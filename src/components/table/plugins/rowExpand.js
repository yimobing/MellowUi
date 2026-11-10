/**
 * MelUi Table 表格组件 - 展开行插件（RowExpand）
 * 点击行首箭头，在该行下方插入一条跨全部列的详情行，内容可由 expandRender 自定义
 * 注意：这是「行详情展开」，不是树形表格：展开区域不是业务数据行，不能再继续嵌套展开
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.1
 * @Date：2026-11-10
 * @PubDate：2026-11-10 11:54:00
 */

 (function(MelUi) {

    /**
     * 展开行插件
     * @param {Object} options 配置
     *   expandSingle: 是否手风琴模式，默认false。false=允许多行同时展开；true=同一时间只能展开一行
     *   expandColWidth: 展开箭头列宽度(px)，默认40
     * 表格根配置：
     *   expandRender(rowData, columnList): 返回展开区域 HTML 字符串。
     *     rowData    本行业务字段副本（未格式化，不含内部字段）
     *     columnList 可见业务列信息数组 [{title, field, value, rawValue}]
     *                value    = 经过列 formatter 格式化后的展示值（与单元格显示同口径）
     *                rawValue = 原始业务值（未格式化）
     *     返回空/纯空白/null/undefined 时，使用内置默认面板（单栏「列名 + 展示值」）
     */
    function RowExpand(options) {
        this.options = this._extend({
            expandSingle: false,
            expandColWidth: 40
        }, options || {});
    }

    RowExpand.prototype = new MelUi.Table.PluginBase();
    RowExpand.prototype.constructor = RowExpand;

    /**
     * 初始化：插入箭头列、接管展开行的 HTML 生成、监听箭头点击
     */
    RowExpand.prototype.init = function(table) {
        this.table = table;
        var self = this;

        // 箭头列作为虚拟列插到列数组最前（最终顺序由 TableCore._normalizeExpandColumn 保证最左）
        table.dataStore.columns.unshift({
            field: '_expand',
            title: '',
            width: this.options.expandColWidth,
            renderer: 'expandArrow',
            align: 'center'
        });

        // 箭头渲染器：直接注册到当前 renderer 的渲染器表上，读取行对象上的 _expanded 标记
        table.renderer._renderers.expandArrow = function(value, col, row) {
            var open = !!(row && row._expanded);
            return '<span class="mel-expand-arrow' + (open ? ' is-open' : '') + '"></span>';
        };

        // 渲染器钩子：每个数据行后追加详情行
        table.renderer.rowExpandBuilder = function(row) {
            return self._buildExpandRowHtml(row);
        };

        // 点箭头只做展开/收起，不再抛 rowClick，避免业务「点行弹详情」被箭头误触发
        table.renderer.rowClickFilter = function(field) {
            return field === '_expand';
        };

        // 箭头点击：走表格已有的单元格事件委托
        table.eventBus.on('cellClick', function(data) {
            if (!data || !data.cell || data.cell.field !== '_expand') return;
            self._toggle(data.rowId);
        });
    };

    /**
     * 切换某行展开状态并重绘表身
     * @param {String} rowId 行标识
     */
    RowExpand.prototype._toggle = function(rowId) {
        var ds = this.table.dataStore;
        var row = ds.getRowById(rowId);
        if (!row) return;

        var expanded = !row._expanded;

        // 手风琴模式：展开新行前，先收起其它行
        if (expanded && this.options.expandSingle) {
            this._clearAllExpanded();
        }

        row._expanded = expanded;

        // 展开行是从表身 HTML 里生成的，状态变化后重绘表身
        this.table.renderer.renderBodyAll();

        // 事件在状态切换完成之后抛，rowData 为纯业务字段副本
        this.table.eventBus.emit('expandChange', {
            rowId: row._rowId,
            rowData: ds.getPlainRow(row),
            expanded: expanded
        });
    };

    /**
     * 收起全部已展开行（不清 DOM，调用方负责重绘）
     */
    RowExpand.prototype._clearAllExpanded = function() {
        var ds = this.table.dataStore;
        var rows = ds.rows;
        for (var i = 0; i < rows.length; i++) {
            rows[i]._expanded = false;
        }
        if (ds._tempAppendRows) {
            for (var t = 0; t < ds._tempAppendRows.length; t++) {
                if (ds._tempAppendRows[t]) ds._tempAppendRows[t]._expanded = false;
            }
        }
    };

    /**
     * 生成展开详情行 HTML（未展开返回空串）
     * @param {Object} row 内部行对象
     * @return {String}
     */
    RowExpand.prototype._buildExpandRowHtml = function(row) {
        if (!row || !row._expanded) return '';

        var content = this._resolveContent(row);
        if (!content) return '';

        // colspan 取实际列总数（含箭头列、复选框列、序号列等所有虚拟列），保证整行通栏
        var colspan = this.table.dataStore.columns.length;

        return '<tr class="mel-row-expand" data-row-expand="1">' +
            '<td colspan="' + colspan + '" class="mel-row-expand-cell">' + content + '</td>' +
            '</tr>';
    };

    /**
     * 解析展开区域内容
     * 规则：配置了 expandRender 且返回值 trim 后非空 → 用用户返回的 HTML；
     *      未配置、返回 null/undefined、返回纯空白 → 回退内置默认面板
     * @param {Object} row 内部行对象
     * @return {String}
     */
    RowExpand.prototype._resolveContent = function(row) {
        var render = this.table.options.expandRender;
        if (typeof render === 'function') {
            // 入参：rowData 业务字段副本 + columnList 可见列信息（value 已过 formatter）
            var ret = render(this.table.dataStore.getPlainRow(row), this._buildColumnList(row));
            if (ret !== null && ret !== undefined && String(ret).replace(/\s/g, '') !== '') {
                return String(ret);
            }
        }
        return this._buildDefaultPanel(row);
    };

    /**
     * 构建可见列信息数组（expandRender 第二个参数、默认面板共用同一套数据）
     * 只含业务可见列：跳过 field 为空、以及下划线开头的内部虚拟列（_expand/_checkbox/_serialNo 等）
     * @param {Object} row 内部行对象
     * @return {Array} [{title, field, value, rawValue}]
     *   title    表头显示名称
     *   field    字段名
     *   value    经过列 formatter 格式化后的展示值（无 formatter 时等于原始值）
     *   rawValue 原始业务值（未格式化，供业务做逻辑判断）
     */
    RowExpand.prototype._buildColumnList = function(row) {
        var columns = this.table.dataStore.columns;
        var plainRow = this.table.dataStore.getPlainRow(row);
        var list = [];

        for (var i = 0; i < columns.length; i++) {
            var col = columns[i];
            if (!col || !col.field) continue;
            if (col.field.charAt(0) === '_') continue; // 内部字段/虚拟列不对外

            var rawValue = row[col.field];
            if (rawValue === undefined) rawValue = '';

            // 展示值走列 formatter（与单元格显示同口径，如 radio 的 1/0 → 是/否）
            var value = rawValue;
            if (typeof col.formatter === 'function') {
                var formatted = col.formatter(rawValue, plainRow);
                value = (formatted === null || formatted === undefined) ? '' : formatted;
            }
            if (value === null) value = '';

            list.push({
                title: col.title || col.field,
                field: col.field,
                value: value,
                rawValue: rawValue
            });
        }

        return list;
    };

    /**
     * 内置默认面板：单栏垂直排列，每项展示「列名(浅色) + 展示值(深色)」
     * 展示值取 columnList 里的 value，与单元格 formatter 同口径
     * @param {Object} row 内部行对象
     * @return {String}
     */
    RowExpand.prototype._buildDefaultPanel = function(row) {
        var list = this._buildColumnList(row);
        var html = '<div class="mel-row-expand-wrapper">';

        if (!list.length) return '';

        for (var i = 0; i < list.length; i++) {
            html += '<div class="mel-row-expand-item">' +
                '<span class="mel-row-expand-label">' + this._escapeHtml(list[i].title) + '</span>' +
                '<span class="mel-row-expand-value">' + this._escapeHtml(String(list[i].value)) + '</span>' +
                '</div>';
        }

        html += '</div>';
        return html;
    };

    /**
     * HTML 转义（默认面板渲染的是数据，必须转义，防止 XSS）
     * @param {String} str 原始文本
     * @return {String}
     */
    RowExpand.prototype._escapeHtml = function(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    /**
     * 销毁：移除虚拟列与渲染器钩子
     */
    RowExpand.prototype.destroy = function() {
        if (!this.table) return;
        var columns = this.table.dataStore ? this.table.dataStore.columns : [];
        for (var i = columns.length - 1; i >= 0; i--) {
            if (columns[i] && columns[i].field === '_expand') {
                columns.splice(i, 1);
            }
        }
        if (this.table.renderer) {
            this.table.renderer.rowExpandBuilder = null;
            this.table.renderer.rowClickFilter = null;
            if (this.table.renderer._renderers) {
                this.table.renderer._renderers.expandArrow = null;
            }
        }
        this.table = null;
    };

    RowExpand.prototype._extend = function(target) {
        var sources = Array.prototype.slice.call(arguments, 1);
        for (var i = 0; i < sources.length; i++) {
            for (var key in sources[i]) {
                if (sources[i].hasOwnProperty(key)) {
                    target[key] = sources[i][key];
                }
            }
        }
        return target;
    };

    MelUi.Table = MelUi.Table || {};
    MelUi.Table.plugins = MelUi.Table.plugins || {};
    MelUi.Table.plugins.RowExpand = RowExpand;

})(window.MelUi = window.MelUi || {});

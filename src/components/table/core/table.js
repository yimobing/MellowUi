/**
 * MelUi Table 表格组件 - 主类
 * 对外暴露的入口类，整合 DataStore / EventBus / Renderer
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.5.1
 * @Date：2026-10-10
 * @PubDate：2026-11-02
 */

 (function(MelUi) {

    /**
     * TableCore 构造函数
     * @param {Object} options 配置项
     */
    function TableCore(options) {
        // 默认配置
        var defaults = {
            el: null, // 表格挂载节点(必填)。传CSS选择器字符串或DOM元素
            columns: [], // 列配置数组(必填)。每项含 field/title/width/renderer/type 等
            data: [], // 表格数据(必填)。对象数组，每项对应一行
            rowHeight: 40, // 行高(可选)。默认40px
            headerHeight: 40, // 表头高度(可选)。默认40px
            fitViewport: true, // 是否垂直适配视口(可选)。true时，bodyHeight、el自定义高度失效，整套表格在视口内展示，即自动占满页面剩余高度且页面不出现垂直滚动条。
            viewportBottomGap: 16, // fitViewport模式下视口底部预留间隙(可选)。仅fitViewport=true生效，单位px，在表格与视口底边之间留出空隙露出body背景色
            bodyHeight: 0, // 表身固定高度(可选)。0表示不限制，由el节点控制。fitViewport=true时本参数无效；fitViewport=false && bodyHeight>0时，会强制el高度为auto!important
            fitWidth: false, // 是否开启列宽自适应(可选)。false 固定列宽模式：使用columns配置的固定px列宽；true 弹性自适应模：以各列width为权重，根据容器宽度弹性分配填满容器
            fixedLeftColumns: 0, // 表格固定几列不动(可选)。值：0 0列, 1 1列
            bordered: true, // 是否显示边框(可选)。true显示边框，false不显示
            stripe: false, // 是否斑马纹(可选)。true交替行背景色
            hoverHighlight: true, // 是否行悬浮高亮(可选)。true鼠标悬停行高亮
            showSelectAll: true, // 多选列表头是否显示全选checkbox(可选)。true显示，false不显示
            plugins: [], // 插件数组(可选)。字符串简写启用+默认配置，或对象{name, ...}启用+自定义配置
            events: {} // 事件配置(可选)。如 onCellClick/onCellChange/onRowClick 等回调
        };

        // 合并配置
        this.options = this._extend({}, defaults, options);

        // 初始化核心模块
        this.eventBus = new MelUi.Table.EventBus();
        this.dataStore = new MelUi.Table.DataStore({
            columns: this.options.columns,
            data: this.options.data
        });
        this.renderer = new MelUi.Table.Renderer(this.options, this.dataStore, this.eventBus);

        // 绑定用户事件
        this._bindUserEvents();

        // 初始化插件
        this._initPlugins();

        // 渲染
        this.renderer.render();
    }

    /**
     * 深度合并对象（简单版，只做第一层）
     */
    TableCore.prototype._extend = function(target) {
        var sources = Array.prototype.slice.call(arguments, 1);
        for (var i = 0; i < sources.length; i++) {
            var src = sources[i];
            for (var key in src) {
                if (src.hasOwnProperty(key)) {
                    target[key] = src[key];
                }
            }
        }
        return target;
    };

    /**
     * 绑定用户配置的事件
     */
    TableCore.prototype._bindUserEvents = function() {
        var events = this.options.events || {};
        var self = this;

        // 建立事件名映射：用户配置的事件名 -> 内部事件名
        var eventMap = {
            onCellClick: 'cellClick',
            onCellChange: 'cellChange',
            onRowClick: 'rowClick',
            onSelectChange: 'selectChange',
            onRowAdd: 'rowAdd',
            onRowDelete: 'rowDelete',
            onSort: 'sort',
            onPageChange: 'pageChange'
        };

        for (var userEvent in eventMap) {
            if (events[userEvent] && typeof events[userEvent] === 'function') {
                (function(eventName, handler) {
                    self.eventBus.on(eventName, function(data) {
                        handler(data);
                    });
                })(eventMap[userEvent], events[userEvent]);
            }
        }
    };

    /**
     * 初始化插件
     */
    TableCore.prototype._initPlugins = function() {
        var plugins = this.options.plugins || [];
        this._pluginInstances = [];

        for (var i = 0; i < plugins.length; i++) {
            var pluginConfig = plugins[i];
            var pluginName = '';
            var pluginOptions = {};

            // 字符串形式：'SerialNo' = 启用 + 默认配置
            if (typeof pluginConfig === 'string') {
                pluginName = pluginConfig;
            }
            // 对象形式：{name: 'Pagination', pageSize: 30} = 启用 + 自定义配置
            else if (typeof pluginConfig === 'object' && pluginConfig.name) {
                pluginName = pluginConfig.name;
                pluginOptions = this._extend({}, pluginConfig);
                delete pluginOptions.name;
            }

            if (!pluginName) continue;

            // 从插件注册表中获取插件类
            var PluginClass = (MelUi.Table.plugins && MelUi.Table.plugins[pluginName]) || null;
            if (!PluginClass) {
                continue;
            }

            // 创建插件实例并初始化
            var plugin = new PluginClass(pluginOptions);
            plugin.init(this);
            this._pluginInstances.push(plugin);
        }
    };

    // ==================== 数据读取 ====================

    /**
     * 获取整表数据
     * @return {Array}
     */
    TableCore.prototype.getData = function() {
        return this.dataStore.rows;
    };

    /**
     * 获取指定行数据
     * @param {Number} rowIndex 行索引
     * @return {Object|null}
     */
    TableCore.prototype.getRowData = function(rowIndex) {
        return this.dataStore.getRow(rowIndex);
    };

    /**
     * 获取选中行数据
     * @return {Array}
     */
    TableCore.prototype.getSelectedData = function() {
        return this.dataStore.getSelectedRows();
    };

    /**
     * 获取有变动的行（新增 + 修改）
     * @return {Array}
     */
    TableCore.prototype.getDirtyData = function() {
        return this.dataStore.getDirtyRows();
    };

    // ==================== 数据写入 ====================

    /**
     * 设置某行某列的值
     * @param {Number} rowIndex 行索引
     * @param {String} field 字段名
     * @param {*} value 新值
     */
    TableCore.prototype.setCellValue = function(rowIndex, field, value) {
        this.dataStore.setCell(rowIndex, field, value);
        this.renderer.renderCell(rowIndex, field);
    };

    /**
     * 批量设置某行多个列的值
     * @param {Number} rowIndex 行索引
     * @param {Object} data {field1: val1, field2: val2}
     */
    TableCore.prototype.setRowData = function(rowIndex, data) {
        for (var field in data) {
            if (data.hasOwnProperty(field)) {
                this.dataStore.setCell(rowIndex, field, data[field]);
            }
        }
        this.renderer.renderRow(rowIndex);
    };

    /**
     * 新增一行
     * @param {Object} data 行数据（可选）
     * @param {String} position 'first' / 'last'
     */
    TableCore.prototype.addRow = function(data, position) {
        var row = this.dataStore.addRow(data, position || 'last');
        this.renderer.renderRow(row._rowIndex);
        this.eventBus.emit('rowAdd', {rowData: row, rowIndex: row._rowIndex});
    };

    /**
     * 删除一行
     * @param {Number} rowIndex 行索引
     */
    TableCore.prototype.deleteRow = function(rowIndex) {
        var row = this.dataStore.getRow(rowIndex);
        this.dataStore.removeRow(rowIndex);

        // 重新渲染表身（删除行后索引变了，简单起见全量重绘）
        this.renderer._renderBody();

        this.eventBus.emit('rowDelete', {rowIndex: rowIndex, rowData: row});
    };

    /**
     * 清空所有数据
     */
    TableCore.prototype.clearData = function() {
        this.dataStore.clearRows();
        this.renderer._renderBody();
    };

    // ==================== 状态操作 ====================

    /**
     * 标记行为已保存
     * @param {Number|String} rowIndex 行索引，传 'all' 表示全部
     */
    TableCore.prototype.markSaved = function(rowIndex) {
        this.dataStore.markSaved(rowIndex);
    };

    /**
     * 设置某行某列为只读/可写
     * @param {Number} rowIndex 行索引
     * @param {String} field 字段名
     * @param {Boolean} readonly 是否只读
     */
    TableCore.prototype.setCellReadonly = function(rowIndex, field, readonly) {
        var row = this.dataStore.getRow(rowIndex);
        if (!row || !row._node) return;

        var td = row._node.querySelector('td[data-field="' + field + '"]');
        if (!td) return;

        var input = td.querySelector('input, textarea');
        if (input) {
            if (readonly) {
                input.setAttribute('readonly', 'readonly');
            } else {
                input.removeAttribute('readonly');
            }
        }
    };

    /**
     * 全选
     */
    TableCore.prototype.selectAll = function() {
        this.dataStore.selectAll(true);
        this._refreshSelectedRows();
        this.eventBus.emit('selectChange', {selectedRows: this.dataStore.getSelectedRows()});
    };

    /**
     * 全不选
     */
    TableCore.prototype.selectNone = function() {
        this.dataStore.selectAll(false);
        this._refreshSelectedRows();
        this.eventBus.emit('selectChange', {selectedRows: []});
    };

    /**
     * 反选
     */
    TableCore.prototype.invertSelect = function() {
        this.dataStore.invertSelect();
        this._refreshSelectedRows();
        this.eventBus.emit('selectChange', {selectedRows: this.dataStore.getSelectedRows()});
    };

    /**
     * 刷新选中行的 DOM 状态（内部用）
     */
    TableCore.prototype._refreshSelectedRows = function() {
        var rows = this.dataStore.rows;
        for (var i = 0; i < rows.length; i++) {
            if (rows[i]._node) {
                var checkbox = rows[i]._node.querySelector('.mel-cell-checkbox');
                if (checkbox) {
                    checkbox.checked = rows[i]._selected;
                }
            }
        }
    };

    // ==================== 校验 ====================

    /**
     * 校验指定行必填项
     * @param {Number|String} rowIndex 行索引，传 'all' 校验全部
     * @return {String} 错误提示，空字符串表示通过
     */
    TableCore.prototype.validate = function(rowIndex) {
        var columns = this.dataStore.columns;
        var rows = this.dataStore.rows;
        var tips = '';

        var checkRow = function(rowIdx) {
            var row = rows[rowIdx];
            for (var i = 0; i < columns.length; i++) {
                var col = columns[i];
                if (!col.required) continue;

                var value = row[col.field];
                if (value === undefined || value === null || value === '') {
                    tips += '第' + (rowIdx + 1) + '行【' + col.title + '】不能为空\n';
                }
            }
        };

        if (rowIndex === 'all') {
            for (var i = 0; i < rows.length; i++) {
                checkRow(i);
            }
        } else {
            checkRow(rowIndex);
        }

        return tips;
    };

    /**
     * 校验唯一值列
     * @return {String} 错误提示，空字符串表示通过
     */
    TableCore.prototype.validateUnique = function() {
        var columns = this.dataStore.columns;
        var rows = this.dataStore.rows;
        var tips = '';

        for (var i = 0; i < columns.length; i++) {
            var col = columns[i];
            if (!col.unique) continue;

            var seen = {};
            for (var j = 0; j < rows.length; j++) {
                var val = rows[j][col.field];
                if (val === undefined || val === '') continue;

                if (seen[val]) {
                    tips += '【' + col.title + '】值 "' + val + '" 重复了\n';
                } else {
                    seen[val] = true;
                }
            }
        }

        return tips;
    };

    // ==================== 渲染控制 ====================

    /**
     * 全量重绘
     */
    TableCore.prototype.render = function() {
        this.renderer.render();
    };

    /**
     * 只重绘某行
     * @param {Number} rowIndex 行索引
     */
    TableCore.prototype.renderRow = function(rowIndex) {
        this.renderer.renderRow(rowIndex);
    };

    /**
     * 只重绘某格
     * @param {Number} rowIndex 行索引
     * @param {String} field 字段名
     */
    TableCore.prototype.renderCell = function(rowIndex, field) {
        this.renderer.renderCell(rowIndex, field);
    };

    // ==================== 事件绑定 ====================

    /**
     * 绑定事件
     * @param {String} eventName 事件名
     * @param {Function} handler 回调
     */
    TableCore.prototype.on = function(eventName, handler) {
        this.eventBus.on(eventName, handler);
    };

    /**
     * 解绑事件
     * @param {String} eventName 事件名
     * @param {Function} handler 回调
     */
    TableCore.prototype.off = function(eventName, handler) {
        this.eventBus.off(eventName, handler);
    };

    // ==================== 销毁 ====================

    /**
     * 销毁表格(可选)
     * 清理window.resize、表身scroll事件监听，恢复body样式，销毁插件，清空容器DOM。
     * 【重要】SPA路由切换、弹窗关闭、容器复用重新new实例场景必须手动调用；整页刷新无需调用。
     * 重复调用不会报错。
     */
    TableCore.prototype.destroy = function() {
        if (this._isDestroyed) return;
        this._isDestroyed = true;

        // 销毁插件
        if (this._pluginInstances) {
            for (var i = 0; i < this._pluginInstances.length; i++) {
                if (this._pluginInstances[i].destroy) {
                    this._pluginInstances[i].destroy();
                }
            }
        }

        // renderer统一清理：移除resize/scroll监听、恢复body样式、清空容器DOM
        if (this.renderer && this.renderer._destroy) {
            this.renderer._destroy();
        }
    };

    // 暴露到命名空间
    MelUi.Table = MelUi.Table || {};
    MelUi.Table.Core = TableCore;
    MelUi.Table.plugins = MelUi.Table.plugins || {};

})(window.MelUi = window.MelUi || {});

/**
 * MelUi Table 表格组件 - 主类
 * 对外暴露的入口类，整合 DataStore / EventBus / Renderer
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.7.5
 * @Date：2026-10-10
 * @PubDate：2026-11-05 10:07:38
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

            // ·外观
            fixedLeftColumns: 0, // 表格固定几列不动(可选)。值：0 0列, 1 1列
            rowHeight: 40, // 行高(可选)。默认40px
            headerHeight: 'auto', // 表头高度(可选)。默认'auto'由内容自动撑开；传入数值时表头使用指定高度
            bordered: true, // 是否显示边框(可选)。true显示边框，false不显示
            stripe: false, // 是否隔行变色斑马纹(可选)。true交替行背景色
            hoverHighlight: true, // 是否行悬浮高亮(可选)。true鼠标悬停行高亮
            showSelectAll: true, // 选择列是否显示全选复选框(可选)。true显示，false不显示

            // ·布局大小
            fitViewport: true, // 是否垂直适配视口(可选)。true时，bodyHeight、el自定义高度失效，整套表格在视口内展示，即自动占满页面剩余高度且页面不出现垂直滚动条。
            viewportBottomGap: 16, // fitViewport模式下视口底部预留间隙(可选)。仅fitViewport=true生效，单位px，在表格与视口底边之间留出空隙露出body背景色
            bodyHeight: 0, // 表身固定高度(可选)。0表示不限制，由el节点控制。fitViewport=true时本参数无效；fitViewport=false && bodyHeight>0时，会强制el高度为auto!important
            fitWidth: false, // 是否开启列宽自适应(可选)。false 固定列宽模式：使用columns配置的固定px列宽；true 弹性自适应模：当所有列宽总和小于等于容器宽度时，以各列width为权重弹性拉伸填满容器；当列宽总和大于容器宽度时，不拉伸，使用各列原始width并出现横向滚动条

            // ·分页
            remotePaging: false, // 是否后端远程分页(可选)。值：false=前端本地分页(默认)，一次性传全部data组件内部切片；true=后端远程分页，点击分页触发onPageChange(page,pageSize)，由外部请求后端并setData回填
            total: 0, // 总记录数(可选)。仅remotePaging=true时生效，由外部传入总条数，组件据此渲染分页UI
            enableRemotePagingFallback: true,
            // 是否兜底后端远程分页，默认true表示启用(可选)。
            // 说明：仅 remotePaging=true 生效。
            // 当后端返回 total=0 或者 total < 当前返回列表条数，本参数值为true时则组件自动降级，使用当前这批数据前端本地分页；
            // 值为false时关闭则严格信任后端返回的total，不会自动切换成前端本地分页。
            // 注意：标准分页接口时设置本参数值为false；接口本身不支持一次性返回总记录数时，设置为true。

            // 以下仅 remotePaging = false 时有效
            addRowMode: 'currentPage', // 新增行插入位置(可选)。值：'currentPage'=插入当前页数据集合(默认)，配合addRow的position控制当前页首/尾；'global'=插入全局原始数据数组首/尾。注：remotePaging=true时本参数无效(自动降级为global)

            // ·插件及事件
            plugins: [], // 插件数组(可选)。字符串简写启用+默认配置，或对象{name, ...}启用+自定义配置
            events: {} // 事件配置(可选)。如 onCellClick/onCellChange/onRowClick 等回调
        };

        // 合并配置
        this.options = this._extend({}, defaults, options);

        // 初始化核心模块
        this.eventBus = new MelUi.Table.EventBus();
        this.dataStore = new MelUi.Table.DataStore({
            columns: this.options.columns,
            data: this.options.data,
            remotePaging: this.options.remotePaging,
            total: this.options.total,
            addRowMode: this.options.addRowMode,
            enableRemotePagingFallback: this.options.enableRemotePagingFallback
        });
        this.renderer = new MelUi.Table.Renderer(this.options, this.dataStore, this.eventBus);

        // 挂载降级兜底状态到表格实例，供业务在 onPageChange 等回调中判断：
        // true = 当前处于降级兜底分页（无需请求后端，组件内部前端切片）；
        // false = 标准远程/本地分页（按原逻辑请求后端）。
        this.isFallbackPaging = this.dataStore.isFallbackPaging();

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
            onDeleteRow: 'rowDelete', // deleteRow方法删除成功后抛出的回调事件
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
     * 插入位置由 addRowMode 决定：
     *   - currentPage（默认）：插入当前页数据集合；配合 position 控制当前页首/尾
     *   - global：插入全局原始 data 数组首/尾
     */
    TableCore.prototype.addRow = function(data, position) {
        var row = null;
        if (this.options.addRowMode === 'global') {
            // 全局模式：直接操作原始数据数组
            row = this.dataStore.addRow(data, position || 'last');
        } else {
            // currentPage 模式：插入当前页数据集合对应的全局数组区间
            row = this.dataStore.addRowToCurrentPage(data, position || 'last');
        }

        this.renderer.renderBodyAll();
        this.eventBus.emit('rowAdd', {rowData: row, rowIndex: row._rowIndex});

        // 新增行交互优化：
        //   1. 聚焦新增行第一个可输入控件（input/textarea），让光标落到新增行上，更醒目；
        //   2. 滚动定位：让用户能立刻看到新增行。
        // 注意：必须先 focus 再滚动——滚动会触发浏览器重排，若先滚动后 focus，部分浏览器
        //   在滚动布局刷新时会冲掉刚设置的焦点。整个流程包进 setTimeout 放到后续渲染队列，
        //   确保 DOM 已完成布局、编辑控件已挂载，focus 不被静默忽略。
        // 延时取 30ms（约两帧）：给单元格编辑态控件完成渲染挂载的时间，Chrome/IE9 均可用。
        var self = this;
        var addPosition = position || 'last';
        setTimeout(function() {
            self._focusNewRow(row);
            self._scrollToNewRow(addPosition);
        }, 30);
    };

    /**
     * 新增行后滚动容器定位
     * 滚动规则分两类：
     *   - remotePaging=true 或 addRowMode='currentPage'：草稿/临时行只作用当前视图，
     *     新增到最前→滚到顶部；新增到最后→滚到底部（不管当前页码，始终让新增行可见）。
     *   - remotePaging=false 且 addRowMode='global'：新增行是正式插入全局数组，
     *     只有新增结果落在当前可见页时才滚动，避免打扰用户正在浏览的其他页：
     *       position='first' 且当前在第1页 → 滚到顶部
     *       position='last' 且当前在最后一页 → 滚到底部
     *       其他页码 → 不滚动
     * @param {String} position 'first' 滚到顶部 / 'last' 滚到底部
     */
    TableCore.prototype._scrollToNewRow = function(position) {
        var bodyWrapper = this.renderer.bodyWrapper;
        if (!bodyWrapper) return;

        var ds = this.dataStore;
        var scrollTop = -1; // -1 表示不滚动

        if (ds.remotePaging || this.options.addRowMode === 'currentPage') {
            // 远程 / currentPage：始终滚动到新增位置
            if (position === 'first') {
                scrollTop = 0;
            } else {
                scrollTop = bodyWrapper.scrollHeight || 0;
            }
        } else {
            // 本地 + global：仅当新增结果落在当前可见页才滚动
            var totalPages = ds.getTotalPages();
            if (position === 'first' && ds.currentPage === 1) {
                scrollTop = 0;
            } else if (position === 'last' && ds.currentPage === totalPages) {
                scrollTop = bodyWrapper.scrollHeight || 0;
            }
            // 其他情况保持 scrollTop = -1，不滚动
        }

        if (scrollTop >= 0) {
            bodyWrapper.scrollTop = scrollTop;
        }
    };

    /**
     * 聚焦新增行第一个可输入控件（input/textarea）
     * 只找本次新增行内部的第一个可编辑输入框；
     * 过滤规则：
     *   1. 跳过 readonly/disabled（不可输入，聚焦无意义）；
     *   2. 只允许 textarea，以及 input 的 text / password 类型；
     *      checkbox / radio / button / hidden / number / date 等其它 input 类型一律跳过
     *      （这类控件虽可获得焦点，但不是业务要录入文本的输入框，聚焦上去看不到光标，等同聚焦失效）。
     * 找不到可输入控件时静默跳过，不影响新增流程。
     * @param {Object} row 新增行对象
     */
    TableCore.prototype._focusNewRow = function(row) {
        if (!row || !row._node) return;
        var nodes = row._node.querySelectorAll('input, textarea');
        for (var i = 0; i < nodes.length; i++) {
            var editable = nodes[i];
            var tag_name = editable.tagName.toLocaleLowerCase();
            var type = (editable.type || '').toLocaleLowerCase();

            // 跳过只读/禁用输入框（不可输入，聚焦无意义）
            if (editable.disabled || editable.readOnly) continue;

            // 只允许 textarea / input:text / input:password，其余类型（checkbox/radio/button/hidden 等）跳过
            if (!(tag_name === 'textarea' || (tag_name === 'input' && (type === 'text' || type === 'password')))) continue;

            editable.focus();
            return;
        }
    };

    /**
     * 删除一行
     * @param {Number} rowIndex 行索引
     */
    TableCore.prototype.deleteRow = function(rowIndex) {
        var row = this.dataStore.getRow(rowIndex);
        if (!row) return;
        this.dataStore.removeRow(rowIndex);

        // 重新渲染表身（删除行后索引变了，简单起见全量重绘）
        this.renderer.renderBodyAll();

        this.eventBus.emit('rowDelete', {rowIndex: rowIndex, rowData: row});
    };

    /**
     * 清空所有数据
     */
    TableCore.prototype.clearData = function() {
        this.dataStore.clearRows();
        this.renderer.renderBodyAll();
    };

    /**
     * 设置表格数据（远程分页回填用，也支持普通全量替换）
     * 远程分页时：每次切换页码后，把后端返回的当页数据传入这里回填。
     * @param {Array} data 行数据数组
     */
    TableCore.prototype.setData = function(data) {
        this.dataStore.setRows(data);
        // 数据替换可能改变降级兜底状态（rows 数量变化影响 isFallbackPaging 判定），重新同步
        this.isFallbackPaging = this.dataStore.isFallbackPaging();
        this.renderer.render();
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
     * 单选模式：静默忽略（不console.warn，兼容IE）
     */
    TableCore.prototype.selectAll = function() {
        if (this.dataStore.selectMode === 'single') return;

        this.dataStore.selectAll(true);
        this._refreshSelectedRows();
        this.eventBus.emit('selectChange', {selectedRows: this.dataStore.getSelectedRows()});
    };

    /**
     * 全不选
     * 单选模式：静默忽略（不console.warn，兼容IE）
     */
    TableCore.prototype.selectNone = function() {
        if (this.dataStore.selectMode === 'single') return;

        this.dataStore.selectAll(false);
        this._refreshSelectedRows();
        this.eventBus.emit('selectChange', {selectedRows: []});
    };

    /**
     * 反选
     * 单选模式：静默忽略（不console.warn，兼容IE）
     */
    TableCore.prototype.invertSelect = function() {
        if (this.dataStore.selectMode === 'single') return;

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

    /**
     * 按行索引设置选中行
     * 单选模式：传入多条时静默只取第一条（不console.warn，兼容IE）
     * @param {Array} rowIndexes 行索引数组
     */
    TableCore.prototype.setSelectedKeys = function(rowIndexes) {
        var keys = rowIndexes || [];
        if (!keys.length) {
            this.dataStore.clearSelection();
            this._refreshSelectedRows();
            this.eventBus.emit('selectChange', {selectedRows: this.dataStore.getSelectedRows()});
            return;
        }

        // 单选模式：只取第一条
        if (this.dataStore.selectMode === 'single') {
            keys = [keys[0]];
        }

        this.dataStore.clearSelection();
        for (var i = 0; i < keys.length; i++) {
            this.dataStore.setRowSelected(keys[i], true);
        }
        this._refreshSelectedRows();
        this.eventBus.emit('selectChange', {selectedRows: this.dataStore.getSelectedRows()});
    };

    /**
     * 清空选中（单选/多选都适用）
     */
    TableCore.prototype.clearSelection = function() {
        this.dataStore.clearSelection();
        this._refreshSelectedRows();
        this.eventBus.emit('selectChange', {selectedRows: []});
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

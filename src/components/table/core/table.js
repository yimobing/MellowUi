/**
 * MelUi Table 表格组件 - 主类
 * 对外暴露的入口类，整合 DataStore / EventBus / Renderer
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.10.0
 * @Date：2026-10-10
 * @PubDate：2026-11-12 16:50:19
 */

 (function(MelUi) {

    /**
     * 已销毁实例调用API时的告警开关
     * true：打印 console.warn，开发期便于发现"拿旧实例继续操作"的误用；
     * false：静默（生产环境如需零日志可改为false）。
     * 仅影响提示日志，不影响守卫本身：无论开关如何，已销毁实例的调用一律被忽略。
     */
    var DESTROYED_WARN = true;

    /**
     * TableCore 构造函数
     * @param {Object} options 配置项
     */
    function TableCore(options) {
        // 销毁状态标记。destroy() 置true后，所有对外API入口据此短路，
        // 防止业务代码/异步回调继续操作已经释放DOM、已经清空数据源的实例。
        this._isDestroyed = false;

        // 默认配置
        var defaults = {
            el: null, // 表格挂载节点(必填)。传CSS选择器字符串或DOM元素
            columns: [], // 列配置数组(必填)。每项含 field/title/width/renderer/type 等
            data: [], // 表格数据(必填)。对象数组，每项对应一行

            // ·外观
            fixedLeftColumns: 0, // 表格固定几列不动(可选)。值：0 0列, 1 1列
            rowHeight: 40, // 行高(可选)。默认40px
            headerHeight: 'auto', // 表头高度(可选)。默认'auto'由内容自动撑开；传入数值时表头使用指定高度
            bordered: false, // 是否显示边框(可选)。true=完整边框(外框+单元格横竖分隔线)；false=无外框、无单元格竖线，仅保留横向分隔线
            headBgEnable: false, // 是否启用表头背景色(可选)。true启用，false表头透明
            headBgColor: '', // 表头背景色(可选)。仅在headBgEnable=true时生效；留空则使用内置默认色#f5f7fa
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
            plugins: [], // 插件数组(可选)。'SerialNo'=字符串简写启用+默认配置；{name:'Pagination',pageSize:30}=对象形式；['RowExpand',{expandSingle:false}]=数组形式，第一项插件名、第二项配置
            events: {}, // 事件配置(可选)。如 onCellClick/onCellChange/onRowClick 等回调

            // ·表格上下额外区块
            extraBefore: '', // 表格上方额外内容(可选)。String 直接作为html渲染；Function 以表格实例为参数，返回html字符串。取值或返回值为空则不渲染该区块
            extraAfter: '' // 表格下方额外内容(可选)。用法同 extraBefore
        };

        // 合并配置
        this.options = this._extend({}, defaults, options);

        // 多级表头支持：columns 允许用 children 描述分组表头（树形）。
        // 数据源只认叶子列，必须在创建 DataStore 之前把树拍平成叶子列，
        // 否则列宽汇总、colgroup、行渲染、字段取值、固定列都会把分组节点当成一列而错位。
        // 表头树单独保留在 _columnTree，供 HeaderMerge 插件渲染多行表头使用；不改动用户传入的配置对象。
        this._columnTree = this.options.columns || [];
        this.options.columns = this._flattenColumns(this._columnTree);

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
        this.renderer = new MelUi.Table.Renderer(this.options, this.dataStore, this.eventBus, this);

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
     * 把 columns 树拍平成叶子列数组
     * - 叶子列 = 没有 children 的列（带 field，参与列宽、渲染、取值）；
     * - 普通扁平 columns 原样返回（同一个数组引用，不做无谓拷贝，零开销）；
     * - 分组节点（含 children）不进入返回值，仅用于表头渲染。
     * @param {Array} columns 列配置（可含 children 分组）
     * @return {Array} 叶子列数组
     */
    TableCore.prototype._flattenColumns = function(columns) {
        if (!columns || !columns.length) return columns || [];

        // 先探测是否存在分组，没有分组直接原样返回，保证原有行为完全不变
        var hasGroup = false;
        for (var i = 0; i < columns.length; i++) {
            if (columns[i] && columns[i].children && columns[i].children.length) {
                hasGroup = true;
                break;
            }
        }
        if (!hasGroup) return columns;

        var leaves = [];
        var walk = function(list) {
            for (var j = 0; j < list.length; j++) {
                var col = list[j];
                if (!col) continue;
                if (col.children && col.children.length) {
                    walk(col.children);
                } else {
                    leaves.push(col);
                }
            }
        };
        walk(columns);
        return leaves;
    };

    /**
     * 只读销毁状态：true=实例已销毁，不可再调用表格API
     * 只暴露 getter，业务只能读不能改，避免外部篡改内部标记导致守卫失效
     */
    Object.defineProperty(TableCore.prototype, 'isDestroyed', {
        get: function() {
            return this._isDestroyed;
        },
        enumerable: true
    });

    /**
     * 销毁守卫（内部用）：实例已销毁返回 true，调用方应立即 return
     * 统一入口的好处：所有API短路口径一致，不会出现"有的方法拦、有的方法漏拦"
     * @param {String} methodName 方法名，仅用于告警日志定位
     * @return {Boolean} true=已销毁，跳过执行；false=正常执行
     */
    TableCore.prototype._guardDestroyed = function(methodName) {
        if (!this._isDestroyed) return false;
        if (DESTROYED_WARN && window.console && console.warn) {
            console.warn('[MelUi.Table] 实例已销毁，' + methodName + ' 调用被忽略');
        }
        return true;
    };

    /**
     * 绑定用户配置的事件
     */
    TableCore.prototype._bindUserEvents = function() {
        var events = this.options.events || {};
        var self = this;

        // 建立事件名映射：用户配置的事件名 -> 内部事件名
        var eventMap = {
            onRendered: 'rendered',
            onCellClick: 'cellClick',
            onCellChange: 'cellChange',
            onRowClick: 'rowClick',
            onSelectChange: 'selectChange',
            onRowAdd: 'rowAdd',
            onRowDelete: 'rowDelete',
            onDeleteRow: 'rowDelete', // deleteRow方法删除成功后抛出的回调事件
            onSort: 'sortChange',
            onPageChange: 'pageChange',
            onGroupHeaderClick: 'groupHeaderClick', // 合并表头时点击分组表头（父级 th）触发
            onExpandChange: 'expandChange' // 展开行插件：展开/收起切换完成后触发
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
            // 数组形式：['RowExpand', {expandSingle: false}] = 第一项插件名 + 第二项配置
            else if (Object.prototype.toString.call(pluginConfig) === '[object Array]') {
                pluginName = pluginConfig[0] || '';
                pluginOptions = this._extend({}, pluginConfig[1] || {});
            }

            if (!pluginName) continue;

            // 从插件注册表中获取插件类
            var PluginClass = (MelUi.Table.plugins && MelUi.Table.plugins[pluginName]) || null;
            if (!PluginClass) {
                continue;
            }

            // 创建插件实例并初始化
            var plugin = new PluginClass(pluginOptions);
            // 记下注册名：业务侧 table.getPlugin('Export') 靠它匹配，
            // 不依赖 instanceof / 私有数组下标，插件改名也不会错配
            plugin._pluginName = pluginName;
            plugin.init(this);
            this._pluginInstances.push(plugin);
        }

        // 插件列顺序归一：各插件都在 init 里 unshift 自己的虚拟列，
        // 谁最后 init 谁最靠前，实际顺序会随 plugins 配置顺序漂移。
        // 展开行箭头列在交互上必须固定最左（展开箭头 → 复选框 → 序号 → 业务列），
        // 这里统一把它挪到列数组首位，与插件配置顺序无关。
        this._normalizeExpandColumn();
    };

    /**
     * 把展开行插件的虚拟箭头列(_expand)移到列数组最前面
     * 没有启用 RowExpand 插件时不做任何事
     */
    TableCore.prototype._normalizeExpandColumn = function() {
        var columns = this.dataStore.columns;
        var idx = -1;
        for (var i = 0; i < columns.length; i++) {
            if (columns[i] && columns[i].field === '_expand') {
                idx = i;
                break;
            }
        }
        if (idx <= 0) return;
        var col = columns.splice(idx, 1)[0];
        columns.unshift(col);
    };

    // ==================== 数据读取 ====================

    /**
     * 获取整表数据
     * @return {Array}
     */
    TableCore.prototype.getData = function() {
        if (this._guardDestroyed('getData')) return [];
        return this.dataStore.rows;
    };

    /**
     * 获取指定行数据
     * @param {Number} rowIndex 行索引
     * @return {Object|null}
     */
    TableCore.prototype.getRowData = function(rowIndex) {
        if (this._guardDestroyed('getRowData')) return null;
        return this.dataStore.getRow(rowIndex);
    };

    /**
     * 按 rowId 获取行数据
     * rowId 来自单行类事件参数（rowClick / cellClick / cellChange / selectChange / rowAdd / rowDelete / expandChange）
     * @param {String} rowId 行标识
     * @return {Object|null} 内部原始行对象（含内部字段，可直接改值但不会触发重绘）；找不到返回 null
     * 注意：rowId 是前端运行期临时标识，分页/排序不变，行删除后失效，禁止存入后端。
     */
    TableCore.prototype.getRowById = function(rowId) {
        if (this._guardDestroyed('getRowById')) return null;
        return this.dataStore.getRowById(rowId);
    };

    /**
     * 获取选中行数据
     * @return {Array}
     */
    TableCore.prototype.getSelectedData = function() {
        if (this._guardDestroyed('getSelectedData')) return [];
        return this.dataStore.getSelectedRows();
    };

    /**
     * 获取有变动的行（新增 + 修改）
     * @return {Array}
     */
    TableCore.prototype.getDirtyData = function() {
        if (this._guardDestroyed('getDirtyData')) return [];
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
        if (this._guardDestroyed('setCellValue')) return;
        this.dataStore.setCell(rowIndex, field, value);
        this.renderer.renderCell(rowIndex, field);
    };

    /**
     * 批量设置某行多个列的值
     * @param {Number} rowIndex 行索引
     * @param {Object} data {field1: val1, field2: val2}
     */
    TableCore.prototype.setRowData = function(rowIndex, data) {
        if (this._guardDestroyed('setRowData')) return;
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
        if (this._guardDestroyed('addRow')) return null;
        var row = null;
        if (this.options.addRowMode === 'global') {
            // 全局模式：直接操作原始数据数组
            row = this.dataStore.addRow(data, position || 'last');
        } else {
            // currentPage 模式：插入当前页数据集合对应的全局数组区间
            row = this.dataStore.addRowToCurrentPage(data, position || 'last');
        }

        this.renderer.renderBodyAll();
        this.eventBus.emit('rowAdd', {
            rowId: row._rowId,
            rowData: this.dataStore.getPlainRow(row),
            rowIndex: row._rowIndex
        });

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
        if (this._guardDestroyed('deleteRow')) return;
        var row = this.dataStore.getRow(rowIndex);
        if (!row) return;
        this.dataStore.removeRow(rowIndex);

        // 重新渲染表身（删除行后索引变了，简单起见全量重绘）
        this.renderer.renderBodyAll();

        this.eventBus.emit('rowDelete', {
            rowId: row._rowId,
            rowData: this.dataStore.getPlainRow(row),
            rowIndex: rowIndex
        });
    };

    /**
     * 清空所有数据
     */
    TableCore.prototype.clearData = function() {
        if (this._guardDestroyed('clearData')) return;
        this.dataStore.clearRows();
        this.renderer.renderBodyAll();
    };

    /**
     * 设置表格数据（远程分页回填用，也支持普通全量替换）
     * 远程分页时：每次切换页码后，把后端返回的当页数据传入这里回填。
     * @param {Array} data 行数据数组
     */
    TableCore.prototype.setData = function(data) {
        if (this._guardDestroyed('setData')) return;
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
        if (this._guardDestroyed('markSaved')) return;
        this.dataStore.markSaved(rowIndex);
    };

    /**
     * 设置某行某列为只读/可写
     * @param {Number} rowIndex 行索引
     * @param {String} field 字段名
     * @param {Boolean} readonly 是否只读
     */
    TableCore.prototype.setCellReadonly = function(rowIndex, field, readonly) {
        if (this._guardDestroyed('setCellReadonly')) return;
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
     * 设置列显隐（只影响界面显示，不删除列）
     * 与“columns 里不配置该列”的区别：列配置、列数据、格式化规则全部保留，
     * 表头/单元格 DOM 也照常渲染（F12 可见），只是 display:none 不占可见宽度，
     * 导出时可用 includeHiddenColumns 把这些隐藏列一起带出去，需要时还能再显示回来。
     * @param {String} field 列字段名
     * @param {Boolean} visible true=显示 / false=隐藏（不传或传非 false 视为显示）
     * @param {Boolean} skipRender 是否跳过重绘（可选）。批量切换多列时传 true，最后统一调 render()
     */
    TableCore.prototype.setColumnVisible = function(field, visible, skipRender) {
        if (this._guardDestroyed('setColumnVisible')) return;
        if (!field) return;

        var columns = this.dataStore.columns || [];
        var target = null;
        for (var i = 0; i < columns.length; i++) {
            if (columns[i] && columns[i].field === field) {
                target = columns[i];
                break;
            }
        }
        if (!target) return;

        target.visible = (visible !== false);

        // 列显隐影响：列宽总和、colgroup 列宽、表头与表身单元格、固定列平移，必须整体重绘
        if (skipRender) return;
        this.renderer.render();
    };

    /**
     * 全选
     * 单选模式：静默忽略（不console.warn，兼容IE）
     */
    TableCore.prototype.selectAll = function() {
        if (this._guardDestroyed('selectAll')) return;
        if (this.dataStore.selectMode === 'single') return;

        this.dataStore.selectAll(true);
        this._refreshSelectedRows();
        this.eventBus.emit('selectChange', {
            selectedRows: this.dataStore.getPlainRows(this.dataStore.getSelectedRows())
        });
    };

    /**
     * 全不选
     * 单选模式：静默忽略（不console.warn，兼容IE）
     */
    TableCore.prototype.selectNone = function() {
        if (this._guardDestroyed('selectNone')) return;
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
        if (this._guardDestroyed('invertSelect')) return;
        if (this.dataStore.selectMode === 'single') return;

        this.dataStore.invertSelect();
        this._refreshSelectedRows();
        this.eventBus.emit('selectChange', {
            selectedRows: this.dataStore.getPlainRows(this.dataStore.getSelectedRows())
        });
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
        if (this._guardDestroyed('setSelectedKeys')) return;
        var keys = rowIndexes || [];
        if (!keys.length) {
            this.dataStore.clearSelection();
            this._refreshSelectedRows();
            this.eventBus.emit('selectChange', {
            selectedRows: this.dataStore.getPlainRows(this.dataStore.getSelectedRows())
        });
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
        this.eventBus.emit('selectChange', {
            selectedRows: this.dataStore.getPlainRows(this.dataStore.getSelectedRows())
        });
    };

    /**
     * 清空选中（单选/多选都适用）
     */
    TableCore.prototype.clearSelection = function() {
        if (this._guardDestroyed('clearSelection')) return;
        this.dataStore.clearSelection();
        this._refreshSelectedRows();
        this.eventBus.emit('selectChange', {selectedRows: []});
    };

    // ==================== 校验 ====================

    /**
     * 判断值是否“空”（必填判空统一口径）
     * 纯空格 / 全角空格都算空；数字 0 不算空
     * @param {Any} value 单元格值
     * @return {Boolean}
     */
    TableCore.prototype._isBlankValue = function(value) {
        if (value === undefined || value === null) return true;
        return String(value).replace(/\s+/g, '') === '';
    };

    /**
     * 取该行在界面上显示的行号（即「序号」列的值）
     * 优先用 SerialNo 插件写入 row._serialNo（用户眼睛看到的就是这个数），
     * 没有则退回行对象全局下标 +1，保证提示文案里永远有个号
     * @param {Object} row 行数据
     * @param {Number} fallbackIndex 兜底下标（rows 下标）
     * @return {String}
     */
    TableCore.prototype._getRowNo = function(row, fallbackIndex) {
        if (row && row._serialNo !== undefined && row._serialNo !== null && String(row._serialNo) !== '') {
            return String(row._serialNo);
        }
        var idx = (row && row._rowIndex !== undefined && row._rowIndex !== null) ? row._rowIndex : fallbackIndex;
        if (idx === undefined || idx === null) idx = 0;
        return String(idx + 1);
    };

    /**
     * 由错误明细组装校验返回结构
     * - errors：给机器看，一条 = 一个单元格（定位 / 聚焦 / 标红）
     * - briefs：给人看，一条 = 同一列同类错误的聚合文案（一次弹窗展示）
     * - message：第一条错误的成品文案（逐条引导直接用）
     * @param {Array} errors 错误明细
     * @return {Object}
     */
    TableCore.prototype._buildValidateResult = function(errors) {
        var briefs = [];
        var map = {};

        // 聚合：同一列 + 同一错误类型（validator 再加原始文案）合并成一句
        for (var i = 0; i < errors.length; i++) {
            var e = errors[i];
            var key = e.field + '|' + e.reason + '|' + (e.reason === 'validator' ? e.raw : '');
            var g = map[key];
            if (!g) {
                g = {
                    field: e.field,
                    title: e.title,
                    reason: e.reason,
                    raw: e.reason === 'validator' ? e.raw : '',
                    rows: [],
                    rowNos: [],
                    count: 0,
                    message: ''
                };
                map[key] = g;
                briefs.push(g);
            }
            g.rows.push(e.rowIndex);
            g.rowNos.push(e.rowNo);
            g.count = g.rows.length;
        }

        // 生成聚合文案
        for (var j = 0; j < briefs.length; j++) {
            var b = briefs[j];
            var prefix = b.title ? '【' + b.title + '】' : '';
            if (b.reason === 'required') {
                b.message = prefix + '第 ' + b.rowNos.join('、') + ' 行不能为空';
            } else {
                b.message = prefix + '第 ' + b.rowNos.join('、') + ' 行' + b.raw;
            }
        }

        // 顶层平铺字段：只代表【第一条】错误，便于业务一句话定位
        //   table.focusCell(result.rowIndex, result.field)
        // 全量明细仍然看 errors；全部通过时 rowIndex = -1，其余为空串
        var first = errors.length ? errors[0] : null;
        return {
            passed: errors.length === 0,
            message: first ? first.message : '',
            rowIndex: first ? first.rowIndex : -1,
            rowNo: first ? first.rowNo : '',
            field: first ? first.field : '',
            title: first ? first.title : '',
            errors: errors,
            briefs: briefs
        };
    };

    /**
     * 校验（必填 required + 列级 validator）
     * 注意：隐藏列（列配置 visible:false）不参与校验——用户看不见也就改不了，
     *       报出错误只会产生一条指向无法操作单元格的提示。需要校验隐藏数据请在提交前自行核对。
     * @param {Number|String} rowIndex 行索引（0-based）；传 'all' 校验全部行；不传等价 'all'
     * @param {Boolean} isAllRows 是否校验所有行，默认 true。
     *        true  = 扫完所有行，返回全部错误（errors / briefs 全量）；
     *        false = 顺序扫描，命中第一条错误立即停止（errors 最多 1 条），
     *                用于「逐条引导用户改」，同时省掉大数据量整表扫描的开销。
     *        仅当 rowIndex 为 'all' 时有效，单行校验时忽略。
     * @return {Object} {passed, message, rowIndex, rowNo, field, title, errors, briefs}
     *        顶层 rowIndex / rowNo / field / title 是 errors[0] 的镜像，只代表第一条错误；
     *        全部通过时 rowIndex = -1，其余为空串。全量明细请读 errors。
     */
    TableCore.prototype.validate = function(rowIndex, isAllRows) {
        var emptyResult = {
            passed: true, message: '', rowIndex: -1, rowNo: '', field: '', title: '',
            errors: [], briefs: []
        };
        if (this._guardDestroyed('validate')) return emptyResult;

        // 重入守卫：validator 内再调 validate() 会无限递归爆栈，直接忽略本次调用
        if (this._validating) {
            if (window.console && console.warn) {
                console.warn('[MelUi.Table] 禁止在 validator 内递归调用 validate() / validateUnique()，本次调用已忽略');
            }
            return emptyResult;
        }

        // 参数归一：不传（undefined / null）等价 'all'；数字则只校验该行
        var scope = (rowIndex === undefined || rowIndex === null) ? 'all' : rowIndex;
        var allRows = (isAllRows !== false);

        // 快照：validator 里若擅自改数据/列配置，也不会让本次遍历错乱
        var columns = this.dataStore.columns.slice(0);
        var rows = this.dataStore.rows.slice(0);
        var errors = [];
        var self = this;

        var pushError = function(rowIdx, col, reason, raw) {
            var row = rows[rowIdx];
            var rowNo = self._getRowNo(row, rowIdx);
            var title = col.title || '';
            var msg = (reason === 'required')
                ? '第' + rowNo + '行【' + title + '】不能为空'
                : '第' + rowNo + '行' + (title ? '【' + title + '】' : '') + raw;
            errors.push({
                message: msg,
                rowIndex: rowIdx,
                rowNo: rowNo,
                field: col.field,
                title: title,
                reason: reason,
                row: row,
                raw: raw || ''
            });
        };

        // 单行校验；返回 true 表示 allRows=false 时已命中错误、需停止扫描
        var checkRow = function(rowIdx) {
            var row = rows[rowIdx];
            if (!row) return false;

            for (var i = 0; i < columns.length; i++) {
                var col = columns[i];
                if (!col || !col.field) continue;
                // 隐藏列不参与校验：用户看不见、改不了，报了也是死循环
                if (col.visible === false) continue;

                var hasValidator = typeof col.validator === 'function';
                // 既没配必填、也没配自定义校验的列直接跳过
                if (!col.required && !hasValidator) continue;

                var value = row[col.field];

                // 1. 必填判空（纯空格也算空）
                if (col.required && self._isBlankValue(value)) {
                    pushError(rowIdx, col, 'required', '不能为空');
                    if (!allRows) return true;
                    // 空值不再跑自定义校验，避免同一格出现两条重复提示
                    continue;
                }

                // 2. 列级自定义校验 validator({value, rowData, rowIndex, field, title, table})
                //    返回非空字符串 = 不通过；返回 '' / undefined = 通过
                //    注意：validator 内只读，不要 setData / addRow / deleteRow / render / destroy
                if (hasValidator) {
                    var ret;
                    try {
                        ret = col.validator({
                            value: value,
                            rowData: row,
                            rowIndex: rowIdx,
                            field: col.field,
                            title: col.title || '',
                            table: self
                        });
                    } catch (err) {
                        // validator 自己抛异常不能把整轮校验打崩，转成一条错误提示
                        ret = '校验出错：' + ((err && err.message) ? err.message : err);
                    }

                    if (typeof ret === 'string' && ret !== '') {
                        pushError(rowIdx, col, 'validator', ret);
                        if (!allRows) return true;
                    } else if (ret !== undefined && ret !== null && ret !== false && ret !== '') {
                        // 返回了非字符串的真值，忽略，仅开发期提示
                        if (window.console && console.warn) {
                            console.warn('[MelUi.Table] 列 "' + col.field + '" 的 validator 应返回字符串，已忽略本次返回值');
                        }
                    }
                }
            }
            return false;
        };

        var result;
        this._validating = true;
        try {
            if (scope === 'all') {
                for (var r = 0; r < rows.length; r++) {
                    if (checkRow(r)) break; // allRows=false：命中第一条错误即停止
                }
            } else {
                var idx = parseInt(scope, 10);
                if (isNaN(idx) || idx < 0 || idx >= rows.length) {
                    if (window.console && console.warn) {
                        console.warn('[MelUi.Table] validate() 行索引超出范围：' + scope);
                    }
                } else {
                    checkRow(idx);
                }
            }
            result = this._buildValidateResult(errors);
        } finally {
            this._validating = false;
        }
        return result;
    };

    /**
     * 校验唯一值列（恒为全部 rows：本地分页=全表，远程分页=当前已加载数据）
     * @param {Boolean} isAllRows 是否校验所有行，默认 true。
     *        true  = 返回全部重复列；false = 命中第一组重复即停止。
     * @return {Object} {passed, message, rowIndex, rowNo, field, title, errors, checkedFields}
     *        顶层 rowIndex / rowNo / field / title 指向【第一组重复里的第一行】，只代表该组；
     *        整组的行号在 errors[i].rowIndexes 里。全部通过时 rowIndex = -1，其余为空串。
     */
    TableCore.prototype.validateUnique = function(isAllRows) {
        var emptyResult = {
            passed: true, message: '', rowIndex: -1, rowNo: '', field: '', title: '',
            errors: [], checkedFields: []
        };
        if (this._guardDestroyed('validateUnique')) return emptyResult;

        if (this._validating) {
            if (window.console && console.warn) {
                console.warn('[MelUi.Table] 禁止在 validator 内递归调用 validate() / validateUnique()，本次调用已忽略');
            }
            return emptyResult;
        }

        var allRows = (isAllRows !== false);
        // 快照：避免校验期间列配置 / 数据被改动导致遍历错乱
        var columns = this.dataStore.columns.slice(0);
        var rows = this.dataStore.rows.slice(0);
        var errors = [];
        var checkedFields = [];
        var self = this;

        this._validating = true;
        try {
            for (var i = 0; i < columns.length; i++) {
                var col = columns[i];
                if (!col || !col.unique || !col.field) continue;
                // 隐藏列不参与判重，口径与 validate() 一致
                if (col.visible === false) continue;
                checkedFields.push(col.field);

                // 同一列内按“去空白后的值”分组，记录每组的行下标
                var groups = {};
                var order = [];

                for (var j = 0; j < rows.length; j++) {
                    var val = rows[j][col.field];
                    if (self._isBlankValue(val)) continue; // 空值不参与判重（“没填”交给 required）

                    var key = String(val).replace(/\s+/g, '');
                    if (!groups[key]) {
                        groups[key] = {value: String(val), indexes: []};
                        order.push(key);
                    }
                    groups[key].indexes.push(j);
                }

                // 收集重复组（行数 > 1）
                for (var k = 0; k < order.length; k++) {
                    var g = groups[order[k]];
                    if (!g || g.indexes.length < 2) continue;

                    var rowNos = [];
                    for (var m = 0; m < g.indexes.length; m++) {
                        rowNos.push(self._getRowNo(rows[g.indexes[m]], g.indexes[m]));
                    }

                    var msg = (col.title ? '【' + col.title + '】' : '') +
                        '第 ' + rowNos.join('、') + ' 行重复';

                    errors.push({
                        message: msg,
                        rowIndex: g.indexes[0],
                        rowNo: rowNos[0],
                        field: col.field,
                        title: col.title || '',
                        reason: 'unique',
                        // 整组重复行的行号（0-based），名字与 errors[i].rowIndex 同词根
                        rowIndexes: g.indexes,
                        rowNos: rowNos,
                        values: [g.value],
                        raw: g.value
                    });

                    if (!allRows) break; // 命中第一组重复即停止
                }

                if (!allRows && errors.length) break;
            }
        } finally {
            this._validating = false;
        }

        var first = errors.length ? errors[0] : null;
        return {
            passed: errors.length === 0,
            message: first ? first.message : '',
            rowIndex: first ? first.rowIndex : -1,
            rowNo: first ? first.rowNo : '',
            field: first ? first.field : '',
            title: first ? first.title : '',
            errors: errors,
            checkedFields: checkedFields
        };
    };

    /**
     * 聚焦到指定单元格：校验不通过时引导用户直接跳到那一格去改
     * @param {Number} rowIndex 行索引（0-based，与 validate 返回的 rowIndex 一致）
     * @param {String} field 列字段名
     * @param {Object} options 可选项：highlight 是否临时高亮，默认 true
     * @return {Boolean} 是否定位成功
     */
    TableCore.prototype.focusCell = function(rowIndex, field, options) {
        if (this._guardDestroyed('focusCell')) return false;

        // 参数严格化：只认「数值行索引 + 字段名字符串」这一种形态，不做任何猜测。
        // 传对象 / 'all' / 数组一律拒绝并 warn，避免通用定位 API 被返回值结构绑架。
        if (typeof rowIndex !== 'number' || isNaN(rowIndex)) {
            if (window.console && console.warn) {
                console.warn('[MelUi.Table] focusCell(rowIndex, field) 的第一个参数必须是数值行索引（0-based），收到：' + rowIndex);
            }
            return false;
        }
        if (typeof field !== 'string' || field === '') {
            if (window.console && console.warn) {
                console.warn('[MelUi.Table] focusCell(rowIndex, field) 的第二个参数必须是非空字段名字符串，收到：' + field);
            }
            return false;
        }
        if (!options || typeof options !== 'object') options = {};

        var ds = this.dataStore;
        var row = ds.getRow(rowIndex);
        if (!row) return false;

        // 目标行不在当前页：先翻页再定位（本地分页才有意义，远程分页 rows 本身就是当前页）
        if ((!row._node || !row._node.parentNode) && ds.pageSize > 0 && !ds.remotePaging) {
            var page = Math.floor(rowIndex / ds.pageSize) + 1;
            var instances = this._pluginInstances || [];
            for (var i = 0; i < instances.length; i++) {
                var plugin = instances[i];
                if (plugin && typeof plugin.goToPage === 'function') {
                    plugin.goToPage(page);
                    break;
                }
            }
        }

        if (!this.renderer || typeof this.renderer.focusCell !== 'function') return false;
        return this.renderer.focusCell(rowIndex, field, options);
    };

    // ==================== 渲染控制 ====================

    /**
     * 全量重绘
     */
    TableCore.prototype.render = function() {
        if (this._guardDestroyed('render')) return;
        this.renderer.render();
    };

    /**
     * 只重绘某行
     * @param {Number} rowIndex 行索引
     */
    TableCore.prototype.renderRow = function(rowIndex) {
        if (this._guardDestroyed('renderRow')) return;
        this.renderer.renderRow(rowIndex);
    };

    /**
     * 只重绘某格
     * @param {Number} rowIndex 行索引
     * @param {String} field 字段名
     */
    TableCore.prototype.renderCell = function(rowIndex, field) {
        if (this._guardDestroyed('renderCell')) return;
        this.renderer.renderCell(rowIndex, field);
    };

    // ==================== 插件实例 ====================

    /**
     * 取指定插件实例（同名插件注册了多个时返回第一个）
     * @param {String} name 注册时的插件名，与 plugins 配置里写的一致，如 'Export' / 'Pagination'
     * @return {Object|null} 插件实例；未注册、传参非法或实例已销毁时返回 null
     */
    TableCore.prototype.getPlugin = function(name) {
        var list = this.getPlugins(name);
        return list.length ? list[0] : null;
    };

    /**
     * 取指定插件的全部实例（同一插件注册多次的场景，如多个不同格式的 Export）
     * @param {String} name 注册时的插件名
     * @return {Array} 实例数组；未注册、传参非法或实例已销毁时返回空数组
     */
    TableCore.prototype.getPlugins = function(name) {
        if (this._guardDestroyed('getPlugins')) return [];
        if (typeof name !== 'string' || name === '') {
            if (window.console && console.warn) {
                console.warn('[MelUi.Table] getPlugin / getPlugins 需要传入非空字符串形式的插件名');
            }
            return [];
        }
        var out = [];
        var instances = this._pluginInstances || [];
        for (var i = 0; i < instances.length; i++) {
            var plugin = instances[i];
            if (!plugin) continue;
            if (plugin._pluginName === name) out.push(plugin);
        }
        return out;
    };

    /**
     * 取全部插件实例（不分名称、不分类型）
     * 用途：调试排查（看当前表格装了哪些插件）、上层二次封装统一处理；
     *       业务代码请优先用 getPlugin / getPlugins 按名取，不要直接改插件内部属性。
     * @return {Array} 插件实例数组（副本，增删不影响组件内部），顺序与 plugins 配置一致；实例已销毁时返回空数组
     */
    TableCore.prototype.getAllPlugins = function() {
        if (this._guardDestroyed('getAllPlugins')) return [];
        return (this._pluginInstances || []).slice(0);
    };

    // ==================== 事件绑定 ====================

    /**
     * 绑定事件
     * @param {String} eventName 事件名
     * @param {Function} handler 回调
     */
    TableCore.prototype.on = function(eventName, handler) {
        if (this._guardDestroyed('on')) return;
        this.eventBus.on(eventName, handler);
    };

    /**
     * 解绑事件
     * @param {String} eventName 事件名
     * @param {Function} handler 回调
     */
    TableCore.prototype.off = function(eventName, handler) {
        if (this._guardDestroyed('off')) return;
        this.eventBus.off(eventName, handler);
    };

    // ==================== 销毁 ====================

    /**
     * 销毁表格(可选)
     * 清理window.resize、表身scroll事件监听，恢复body样式，销毁插件，清空容器DOM，同步销毁DataStore。
     * 【重要】SPA路由切换、弹窗关闭、容器复用重新new实例场景必须手动调用；整页刷新无需调用。
     * 销毁后实例的 isDestroyed 变为 true，再调用任何对外API都会被守卫拦住（开发期会打warn提示）。
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
            this._pluginInstances = [];
        }

        // renderer统一清理：移除resize/scroll监听、恢复body样式、清空容器DOM
        if (this.renderer && this.renderer._destroy) {
            this.renderer._destroy();
        }

        // 数据源同步销毁：清空rows（行对象里的_node持有DOM节点引用，必须一并释放）、
        // 清空选中集合与当前页临时插队集合，避免已销毁实例被异步闭包继续持有导致内存上涨。
        if (this.dataStore && this.dataStore.destroy) {
            this.dataStore.destroy();
        }
    };

    // 暴露到命名空间
    MelUi.Table = MelUi.Table || {};
    MelUi.Table.Core = TableCore;
    MelUi.Table.plugins = MelUi.Table.plugins || {};

})(window.MelUi = window.MelUi || {});

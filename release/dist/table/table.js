(function (factory) {
    typeof define === 'function' && define.amd ? define(factory) :
    factory();
})((function () { 'use strict';

    /**
     * MelUi Table 表格组件 - 入口文件
     * 负责挂载构造函数到全局命名空间
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.0.1
     * @Date：2026-10-10
     * @Pubdate：2026-10-10
     */

    (function(MelUi) {

        // 先把已有的 MelUi.Table 对象（Core/Renderer/DataStore 等）保存下来
        var oldTable = MelUi.Table || {};

        // 定义对外调用的函数
        function Table(options) {
            return new Table.Core(options);
        }

        // 把旧对象上的所有属性（Core、Renderer、DataStore、plugins 等）合并到新函数上
        for (var key in oldTable) {
            if (oldTable.hasOwnProperty(key)) {
                Table[key] = oldTable[key];
            }
        }

        // 确保 plugins 命名空间存在
        Table.plugins = Table.plugins || {};

        MelUi.Table = Table;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 数据存储
     * 负责管理表格所有数据：行数据、列配置、选中状态、排序状态
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.10.5
     * @Date：2026-10-10
     * @Pubdate：2026-11-10 10:35:00
     */

     (function(MelUi) {

        /**
         * DataStore 构造函数
         * @param {Object} options 配置项
         * @param {Boolean} options.remotePaging 是否后端远程分页（默认false，前端本地分页）
         * @param {Number} options.total 远程分页时的总记录数（由外部传入）
         */
        function DataStore(options) {
            // 销毁状态标记，由 TableCore.destroy 触发 destroy() 时置true
            this._isDestroyed = false;

            this.columns = options.columns || [];
            this.rows = [];
            this.sortField = '';
            this.sortOrder = '';
            this.selectedRowIndexes = [];
            this.currentPage = 1;  // 当前页码
            this.pageSize = 0;     // 每页条数，0表示不分页
            this.selectMode = 'multi'; // 选择模式：multi多选 / single单选，由Checkbox插件init时设置
            this.remotePaging = !!(options && options.remotePaging); // 后端远程分页开关
            this.remoteTotal = (options && options.total) || 0;       // 远程分页总条数
            // 是否兜底后端远程分页（仅 remotePaging=true 生效）：
            //   true：后端 total=0 或 total<返回列表条数时，组件自动降级，用当前这批数据做前端本地分页；
            //   false：严格信任后端 total，不会自动切换成前端本地分页（标准分页接口应设为false）。
            this.enableRemotePagingFallback = (options && options.enableRemotePagingFallback !== undefined)
                ? !!options.enableRemotePagingFallback : true;
            this.addRowMode = (options && options.addRowMode) || 'currentPage'; // 新增行插入位置：currentPage当前页 / global全局
            this._tempAppendRows = []; // addRowMode='currentPage'时，当前页临时追加的行引用集合（翻页/排序/setData时清空）
            this._tempRowSeq = 0;      // 草稿行独立索引计数器：remote/currentPage 新增的草稿行用负数自增索引，与后端 rows 的 0..n 隔离，避免 data-row-index 冲突

            // 行标识计数器：行对象里的 _rowId 由此自增生成
            // 作用：给每一行一个【运行期唯一标识】，供单行事件（rowClick/cellClick/expandChange 等）
            //   和 getRowById 使用。它不随分页、排序变化，行删除后失效，不可存后端。
            this._rowIdSeq = 0;

            // 初始化数据
            if (options.data && options.data.length) {
                for (var i = 0; i < options.data.length; i++) {
                    var row = this._createRow(options.data[i]);
                    row._rowIndex = i;
                    this.rows.push(row);
                }
            }

            // 构造时若进入降级兜底场景，自动把 pageSize 对齐为数据长度（初始化铺满一页）
            this._alignFallbackPageSize();
        }

        /**
         * 只读销毁状态：true=数据源已销毁，不可再读写
         * 只暴露 getter，业务只能读不能改
         */
        Object.defineProperty(DataStore.prototype, 'isDestroyed', {
            get: function() {
                return this._isDestroyed;
            },
            enumerable: true
        });

        /**
         * 销毁守卫（内部用）：已销毁返回 true，调用方应立即 return
         * 各方法按自身返回类型给出对应的空值，避免业务拿到 undefined 后继续参与计算
         * @param {String} methodName 方法名，仅用于告警日志定位
         * @return {Boolean} true=已销毁，跳过执行；false=正常执行
         */
        DataStore.prototype._guardDestroyed = function(methodName) {
            if (!this._isDestroyed) return false;
            if (window.console && console.warn) {
                console.warn('[MelUi.Table] DataStore 已销毁，' + methodName + ' 调用被忽略');
            }
            return true;
        };

        /**
         * 销毁数据源（由 TableCore.destroy 统一调用，业务无需手动调用）
         * 清空 rows / 选中集合 / 当前页临时插队集合：
         * 行对象里的 _node 持有表身 DOM 节点引用，必须随 rows 一起释放，
         * 否则已销毁实例的整棵行元素会被 DataStore 持有而无法回收。
         * 重复调用不会报错。
         */
        DataStore.prototype.destroy = function() {
            if (this._isDestroyed) return;
            this._isDestroyed = true;

            this.rows = [];
            this.selectedRowIndexes = [];
            this._tempAppendRows = [];
            this.sortField = '';
            this.sortOrder = '';
        };

        /**
         * 降级兜底时自动对齐 pageSize（统一入口）
         * 规则：仅 remotePaging=true 且 enableRemotePagingFallback=true 且后端 total 不可信
         *   （total=0 或 < 当前返回列表长度）时，把 pageSize 设为当前 rows 长度，
         *   使数据加载进来自动铺满一页展示全部；
         * 用户随后手动在下拉切换 pageSize 后，以用户选择为准（本方法不再覆盖），
         * 直到下一次数据刷新（构造 / setRows）再次触发降级才重新对齐。
         * 注意：enableRemotePagingFallback=false（严格信任后端 total）时不触碰 pageSize。
         */
        DataStore.prototype._alignFallbackPageSize = function() {
            if (!this.remotePaging || !this.enableRemotePagingFallback) return;
            var bt = this.remoteTotal || 0;
            var ll = this.rows.length;
            if (bt > 0 && bt >= ll) return; // total 可信，标准远程分页，不触碰
            if (ll <= 0) return;
            this.pageSize = ll; // 降级：铺满一页
        };

        /**
         * 是否处于降级兜底分页状态（只读）
         * 供业务在 onPageChange 中判断：true 时不请求后端接口（组件内部前端切片分页），
         * false 时按标准远程分页由业务自行请求后端。
         * 判定：仅 remotePaging=true 且 enableRemotePagingFallback=true 且后端 total 不可信
         *   （total=0 或 < 当前返回列表长度）时返回 true，否则 false。
         * @return {Boolean}
         */
        DataStore.prototype.isFallbackPaging = function() {
            if (this._guardDestroyed('isFallbackPaging')) return false;
            if (!this.remotePaging) return false;
            if (!this.enableRemotePagingFallback) return false;
            var bt = this.remoteTotal || 0;
            var ll = this.rows.length;
            return !(bt > 0 && bt >= ll);
        };

        /**
         * 初始化一行数据，附加内部字段（不 push 到 rows，由调用方控制位置）
         * @param {Object} rowData 行数据
         * @return {Object} 行对象
         */
        DataStore.prototype._createRow = function(rowData) {
            var row = {};

            // 拷贝业务字段
            for (var key in rowData) {
                if (rowData.hasOwnProperty(key)) {
                    row[key] = rowData[key];
                }
            }

            // 内部字段
            row._rowId = 'r' + (++this._rowIdSeq); // 运行期唯一行标识：单行事件与 getRowById 使用，不存后端
            row._rowIndex = 0;
            row._status = 's';  // i=新增, u=修改, s=已保存
            row._selected = false;
            row._node = null;

            return row;
        };

        /**
         * 按 rowId 查找内部原始行（rows 与草稿行 _tempAppendRows 都会查）
         * @param {String} rowId 行标识（来自单行事件参数 rowId）
         * @return {Object|null} 内部原始行对象；找不到返回 null
         */
        DataStore.prototype.getRowById = function(rowId) {
            if (this._guardDestroyed('getRowById')) return null;
            if (rowId === undefined || rowId === null || rowId === '') return null;

            for (var i = 0; i < this.rows.length; i++) {
                if (this.rows[i] && this.rows[i]._rowId === rowId) return this.rows[i];
            }
            if (this._tempAppendRows) {
                for (var t = 0; t < this._tempAppendRows.length; t++) {
                    if (this._tempAppendRows[t] && this._tempAppendRows[t]._rowId === rowId) {
                        return this._tempAppendRows[t];
                    }
                }
            }
            return null;
        };

        /**
         * 取一行的对业务可见副本（浅拷贝，剥离所有下划线开头的内部字段）
         * 事件回调里的 rowData / rendered.rows 一律走这里，避免把 _rowIndex/_rowId/_node 等内部字段暴露给业务。
         * @param {Object} row 内部行对象
         * @return {Object} 纯业务字段对象
         */
        DataStore.prototype.getPlainRow = function(row) {
            var plain = {};
            if (!row) return plain;
            for (var key in row) {
                if (!row.hasOwnProperty(key)) continue;
                if (key.charAt(0) === '_') continue; // 内部字段一律不对外
                plain[key] = row[key];
            }
            return plain;
        };

        /**
         * 批量取对业务可见副本
         * @param {Array} rows 内部行数组
         * @return {Array} 纯业务字段对象数组
         */
        DataStore.prototype.getPlainRows = function(rows) {
            var list = [];
            if (!rows) return list;
            for (var i = 0; i < rows.length; i++) {
                list.push(this.getPlainRow(rows[i]));
            }
            return list;
        };

        /**
         * 获取指定行数据
         * @param {Number} rowIndex 行索引
         *   负数索引：草稿行（remote 模式新增行只进 _tempAppendRows、不进 rows，分配独立负数索引），
         *   在 _tempAppendRows 中按 _rowIndex 精确匹配定位，与后端 rows 的 0..n 下标体系隔离，
         *   避免渲染 data-row-index 冲突导致状态列"改"错标到旧行、单元格数据写错位置。
         * @return {Object|null}
         */
        DataStore.prototype.getRow = function(rowIndex) {
            if (this._guardDestroyed('getRow')) return null;
            // 负数索引：草稿行定位到临时插队集合
            if (rowIndex < 0) {
                if (this._tempAppendRows) {
                    for (var t = 0; t < this._tempAppendRows.length; t++) {
                        if (this._tempAppendRows[t] && this._tempAppendRows[t]._rowIndex === rowIndex) {
                            return this._tempAppendRows[t];
                        }
                    }
                }
                return null;
            }
            if (rowIndex >= this.rows.length) return null;
            return this.rows[rowIndex];
        };

        /**
         * 获取某行某列的值
         * @param {Number} rowIndex 行索引
         * @param {String} field 字段名
         * @return {*}
         */
        DataStore.prototype.getCell = function(rowIndex, field) {
            if (this._guardDestroyed('getCell')) return '';
            var row = this.getRow(rowIndex);
            if (!row) return '';
            return row[field] || '';
        };

        /**
         * 设置某行某列的值
         * @param {Number} rowIndex 行索引
         * @param {String} field 字段名
         * @param {*} value 新值
         */
        DataStore.prototype.setCell = function(rowIndex, field, value) {
            if (this._guardDestroyed('setCell')) return;
            var row = this.getRow(rowIndex);
            if (!row) return;

            var oldValue = row[field];
            row[field] = value;

            // 如果当前是已保存状态，且值有变化，标记为修改
            if (row._status === 's' && oldValue !== value) {
                row._status = 'u';
            }
        };

        /**
         * 新增一行
         * @param {Object} data 行数据（可选）
         * @param {String} position 位置：'first' 最前 / 'last' 最后
         * 按 addRowMode 与分页模式区分：
         *   - addRowMode='currentPage'（本地分页）：新增行写入全局 rows（真实数据源，getData/导出/翻页不丢），
         *     打 _isTempAdd 标记，渲染时由 getVisibleRows 把该行【附加】到当前页切片首/尾，
         *     原当前页切片数据不被挤走（不会跑到下一页）、其它页数据分布完全不变；
         *     翻页/排序/setData 时 clearTempAppend 清空插队集合并移除 _isTempAdd，该行回归普通分页。
         *   - addRowMode='global'（本地分页）：直接操作全局数组真首尾（'first'→下标0，'last'→末尾），
         *     只打 _isTempAdd 标记（用于序号控制：showNewRowSerialNumber=false 时新增行序号空），不进插队集合。
         *     这是 global 语义：新增行真正插入数据源首部，rows 整体右移，分页边界按新数组重算，属正常结果。
         *   - remotePaging=true：rows 是后端返回的当前页数据，不能直接插入污染
         *     （否则 unshift 会改变原行下标、导致原行序号偏移）；新增行仅加入 _tempAppendRows
         *     由 getVisibleRows 附加到当前页首/尾，真正入库由业务调用后端接口处理，本处只做视图层临时显示。
         * @return {Object} 新增的行对象
         */
        DataStore.prototype.addRow = function(data, position) {
            if (this._guardDestroyed('addRow')) return null;
            position = position || 'last';
            var rowData = data || {};

            // 填充默认值
            for (var i = 0; i < this.columns.length; i++) {
                var col = this.columns[i];
                if (col.defaultValue !== undefined && rowData[col.field] === undefined) {
                    rowData[col.field] = col.defaultValue;
                }
            }

            var row = this._createRow(rowData);
            row._status = 'i';  // 新增行标记为 i
            // 打新增标记：序号插件据此决定是否显示序号
            row._isTempAdd = true;

            if (this.remotePaging) {
                // ===== 远程分页：仅加入临时插队集合，不污染后端当前页数据 =====
                // 草稿行分配独立负数索引（--_tempRowSeq），与后端 rows 的 0..n 下标隔离：
                //   - 渲染 data-row-index 用该负数，不与后端任一行的 data-row-index 冲突；
                //   - getRow(rowIndex) 对负数在 _tempAppendRows 中按 _rowIndex 精确定位，
                //     保证 cellChange/setCell/state-column 状态标记作用到草稿行本身，而非错位的旧行。
                row._rowIndex = --this._tempRowSeq;
                row._insertPos = position;
                // 最新新增的草稿行用 unshift 插到集合最前，保证多次"新增到最前"时视图顺序为 3,2,1（最新加的最上）
                if (position === 'first') {
                    this._tempAppendRows.unshift(row);
                } else {
                    this._tempAppendRows.push(row);
                }
            } else if (this.addRowMode === 'currentPage') {
                // ===== currentPage 模式：写全局 rows 末尾 + 附加到当前页首/尾 =====
                // 统一追加到 rows 末尾（不做 unshift），避免把本页末尾行挤到下一页、不改变其它页数据分布；
                // 配合 _insertPos，由 getVisibleRows 把该行附加到当前页首/尾显示。
                // 注意：currentPage 草稿行写入了 rows，其 _rowIndex 由 _updateRowIndexes 按 rows 下标重排，
                //   不冲突（同一行对象即 rows 里的真实行）。此处保持既有语义，仅 _tempAppendRows 用 unshift 满足 3,2,1 顺序。
                this.rows.push(row);
                row._insertPos = position;
                if (position === 'first') {
                    this._tempAppendRows.unshift(row);
                } else {
                    this._tempAppendRows.push(row);
                }
            } else {
                // ===== global 模式：直接操作全局数组真首尾 =====
                if (position === 'first') {
                    this.rows.unshift(row);
                } else {
                    this.rows.push(row);
                }
            }

            this._updateRowIndexes();
            return row;
        };

        /**
         * 清空当前页插队集合（addRowMode='currentPage' 的新增行）
         * 翻页、排序、setData 时调用：
         *   1. 清空 _tempAppendRows 集合；
         *   2. 移除集合中这些行的 _isTempAdd 标记，使其回归普通行（按全局下标正常分页、正常显示序号）。
         * 数据本身已写入全局 rows，不会丢失，只是不再"插队"显示在当前页首/尾。
         */
        DataStore.prototype.clearTempAppend = function() {
            if (this._guardDestroyed('clearTempAppend')) return;
            if (this._tempAppendRows && this._tempAppendRows.length) {
                for (var i = 0; i < this._tempAppendRows.length; i++) {
                    var row = this._tempAppendRows[i];
                    if (row) {
                        delete row._isTempAdd;
                        delete row._insertPos;
                    }
                }
                this._tempAppendRows.length = 0;
            }
        };

        /**
         * 删除一行
         * @param {Number} rowIndex 行索引
         */
        DataStore.prototype.removeRow = function(rowIndex) {
            if (this._guardDestroyed('removeRow')) return;
            if (rowIndex < 0 || rowIndex >= this.rows.length) return;

            var row = this.rows[rowIndex];
            this.rows.splice(rowIndex, 1);
            this._updateRowIndexes();

            // 若被删除的行还残留在当前页临时追加集合中，同步移除，避免getVisibleRows再concat出已删行
            if (this._tempAppendRows && this._tempAppendRows.length) {
                for (var i = 0; i < this._tempAppendRows.length; i++) {
                    if (this._tempAppendRows[i] === row) {
                        this._tempAppendRows.splice(i, 1);
                        break;
                    }
                }
            }
        };

        /**
         * 清空所有行
         */
        DataStore.prototype.clearRows = function() {
            if (this._guardDestroyed('clearRows')) return;
            this.rows = [];
            this.selectedRowIndexes = [];
            this.clearTempAppend();
        };

        /**
         * 重新计算行索引（删除或插入后调用）
         */
        DataStore.prototype._updateRowIndexes = function() {
            for (var i = 0; i < this.rows.length; i++) {
                this.rows[i]._rowIndex = i;
            }
        };

        /**
         * 获取所有有变动的行（新增 + 修改）
         * @return {Array}
         */
        DataStore.prototype.getDirtyRows = function() {
            if (this._guardDestroyed('getDirtyRows')) return [];
            var result = [];
            for (var i = 0; i < this.rows.length; i++) {
                if (this.rows[i]._status === 'i' || this.rows[i]._status === 'u') {
                    result.push(this.rows[i]);
                }
            }
            return result;
        };

        /**
         * 标记行为已保存状态
         * @param {Number|String} rowIndex 行索引，传 'all' 表示全部
         */
        DataStore.prototype.markSaved = function(rowIndex) {
            if (this._guardDestroyed('markSaved')) return;
            if (rowIndex === 'all') {
                for (var i = 0; i < this.rows.length; i++) {
                    this.rows[i]._status = 's';
                }
            } else {
                var row = this.getRow(rowIndex);
                if (row) row._status = 's';
            }
        };

        /**
         * 设置行选中状态
         * @param {Number} rowIndex 行索引
         * @param {Boolean} selected 是否选中
         */
        DataStore.prototype.setRowSelected = function(rowIndex, selected) {
            if (this._guardDestroyed('setRowSelected')) return;
            var row = this.getRow(rowIndex);
            if (!row) return;

            // 单选模式：选中新行时先清空其它行选中（互斥）
            if (this.selectMode === 'single' && selected) {
                for (var k = 0; k < this.rows.length; k++) {
                    this.rows[k]._selected = false;
                }
                this.selectedRowIndexes = [];
            }

            row._selected = selected;

            // 同步维护 selectedRowIndexes 数组
            var idx = this.selectedRowIndexes.indexOf(rowIndex);
            if (selected && idx < 0) {
                this.selectedRowIndexes.push(rowIndex);
            } else if (!selected && idx >= 0) {
                this.selectedRowIndexes.splice(idx, 1);
            }
        };

        /**
         * 获取选中的行数据
         * @return {Array}
         */
        DataStore.prototype.getSelectedRows = function() {
            if (this._guardDestroyed('getSelectedRows')) return [];
            var result = [];
            for (var i = 0; i < this.rows.length; i++) {
                if (this.rows[i]._selected) {
                    result.push(this.rows[i]);
                }
            }
            return result;
        };

        /**
         * 全选 / 全不选
         * 单选模式：全选操作静默忽略（不console.warn，兼容IE）
         * @param {Boolean} selected 是否选中
         */
        DataStore.prototype.selectAll = function(selected) {
            if (this._guardDestroyed('selectAll')) return;
            if (this.selectMode === 'single') return;

            this.selectedRowIndexes = [];
            for (var i = 0; i < this.rows.length; i++) {
                this.rows[i]._selected = selected;
                if (selected) this.selectedRowIndexes.push(i);
            }
        };

        /**
         * 反选
         * 单选模式：反选操作静默忽略（不console.warn，兼容IE）
         */
        DataStore.prototype.invertSelect = function() {
            if (this._guardDestroyed('invertSelect')) return;
            if (this.selectMode === 'single') return;

            this.selectedRowIndexes = [];
            for (var i = 0; i < this.rows.length; i++) {
                this.rows[i]._selected = !this.rows[i]._selected;
                if (this.rows[i]._selected) this.selectedRowIndexes.push(i);
            }
        };

        /**
         * 清空所有选中（单选/多选都适用）
         */
        DataStore.prototype.clearSelection = function() {
            if (this._guardDestroyed('clearSelection')) return;
            this.selectedRowIndexes = [];
            for (var i = 0; i < this.rows.length; i++) {
                this.rows[i]._selected = false;
            }
        };

        /**
         * 排序
         * @param {String} field 字段名
         * @param {String} order 排序方向：'asc' / 'desc'
         * @param {Boolean} currentPageOnly 是否仅对当前页排序（可选）。
         *   仅 remotePaging=false 本地分页且 pageSize>0 时生效：
         *     只取出当前页对应的 rows 切片区间排序，结果回填回原 rows 该区间，其他数据顺序不变；
         *     这样当前页内顺序变了，分页边界不变，不会出现数据排序后跑到其他页。
         *   remotePaging=true 或未分页时本参数无效，等价于全量排序。
         */
        DataStore.prototype.sort = function(field, order, currentPageOnly) {
            if (this._guardDestroyed('sort')) return;
            this.sortField = field;
            this.sortOrder = order;

            // 排序会重建数据顺序，清空当前页插队集合
            this.clearTempAppend();

            var compareFn = function(a, b) {
                var va = a[field];
                var vb = b[field];

                // 数字比较
                var na = parseFloat(va);
                var nb = parseFloat(vb);
                if (!isNaN(na) && !isNaN(nb)) {
                    return order === 'asc' ? na - nb : nb - na;
                }

                // 字符串比较
                va = String(va || '');
                vb = String(vb || '');
                if (order === 'asc') {
                    return va < vb ? -1 : (va > vb ? 1 : 0);
                } else {
                    return va > vb ? -1 : (va < vb ? 1 : 0);
                }
            };

            // 仅当前页排序：只对当前页切片区间排序并回填原数组区间
            if (currentPageOnly && !this.remotePaging && this.pageSize > 0) {
                var start = (this.currentPage - 1) * this.pageSize;
                var end = Math.min(start + this.pageSize, this.rows.length);
                if (start >= this.rows.length) {
                    this._updateRowIndexes();
                    return;
                }

                // 取出当前页切片区间，排序
                var segment = this.rows.slice(start, end);
                segment.sort(compareFn);

                // 回填回原数组该区间（区间外数据顺序不变）
                for (var i = start; i < end; i++) {
                    this.rows[i] = segment[i - start];
                }
            } else {
                // 全量排序（默认 / 远程分页 / 未分页）
                this.rows.sort(compareFn);
            }

            this._updateRowIndexes();
        };

        /**
         * 设置每页条数（开启分页）
         * @param {Number} size 每页条数，0表示关闭分页
         */
        DataStore.prototype.setPageSize = function(size) {
            if (this._guardDestroyed('setPageSize')) return;
            this.pageSize = size || 0;
            this.currentPage = 1;
        };

        /**
         * 获取当前页应显示的行
         * 远程分页(remotePaging=true)：rows 是后端当前页数据，把 _tempAppendRows 中新增行【附加】到首/尾，
         *   不污染后端数据、不改变原行序号。
         * 本地分页：按 currentPage/pageSize 对 rows 切片，再把 _tempAppendRows 中新增行【附加】到切片首/尾：
         *   - position='first' 的行放切片最前面
         *   - position='last' 的行放切片最后面
         * 原切片数据保持完整（本页临时多展示新增行），不会被挤走到下一页。
         * @return {Array}
         */
        DataStore.prototype.getVisibleRows = function() {
            if (this._guardDestroyed('getVisibleRows')) return [];
            var base = null;

            if (this.remotePaging) {
                // 远程分页分支
                var backendTotal = this.remoteTotal || 0;
                if (backendTotal > 0 && backendTotal >= this.rows.length) {
                    // 标准远程分页：后端 total 可信，rows 是后端已切好的当前页数据，不做本地切片
                    base = this.rows;
                } else if (this.enableRemotePagingFallback && this.pageSize > 0) {
                    // 兜底降级：后端 total 不可信（=0 或 < 返回列表长度），
                    // 后端不再负责分页，由前端对当前这批 rows 做本地切片分页（支持切换每页条数、翻页）
                    var fs = (this.currentPage - 1) * this.pageSize;
                    var fe = fs + this.pageSize;
                    base = this.rows.slice(fs, fe);
                } else {
                    // 未开启兜底（enableRemotePagingFallback=false）：严格信任后端 total，不自动降级切片
                    base = this.rows;
                }
            } else if (!this.pageSize || this.pageSize <= 0) {
                // 未分页：直接返回全部 rows
                base = this.rows;
            } else {
                // 本地分页：按 currentPage/pageSize 切片
                var start = (this.currentPage - 1) * this.pageSize;
                var end = start + this.pageSize;
                base = this.rows.slice(start, end);
            }

            // 有插队新增行时，附加到 base 首/尾（不改变 base 本身，不挤走原数据）
            if (this._tempAppendRows && this._tempAppendRows.length) {
                var firstAdds = [];  // position='first' 的新增行（放最前）
                var lastAdds = [];   // position='last' 的新增行（放最后）

                // 先从 base 中剔除已在 base 内的插队行（本地分页时新增行也写入了 rows，可能在切片内，避免重复显示）
                var keepBase = [];
                for (var k = 0; k < base.length; k++) {
                    var inTemp = false;
                    for (var t = 0; t < this._tempAppendRows.length; t++) {
                        if (base[k] === this._tempAppendRows[t]) { inTemp = true; break; }
                    }
                    if (!inTemp) {
                        keepBase.push(base[k]);
                    }
                }

                // 按插入位置归类待插队行
                for (var i = 0; i < this._tempAppendRows.length; i++) {
                    var tempRow = this._tempAppendRows[i];
                    if (!tempRow) continue;
                    if (tempRow._insertPos === 'first') {
                        firstAdds.push(tempRow);
                    } else {
                        lastAdds.push(tempRow);
                    }
                }

                // 拼装：first插队行 + 剔除插队行后的原数据 + last插队行
                var result = [];
                for (var a = 0; a < firstAdds.length; a++) result.push(firstAdds[a]);
                for (var m = 0; m < keepBase.length; m++) result.push(keepBase[m]);
                for (var n = 0; n < lastAdds.length; n++) result.push(lastAdds[n]);
                return result;
            }

            return base;
        };

        /**
         * 获取矫正后的展示总条数
         * 规则（仅 remotePaging=true 时对后端 total 做合法性校验）：
         *   - 后端 total > 0 且 >= 本次返回列表长度 → 后端 total 可信，标准远程分页，采用之；
         *   - 后端 total = 0，或 total > 0 但 < 本次返回列表长度（数据自相矛盾）：
         *       若 enableRemotePagingFallback=true（默认）→ 开启兜底，降级采用本次返回实际列表长度 rows.length，
         *       后端不再负责分页，由前端对该批数据本地分页；
         *       若 enableRemotePagingFallback=false → 关闭兜底，严格信任后端 total，不自动切换。
         *  remotePaging=false 时始终返回本地行数 rows.length。
         * @return {Number}
         */
        DataStore.prototype.getEffectiveTotal = function() {
            if (this._guardDestroyed('getEffectiveTotal')) return 0;
            if (!this.remotePaging) return this.rows.length;
            var backendTotal = this.remoteTotal || 0;
            var listLen = this.rows.length;
            if (backendTotal > 0 && backendTotal >= listLen) {
                return backendTotal; // 后端 total 可信，标准远程分页
            }
            // total 不可信
            if (this.enableRemotePagingFallback) {
                return listLen; // 开启兜底：以本次返回列表长度为总数
            }
            return backendTotal; // 关闭兜底：严格信任后端 total，不自动切换
        };

        /**
         * 获取矫正后的生效每页条数
         * 无论 remotePaging 是否开启、total 是否可信，均跟随当前选中的 pageSize：
         *   - 标准远程分页：pageSize 由业务/分页下拉控制；
         *   - 降级兜底分页：同样由分页下拉控制（用户可自由切换每页条数，触发前端本地切片）。
         * 由 getTotalPages / getVisibleRows 配合完成实际切片与总页数计算。
         * @return {Number}
         */
        DataStore.prototype.getEffectivePageSize = function() {
            if (this._guardDestroyed('getEffectivePageSize')) return 0;
            return this.pageSize;
        };

        /**
         * 获取总页数
         * 基于 getEffectiveTotal / getEffectivePageSize 计算，与分页栏展示口径完全统一。
         * @return {Number}
         */
        DataStore.prototype.getTotalPages = function() {
            if (this._guardDestroyed('getTotalPages')) return 1;
            var effPageSize = this.getEffectivePageSize();
            if (!effPageSize || effPageSize <= 0) return 1;
            var total = this.getEffectiveTotal();
            if (isNaN(total)) total = 0;
            return Math.ceil(total / effPageSize);
        };

        /**
         * 新增一行到当前页数据集合（addRowMode='currentPage'）
         * 统一委托给 addRow 处理：
         *  - 行写入全局 rows（保证 getData/getDirtyData/导出/校验可读，业务无需手动合并）
         *  - addRowMode='currentPage' 时把行引用追加到 _tempAppendRows，getVisibleRows 会 concat，
         *    使新增行新增瞬间留在当前页；翻页/排序/setData 清空后回归标准分片。
         * @param {Object} data 行数据（可选）
         * @param {String} position 位置：'first' 插到当前页首 / 'last' 追加到当前页尾
         * @return {Object} 新增的行对象
         */
        DataStore.prototype.addRowToCurrentPage = function(data, position) {
            if (this._guardDestroyed('addRowToCurrentPage')) return null;
            return this.addRow(data, position);
        };

        /**
         * 替换整表数据（远程分页回填用，也支持普通全量替换）
         * @param {Array} data 行数据数组
         */
        DataStore.prototype.setRows = function(data) {
            if (this._guardDestroyed('setRows')) return;
            this.rows = [];
            if (data && data.length) {
                for (var i = 0; i < data.length; i++) {
                    var row = this._createRow(data[i]);
                    row._rowIndex = i;
                    this.rows.push(row);
                }
            }

            // 说明：不在此处改写 remoteTotal。
            // 分页栏展示总数、总页数统一由 getEffectiveTotal / getEffectivePageSize 做合法性矫正：
            //   - 后端 total>0 且 >= 返回列表长度 → 正常采用；
            //   - 后端 total=0 或 < 返回列表长度 → 降级以本次返回列表长度为准。
            // 保持 remoteTotal 为后端原始值，才能正确区分"正常远程分页"与"total 不可信降级"两种场景。

            // 降级兜底时自动对齐 pageSize（只在此次 setRows 刷新时重置一次），
            // 使新数据加载进来自动铺满一页展示全部；用户随后手动切换 pageSize 以用户选择为准，
            // 直到下一次 setRows 拿到新数据再次触发降级才重新对齐。
            this._alignFallbackPageSize();

            // 清空选中状态（数据已替换）
            this.selectedRowIndexes = [];
            // 数据整体替换：清空当前页临时追加集合
            this.clearTempAppend();
        };

        // 暴露到命名空间
        MelUi.Table = MelUi.Table || {};
        MelUi.Table.DataStore = DataStore;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 事件总线
     * 负责表格内部事件的发布与订阅，解耦核心层与插件层
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.0.3
     * @Date：2026-10-10
     * @Pubdate：2026-10-10
     */

    (function(MelUi) {

        /**
         * EventBus 构造函数
         */
        function EventBus() {
            this._listeners = {};
        }

        /**
         * 订阅事件
         * @param {String} eventName 事件名
         * @param {Function} handler 回调函数
         */
        EventBus.prototype.on = function(eventName, handler) {
            if (!this._listeners[eventName]) {
                this._listeners[eventName] = [];
            }
            this._listeners[eventName].push(handler);
        };

        /**
         * 取消订阅
         * @param {String} eventName 事件名
         * @param {Function} handler 回调函数
         */
        EventBus.prototype.off = function(eventName, handler) {
            if (!this._listeners[eventName]) return;

            var arr = this._listeners[eventName];
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] === handler) {
                    arr.splice(i, 1);
                    break;
                }
            }
        };

        /**
         * 发布事件
         * @param {String} eventName 事件名
         * @param {*} data 传递的数据
         */
        EventBus.prototype.emit = function(eventName, data) {
            if (!this._listeners[eventName]) return;

            var arr = this._listeners[eventName];
            for (var i = 0; i < arr.length; i++) {
                try {
                    arr[i](data);
                } catch (e) {
                    // 单个监听器出错不影响其他监听器
                }
            }
        };

        // 暴露到命名空间
        MelUi.Table = MelUi.Table || {};
        MelUi.Table.EventBus = EventBus;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 核心渲染器
     * 负责根据 DataStore 数据渲染表头和表身 DOM，所有 DOM 操作统一在此
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.10.2
     * @Date：2026-10-10
     * @PubDate：2026-11-12 18:05:00
     */

     (function(MelUi) {

        /**
         * Renderer 构造函数
         * @param {Object} options 配置项
         * @param {Object} dataStore DataStore 实例
         * @param {Object} eventBus EventBus 实例
         * @param {Object} table TableCore 实例（可选）。供 extraBefore/extraAfter 的函数形态取用表格状态
         */
        function Renderer(options, dataStore, eventBus, table) {
            this.options = options;
            this.dataStore = dataStore;
            this.eventBus = eventBus;
            this.table = table || null;
            this.el = typeof options.el === 'string' ? document.querySelector(options.el) : options.el;
            this.isRenderComplete = false;

            // extraBefore / extraAfter 渲染出的区块节点引用（未配置时为空）
            this.extraBeforeWrap = null;
            this.extraAfterWrap = null;

            // 纵向固定表尾（独立 table，不在滚动容器内；未启用时 display:none 不占高度）
            this.footerWrapper = null;
            this.footerTable = null;
            this.footerTbody = null;
            // 最近一次合计数据：表尾因空间不足降级时，要用它把合计行挪回表身
            this._lastSums = null;
            // 表尾降级标记（一旦降级本次实例不再启用表尾，避免高度抖动）
            this._footerDegraded = false;
            this._footerWarned = false;
            // 表身最小可用高度：低于该值时表尾降级，避免把表身压成 0
            this._footerMinBodyHeight = 80;
            // 合计标题列越界告警标记（只警告一次，避免每次重算刷屏）
            this._titleColumnWarned = false;

            // 表头固定列缓存（合并表头时是「覆盖前N列的th列表」，滚动同步复用）
            this._headerFixedCells = [];

            // 是否启用排序能力：由 Sort 插件 init 时置 true。
            // 未启用时表头不显示可排序光标（pointer），避免“点了没反应”的误导。
            this.sortEnabled = false;

            this._renderers = MelUi.Table.cellRenderers || {};

            this._bindInternalEvents();
        }

        /**
         * 监听内部事件
         */
        Renderer.prototype._bindInternalEvents = function() {
            var self = this;

            this.eventBus.on('sortChange', function() {
                if (!self.isRenderComplete) return;
                self._renderHeader();
                self._renderBody();
            });

            this.eventBus.on('summaryChange', function(data) {
                self._renderSummaryRow(data.sums, data.fixed);
            });

            this.eventBus.on('selectChange', function() {
                if (!self.isRenderComplete) return;
                self._refreshSelectedStates();
            });

            this.eventBus.on('rowAdd', function() {
                if (!self.isRenderComplete) return;
                self._renderBody();
                self._applyFixedColumns();
            });

            this.eventBus.on('rowDelete', function() {
                if (!self.isRenderComplete) return;
                self._renderBody();
                self._applyFixedColumns();
            });

            this.eventBus.on('pageChange', function() {
                if (!self.isRenderComplete) return;
                self._renderBody();
                self._applyFixedColumns();
            });
        };

        /**
         * 渲染整个表格
         */
        Renderer.prototype.render = function() {
            this._renderContainer();
            this._renderHeader();
            this._renderBody();
            this._bindEvents();
            this._initLayout();

            var self = this;
            // 延迟等浏览器完成布局，再调整宽度和高度
            setTimeout(function() {
                self._adjustWrapperWidth(self._getTotalWidth());
                // 初始应用固定列样式（固定列走 renderer 内置，Layout 插件未启用时此方法生效）
                self._applyFixedColumns();

                // 统一绑定窗口resize（所有模式都刷新水平宽度；fitViewport额外刷新垂直高度）
                self._bindResize();

                // fitViewport=true：自动适配视口，占满页面剩余高度
                if (self.options.fitViewport) {
                    self._fitViewport();
                } else {
                    self._adjustBodyHeight();
                }
            }, 0);
            this.isRenderComplete = true;

            // rendered 事件载荷：只对外给只读快照，不暴露 DataStore 实例，
            // 避免业务拿到ds后绕开表格对外API直接改数据源，破坏封装。
            // 字段口径：
            //   rows     = 本次实际渲染的行（即 getVisibleRows 结果，含当前页临时追加的新增行）
            //   total    = 统一走 getEffectiveTotal()，与分页栏展示总数同口径
            //              （remotePaging + enableRemotePagingFallback 的矫正规则都在该方法内，此处不重复推导）
            //   pageNo   = 当前页码，内部字段是 currentPage，对外统一叫 pageNo，与 pageChange 事件命名对应
            //   pageSize = 每页条数
            // 注意：rows 里每一项都是【纯业务字段副本】（已剥离 _rowIndex/_rowId/_status/_node 等内部字段），
            // 修改副本不会影响表格数据源；需要按 rowId 定位原始行请用 table.getRowById()。
            var ds = this.dataStore;
            var visibleRows = ds.getVisibleRows();
            var renderInfo = {
                rows: ds.getPlainRows(visibleRows),
                total: ds.getEffectiveTotal(),
                pageNo: ds.currentPage,
                pageSize: ds.pageSize
            };
            this.eventBus.emit('rendered', renderInfo);
        };

        /**
         * 判断某列是否被隐藏（列配置 visible:false）
         * 隐藏列只是界面上不显示：th / td 照常渲染进 DOM（F12 可见），
         * 靠 mel-col-hidden 类 display:none + colgroup 列宽置 0 让它不占可见宽度，
         * 这样列数据、列配置、导出能力全部保留，可随时用 setColumnVisible 切回来。
         * @param {Object} col 列配置
         * @return {Boolean}
         */
        Renderer.prototype._isColHidden = function(col) {
            return !!(col && col.visible === false);
        };

        /**
         * 获取列宽总和（隐藏列按 0 参与，避免表格右侧多出空白）
         */
        Renderer.prototype._getTotalWidth = function() {
            var totalWidth = 0;
            for (var i = 0; i < this.dataStore.columns.length; i++) {
                var col = this.dataStore.columns[i];
                if (this._isColHidden(col)) continue;
                totalWidth += col.width || 100;
            }
            return totalWidth;
        };

        /**
         * 解析 extraBefore / extraAfter 配置，得到待渲染的 html 字符串
         * 支持两种形态：
         *   String  ：直接作为 html 使用；
         *   Function：以表格实例为参数调用，取其返回值作为 html。
         * 返回 '' / null / undefined 均视为“不渲染该区块”，不会输出空容器。
         * 注意：函数形态每次 render 都会重新执行，函数内如有重计算或高频渲染，性能由业务自行控制。
         * @param {String|Function} extra 配置值
         * @return {String} 待渲染 html，空字符串表示不渲染
         */
        Renderer.prototype._resolveExtraHtml = function(extra) {
            if (!extra) return '';

            if (typeof extra === 'function') {
                var ret = extra(this.table);
                if (ret === null || ret === undefined) return '';
                return String(ret);
            }

            return String(extra);
        };

        /**
         * 构建额外区块 html（带包裹容器）
         * @param {String|Function} extra 配置值
         * @param {String} className 包裹容器的样式类
         * @return {String} 完整区块 html，无内容时返回空字符串
         */
        Renderer.prototype._buildExtraBlock = function(extra, className) {
            var content = this._resolveExtraHtml(extra);
            if (!content) return '';
            return '<div class="' + className + '">' + content + '</div>';
        };

        /**
         * 渲染外层容器结构
         * extraBefore / extraAfter 与表头、表身同处 mel-table-container 内部（before → 表头 → 表身 → after）：
         *   - 同属一个父容器的普通文档流，宽度天然跟随表格，无需额外同步；
         *   - 不属于表头、表体，不参与列对齐、固定列、排序、选中、合并表头等任何表格逻辑；
         *   - 区块内如果放了按钮等交互 DOM，事件由业务自行绑定，组件不做代理。
         */
        Renderer.prototype._renderContainer = function() {
            var beforeHtml = this._buildExtraBlock(this.options.extraBefore, 'mel-table-extra-wrapper mel-table-extra-before-wrapper');
            var afterHtml = this._buildExtraBlock(this.options.extraAfter, 'mel-table-extra-wrapper mel-table-extra-after-wrapper');

            var lines = ['<div class="mel-table-container">'];

            // 无内容时不输出该行，不产生多余的空白区块
            if (beforeHtml) lines.push('  ' + beforeHtml);

            lines.push('  <div class="mel-table-header-wrapper">');
            lines.push('    <table class="mel-table-header">');
            lines.push('      <colgroup></colgroup>');
            lines.push('      <thead><tr></tr></thead>');
            lines.push('    </table>');
            lines.push('  </div>');
            lines.push('  <div class="mel-table-body-wrapper">');
            lines.push('    <table class="mel-table-body">');
            lines.push('      <colgroup></colgroup>');
            lines.push('      <tbody></tbody>');
            lines.push('    </table>');
            lines.push('  </div>');

            // 纵向固定表尾：独立 table（colgroup + 单行 tbody），位于滚动容器之外，
            // 因此垂直滚动不影响它；横向滚动由 _initLayout 的 onScroll 同步 scrollLeft。
            // 未启用表尾固定时保持 display:none，不占任何高度，与改造前行为一致。
            lines.push('  <div class="mel-table-footer-wrapper" style="display:none;">');
            lines.push('    <table class="mel-table-footer">');
            lines.push('      <colgroup></colgroup>');
            lines.push('      <tbody></tbody>');
            lines.push('    </table>');
            lines.push('  </div>');

            // 右侧 gutter：容器级绝对定位覆盖块（不是 wrapper 的子元素）。
            // 放容器级的好处：不改变任何 wrapper 的宽度，横向滚动最大值、fitWidth 基准、
            // extra 宽度全部保持原样；块只覆盖「表头带」「表尾带」这两段，不压住表身的滚动条。
            lines.push('  <div class="mel-table-gutter mel-table-gutter-header"></div>');
            lines.push('  <div class="mel-table-gutter mel-table-gutter-footer"></div>');

            if (afterHtml) lines.push('  ' + afterHtml);

            lines.push('</div>');

            this.el.innerHTML = lines.join('\r\n');

            this.container = this.el.querySelector('.mel-table-container');
            this.headerWrapper = this.el.querySelector('.mel-table-header-wrapper');
            this.headerTable = this.el.querySelector('.mel-table-header');
            this.bodyWrapper = this.el.querySelector('.mel-table-body-wrapper');
            this.bodyTable = this.el.querySelector('.mel-table-body');
            this.footerWrapper = this.el.querySelector('.mel-table-footer-wrapper');
            this.footerTable = this.el.querySelector('.mel-table-footer');
            this.footerTbody = this.footerTable ? this.footerTable.querySelector('tbody') : null;
            this.headerGutter = this.el.querySelector('.mel-table-gutter-header');
            this.footerGutter = this.el.querySelector('.mel-table-gutter-footer');
            this.theadTr = this.headerTable ? this.headerTable.querySelector('thead tr') : null;
            // thead 是整个表头行容器：多级表头时有多行，表头点击统一绑在它上面（它本身不随表头重绘被替换）
            this.thead = this.headerTable ? this.headerTable.querySelector('thead') : null;
            this.tbody = this.bodyTable ? this.bodyTable.querySelector('tbody') : null;
            this.extraBeforeWrap = this.container ? this.container.querySelector('.mel-table-extra-before-wrapper') : null;
            this.extraAfterWrap = this.container ? this.container.querySelector('.mel-table-extra-after-wrapper') : null;

            this._renderColgroup();
            this._applyAppearance();
        };

        /**
         * 渲染 colgroup（列宽控制），手动创建 col 元素兼容 IE9
         * 同时根据列宽总和动态调整 wrapper 宽度
         */
        Renderer.prototype._renderColgroup = function() {
            var columns = this.dataStore.columns;
            var totalWidth = 0;

            for (var i = 0; i < columns.length; i++) {
                if (this._isColHidden(columns[i])) continue;
                totalWidth += columns[i].width || 100;
            }

            // 处理表头 table
            if (this.headerTable !== null && typeof this.headerTable !== 'undefined') {
                var hcg = this.headerTable.querySelector('colgroup');
                if (hcg === null || typeof hcg === 'undefined') {
                    hcg = document.createElement('colgroup');
                    this.headerTable.insertBefore(hcg, this.headerTable.firstChild);
                }
                this._fillColgroup(hcg, columns);
                this.headerTable.style.width = totalWidth + 'px';
            }

            // 处理表身 table
            if (this.bodyTable !== null && typeof this.bodyTable !== 'undefined') {
                var bcg = this.bodyTable.querySelector('colgroup');
                if (bcg === null || typeof bcg === 'undefined') {
                    bcg = document.createElement('colgroup');
                    this.bodyTable.insertBefore(bcg, this.bodyTable.firstChild);
                }
                this._fillColgroup(bcg, columns);
                this.bodyTable.style.width = totalWidth + 'px';
            }

            // 处理固定表尾 table：列骨架与表身完全同源，否则单元格对不齐
            if (this.footerTable !== null && typeof this.footerTable !== 'undefined') {
                var fcg = this.footerTable.querySelector('colgroup');
                if (fcg === null || typeof fcg === 'undefined') {
                    fcg = document.createElement('colgroup');
                    this.footerTable.insertBefore(fcg, this.footerTable.firstChild);
                }
                this._fillColgroup(fcg, columns);
                this.footerTable.style.width = totalWidth + 'px';
            }

            // 动态调整 wrapper 宽度：列宽总和小于容器时，wrapper=table宽度，滚动条紧贴表格
            this._adjustWrapperWidth(totalWidth);
        };

        /**
         * 手动填充 colgroup（不用 innerHTML，兼容 IE9）
         */
        Renderer.prototype._fillColgroup = function(colgroup, columns) {
            // 清空旧 col
            while (colgroup.firstChild) {
                colgroup.removeChild(colgroup.firstChild);
            }
            // 手动创建 col 元素
            for (var i = 0; i < columns.length; i++) {
                var col = document.createElement('col');
                // 隐藏列宽置 0：col 个数与单元格个数保持一一对应（表头 colspan / 表身对齐不乱），
                // 但该列不占可见宽度，视觉上等于消失
                col.style.width = this._isColHidden(columns[i]) ? '0px' : (columns[i].width || 100) + 'px';
                colgroup.appendChild(col);
            }
        };

        /**
         * 动态调整 wrapper 宽度（接入 fitWidth 参数）
         * fitWidth=false：固定列宽模式，使用columns配置的固定px列宽
         * fitWidth=true ：弹性自适应模式，以各列width为权重，按容器宽度分配百分比填满容器
         */
        Renderer.prototype._adjustWrapperWidth = function(totalWidth) {
            if (!this.el) return;

            var opts = this.options;

            // 第一步：先确定 bodyWrapper（滚动容器）的宽度作为基准
            if (opts.fitWidth) {
                // fitWidth=true：列宽自适应。先判断列宽总和与容器宽度：
                //  - 列宽总和 <= 容器宽度：按权重弹性拉伸填满容器
                //  - 列宽总和 > 容器宽度：不拉伸，使用各列原始width，出现横向滚动条
                var fwContainer = this._getContentWidth(this.el);
                if (totalWidth <= fwContainer) {
                    if (this.bodyWrapper) this.bodyWrapper.style.width = '100%';
                } else {
                    // 列总宽超过容器：与固定列宽模式一致，wrapper撑满容器，出现水平滚动
                    if (this.bodyWrapper) this.bodyWrapper.style.width = '100%';
                }
            } else {
                // 固定列宽模式
                var containerWidth = this._getContentWidth(this.el);
                var scrollbarWidth = this._getScrollbarWidth();
                if (totalWidth + scrollbarWidth <= containerWidth) {
                    // 列总宽不足容器宽度：wrapper=列总宽+滚动条宽+2px安全余量，右侧留白，不出水平滚动条
                    var wrapperWidth = totalWidth + scrollbarWidth + 2;
                    if (this.bodyWrapper) this.bodyWrapper.style.width = wrapperWidth + 'px';
                } else {
                    // 列总宽超过容器宽度：wrapper撑满容器，出现水平滚动
                    if (this.bodyWrapper) this.bodyWrapper.style.width = '100%';
                }
            }

            // 第二步：以 bodyWrapper 的实际可视宽度(clientWidth，已扣除垂直滚动条)为对齐基准。
            // 表头 wrapper 与表头 table 均与表身可视宽度一致，保证两 table 列宽基准相同，杜绝错行。
            var bodyClientWidth = this.bodyWrapper ? this.bodyWrapper.clientWidth : 0;

            if (this.headerWrapper) {
                this.headerWrapper.style.width = (bodyClientWidth > 0 ? bodyClientWidth + 'px' : '100%');
            }
            this._syncFooterWidth();

            // 表头宽度定下来后立刻同步 extra 区块宽度（fitWidth 分支会在下面提前 return，这里不能漏）
            this._syncExtraWidth();

            if (opts.fitWidth) {
                // 判断列宽总和是否 <= 容器宽度，决定是否弹性拉伸
                var fitContainer = this._getContentWidth(this.el);
                if (totalWidth <= fitContainer) {
                    // 拉伸填满容器：表头表身 table 都以 bodyClientWidth 为基准，百分比列宽基准一致
                    if (this.headerTable) this.headerTable.style.width = (bodyClientWidth > 0 ? bodyClientWidth + 'px' : '100%');
                    if (this.bodyTable) this.bodyTable.style.width = (bodyClientWidth > 0 ? bodyClientWidth + 'px' : '100%');
                    // 各列按原列宽比例分配百分比，填满容器
                    this._applyFitWidthCols(totalWidth);
                } else {
                    // 列宽总和大于容器：不拉伸，使用各列原始width，保持列总宽并出现横向滚动
                    if (this.headerTable) this.headerTable.style.width = totalWidth + 'px';
                    if (this.bodyTable) this.bodyTable.style.width = totalWidth + 'px';
                    // 恢复 colgroup 为固定 px 列宽（避免残留拉伸时的百分比）
                    this._resetColgroupPx();
                }
                return;
            }

            // 固定列宽：表头表身 table 都保持列总宽 totalWidth
            if (this.headerTable) this.headerTable.style.width = totalWidth + 'px';
            if (this.bodyTable) this.bodyTable.style.width = totalWidth + 'px';
        };

        /**
         * fitWidth=true 时，把每列宽度改为按原列宽比例分配百分比，填满容器
         */
        Renderer.prototype._applyFitWidthCols = function(totalWidth) {
            if (totalWidth <= 0) return;

            var columns = this.dataStore.columns;
            var percents = [];
            for (var i = 0; i < columns.length; i++) {
                // 隐藏列不参与弹性分配，宽度固定为 0
                if (this._isColHidden(columns[i])) {
                    percents.push('0px');
                    continue;
                }
                var w = columns[i].width || 100;
                percents.push((w / totalWidth * 100) + '%');
            }

            // 表头 colgroup
            if (this.headerTable) {
                var hcg = this.headerTable.querySelector('colgroup');
                if (hcg) {
                    var cols = hcg.children;
                    for (var j = 0; j < cols.length && j < percents.length; j++) {
                        cols[j].style.width = percents[j];
                    }
                }
            }

            // 表身 colgroup
            if (this.bodyTable) {
                var bcg = this.bodyTable.querySelector('colgroup');
                if (bcg) {
                    var cols2 = bcg.children;
                    for (var k = 0; k < cols2.length && k < percents.length; k++) {
                        cols2[k].style.width = percents[k];
                    }
                }
            }

            // 表尾 colgroup：百分比必须与表身一致，否则弹性拉伸时列宽错位
            if (this.footerTable) {
                var fcg2 = this.footerTable.querySelector('colgroup');
                if (fcg2) {
                    var cols3 = fcg2.children;
                    for (var m = 0; m < cols3.length && m < percents.length; m++) {
                        cols3[m].style.width = percents[m];
                    }
                }
            }
        };

        /**
         * 重置表头表身 colgroup 各列为固定 px 列宽（fitWidth 不拉伸时调用）
         * 防止残留 fitWidth 拉伸时设置的百分比宽度。
         */
        Renderer.prototype._resetColgroupPx = function() {
            var columns = this.dataStore.columns;
            var i, j;

            if (this.headerTable) {
                var hcg = this.headerTable.querySelector('colgroup');
                if (hcg) {
                    var hcols = hcg.children;
                    for (i = 0; i < hcols.length && i < columns.length; i++) {
                        hcols[i].style.width = this._isColHidden(columns[i]) ? '0px' : (columns[i].width || 100) + 'px';
                    }
                }
            }

            if (this.bodyTable) {
                var bcg = this.bodyTable.querySelector('colgroup');
                if (bcg) {
                    var bcols = bcg.children;
                    for (j = 0; j < bcols.length && j < columns.length; j++) {
                        bcols[j].style.width = this._isColHidden(columns[j]) ? '0px' : (columns[j].width || 100) + 'px';
                    }
                }
            }

            if (this.footerTable) {
                var fcg = this.footerTable.querySelector('colgroup');
                if (fcg) {
                    var fcols = fcg.children;
                    for (var n = 0; n < fcols.length && n < columns.length; n++) {
                        fcols[n].style.width = this._isColHidden(columns[n]) ? '0px' : (columns[n].width || 100) + 'px';
                    }
                }
            }
        };

        /**
         * 获取垂直滚动条宽度（动态创建隐藏div计算，兼容各种浏览器）
         */
        Renderer.prototype._getScrollbarWidth = function() {
            var div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.top = '-9999px';
            div.style.width = '100px';
            div.style.height = '100px';
            div.style.overflow = 'scroll';
            document.body.appendChild(div);
            var width = div.offsetWidth - div.clientWidth;
            document.body.removeChild(div);
            return width;
        };

        /**
         * 获取水平滚动条高度（动态创建隐藏div计算）
         */
        Renderer.prototype._getScrollbarHeight = function() {
            var div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.top = '-9999px';
            div.style.width = '100px';
            div.style.height = '100px';
            div.style.overflow = 'scroll';
            document.body.appendChild(div);
            var height = div.offsetHeight - div.clientHeight;
            document.body.removeChild(div);
            return height;
        };

        /**
         * 应用外观配置
         */
        Renderer.prototype._applyAppearance = function() {
            var opts = this.options;

            if (opts.bordered === true && this.container) {
                this.container.className += ' mel-table-bordered';
            }
            if (opts.stripe && this.container) {
                this.container.className += ' mel-table-stripe';
            }
            if (opts.hoverHighlight !== false && this.container) {
                this.container.className += ' mel-table-hover';
            }
        };

        /**
         * 获取元素content区域高度（减去padding，兼容IE9）
         */
        Renderer.prototype._getContentHeight = function(el) {
            if (!el) return 0;
            var clientHeight = el.clientHeight;

            // 获取padding
            var paddingTop = 0;
            var paddingBottom = 0;
            if (window.getComputedStyle) {
                var style = window.getComputedStyle(el);
                paddingTop = parseInt(style.paddingTop, 10) || 0;
                paddingBottom = parseInt(style.paddingBottom, 10) || 0;
            } else if (el.currentStyle) {
                paddingTop = parseInt(el.currentStyle.paddingTop, 10) || 0;
                paddingBottom = parseInt(el.currentStyle.paddingBottom, 10) || 0;
            }

            return clientHeight - paddingTop - paddingBottom;
        };

        /**
         * 获取元素content区域宽度（减去padding，兼容IE9）
         */
        Renderer.prototype._getContentWidth = function(el) {
            if (!el) return 0;
            var clientWidth = el.clientWidth;

            var paddingLeft = 0;
            var paddingRight = 0;
            if (window.getComputedStyle) {
                var style = window.getComputedStyle(el);
                paddingLeft = parseInt(style.paddingLeft, 10) || 0;
                paddingRight = parseInt(style.paddingRight, 10) || 0;
            } else if (el.currentStyle) {
                paddingLeft = parseInt(el.currentStyle.paddingLeft, 10) || 0;
                paddingRight = parseInt(el.currentStyle.paddingRight, 10) || 0;
            }

            return clientWidth - paddingLeft - paddingRight;
        };

        /**
         * 强制 el 高度为 auto!important（兼容IE9）
         * 场景：fitViewport=true 或 (fitViewport=false && bodyHeight>0)
         * 作用：忽略外部CSS给el写死的固定高度，让el由内部内容(表头+表身+分页)自然撑开
         */
        Renderer.prototype._forceElAutoHeight = function() {
            if (!this.el) return;

            var css = this.el.style.cssText;
            if (css && css.indexOf('height') === -1) {
                // 用 cssText 拼上 auto!important，兼容IE9（IE9 不认 style.height='auto!important'）
                this.el.style.cssText = css + ';height:auto!important';
            } else if (!css) {
                this.el.style.height = 'auto';
            }
        };

        /**
         * 适配视口：接管body垂直滚动，自动计算el高度并占满视口剩余空间
         */
        Renderer.prototype._fitViewport = function() {

            // 接管body垂直滚动：保存原始值，强制hidden，保证页面不出现垂直滚动条、表格在一屏内展示
            if (this._bodyOverflow === undefined) {
                this._bodyOverflow = document.body.style.overflowY || document.body.style.overflow || '';
                document.body.style.overflowY = 'hidden';
            }

            // 先计算一次
            this._doFitViewport();
        };

        /**
         * 统一绑定窗口resize（节流）
         * 所有模式都刷新水平宽度(_adjustWrapperWidth)；fitViewport=true时额外刷新垂直高度(_doFitViewport)
         */
        Renderer.prototype._bindResize = function() {
            if (this._resizeBound) return;
            this._resizeBound = true;

            var self = this;
            var timer = null;

            var handler = function() {
                if (timer) return;
                timer = setTimeout(function() {
                    timer = null;
                    self._handleResize();
                }, 60);
            };

            this._resizeHandler = handler;

            if (window.addEventListener) {
                window.addEventListener('resize', handler, false);
            } else if (window.attachEvent) {
                window.attachEvent('onresize', handler);
            }
        };

        /**
         * 窗口resize实际刷新
         */
        Renderer.prototype._handleResize = function() {
            if (!this.el || !this.bodyWrapper) return;

            // 水平布局刷新（所有模式都需要）
            this._adjustWrapperWidth(this._getTotalWidth());

            // 垂直高度刷新：仅fitViewport=true需要重新按视口计算
            if (this.options.fitViewport) {
                this._doFitViewport();
            }
        };

        /**
         * 实际执行视口适配
         * el目标高度 = 视口高度 - 顶部内容高度(el到视口顶) - 底部预留间隙(viewportBottomGap)
         * 【关键】fitViewport只负责把整套表格组件(表头+表身+组件内分页)放进视口；
         * el后续的外部兄弟元素(result等)不属于表格，不参与高度扣除，由页面正常滚动访问。
         * 同时强制el高度auto!important，忽略外部CSS固定高度，由内容自然撑开。
         */
        Renderer.prototype._doFitViewport = function() {
            if (!this.el) return;

            // 强制 el 高度 auto!important，忽略外部CSS固定高度（如 el{height:300px}）
            this._forceElAutoHeight();

            // 视口高度
            var winHeight = window.innerHeight || document.documentElement.clientHeight;

            // 顶部内容高度 = el到视口顶部的距离
            var top = this.el.getBoundingClientRect().top;

            // 底部预留间隙 = viewportBottomGap（fitViewport模式下el与视口底边之间的空隙，露出body背景色）
            var gap = this.options.viewportBottomGap || 0;

            // el目标border-box总高度 = 视口高度 - 顶部内容高度 - 底部预留间隙
            // 说明：只把"el顶部到视口底部"这段空间分给表格整套组件；el后续外部元素不在视口配额内扣除
            var elTargetBox = winHeight - top - gap;

            this._applyLayout(elTargetBox);
        };

        /**
         * 统一布局推算（唯一一套推算逻辑，不重复）
         * 传入el目标border-box高度，依次推算container和bodyWrapper高度
         * el高度保持auto，由container和分页栏自然撑开
         * @param {Number} elTargetBox el目标border-box总高度
         * 分页扣除逻辑：只要分页不是fixed定位(在普通文档流、与container同级)，都要在el可用高度里预留分页位置；
         * 只有分页fixed(脱离文档流)才不扣除分页高度。
         */
        Renderer.prototype._applyLayout = function(elTargetBox) {
            if (!this.el || !this.container || !this.bodyWrapper) return;
            if (elTargetBox <= 0) return;

            // 读取el的padding和border
            var es = this._getBoxInfo(this.el);

            // el的content区域高度
            var elContent = elTargetBox - es.paddingTop - es.paddingBottom - es.borderTop - es.borderBottom;

            // 分页扣除逻辑：
            // fitViewport=true：无论分页top/bottom/fixed，一律扣除分页高度。
            //   - top/bottom：分页在视口内普通文档流，需要预留位置占位；
            //   - fixed：分页悬浮覆盖视口底部，需为表身底部预留避让高度，否则表身底部行会被fixed分页遮挡。
            // fitViewport=false：仅非fixed分页(top/bottom，与container同级普通流)才扣高度预留位置；fixed脱离文档流不扣。
            // 分页位置由Pagination插件的position参数控制，插件init时已回填到 options._paginationPos
            var fitViewport = this.options.fitViewport;
            var paginationPos = this.options._paginationPos || 'bottom';
            var needSubPagination = fitViewport ? true : (paginationPos !== 'fixed');

            var paginationHeight = 0;
            if (needSubPagination) {
                var paginationDom = this.el.querySelector('.mel-pagination');
                paginationHeight = this._getOuterHeight(paginationDom);
            }

            // extraBefore / extraAfter 现在位于 mel-table-container 内部（el content = container + 分页），
            // 因此这里只扣分页栏高度；上下额外区块的高度由 _applyContainerHeight 在 container 内部扣给表身。
            var containerTargetBox = elContent - paginationHeight;
            if (containerTargetBox <= 0) return;

            this._applyContainerHeight(containerTargetBox);

            // 实测校正：上面的高度是推算值，margin折叠、字体度量、滚动条出现与否都可能让
            // el实际总高度与目标差几个像素。应用后实测一次，超出就把差值回收到 container 上。
            // 只校正一轮：校正后再测通常已落回目标，重复校正反而会抖动。
            if (!this._layoutCorrecting) {
                var actualHeight = this.el.offsetHeight;
                var overflow = actualHeight - elTargetBox;
                if (overflow > 0) {
                    this._layoutCorrecting = true;
                    this._applyContainerHeight(containerTargetBox - overflow);
                    this._layoutCorrecting = false;
                }
            }
        };

        /**
         * 按目标高度设置 container / bodyWrapper 高度（_applyLayout 唯一落地点）
         * @param {Number} containerTargetBox container目标border-box高度
         */
        Renderer.prototype._applyContainerHeight = function(containerTargetBox) {
            if (!this.container || !this.bodyWrapper) return;
            if (containerTargetBox <= 0) return;

            this.container.style.boxSizing = 'border-box';
            this.container.style.height = containerTargetBox + 'px';

            // 读取container自己的border
            var cs = this._getBoxInfo(this.container);

            // 表头实际高度：headerHeight 为'auto'时读表头实际渲染高度；为数值时用指定值
            // 配置来自defaults合并结果，不写死数字
            var headerHeight = this.options.headerHeight;
            if (!(typeof headerHeight === 'number' && !isNaN(headerHeight))) {
                headerHeight = this.headerWrapper ? this.headerWrapper.offsetHeight : 0;
            }

            // extraBefore / extraAfter 在 container 内部，占地必须先从 container 高度里扣掉。
            // 【关键】用 _getOuterHeight（offsetHeight + 上下 margin）：offsetHeight 不含外边距，
            // 而 .mel-table-extra-before-wrapper / .mel-table-extra-after-wrapper 各带 8px margin，只减 offsetHeight 会稳定溢出 16px。
            var extraHeight = this._getOuterHeight(this.extraBeforeWrap) + this._getOuterHeight(this.extraAfterWrap);

            // bodyWrapper目标border-box高度 = container高度 - container border上下 - 表头高度 - 上下额外区块高度
            // 固定表尾占用高度：display:none 时为 0（未启用/已降级都不扣）
            var footerVisible = this._isFooterVisible();
            var footerHeight = footerVisible ? this._getOuterHeight(this.footerWrapper) : 0;

            // bodyWrapper目标border-box高度 = container高度 - border - 表头 - extra - 固定表尾
            var bodyHeight = containerTargetBox - cs.borderTop - cs.borderBottom - headerHeight - extraHeight - footerHeight;

            // 空间不足保护：表尾吃掉了大部分高度时自动降级回表身内渲染，避免表身被压成 0/负数
            if (footerVisible && bodyHeight < this._footerMinBodyHeight) {
                this._degradeFooter();
                footerVisible = false;
                footerHeight = 0;
                bodyHeight = containerTargetBox - cs.borderTop - cs.borderBottom - headerHeight - extraHeight;
            }

            if (bodyHeight > 0) {
                this.bodyWrapper.style.height = bodyHeight + 'px';
                this.bodyWrapper.style.overflow = 'auto';
            }

            // 表身高变化后，垂直滚动条可能出现/消失，导致 bodyClientWidth 变化；
            // 重新对齐表头 wrapper 宽度到 bodyWrapper.clientWidth，保证表头表身不错行
            this._syncHeaderWidth();
        };

        /**
         * 取元素「外框高度」：offsetHeight + 上下外边距
         * 用途：高度扣减必须包含 margin，否则带 margin 的区块会稳定溢出。
         * 兼容IE9：无 getComputedStyle 时退化用 currentStyle
         * @param {Element} el 目标元素
         * @return {Number} 元素占据的垂直高度（含 margin），元素不存在返回 0
         */
        Renderer.prototype._getOuterHeight = function(el) {
            if (!el) return 0;

            var h = el.offsetHeight || 0;
            var marginTop = 0;
            var marginBottom = 0;

            if (window.getComputedStyle) {
                var style = window.getComputedStyle(el);
                marginTop = parseInt(style.marginTop, 10) || 0;
                marginBottom = parseInt(style.marginBottom, 10) || 0;
            } else if (el.currentStyle) {
                marginTop = parseInt(el.currentStyle.marginTop, 10) || 0;
                marginBottom = parseInt(el.currentStyle.marginBottom, 10) || 0;
            }

            return h + marginTop + marginBottom;
        };

        /**
         * 给表头 table 打/去「多行表头」标记（mel-header-multi）
         * @param {Boolean} isMulti 是否多行表头
         */
        Renderer.prototype._setMultiHeaderFlag = function(isMulti) {
            if (!this.headerTable) return;

            var cls = ' ' + this.headerTable.className + ' ';
            var has = cls.indexOf(' mel-header-multi ') > -1;

            if (isMulti && !has) {
                this.headerTable.className += ' mel-header-multi';
            } else if (!isMulti && has) {
                this.headerTable.className = cls.replace(' mel-header-multi ', ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
            }
        };

        /**
         * 同步表头 wrapper 宽度与表身可视宽度一致（已扣除垂直滚动条）
         * 表头表身是两个独立 table，靠列宽基准一致对齐；表身有垂直滚动条会吃掉右侧可视宽度，
         * 表头必须跟随 bodyWrapper.clientWidth，否则水平滚动/自适应时错行。
         */
        Renderer.prototype._syncHeaderWidth = function() {
            if (!this.headerWrapper || !this.bodyWrapper) return;
            var cw = this.bodyWrapper.clientWidth;
            if (cw > 0) {
                // 表头 wrapper 与表身可视宽度对齐
                this.headerWrapper.style.width = cw + 'px';
                // fitWidth=true 时，表头表身 table 也以当前 bodyClientWidth 为基准重设，
                // 使垂直滚动条出现/消失导致的基准变化同步到两 table，杜绝错行
                if (this.options.fitWidth) {
                    if (this.headerTable) this.headerTable.style.width = cw + 'px';
                    if (this.bodyTable) this.bodyTable.style.width = cw + 'px';
                }
            }
            // 表尾宽度与表身可视宽度同源（与表头同一基准）
            this._syncFooterWidth();
            // extra 区块跟着表头宽度走，保证右边界与表头齐平
            this._syncExtraWidth();
            // 滚动条宽度可能因表身高度变化而改变，最后统一校准 gutter 与 wrapper 宽度
            this._syncGutter();
        };

        /**
         * 同步固定表尾宽度
         * 表尾不在滚动容器内，宽度必须显式对齐 bodyWrapper.clientWidth（已扣除垂直滚动条），
         * 否则会被滚动条宽度带偏，右侧差几像素露出底色
         */
        Renderer.prototype._syncFooterWidth = function() {
            if (!this.footerWrapper || !this.bodyWrapper) return;
            var cw = this.bodyWrapper.clientWidth;
            if (cw <= 0) return;

            this.footerWrapper.style.width = cw + 'px';
            // fitWidth 模式：表尾 table 与表身 table 同基准，否则弹性列宽比例不一致
            if (this.options.fitWidth && this.footerTable) {
                this.footerTable.style.width = cw + 'px';
            }

            this._syncGutter();
        };

        /**
         * 读取元素某一边的边框宽度（像素数值）
         * @param {Element} el 目标元素
         * @param {String} side 'Left' / 'Right' / 'Top' / 'Bottom'
         * @return {Number} 边框宽度，取不到时为 0
         */
        Renderer.prototype._getBorderWidth = function(el, side) {
            if (!el) return 0;
            var val = '';
            if (window.getComputedStyle) {
                val = window.getComputedStyle(el)['border' + side + 'Width'];
            } else if (el.currentStyle) {
                val = el.currentStyle['border' + side + 'Width'];
            }
            var num = parseFloat(val);
            return isNaN(num) ? 0 : num;
        };

        /**
         * 解析右侧 gutter 空块的底色
         * 表头 gutter 紧挨最后一列，取最后一列的 headBgColor 保证颜色连续；
         * 未配置则回退到全局表头背景，再回退白色
         */
        Renderer.prototype._getGutterBg = function() {
            var columns = this.dataStore.columns || [];
            for (var i = columns.length - 1; i >= 0; i--) {
                if (this._isColHidden(columns[i])) continue;
                if (columns[i].headBgColor) return columns[i].headBgColor;
                break;
            }
            return this._getHeadBgColor(null) || '#ffffff';
        };

        /**
         * 同步右侧 gutter（视觉占用块）
         * 表身出现纵向滚动条时，表头/表尾右侧会空出「滚动条宽度」的一截；
         * 这里把 wrapper 宽度补到 bodyWrapper.offsetWidth（含滚动条），
         * 再用绝对定位的空块铺满这一截，让滚动条看起来在表格内部而不是贴在表外。
         * 只影响 wrapper 宽度与空块尺寸，表头/表尾 table 宽度仍按 clientWidth 设置，列结构与宽度账本不动。
         */
        Renderer.prototype._syncGutter = function() {
            if (!this.bodyWrapper || !this.container) return;

            var bw = this.bodyWrapper;
            var client = bw.clientWidth;

            // 滚动条宽度必须把 wrapper 自身的 border 排除掉：offsetWidth - clientWidth 里含 border，
            // 直接把差值当滚动条宽度会让 gutter 宽出 1~2px，并让 left 偏移 1px（大屏/高 DPI 下更明显）
            var borderLeft = this._getBorderWidth(bw, 'Left');
            var borderRight = this._getBorderWidth(bw, 'Right');

            var gutter;
            var left;
            if (bw.getBoundingClientRect && this.container.getBoundingClientRect) {
                // 用 rect 计算：分数像素（高 DPI、125% 缩放）下也能对齐，不依赖整数化的 offsetLeft/clientWidth
                var bwRect = bw.getBoundingClientRect();
                var cRect = this.container.getBoundingClientRect();
                gutter = bwRect.width - borderLeft - borderRight - client;
                // 覆盖块左边界 = 表身内容区右边界 = wrapper 右边 - 右边框 - 滚动条宽度
                left = bwRect.right - cRect.left - borderRight - gutter;
            } else {
                gutter = bw.offsetWidth - borderLeft - borderRight - client;
                left = bw.offsetLeft + borderLeft + client;
            }
            if (gutter < 0) gutter = 0;

            // 0/1px 视为没有滚动条（部分环境滚动条宽度就是 0，不能硬留空）
            var show = gutter > 1;

            var hg = this.headerGutter;
            if (hg) {
                if (show && this.headerWrapper) {
                    hg.style.display = 'block';
                    hg.style.left = left + 'px';
                    hg.style.top = this.headerWrapper.offsetTop + 'px';
                    hg.style.width = gutter + 'px';
                    hg.style.height = this.headerWrapper.offsetHeight + 'px';
                    hg.style.backgroundColor = this._getGutterBg();
                } else {
                    hg.style.display = 'none';
                }
            }

            var fg = this.footerGutter;
            if (fg) {
                if (show && this.footerWrapper && this._isFooterVisible()) {
                    fg.style.display = 'block';
                    fg.style.left = left + 'px';
                    fg.style.top = this.footerWrapper.offsetTop + 'px';
                    fg.style.width = gutter + 'px';
                    fg.style.height = this.footerWrapper.offsetHeight + 'px';
                } else {
                    fg.style.display = 'none';
                }
            }
        };

        /**
         * 同步 extraBefore / extraAfter 的宽度 = 表头 wrapper 可视宽度
         * 原因：extra 区块是 el 的直接子元素，默认撑满 el；而表头 wrapper 宽度是
         * bodyWrapper.clientWidth（已扣除垂直滚动条、且固定列宽模式下还可能比 el 窄），
         * 两者不等宽时 extra 内容会越过表头右边界，视觉割裂。
         * 这里统一以表头 wrapper 可视宽度为准（表头 wrapper 有背景与下边框，是最直观的右边界）。
         */
        Renderer.prototype._syncExtraWidth = function() {
            if (!this.headerWrapper) return;

            // 基准用表身可视宽度：与表头 wrapper 宽度同源，宽表时也不会取到列总宽把 extra 撑出去
            var w = this.bodyWrapper ? this.bodyWrapper.clientWidth : this.headerWrapper.clientWidth;
            if (w <= 0) return;

            if (this.extraBeforeWrap) {
                this.extraBeforeWrap.style.width = w + 'px';
            }
            if (this.extraAfterWrap) {
                this.extraAfterWrap.style.width = w + 'px';
            }
        };

        /**
         * 应用固定列样式到当前表头/表身的固定列 td/th
         * 仅设置样式(相对定位、z-index、背景、当前left)，不重复绑定滚动事件。
         * 在 render 初始、翻页、增删行(_renderBody)后调用，保证重建后的固定列样式不丢失。
         * 【背景色关键】冻结 td 不能写死固定色，必须实时取所属行 tr 的实际渲染背景色
         * (含斑马纹、hover)，否则下层滚动内容会穿透，且行间颜色不一致。
         */
        /**
         * 取出表头中「覆盖前 count 列」的全部 th
         * 合并表头有多行，且有 colspan（分组）、rowspan（浅层列/非分组列），
         * 所以要按网格推演每个 th 的实际起始列，再挑出起始列 < count 的那些。
         * 单级表头时等价于「该行前 count 个 th」，行为与改造前完全一致。
         * @param {Number} count 固定列数量（从第1列开始连续 count 列）
         * @return {Array} th 列表
         */
        Renderer.prototype._getFixedHeaderCells = function(count) {
            var result = [];
            var rows = this.theadTrs;

            // 固定列数量按「可见列」计：隐藏列已不占可见宽度，不能吃掉固定列的坑位。
            // 用列配置的前缀可见列计数，把网格原始列号换算成可见列号。
            var colsCfg = (this.dataStore && this.dataStore.columns) || [];
            var pre = [];
            var vis = 0;
            for (var n = 0; n <= colsCfg.length; n++) {
                pre[n] = vis;
                if (n < colsCfg.length && !this._isColHidden(colsCfg[n])) vis++;
            }

            if (!rows || !rows.length) {
                // 兜底：没有多行引用时退化为单行前 count 个可见列（如插件在表头未渲染时调用）
                if (this.theadTr) {
                    var single = this.theadTr.children;
                    var picked = 0;
                    for (var k = 0; k < single.length && picked < count; k++) {
                        if (this._isHiddenCell(single[k])) continue;
                        result.push(single[k]);
                        picked++;
                    }
                }
                return result;
            }

            // 网格推演：逐行逐格计算起始列，被上方 rowspan 占用的列跳过
            var placed = [];
            for (var r = 0; r < rows.length; r++) {
                var cells = rows[r].children;
                var col = 0;
                for (var c = 0; c < cells.length; c++) {
                    var th = cells[c];
                    var colspan = parseInt(th.getAttribute('colspan'), 10) || 1;
                    var rowspan = parseInt(th.getAttribute('rowspan'), 10) || 1;

                    while (this._isColumnOccupied(placed, r, col)) {
                        col++;
                    }

                    placed.push({row: r, col: col, colspan: colspan, rowspan: rowspan, th: th});
                    col += colspan;
                }
            }

            for (var i = 0; i < placed.length; i++) {
                // 单元格起始列的「可见列序号」小于 count 才算固定列；隐藏单元格本身不参与固定
                var visibleStart = pre[placed[i].col] === undefined ? placed[i].col : pre[placed[i].col];
                if (visibleStart < count && !this._isHiddenCell(placed[i].th)) {
                    result.push(placed[i].th);
                }
            }
            return result;
        };

        /**
         * 取某一行需要冻结的单元格
         * 固定列数量一律按「可见列」计：隐藏列已不占可见宽度，跳过它继续数，
         * 否则隐藏列会白吃一个固定坑位，导致后面的列没被固定、滚动时压住固定内容。
         * 首次渲染、滚动同步、hover 换背景三处必须共用这一个口径，不能各写一套。
         * @param {Element} tr 行节点
         * @param {Number} count 需要冻结的可见列数
         * @return {Array} td 列表
         */
        Renderer.prototype._getFixedBodyCells = function(tr, count) {
            var result = [];
            if (!tr || !tr.children) return result;
            var tds = tr.children;
            for (var i = 0; i < tds.length && result.length < count; i++) {
                if (this._isHiddenCell(tds[i])) continue;
                result.push(tds[i]);
            }
            return result;
        };

        /**
         * 判断某个 th / td 是否为隐藏列单元格（靠渲染时打的 mel-col-hidden 类）
         * @param {Element} cell 单元格节点
         * @return {Boolean}
         */
        Renderer.prototype._isHiddenCell = function(cell) {
            if (!cell || !cell.className) return false;
            return (' ' + cell.className + ' ').indexOf(' mel-col-hidden ') >= 0;
        };

        /**
         * 判断某行某列是否已被上方（rowspan）单元格占用
         * @param {Array} placed 已排布单元格记录
         * @param {Number} row 行号
         * @param {Number} col 列号
         * @return {Boolean}
         */
        Renderer.prototype._isColumnOccupied = function(placed, row, col) {
            for (var i = 0; i < placed.length; i++) {
                var p = placed[i];
                if (p.row < row && row < p.row + p.rowspan && p.col <= col && col < p.col + p.colspan) {
                    return true;
                }
            }
            return false;
        };

        Renderer.prototype._applyFixedColumns = function() {
            var fixedLeft = this.options.fixedLeftColumns || 0;
            if (fixedLeft <= 0) return;
            if (!this.theadTr || !this.tbody) return;

            var scrollLeft = this.bodyWrapper ? this.bodyWrapper.scrollLeft : 0;

            // 表头固定列（表头背景固定 #f5f7fa）
            // 注意：合并表头时不能简单取叶子行前 N 个 th——分组 th 有 colspan、浅层列有 rowspan，
            // 叶子行的第 1 个 th 未必是第 1 列。这里按网格推演出的「列偏移」挑选覆盖前 N 列的 th。
            // 表头固定列：底色取该 th 当前生效的背景（列级/全局表头背景都算在内），
            // 不能再写死 #f5f7fa，否则会盖掉 columns.headBgColor 与「表头无背景」这两种配置
            var headerCells = this._getFixedHeaderCells(fixedLeft);
            this._headerFixedCells = headerCells;
            for (var h = 0; h < headerCells.length; h++) {
                var th = headerCells[h];
                th.style.position = 'relative';
                th.style.left = scrollLeft + 'px';
                th.style.zIndex = '2';
                th.style.backgroundColor = this._getEffectiveBgColor(th);
                this._setFixedShadow(th);
            }

            // 表身固定列：背景取所属行 tr 的实际渲染色
            // 固定列数量按「可见列」计：隐藏列不占可见宽度，跳过它继续数，避免它白占一个固定坑位
            var trs = this.tbody.children;
            for (var r = 0; r < trs.length; r++) {
                // 展开详情行整行跨列，不属于数据行，不参与冻结列平移
                if (this._isExpandRowTr(trs[r])) continue;
                var rowBg = this._getRowBackground(trs[r]);
                var cells = this._getFixedBodyCells(trs[r], fixedLeft);
                for (var c = 0; c < cells.length; c++) {
                    cells[c].style.position = 'relative';
                    cells[c].style.left = scrollLeft + 'px';
                    cells[c].style.zIndex = '1';
                    cells[c].style.backgroundColor = rowBg;
                    this._setFixedShadow(cells[c]);
                }
            }

            // 表尾行单独处理（不在 this.tbody.children 里）
            this._applyFixedToFooter(scrollLeft);
        };

        /**
         * 给固定表尾行应用左冻结样式
         * 复用 _getFixedBodyCells（隐藏列跳过、按可见列数计），与表身/表头同一套口径，
         * 否则会出现"表身冻结 2 列、表尾冻结 1 列"的错位
         * @param {Number} scrollLeft 当前横向滚动偏移
         */
        Renderer.prototype._applyFixedToFooter = function(scrollLeft) {
            var fixedLeft = this.options.fixedLeftColumns || 0;
            if (fixedLeft <= 0 || !this.footerTbody) return;

            var trs = this.footerTbody.children;
            for (var r = 0; r < trs.length; r++) {
                var cells = this._getFixedBodyCells(trs[r], fixedLeft);
                for (var c = 0; c < cells.length; c++) {
                    cells[c].style.position = 'relative';
                    cells[c].style.left = (scrollLeft || 0) + 'px';
                    cells[c].style.zIndex = '1';
                    // 合计行固定列背景跟随合计行底色，避免透出下方内容
                    cells[c].style.backgroundColor = '#f5f7fa';
                    this._setFixedShadow(cells[c]);
                }
            }
        };

        /**
         * 获取行的实际渲染背景色（兼容IE9：getComputedStyle 或 currentStyle）
         * 优先取 tr 自身的背景色；若透明/未设置，则回退到表格容器背景或 #fff
         */
        Renderer.prototype._getRowBackground = function(tr) {
            var bg = '';
            if (window.getComputedStyle) {
                bg = window.getComputedStyle(tr).backgroundColor;
            } else if (tr.currentStyle) {
                bg = tr.currentStyle.backgroundColor;
            }

            // 透明/未设置：向上找容器背景，否则默认白
            if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' || bg === 'rgba(0,0,0,0)') {
                if (this.container) {
                    var cb = '';
                    if (window.getComputedStyle) {
                        cb = window.getComputedStyle(this.container).backgroundColor;
                    } else if (this.container.currentStyle) {
                        cb = this.container.currentStyle.backgroundColor;
                    }
                    if (cb && cb !== 'transparent' && cb !== 'rgba(0, 0, 0, 0)' && cb !== 'rgba(0,0,0,0)') {
                        return cb;
                    }
                }
                return '#ffffff';
            }
            return bg;
        };

        /**
         * 给冻结单元格右侧加内阴影，视觉分隔冻结区与滚动区
         */
        Renderer.prototype._setFixedShadow = function(cell) {
            var shadow = '2px 0 6px -2px rgba(0,0,0,0.15)';
            cell.style.boxShadow = shadow;
        };

        /**
         * 获取元素的padding和border尺寸（兼容IE9，用currentStyle）
         */
        Renderer.prototype._getBoxInfo = function(el) {
            var info = {
                paddingTop: 0, paddingBottom: 0, borderTop: 0, borderBottom: 0,
                paddingLeft: 0, paddingRight: 0, borderLeft: 0, borderRight: 0
            };

            var s = null;
            if (window.getComputedStyle) {
                s = window.getComputedStyle(el);
            } else if (el.currentStyle) {
                s = el.currentStyle;
            }
            if (!s) return info;

            info.paddingTop = parseInt(s.paddingTop, 10) || 0;
            info.paddingBottom = parseInt(s.paddingBottom, 10) || 0;
            info.borderTop = parseInt(s.borderTopWidth, 10) || 0;
            info.borderBottom = parseInt(s.borderBottomWidth, 10) || 0;
            info.paddingLeft = parseInt(s.paddingLeft, 10) || 0;
            info.paddingRight = parseInt(s.paddingRight, 10) || 0;
            info.borderLeft = parseInt(s.borderLeftWidth, 10) || 0;
            info.borderRight = parseInt(s.borderRightWidth, 10) || 0;

            return info;
        };

        /**
         * 判断元素有没有明确设置高度（不是auto）
         */
        Renderer.prototype._hasExplicitHeight = function(el) {
            if (!el) return false;

            if (el.style.height && el.style.height !== 'auto') return true;

            var height = '';
            if (window.getComputedStyle) {
                height = window.getComputedStyle(el).height;
            } else if (el.currentStyle) {
                height = el.currentStyle.height;
            }

            return height && height !== 'auto' && height !== '';
        };

        /**
         * 调整表身高度入口
         * 优先级：bodyHeight配置 > el明确高度 > 自然展开
         */
        Renderer.prototype._adjustBodyHeight = function() {
            var opts = this.options;

            // bodyHeight传了就固定高度
            if (opts.bodyHeight && opts.bodyHeight > 0) {
                // bodyHeight固定表身时，el高度由表头+表身+分页撑开，强制auto!important，忽略外部固定高度
                this._forceElAutoHeight();
                if (this.bodyWrapper) {
                    this.bodyWrapper.style.height = opts.bodyHeight + 'px';
                    this.bodyWrapper.style.overflow = 'auto';
                }
                // 高度定下来后垂直滚动条可能才出现/消失，bodyWrapper可视宽度随之变化，
                // 必须重算表头与 extra 宽度，否则表头比表身宽一个滚动条、extra 跟着错位
                this._syncHeaderWidth();
                return;
            }

            // el有明确高度：el目标高度=el实际border-box高度，交给统一方法推算
            if (this._hasExplicitHeight(this.el)) {
                this._applyLayout(this.el.offsetHeight);
                return;
            }

            // el高度auto：不设置固定高度，自然展开
        };

        /**
         * 初始化布局（固定列、滚动同步）
         * 无条件绑定表身滚动事件：表身横向滚动时同步表头scrollLeft；
         * fixedLeft>0时额外平移固定列。用事件监听注册，避免onscroll直接赋值被覆盖。
         */
        Renderer.prototype._initLayout = function() {
            if (!this.bodyWrapper) return;

            var self = this;
            var fixedLeft = this.options.fixedLeftColumns || 0;

            var onScroll = function() {
                // 同步表头横向滚动
                if (self.headerWrapper) {
                    self.headerWrapper.scrollLeft = this.scrollLeft;
                }
                // 同步固定表尾横向滚动（表尾自带 overflow:hidden，不产生独立滚动条）
                if (self.footerWrapper) {
                    self.footerWrapper.scrollLeft = this.scrollLeft;
                }

                // 固定列平移（左侧连续N列）
                // 注意：left 取 +scrollLeft，因为滚动容器内容向左移动了 scrollLeft，
                // 固定列需向右补偿相同距离才能保持视觉原位（方案X position:relative+left 平移）
                if (fixedLeft > 0) {
                    var offset = this.scrollLeft;
                    var trs = self.tbody ? self.tbody.children : [];
                    for (var r = 0; r < trs.length; r++) {
                        // 展开详情行整行跨列，不参与冻结列平移
                        if (self._isExpandRowTr(trs[r])) continue;
                        var cells = self._getFixedBodyCells(trs[r], fixedLeft);
                        for (var c = 0; c < cells.length; c++) {
                            cells[c].style.position = 'relative';
                            cells[c].style.left = offset + 'px';
                            cells[c].style.zIndex = '1';
                        }
                    }

                    // 表头固定列：多行表头时是「覆盖前 N 列的 th 列表」，不是某一行的前 N 个（由 _applyFixedColumns 缓存）
                    var ths = self._headerFixedCells || [];
                    for (var i = 0; i < ths.length; i++) {
                        ths[i].style.position = 'relative';
                        ths[i].style.left = offset + 'px';
                        ths[i].style.zIndex = '2';
                    }

                    // 表尾固定列：表尾已不在 tbody 内，必须单独平移，否则横向滚动时合计行的冻结列会跟着跑
                    self._applyFixedToFooter(offset);
                }
            };

            // 保存handler引用，destroy时移除
            this._bodyScrollHandler = onScroll;

            if (this.bodyWrapper.addEventListener) {
                this.bodyWrapper.addEventListener('scroll', onScroll, false);
            } else if (this.bodyWrapper.attachEvent) {
                this.bodyWrapper.attachEvent('onscroll', onScroll);
            }

            // 初始应用固定列样式（含背景色），滚动事件只负责平移 left
            this._applyFixedColumns();
        };

        /**
         * 设置表头行 HTML（兼容IE9）
         * IE9 不允许直接给 <tr> 赋值 innerHTML（报错"该操作的目标元件无效"），
         * 且游离的 table/tbody 元素直接赋值 innerHTML，IE9 不会正确解析 <tr>/<td> 结构，
         * 会出现 th/tr/td 标签丢失、排版错乱。
         * 正确做法：用普通 div 容器赋完整 <table><tbody>...</tbody></table> 结构，
         * 再从中取出解析好的 <tr> 节点迁移到真实 theadTr，彻底规避 IE9 对 table 系元素赋 innerHTML 的限制。
         * @param {String} html 表头行的 th HTML 字符串
         */
        Renderer.prototype._setTheadHtml = function(rowsHtml) {
            if (!this.thead) return;

            // IE9 兼容【彻底方案】：table / tbody / tr 系列元素直接赋 innerHTML（内容含表格内部标签）
            // 会抛"该操作的目标元件无效"(Invalid target element for this operation)，这是 IE9 的硬性限制，
            // 无论该 table 是否已挂到文档。因此不再用 table 元素做解析容器，
            // 改用普通 div 容器：div 是通用容器，IE9 允许对 div 赋含 <table> 结构的 innerHTML，
            // 再从中取出解析好的 <tr> 节点迁移到真实 thead，彻底规避该限制。
            // 参数为完整的行 html（可多行 <tr>...</tr>，合并表头时即多行）。
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = '<table><tbody>' + rowsHtml + '</tbody></table>';
            var tempTbody = tempDiv.getElementsByTagName('tbody')[0];
            if (!tempTbody) return;

            // 原地替换：先清空旧 thead，再把解析出的每一行 tr 依次迁移进去。
            // 保留 this.thead 引用不变：表头点击事件绑在 thead 上，换行不会丢事件。
            while (this.thead.firstChild) {
                this.thead.removeChild(this.thead.firstChild);
            }

            var tr;
            while ((tr = tempTbody.firstChild)) {
                this.thead.appendChild(tr);
            }

            // 维护行引用：
            //   theadTrs：全部表头行（合并表头时多行）
            //   theadTr ：叶子行（最后一行），其 th 数量与表身列数一致，
            //             固定列定位、滚动同步都以它为准；单级表头时它就是唯一一行，行为与改造前一致。
            this.theadTrs = this.thead.getElementsByTagName('tr');
            this.theadTr = this.theadTrs.length ? this.theadTrs[this.theadTrs.length - 1] : null;

            // 多行（合并）表头标记：css 靠它区分「单级表头收边」与「多行表头保留最后一列右边框」。
            // 表头会随排序等重绘，所以两种状态都要显式切换，不能只加不减。
            this._setMultiHeaderFlag(this.theadTrs.length > 1);
        };

        /**
         * 渲染表头
         */
        /**
         * 生成单个叶子列的 th html（排序箭头、全选 checkbox、副标题等列级细节都在这里，唯一出口）
         * 合并表头插件渲染叶子单元格时也走此方法，避免两处各写一套导致行为不一致
         * @param {Object} col 列配置
         * @param {String} extraClass 额外追加的样式类（可选）
         * @param {Number} rowspan 纵向跨行数（可选，默认1）。多级表头里浅层列/非分组列需要纵向跨行才能与表身对齐
         * @return {String} th html
         */
        /**
         * 判断某列是否可点击表头排序（决定是否显示 pointer 光标）
         * 规则：
         *   1. 未启用 Sort 插件 → 一律不可排序（避免光标 pointer 却点了没反应）；
         *   2. 分组表头（无 field）与内部列（field 以 _ 开头）不参与排序；
         *   3. 列配置 sortable:false → 该列不可排序；不写该项默认可排序。
         * @param {Object} col 列配置
         * @return {Boolean}
         */
        Renderer.prototype._isColSortable = function(col) {
            if (!this.sortEnabled) return false;
            if (!col || !col.field) return false;
            if (col.field.charAt(0) === '_') return false;
            return col.sortable !== false;
        };

        /**
         * 解析表头单元格应使用的背景色（列配置优先于全局）
         * 优先级：columns[i].headBgColor > options.headBgEnable+headBgColor > 无背景
         * @param {Object} col 列配置（合并表头的分组列也适用）
         * @return {String} 背景色，'' 表示不设置
         */
        Renderer.prototype._getHeadBgColor = function(col) {
            if (col && col.headBgColor) return col.headBgColor;
            if (this.options.headBgEnable) return this.options.headBgColor || '#f5f7fa';
            return '';
        };

        /**
         * 解析表头单元格的内联样式（背景色 / 文字颜色）
         * 直接作用在 th 上，因此天然覆盖全局 CSS；表身 td 不受影响
         * @param {Object} col 列配置
         * @return {String} style 属性片段，空字符串表示不设置样式
         */
        Renderer.prototype._getThStyleAttr = function(col) {
            var bg = this._getHeadBgColor(col);
            var color = (col && col.headTextColor) || '';
            var style = '';
            if (bg) style += 'background-color:' + bg + ';';
            if (color) style += 'color:' + color + ';';
            return style ? (' style="' + style + '"') : '';
        };

        /**
         * 读取元素当前生效的背景色，透明时回退到容器色 / 白色
         * 冻结列表头必须有不透明底色，否则横向滚动时下层内容会透出来
         * @param {Element} el 目标元素
         * @return {String} 背景色
         */
        Renderer.prototype._getEffectiveBgColor = function(el) {
            if (!el) return '#ffffff';

            var bg = '';
            if (window.getComputedStyle) {
                bg = window.getComputedStyle(el).backgroundColor;
            } else if (el.currentStyle) {
                bg = el.currentStyle.backgroundColor;
            }

            if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' || bg === 'rgba(0,0,0,0)') {
                return this._getRowBackground(this.container) || '#ffffff';
            }
            return bg;
        };

        Renderer.prototype._buildThHtml = function(col, extraClass, rowspan) {
            var title = col.title || '';
            var subtitle = col.subtitle || '';
            var align = col.align || 'center';
            var alignClass = 'mel-align-' + align;
            if (extraClass) alignClass += ' ' + extraClass;

            // 隐藏列：th 照常渲染（DOM 保留），只挂隐藏类，CSS display:none
            if (this._isColHidden(col)) alignClass += ' mel-col-hidden';

            // 可排序列：追加标记类，CSS 只负责 cursor:pointer
            if (this._isColSortable(col)) alignClass += ' mel-th-sortable';

            var sortField = this.dataStore.sortField;
            var sortOrder = this.dataStore.sortOrder;

            var arrow = '';
            if (col.field === sortField && sortOrder) {
                arrow = '<span class="mel-sort-arrow" style="margin-left:4px;font-size:10px;color:#409eff;">' + (sortOrder === 'asc' ? '▲' : '▼') + '</span>';
            }

            // 多选列表头全选 checkbox（单选模式单选列不渲染全选，且强制忽略showSelectAll）
            var thContent = '';
            if (col.field === '_checkbox' && this.options.showSelectAll !== false && col.mode !== 'single') {
                thContent = '<input type="checkbox" class="mel-header-checkbox">';
            } else {
                thContent = '<div class="mel-th-inner">';
                thContent += '<span class="mel-th-title">' + title + '</span>';
                // 顺序必须是「标题 → 排序箭头 → 副标题」：
                // 副标题是 block 元素（独占一行且必须在标题下方，IE9 不能用 flex），
                // 箭头放在副标题之前才能跟标题文字同一行，跑到副标题那一行就换行了
                thContent += arrow;
                if (subtitle) {
                    thContent += '<em class="mel-th-subtitle">' + subtitle + '</em>';
                }
                thContent += '</div>';
            }

            var spanAttr = (rowspan && rowspan > 1) ? (' rowspan="' + rowspan + '"') : '';
            var styleAttr = this._getThStyleAttr(col);
            return '<th class="' + alignClass + '" data-field="' + (col.field || '') + '"' + styleAttr + spanAttr + '>' + thContent + '</th>';
        };

        /**
         * 生成默认单行表头 html（无合并表头时使用）
         * @return {String} 单行 <tr>...</tr>
         */
        Renderer.prototype._buildHeaderRowsHtml = function() {
            var columns = this.dataStore.columns;
            var html = '';
            for (var i = 0; i < columns.length; i++) {
                html += this._buildThHtml(columns[i]);
            }
            return '<tr>' + html + '</tr>';
        };

        /**
         * 渲染表头
         * 表头行 html 的生成分两条路：
         *   1. 默认：单行平铺（_buildHeaderRowsHtml）；
         *   2. 启用 HeaderMerge 插件：由插件提供的 headerMergeBuilder 返回多行 <tr> 结构。
         * 核心只负责把 html 落到 thead、处理表头高度、绑定全选 checkbox，合并逻辑由插件独占。
         */
        Renderer.prototype._renderHeader = function() {
            if (!this.thead) return;

            var rowsHtml;
            if (typeof this.headerMergeBuilder === 'function') {
                rowsHtml = this.headerMergeBuilder();
            } else {
                rowsHtml = this._buildHeaderRowsHtml();
            }

            this._setTheadHtml(rowsHtml);

            // 表头高度由配置 headerHeight 控制：
            // 默认'auto'不设固定高度，由内容自动撑开；仅当传入数值时才设置固定高度
            if (this.headerWrapper) {
                var headerH = this.options.headerHeight;
                if (typeof headerH === 'number' && !isNaN(headerH)) {
                    this.headerWrapper.style.height = headerH + 'px';
                } else {
                    this.headerWrapper.style.height = '';
                }
                this.headerWrapper.style.boxSizing = 'border-box';
            }

            // 绑定表头全选 checkbox 事件
            var headerCheckbox = this.thead.querySelector('.mel-header-checkbox');
            if (headerCheckbox) {
                var self = this;
                headerCheckbox.onclick = function(e) {
                    var event = e || window.event;
                    event.cancelBubble = true;
                    var checked = this.checked;
                    self.dataStore.selectAll(checked);
                    self.eventBus.emit('selectChange', {
                        selectedRows: self.dataStore.getPlainRows(self.dataStore.getSelectedRows())
                    });
                };
            }
        };

        /**
         * 渲染表身（只渲染当前页的数据）
         */
        Renderer.prototype._renderBody = function() {
            if (!this.tbody) return;

            var rows = this.dataStore.getVisibleRows();

            // 时序关键：先 emit('renderBody')，让依赖渲染的插件（如SerialNo序号）在生成HTML之前
            // 更新行内字段（_serialNo 等），再读取生成 HTML。若放在渲染之后 emit，
            // 序号等字段已在渲染时被取为旧值/空值，DOM 不会重画，导致序号列为空。
            this.eventBus.emit('renderBody');

            var html = '';
            for (var i = 0; i < rows.length; i++) {
                html += this._renderRowHtml(rows[i]);
            }

            // IE9 兼容：不直接给 tbody 赋大段 innerHTML（IE9 对超长/含特殊字符的
            // innerHTML 解析不稳定，容易出现行丢失/空白）。改用临时 tbody 容器解析，
            // 再把解析出的 tr 节点批量迁移到真实 tbody。
            this._setTbodyHtmlSafe(html);
            this._cacheRowNodes();

            // 行数变化会改变垂直滚动条的有无，bodyWrapper 可视宽度随之变化：
            // 重算表头与 extra 宽度，保证表头表身不错行、extra 不越过表头右边界
            this._syncHeaderWidth();

            this.eventBus.emit('summaryRequest');
        };

        /**
         * 安全设置 tbody 内容（兼容IE9）
         * 用普通 div 容器解析完整 <table><tbody>...</tbody></table> 结构，
         * 再把解析出的 tr 节点迁移到真实 tbody，
         * 规避 IE9 直接给 tbody 赋 innerHTML 抛"该操作的目标元件无效"以及 tr/td 标签丢失的问题。
         * @param {String} html 表身行 html（多个<tr>...</tr>拼接）
         */
        Renderer.prototype._setTbodyHtmlSafe = function(html) {
            // IE9 兼容【彻底方案】：同 _setTheadHtml，改用普通 div 容器解析含 <table> 结构的 html，
            // 再取出解析好的 <tr> 节点迁移到真实 tbody，彻底规避
            // IE9 对 table/tbody 元素赋 innerHTML 写表格内部标签抛"该操作的目标元件无效"的硬性限制。
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = '<table><tbody>' + html + '</tbody></table>';
            var tempTbody = tempDiv.getElementsByTagName('tbody')[0];

            // 清空真实 tbody
            while (this.tbody.firstChild) {
                this.tbody.removeChild(this.tbody.firstChild);
            }

            // 迁移解析出的 tr 节点到真实 tbody
            var tr;
            if (tempTbody) {
                while ((tr = tempTbody.firstChild)) {
                    this.tbody.appendChild(tr);
                }
            }
        };

        /**
         * 全量重绘表身（addRow/deleteRow 等数据变动后调用）
         * 同时刷新冻结列样式与表头宽度，保证增删行后冻结列不丢失、不错行。
         */
        Renderer.prototype.renderBodyAll = function() {
            if (!this.tbody) return;
            this._renderBody();
            this._applyFixedColumns();
            this._syncHeaderWidth();
        };

        /**
         * 渲染单行 HTML
         */
        Renderer.prototype._renderRowHtml = function(rowData) {
            var columns = this.dataStore.columns;
            // 行高由配置 rowHeight 控制（不写死数字，读defaults合并后的配置）
            var rowH = this.options.rowHeight || 0;
            var html = '<tr data-row-index="' + rowData._rowIndex + '" style="height:' + rowH + 'px;">';

            for (var i = 0; i < columns.length; i++) {
                var col = columns[i];
                var value = rowData[col.field] !== undefined ? rowData[col.field] : '';
                var align = col.align || 'center';
                var alignClass = 'mel-align-' + align;
                // 隐藏列：td 照常渲染（DOM 保留），只挂隐藏类，不占可见宽度
                if (this._isColHidden(col)) alignClass += ' mel-col-hidden';

                var renderer = this._renderers[col.renderer] || this._renderers.text;
                var cellContent = renderer(value, col, rowData);

                html += '<td class="' + alignClass + '" data-field="' + (col.field || '') + '" data-row-index="' + rowData._rowIndex + '" style="height:' + rowH + 'px;">';
                html += cellContent;
                html += '</td>';
            }

            html += '</tr>';

            // 展开行插件钩子：在数据行后面追加一条跨列详情行（RowExpand 插件接管）
            // 插件未启用时 rowExpandBuilder 为 undefined，不产生任何额外 HTML
            if (typeof this.rowExpandBuilder === 'function') {
                var expandHtml = this.rowExpandBuilder(rowData);
                if (expandHtml) html += expandHtml;
            }

            return html;
        };

        /**
         * 判断是否为展开行插件插入的详情行（不是数据行）
         * 详情行带 data-row-expand="1"，不参与行节点缓存、冻结列平移等按「行」处理的逻辑
         * @param {Element} tr 行节点
         * @return {Boolean}
         */
        Renderer.prototype._isExpandRowTr = function(tr) {
            if (!tr || !tr.getAttribute) return false;
            return tr.getAttribute('data-row-expand') === '1';
        };

        /**
         * 缓存每行 DOM 节点引用
         */
        Renderer.prototype._cacheRowNodes = function() {
            if (!this.tbody) return;

            var trs = this.tbody.children;
            this.dataStore.getVisibleRows();
            // 展开行插件会在数据行后插入详情行，导致 trs 下标与 visibleRows 不再一一对应，
            // 因此按 data-row-index 反查行对象，不能按数组下标硬配。
            // 注意：展开行的单元格里没有 data-row-index，按 index 找不到行，直接跳过。
            for (var i = 0; i < trs.length; i++) {
                if (this._isExpandRowTr(trs[i])) continue;
                var rowIndex = parseInt(trs[i].getAttribute('data-row-index'));
                if (isNaN(rowIndex)) continue;
                var nodeRow = this.dataStore.getRow(rowIndex);
                if (nodeRow) nodeRow._node = trs[i];
            }
        };

        /**
         * 画合计行
         */
        Renderer.prototype._renderSummaryRow = function(sums, fixed) {
            if (!this.tbody) return;

            // 记录最近一次合计数据：表尾降级时要用它把合计行原样挪回表身
            this._lastSums = sums || null;

            var wasVisible = this._isFooterVisible();

            // 两处都清：固定表尾与表身末尾，避免切换/重算后出现两条合计
            this._clearSummaryRows();

            if (!sums) {
                this._hideFooter();
                this._refreshLayoutAfterFooterToggle(wasVisible);
                return;
            }

            var html = this._buildSummaryRowHtml(sums);

            // 表尾固定：若启用且未降级，渲染到独立表尾层；否则渲染到表身末尾（旧行为）
            var useFooter = !!fixed && !this._footerDegraded && this.footerTbody;

            if (useFooter) {
                this._insertRowHtml(this.footerTbody, html);
                this._showFooter();
                // 宽度与表身同源、固定列平移、隐藏列零宽占位（td 已带类名）都在这两步里完成
                this._syncFooterWidth();
                this._applyFixedToFooter(this.bodyWrapper ? this.bodyWrapper.scrollLeft : 0);
            } else {
                this._insertRowHtml(this.tbody, html);
                if (!this.footerTbody || !this.footerTbody.children.length) {
                    this._hideFooter();
                }
            }

            this._refreshLayoutAfterFooterToggle(wasVisible);
        };

        /**
         * 解析合计标题最终落在哪一列
         * titleColumn 语义保持不变（columns 数组原始下标，含插件自动插入的虚拟列），
         * 但该列被隐藏时标题会落在零宽格子里看不见，因此在这里做一次落点修正：
         *   1. 从 titleColumn 起向右找第一个可见列（含自身）；
         *   2. 右侧没有可见列时向左回退到最近的可见列；
         *   3. 整行没有可见列（或没有列）时返回 -1，标题不渲染（整行本来也不可见）；
         *   4. titleColumn 越界（负数或超过总列数）夹到合法区间后走上面同一套规则，并只警告一次。
         * 注意：标题会占用落点列的格子，该列原有的合计数值会被标题覆盖（已知且接受的取舍）。
         * @param {Object} sums 合计结构 {data, title, titleColumn, blank}
         * @param {Array} columns 当前列定义数组
         * @return {Number} 标题列下标，-1 表示无处可放
         */
        Renderer.prototype._resolveTitleColumn = function(sums, columns) {
            var count = columns ? columns.length : 0;
            if (!count) return -1;

            // 整行全隐藏时不做任何落点计算，直接放弃标题
            var hasVisible = false;
            for (var v = 0; v < count; v++) {
                if (!this._isColHidden(columns[v])) {
                    hasVisible = true;
                    break;
                }
            }
            if (!hasVisible) return -1;

            var raw = sums ? parseInt(sums.titleColumn, 10) : 0;
            if (isNaN(raw)) raw = 0;

            var start = raw;
            if (start < 0 || start >= count) {
                // 越界不抛错：夹到两端之一，再按可见列规则继续找
                start = start < 0 ? 0 : count - 1;

                if (!this._titleColumnWarned && window.console && console.warn) {
                    console.warn('[MelUi.Table] Summary 合计标题列 titleColumn 超出范围（0 ~ ' + (count - 1) + '），已按 ' + start + ' 继续解析');
                    this._titleColumnWarned = true;
                }
            }

            // 向右（含自身）找第一个可见列
            for (var i = start; i < count; i++) {
                if (!this._isColHidden(columns[i])) return i;
            }

            // 右侧没有，向左回退
            for (var j = start - 1; j >= 0; j--) {
                if (!this._isColHidden(columns[j])) return j;
            }

            return -1;
        };

        /**
         * 构建合计行 <tr> 的 HTML
         * 表身末尾 / 固定表尾 / 表尾降级三条路径共用同一份构建逻辑，避免标题落点规则只改一处
         * @param {Object} sums 合计结构 {data, title, titleColumn, blank}
         * @return {String} 合计行 HTML
         */
        Renderer.prototype._buildSummaryRowHtml = function(sums) {
            var columns = this.dataStore.columns || [];
            var data = sums.data || {};
            var titleIndex = this._resolveTitleColumn(sums, columns);
            var html = '<tr class="mel-summary-row">';

            for (var c = 0; c < columns.length; c++) {
                var col = columns[c];
                var cellHtml = '';

                if (titleIndex === c) {
                    cellHtml = '<strong>' + (sums.title || '合计') + '</strong>';
                } else if (sums.blank && data[col.field] !== undefined) {
                    // blank=true：合计无数据可算（远程分页 scope='all' 但没给 externalData），直接显示占位符，别渲染成 0 误导使用者
                    cellHtml = '<strong>' + data[col.field] + '</strong>';
                } else if (data[col.field] !== undefined && !isNaN(data[col.field])) {
                    cellHtml = '<strong>' + data[col.field].toFixed(2) + '</strong>';
                }

                // 隐藏列的合计单元格同样挂隐藏类，列宽与表身保持一致，不额外占位
                var tdClass = this._isColHidden(col) ? ' class="mel-col-hidden"' : '';
                html += '<td' + tdClass + '>' + cellHtml + '</td>';
            }

            return html + '</tr>';
        };

        /**
         * 清掉表身与固定表尾里的旧合计行
         */
        Renderer.prototype._clearSummaryRows = function() {
            var targets = [this.tbody, this.footerTbody];
            for (var t = 0; t < targets.length; t++) {
                var box = targets[t];
                if (!box) continue;
                var oldRows = box.querySelectorAll('.mel-summary-row');
                for (var i = 0; i < oldRows.length; i++) {
                    if (oldRows[i].parentNode) oldRows[i].parentNode.removeChild(oldRows[i]);
                }
            }
        };

        /**
         * 往 tbody 追加一行 tr 的 HTML（IE9 兼容）
         * 抽出来给表身 / 固定表尾共用，避免两处各写一套 IE9 兜底
         * @param {Element} tbody 目标 tbody
         * @param {String} html 单个 <tr> 的 HTML
         */
        Renderer.prototype._insertRowHtml = function(tbody, html) {
            if (!tbody) return;

            if (tbody.insertAdjacentHTML) {
                tbody.insertAdjacentHTML('beforeend', html);
                return;
            }

            // IE9 兜底【彻底方案】：改用普通 div 容器解析含 <table> 结构的 html，
            // 再取出 <tr> 迁移到 tbody，规避 IE9 对 table/tbody 赋 innerHTML 写表格内部标签的限制。
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = '<table><tbody>' + html + '</tbody></table>';
            var tempTbody = tempDiv.getElementsByTagName('tbody')[0];
            var tr = tempTbody ? tempTbody.getElementsByTagName('tr')[0] : null;
            if (tr) tbody.appendChild(tr);
        };

        /**
         * 固定表尾是否处于显示状态
         */
        Renderer.prototype._isFooterVisible = function() {
            if (!this.footerWrapper) return false;
            return this.footerWrapper.style.display !== 'none';
        };

        /**
         * 显示固定表尾（占高度）
         */
        Renderer.prototype._showFooter = function() {
            if (this.footerWrapper) this.footerWrapper.style.display = '';
        };

        /**
         * 隐藏固定表尾（不占高度）
         */
        Renderer.prototype._hideFooter = function() {
            if (this.footerWrapper) this.footerWrapper.style.display = 'none';
        };

        /**
         * 表尾显示状态变化后，按当前高度模式重算一次高度
         * 只有 fitViewport 需要（其它模式容器高度自适应，表尾自然堆叠）
         * 首屏渲染阶段不重算：render() 尾部的 setTimeout(_fitViewport) 会用最终结构再算一次
         * @param {Boolean} wasVisible 变化前的显示状态
         */
        Renderer.prototype._refreshLayoutAfterFooterToggle = function(wasVisible) {
            var nowVisible = this._isFooterVisible();
            if (nowVisible === wasVisible) return;
            if (!this.options.fitViewport) return;
            if (!this.isRenderComplete) return;
            this._doFitViewport();
        };

        /**
         * 表尾降级：可用高度不足时，把合计行挪回表身末尾，并关闭表尾
         * 触发点只有 _applyContainerHeight 里的空间检查（表身 < _footerMinBodyHeight）
         */
        Renderer.prototype._degradeFooter = function() {
            if (this._footerDegraded) return;
            this._footerDegraded = true;

            if (!this._footerWarned && window.console && console.warn) {
                console.warn('[MelUi.Table] 表尾固定：可用高度不足（表身 < ' + this._footerMinBodyHeight + 'px），已自动降级为普通合计行（渲染在表身末尾）');
                this._footerWarned = true;
            }

            this._clearSummaryRows();
            this._hideFooter();

            // 把合计行按旧行为放回表身末尾（不重算高度，交给当前这轮 _applyContainerHeight 用无表尾的高度继续算）
            if (this._lastSums && this.tbody) {
                this._insertRowHtml(this.tbody, this._buildSummaryRowHtml(this._lastSums));
            }
        };

        /**
         * 刷新选中行的勾选状态
         */
        Renderer.prototype._refreshSelectedStates = function() {
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
         * 只重绘某行
         */
        Renderer.prototype.renderRow = function(rowIndex) {
            var row = this.dataStore.getRow(rowIndex);
            if (!row || !this.tbody) return;

            var html = this._renderRowHtml(row);
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            var newTr = tempDiv.firstChild;

            if (row._node && row._node.parentNode) {
                this.tbody.replaceChild(newTr, row._node);
                row._node = newTr;
            } else {
                this.tbody.appendChild(newTr);
                row._node = newTr;
            }
        };

        /**
         * 只重绘某格
         */
        Renderer.prototype.renderCell = function(rowIndex, field) {
            var row = this.dataStore.getRow(rowIndex);
            if (!row || !row._node) return;

            var columns = this.dataStore.columns;
            var td = row._node.querySelector('td[data-field="' + field + '"]');
            if (!td) return;

            var col = null;
            for (var i = 0; i < columns.length; i++) {
                if (columns[i].field === field) {
                    col = columns[i];
                    break;
                }
            }
            if (!col) return;

            var value = row[field] !== undefined ? row[field] : '';
            var renderer = this._renderers[col.renderer] || this._renderers.text;
            td.innerHTML = renderer(value, col, row);
        };

        /**
         * 绑定事件（事件委托）
         */
        Renderer.prototype._bindEvents = function() {
            if (!this.tbody || !this.thead) return;

            var self = this;

            this.tbody.onclick = function(e) {
                var event = e || window.event;
                var target = event.target || event.srcElement;

                var td = self._findParent(target, 'TD');
                if (!td) return;

                var rowIndex = parseInt(td.getAttribute('data-row-index'));
                var field = td.getAttribute('data-field');
                var rowData = self.dataStore.getRow(rowIndex);

                if (!rowData) return;

                // 单行事件：rowId 独立作为顶层参数，rowData 为纯业务字段副本（不含内部字段）
                var rowId = rowData._rowId;
                var plainRow = self.dataStore.getPlainRow(rowData);

                self.eventBus.emit('cellClick', {
                    rowId: rowId,
                    rowData: plainRow,
                    cell: {rowIndex: rowIndex, field: field, element: td}
                });
                // 插件可提供 rowClickFilter(field)：命中返回 true 的列，点击后不抛 rowClick
                // （展开行插件用它挡住箭头列，避免点箭头时同时触发业务「点整行」逻辑）
                if (typeof self.rowClickFilter === 'function' && self.rowClickFilter(field)) return;

                self.eventBus.emit('rowClick', {
                    rowId: rowId,
                    rowData: plainRow,
                    rowIndex: rowIndex
                });
            };

            // 输入变化（带类型过滤）
            this.tbody.oninput = function(e) {
                var event = e || window.event;
                var target = event.target || event.srcElement;

                if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;

                var td = self._findParent(target, 'TD');
                if (!td) return;

                var rowIndex = parseInt(td.getAttribute('data-row-index'));
                var field = td.getAttribute('data-field');

                var columns = self.dataStore.columns;
                var col = null;
                for (var i = 0; i < columns.length; i++) {
                    if (columns[i].field === field) {
                        col = columns[i];
                        break;
                    }
                }

                var newValue = target.value;
                if (col && col.type) {
                    newValue = self._filterInputValue(newValue, col.type);
                    if (target.value !== newValue) {
                        target.value = newValue;
                    }
                }

                var oldValue = self.dataStore.getCell(rowIndex, field);

                self.dataStore.setCell(rowIndex, field, newValue);
                var changedRow = self.dataStore.getRow(rowIndex);
                self.eventBus.emit('cellChange', {
                    rowId: changedRow ? changedRow._rowId : '',
                    rowData: self.dataStore.getPlainRow(changedRow),
                    rowIndex: rowIndex, field: field,
                    newValue: newValue, oldValue: oldValue
                });
            };

            // IE9 propertychange 兼容
            if (window.attachEvent) {
                this.tbody.attachEvent('onpropertychange', function(e) {
                    var event = e || window.event;
                    var target = event.target || event.srcElement;

                    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
                    if (event.propertyName !== 'value') return;

                    var td = self._findParent(target, 'TD');
                    if (!td) return;

                    var rowIndex = parseInt(td.getAttribute('data-row-index'));
                    var field = td.getAttribute('data-field');

                    var columns = self.dataStore.columns;
                    var col = null;
                    for (var i = 0; i < columns.length; i++) {
                        if (columns[i].field === field) {
                            col = columns[i];
                            break;
                        }
                    }

                    var newValue = target.value;
                    if (col && col.type) {
                        newValue = self._filterInputValue(newValue, col.type);
                        if (target.value !== newValue) {
                            target.value = newValue;
                        }
                    }

                    var oldValue = self.dataStore.getCell(rowIndex, field);

                    self.dataStore.setCell(rowIndex, field, newValue);
                    var changedRow = self.dataStore.getRow(rowIndex);
                    self.eventBus.emit('cellChange', {
                        rowId: changedRow ? changedRow._rowId : '',
                        rowData: self.dataStore.getPlainRow(changedRow),
                        rowIndex: rowIndex, field: field,
                        newValue: newValue, oldValue: oldValue
                    });
                });
            }

            this.thead.onclick = function(e) {
                var event = e || window.event;
                var target = event.target || event.srcElement;

                var th = self._findParent(target, 'TH');
                if (!th) return;

                var field = th.getAttribute('data-field');

                // 分组表头（合并表头的父级 th）：没有 field，不参与排序，也不抛 headerClick，
                // 单独抛 groupHeaderClick，由分组列解析器还原出对应的列配置对象。
                if (!field) {
                    var groupPath = th.getAttribute('data-group-path');
                    if (groupPath && typeof self.groupColumnResolver === 'function') {
                        self.eventBus.emit('groupHeaderClick', {
                            column: self.groupColumnResolver(groupPath),
                            element: th,
                            event: event
                        });
                    }
                    return;
                }

                self.eventBus.emit('headerClick', {field: field});
            };

            // 冻结列 hover 联动：tr:hover 会改变行背景色(#f5f7fa)，冻结 td 内联背景需同步刷新，
            // 否则冻结列颜色与整行不一致，且下层内容穿透。事件委托到 tbody，减少监听个数。
            var fixedLeft = this.options.fixedLeftColumns || 0;
            if (fixedLeft > 0) {
                var refreshRowBg = function(e) {
                    var event = e || window.event;
                    var target = event.target || event.srcElement;
                    var tr = self._findParent(target, 'TR');
                    if (!tr) return;
                    if (tr.parentNode !== self.tbody) return;
                    // 重取该行背景（hover 后浏览器已应用 tr:hover 样式）
                    var rowBg = self._getRowBackground(tr);
                    var cells = self._getFixedBodyCells(tr, fixedLeft);
                    for (var c = 0; c < cells.length; c++) {
                        cells[c].style.backgroundColor = rowBg;
                    }
                };

                this._fixedHoverOverHandler = refreshRowBg;
                this._fixedHoverOutHandler = refreshRowBg;

                if (this.tbody.addEventListener) {
                    this.tbody.addEventListener('mouseover', refreshRowBg, false);
                    this.tbody.addEventListener('mouseout', refreshRowBg, false);
                } else if (this.tbody.attachEvent) {
                    this.tbody.attachEvent('onmouseover', refreshRowBg);
                    this.tbody.attachEvent('onmouseout', refreshRowBg);
                }
            }
        };

        /**
         * 过滤输入值（根据类型）
         */
        Renderer.prototype._filterInputValue = function(value, type) {
            if (type === 'int') {
                value = value.replace(/[^\d-]/g, '');
                var minusIdx = value.indexOf('-');
                if (minusIdx > 0) value = value.replace(/-/g, '');
            } else if (type === 'float') {
                value = value.replace(/[^\d.-]/g, '');
                var minusIdx = value.indexOf('-');
                if (minusIdx > 0) value = value.replace(/-/g, '');
                var dotCount = value.split('.').length - 1;
                if (dotCount > 1) {
                    var firstDot = value.indexOf('.');
                    value = value.substring(0, firstDot + 1) + value.substring(firstDot + 1).replace(/\./g, '');
                }
            }
            return value;
        };

        /**
         * 销毁清理：移除window.resize、表身scroll监听，恢复body overflow-y，清空容器DOM
         */
        /**
         * 聚焦单元格：滚动到可见 + 聚焦输入元素 + 可选临时高亮
         * 供 TableCore.focusCell 调用（校验不通过时把用户直接带到出错的格子）
         * @param {Number} rowIndex 行索引（0-based）
         * @param {String} field 列字段名
         * @param {Object} options highlight：是否临时高亮，默认 true
         * @return {Boolean} 是否定位成功
         */
        Renderer.prototype.focusCell = function(rowIndex, field, options) {
            var ds = this.dataStore;
            var row = ds ? ds.getRow(rowIndex) : null;
            if (!row || !row._node || !row._node.parentNode) return false;

            var td = row._node.querySelector('td[data-field="' + field + '"]');
            if (!td) return false;

            // 1. 滚动到可见区域（滚动容器是表身，不是 window）
            if (this.bodyWrapper) {
                this._scrollCellIntoView(td, this.bodyWrapper);
                // 程序化改 scrollLeft / scrollTop 部分环境不派发 scroll 事件，
                // 这里主动同步表头横向位置与固定列 left 平移，避免固定列压盖
                if (this.headerWrapper) this.headerWrapper.scrollLeft = this.bodyWrapper.scrollLeft;
                if (typeof this._bodyScrollHandler === 'function') {
                    this._bodyScrollHandler.call(this.bodyWrapper);
                }
            }

            // 2. 聚焦可输入元素（纯展示列没有输入元素，只做高亮）
            var input = null;
            var tags = ['input', 'textarea', 'select'];
            for (var i = 0; i < tags.length; i++) {
                input = td.querySelector(tags[i]);
                if (input) break;
            }
            if (input && input.focus) {
                try {
                    input.focus();
                } catch (e) {
                    // 只读 / 禁用元素聚焦失败无需处理
                }
            }

            // 3. 临时高亮
            if (!options || options.highlight !== false) {
                this._flashCell(td);
            }
            return true;
        };

        /**
         * 把单元格滚动到表身容器的可见范围内
         * 用 rect 差量计算，天然兼容固定列的 position:relative + left 平移
         * @param {Element} cell 单元格
         * @param {Element} wrapper 表身滚动容器
         */
        Renderer.prototype._scrollCellIntoView = function(cell, wrapper) {
            if (!cell || !wrapper || !cell.getBoundingClientRect) return;

            var cr = cell.getBoundingClientRect();
            var wr = wrapper.getBoundingClientRect();
            var pad = 8;
            var lead = 40; // 横向多留一点，避免单元格贴着边缘难以看清

            var dl = cr.left - wr.left;
            var dr = cr.right - (wr.left + wrapper.clientWidth);
            if (dl < pad) {
                wrapper.scrollLeft += (dl - lead);
            } else if (dr > -pad) {
                wrapper.scrollLeft += (dr + lead);
            }

            var dt = cr.top - wr.top;
            var db = cr.bottom - (wr.top + wrapper.clientHeight);
            if (dt < pad) {
                wrapper.scrollTop += (dt - pad);
            } else if (db > -pad) {
                wrapper.scrollTop += (db + pad);
            }
        };

        /**
         * 单元格临时高亮（1.2 秒后自动恢复）
         * 同时只亮一格，避免用户看花
         * @param {Element} cell 单元格
         */
        Renderer.prototype._flashCell = function(cell) {
            if (!cell || !cell.style) return;

            // 先恢复上一格
            if (this._flashCellEl && this._flashCellEl.style) {
                this._flashCellEl.style.boxShadow = this._flashCellShadow || '';
                this._flashCellEl.style.backgroundColor = this._flashCellBg || '';
            }
            if (this._flashTimer) {
                clearTimeout(this._flashTimer);
                this._flashTimer = null;
            }

            this._flashCellEl = cell;
            this._flashCellShadow = cell.style.boxShadow || '';
            this._flashCellBg = cell.style.backgroundColor || '';

            cell.style.boxShadow = 'inset 0 0 0 2px #e53935';
            cell.style.backgroundColor = '#fff1f0';

            var self = this;
            this._flashTimer = setTimeout(function() {
                if (self._flashCellEl && self._flashCellEl.style) {
                    self._flashCellEl.style.boxShadow = self._flashCellShadow || '';
                    self._flashCellEl.style.backgroundColor = self._flashCellBg || '';
                }
                self._flashCellEl = null;
                self._flashTimer = null;
            }, 1200);
        };

        Renderer.prototype._destroy = function() {
            // 固定表尾引用与数据（容器 DOM 由 el 整体销毁，这里只断引用，避免实例持有节点）
            this.footerWrapper = null;
            this.footerTable = null;
            this.footerTbody = null;
            this.headerGutter = null;
            this.footerGutter = null;
            this._lastSums = null;

            // 清理单元格高亮定时器
            if (this._flashTimer) {
                clearTimeout(this._flashTimer);
                this._flashTimer = null;
            }
            this._flashCellEl = null;

            // 移除window.resize监听
            if (this._resizeBound && this._resizeHandler) {
                if (window.removeEventListener) {
                    window.removeEventListener('resize', this._resizeHandler);
                } else if (window.detachEvent) {
                    window.detachEvent('onresize', this._resizeHandler);
                }
                this._resizeBound = false;
                this._resizeHandler = null;
            }

            // 移除表身scroll监听
            if (this.bodyWrapper && this._bodyScrollHandler) {
                if (this.bodyWrapper.removeEventListener) {
                    this.bodyWrapper.removeEventListener('scroll', this._bodyScrollHandler);
                } else if (this.bodyWrapper.detachEvent) {
                    this.bodyWrapper.detachEvent('onscroll', this._bodyScrollHandler);
                }
                this._bodyScrollHandler = null;
            }

            // 移除冻结列hover监听
            if (this.tbody && this._fixedHoverOverHandler) {
                if (this.tbody.removeEventListener) {
                    this.tbody.removeEventListener('mouseover', this._fixedHoverOverHandler);
                    this.tbody.removeEventListener('mouseout', this._fixedHoverOutHandler);
                } else if (this.tbody.detachEvent) {
                    this.tbody.detachEvent('onmouseover', this._fixedHoverOverHandler);
                    this.tbody.detachEvent('onmouseout', this._fixedHoverOutHandler);
                }
                this._fixedHoverOverHandler = null;
                this._fixedHoverOutHandler = null;
            }

            // 恢复body原始overflow-y（fitViewport=true接管过才需要恢复）
            if (this._bodyOverflow !== undefined) {
                document.body.style.overflowY = this._bodyOverflow;
                this._bodyOverflow = undefined;
            }

            // 清空容器DOM
            if (this.el) {
                this.el.innerHTML = '';
            }
        };

        /**
         * 向上查找父元素
         */
        Renderer.prototype._findParent = function(node, tagName) {
            while (node && node.tagName !== tagName) {
                node = node.parentNode;
            }
            return node;
        };

        MelUi.Table = MelUi.Table || {};
        MelUi.Table.Renderer = Renderer;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 布局管理
     * 负责固定表头、固定列、滚动同步
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.0.0
     * @Date：2026-10-10
     * @Pubdate：2026-10-10
     */

    (function(MelUi) {

        /**
         * Layout 构造函数
         * @param {Object} options 配置项
         * @param {Object} renderer Renderer 实例
         */
        function Layout(options, renderer) {
            this.options = options;
            this.renderer = renderer;

            this.fixedLeftColumns = options.fixedLeftColumns || 0;
            this.headerHeight = options.headerHeight || 40;
        }

        /**
         * 初始化布局
         */
        Layout.prototype.init = function() {
            this._syncScroll();
            this._applyFixedColumns();
        };

        /**
         * 同步表头和表身的横向滚动
         * 表头 wrapper overflow:hidden，表身 wrapper overflow:auto
         * 表身滚动时，表头跟着同步 scrollLeft
         */
        Layout.prototype._syncScroll = function() {
            var bodyWrapper = this.renderer.bodyWrapper;
            var headerWrapper = this.renderer.headerWrapper;

            if (!bodyWrapper || !headerWrapper) return;

            // 表身横向滚动时，同步表头
            bodyWrapper.onscroll = function() {
                headerWrapper.scrollLeft = bodyWrapper.scrollLeft;
            };
        };

        /**
         * 应用固定列（左侧连续N列固定）
         * 方案：固定列的 td/th 设置 position:relative + left偏移 + z-index
         * 横向滚动时，固定列保持视觉上不动
         */
        Layout.prototype._applyFixedColumns = function() {
            if (this.fixedLeftColumns <= 0) return;

            var columns = this.renderer.dataStore.columns;
            var fixedCount = Math.min(this.fixedLeftColumns, columns.length);

            // 计算每列的宽度，累加得到固定列总宽度
            var fixedWidth = 0;
            for (var i = 0; i < fixedCount; i++) {
                fixedWidth += columns[i].width || 100;
            }

            // 给表头固定列加样式
            var headerThs = this.renderer.theadTr.children;
            for (var i = 0; i < fixedCount && i < headerThs.length; i++) {
                var th = headerThs[i];
                th.style.position = 'relative';
                th.style.zIndex = '2';
                th.style.backgroundColor = '#f5f7fa';
            }

            // 给表身固定列加样式
            var bodyTrs = this.renderer.tbody.children;
            for (var rowIdx = 0; rowIdx < bodyTrs.length; rowIdx++) {
                var tds = bodyTrs[rowIdx].children;
                for (var colIdx = 0; colIdx < fixedCount && colIdx < tds.length; colIdx++) {
                    var td = tds[colIdx];
                    td.style.position = 'relative';
                    td.style.zIndex = '1';
                    td.style.backgroundColor = '#fff';
                }
            }

            // 监听表身滚动，平移固定列
            var self = this;
            this.renderer.bodyWrapper.onscroll = function() {
                var scrollLeft = this.scrollLeft;

                // 同步表头滚动
                self.renderer.headerWrapper.scrollLeft = scrollLeft;

                // 平移固定列，视觉上钉住
                var offset = -scrollLeft;
                for (var rowIdx = 0; rowIdx < bodyTrs.length; rowIdx++) {
                    var tds = bodyTrs[rowIdx].children;
                    for (var colIdx = 0; colIdx < fixedCount && colIdx < tds.length; colIdx++) {
                        tds[colIdx].style.left = offset + 'px';
                    }
                }

                // 表头固定列也要平移
                for (var i = 0; i < fixedCount && i < headerThs.length; i++) {
                    headerThs[i].style.left = offset + 'px';
                }
            };
        };

        /**
         * 行渲染后重新应用固定列样式（新增/删除行后调用）
         */
        Layout.prototype.refreshFixedColumns = function() {
            if (this.fixedLeftColumns <= 0) return;
            this._applyFixedColumns();
        };

        MelUi.Table = MelUi.Table || {};
        MelUi.Table.Layout = Layout;


    })(window.MelUi = window.MelUi || {});

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
            if (window.console && console.warn) {
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

    /**
     * MelUi Table 表格组件 - 插件基类
     * 所有插件继承此基类，实现统一接口
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.0.0
     * @Date：2026-10-10
     * @Pubdate：2026-10-10
     */

    (function(MelUi) {

        /**
         * PluginBase 插件基类构造函数
         * @param {Object} options 插件配置
         */
        function PluginBase(options) {
            this.options = options || {};
            this.table = null;
        }

        /**
         * 初始化插件（由表格主类调用）
         * @param {Object} table 表格实例
         */
        PluginBase.prototype.init = function(table) {
            this.table = table;
        };

        /**
         * 销毁插件
         */
        PluginBase.prototype.destroy = function() {
            this.table = null;
        };

        MelUi.Table = MelUi.Table || {};
        MelUi.Table.PluginBase = PluginBase;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 序号列插件
     * 在表格最前面插入一列序号
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.4.0
     * @Date：2026-10-10
     * @Pubdate：2026-11-04
     */

     (function(MelUi) {

        /**
         * SerialNo 序号列插件
         * @param {Object} options 配置
         *   width: 列宽，默认50
         *   showNewRowSerialNumber: 新增行是否显示序号，默认false(可选)。false 新增行序号为空（便于一眼识别是新增行）；true 正常展示序号
         */
        function SerialNo(options) {
            this.options = this._extend({
                width: 50,
                showNewRowSerialNumber: false
            }, options || {});
        }

        SerialNo.prototype = new MelUi.Table.PluginBase();
        SerialNo.prototype.constructor = SerialNo;

        /**
         * 初始化
         */
        SerialNo.prototype.init = function(table) {
            this.table = table;

            // 在列配置最前面插入序号列
            table.dataStore.columns.unshift({
                field: '_serialNo',
                title: '序号',
                width: this.options.width,
                renderer: 'text',
                align: 'center'
            });

            // 监听行数据变化，更新序号
            var self = this;
            table.eventBus.on('renderBody', function() {
                self._updateSerialNumbers();
            });

            // 初始化后更新一次
            this._updateSerialNumbers();
        };

        /**
         * 更新序号列
         * 基于当前页可见行(getVisibleRows)计算：
         * 远程分页(remotePaging=true)：组件只有当前页数据，序号按
         *   (currentPage-1)*pageSize + 当前页内相对下标 + 1 计算，保证跨页连续；
         * 本地分页/不分页：序号为行在全局数组中的下标 + 1。
         * 新增行(_isTempAdd)默认不显示序号(showNewRowSerialNumber=false)，序号置空，便于一眼识别；设为true则正常展示。
         */
        SerialNo.prototype._updateSerialNumbers = function() {
            var ds = this.table.dataStore;
            var visibleRows = ds.getVisibleRows();
            var showNewNo = !!this.options.showNewRowSerialNumber;

            if (ds.remotePaging && ds.pageSize > 0) {
                // 远程分页：基于页码与页容量计算全局序号
                var base = (ds.currentPage - 1) * ds.pageSize;
                // 独立计数器：只对【非新增行】递增序号，
                // 新增行(_isTempAdd)在 showNewRowSerialNumber=false 时序号置空且【不占位】，
                // 因此即使新增行 unshift 到最前面，原有行序号仍保持 1,2,3,4 不偏移。
                var counter = 0;
                for (var i = 0; i < visibleRows.length; i++) {
                    if (!showNewNo && visibleRows[i]._isTempAdd) {
                        visibleRows[i]._serialNo = '';
                    } else {
                        counter++;
                        visibleRows[i]._serialNo = (base + counter).toString();
                    }
                }
            } else {
                for (var j = 0; j < visibleRows.length; j++) {
                    if (!showNewNo && visibleRows[j]._isTempAdd) {
                        visibleRows[j]._serialNo = '';
                    } else {
                        visibleRows[j]._serialNo = (visibleRows[j]._rowIndex + 1).toString();
                    }
                }
            }
        };

        /**
         * 简单对象合并
         */
        SerialNo.prototype._extend = function(target) {
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
        MelUi.Table.plugins.SerialNo = SerialNo;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 多选列插件
     * 只负责修改选中状态数据，DOM 渲染由 Renderer 统一处理
     * 支持多选(multi)与单选(single)两种模式
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.2.2
     * @Date：2026-10-10
     * @PubDate：2026-11-10 10:45:00
     */

     (function(MelUi) {

        /**
         * Checkbox 多选列插件
         * @param {Object} options 配置
         *   width: 列宽，默认60（要放得下"合计"两个字）
         *   mode: 选择模式 'multi'多选(默认) / 'single'单选
         */
        function Checkbox(options) {
            this.options = this._extend({
                width: 60,
                mode: 'multi'
            }, options || {});
        }

        Checkbox.prototype = new MelUi.Table.PluginBase();
        Checkbox.prototype.constructor = Checkbox;

        /**
         * 初始化：记录选择模式、加列配置、监听事件改数据，不碰 DOM
         */
        Checkbox.prototype.init = function(table) {
            this.table = table;
            var self = this;

            // 记录选择模式到 dataStore（单选互斥、API保护用）
            table.dataStore.selectMode = this.options.mode;

            // 在列配置最前面插入选择列（带mode标记，供渲染器/表头判断）
            table.dataStore.columns.unshift({
                field: '_checkbox',
                title: '',
                width: this.options.width,
                renderer: 'checkbox',
                align: 'center',
                mode: this.options.mode
            });

            // 监听渲染完成后，给 tbody 加点击监听（只监听勾选框点击）
            table.eventBus.on('rendered', function() {
                self._bindClickEvent();
            });
        };

        /**
         * 绑定勾选框点击事件（此时 DOM 已就绪）
         */
        Checkbox.prototype._bindClickEvent = function() {
            var tbody = this.table.renderer.tbody;
            if (!tbody) return;

            var self = this;

            var handler = function(e) {
                var event = e || window.event;
                var target = event.target || event.srcElement;

                if (target.tagName !== 'INPUT') return;
                if (target.type !== 'checkbox' && target.type !== 'radio') return;

                var td = self._findParent(target, 'TD');
                if (!td) return;

                // 只处理本插件专属的 _checkbox 列；表格内其它列(input/radio/checkbox)点击一律忽略，互不干扰
                var field = td.getAttribute('data-field');
                if (field !== '_checkbox') return;

                var rowIndex = parseInt(td.getAttribute('data-row-index'));

                // setRowSelected 内部已处理单选互斥（选中新行自动清空其它行选中），多选只切换当前行
                self.table.dataStore.setRowSelected(rowIndex, target.checked);

                // 发事件，Renderer 收到后刷新勾选状态
                // 本事件是单行触发的（点击某一行的勾选框），因此带上 rowId / rowData / checked；
                // 全选、全不选、反选等批量操作由表格 API 发出，只有 selectedRows，不带单行参数。
                var ds = self.table.dataStore;
                var row = ds.getRow(rowIndex);
                self.table.eventBus.emit('selectChange', {
                    rowId: row ? row._rowId : '',
                    rowData: ds.getPlainRow(row),
                    checked: target.checked,
                    selectedRows: ds.getPlainRows(ds.getSelectedRows())
                });
            };

            if (tbody.addEventListener) {
                tbody.addEventListener('click', handler);
            } else if (tbody.attachEvent) {
                tbody.attachEvent('onclick', handler);
            }
        };

        Checkbox.prototype._findParent = function(node, tagName) {
            while (node && node.tagName !== tagName) {
                node = node.parentNode;
            }
            return node;
        };

        Checkbox.prototype._extend = function(target) {
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
        MelUi.Table.plugins.Checkbox = Checkbox;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 状态列插件
     * 在表格最后插入一列状态标记（新增/修改/已保存）
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.2.0
     * @Date：2026-10-10
     * @Pubdate：2026-11-03
     */

     (function(MelUi) {

        /**
         * StateColumn 状态列插件
         * @param {Object} options 配置
         *   width: 列宽，默认60
         *   newText: 新增标记文字，默认 '新'
         *   unsaveText: 修改标记文字，默认 '改'
         *   savedText: 已保存标记文字，默认 ''
         *   columnPosition: 状态列显示位置(可选)。'behind'=状态列在所有数据列的最后面(默认)；'front'=状态列在checkbox/序号列之前(无这两列时在数据第1列前)
         */
        function StateColumn(options) {
            this.options = this._extend({
                width: 60,
                newText: '新',
                unsaveText: '改',
                savedText: '',
                columnPosition: 'behind'
            }, options || {});
        }

        StateColumn.prototype = new MelUi.Table.PluginBase();
        StateColumn.prototype.constructor = StateColumn;

        /**
         * 初始化
         */
        StateColumn.prototype.init = function(table) {
            this.table = table;

            var stateCol = {
                field: '_state',
                title: '状态',
                width: this.options.width,
                renderer: 'text',
                align: 'center'
            };

            // columnPosition: 'front'=插到列配置最前面(checkbox/序号列之前，若无这两列则数据第1列前)；'behind'=追加到列配置最后面(默认)
            if (this.options.columnPosition === 'front') {
                table.dataStore.columns.unshift(stateCol);
            } else {
                table.dataStore.columns.push(stateCol);
            }

            // 初始化所有行的状态字段
            var rows = table.dataStore.rows;
            for (var i = 0; i < rows.length; i++) {
                rows[i]._state = this._getStatusText(rows[i]._status);
            }

            // 监听单元格变化，更新状态
            var self = this;
            table.eventBus.on('cellChange', function(data) {
                var row = table.dataStore.getRow(data.rowIndex);
                if (row) {
                    row._state = self._getStatusText(row._status);
                    table.renderer.renderCell(data.rowIndex, '_state');
                }
            });

            // 监听新增行
            table.eventBus.on('rowAdd', function(data) {
                data.rowData._state = self._getStatusText(data.rowData._status);
            });
        };

        /**
         * 根据状态码获取显示文字
         * @param {String} status 状态码：'i' / 'u' / 's'
         * @return {String}
         */
        StateColumn.prototype._getStatusText = function(status) {
            if (status === 'i') return this.options.newText;
            if (status === 'u') return this.options.unsaveText;
            return this.options.savedText;
        };

        /**
         * 简单对象合并
         */
        StateColumn.prototype._extend = function(target) {
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
        MelUi.Table.plugins.StateColumn = StateColumn;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 排序插件
     * 只负责修改数据模型的排序状态，DOM 渲染由 Renderer 统一处理
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.1.2
     * @Date：2026-10-10
     * @Pubdate：2026-11-11 18:39:02
     */

     (function(MelUi) {

        /**
         * Sort 排序插件
         * @param {Object} options 配置
         *   defaultField: 默认排序列字段名
         *   defaultOrder: 默认排序方向 'asc' / 'desc'
         *   sortCurrentPageOnly: 是否仅对当前页排序(可选)，默认true。
         *     默认 true 让本地分页与远程分页口径统一：都是"只排当前这一页"，不会出现排序后数据跑到其它页。
         *     true：只对当前页切片区间排序并回填数据源该区间，其他页数据顺序不变。
         *     false：对整个数据源排序后重新分页切片（旧行为，需要"全表排序"时才显式传 false）。
         */
        function Sort(options) {
            this.options = this._extend({
                defaultField: '',
                defaultOrder: 'asc',
                sortCurrentPageOnly: true
            }, options || {});
        }

        Sort.prototype = new MelUi.Table.PluginBase();
        Sort.prototype.constructor = Sort;

        /**
         * 初始化：只监听事件、改数据，不碰 DOM
         */
        Sort.prototype.init = function(table) {
            this.table = table;
            var self = this;

            // 供 Renderer 判断“表头是否要显示可排序光标”：只有启用了 Sort 插件才有排序能力，
            // 未启用时表头一律保持普通光标，避免光标 pointer 但点了没反应。
            if (table.renderer) {
                table.renderer.sortEnabled = true;
            }

            // 监听表头点击 → 改排序状态 → 发事件让 Renderer 重绘
            table.eventBus.on('headerClick', function(data) {
                var field = data.field;
                if (!field || field.charAt(0) === '_') return;

                // 列级排序开关：列配置 sortable:false 时该列点击表头不排序（不写该项默认可排序）
                var col = self._findColumn(field);
                if (col && col.sortable === false) return;

                // 切换排序方向
                if (table.dataStore.sortField === field) {
                    table.dataStore.sortOrder = table.dataStore.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    table.dataStore.sortField = field;
                    table.dataStore.sortOrder = 'asc';
                }

                // sortCurrentPageOnly 默认 true：只排当前页（远程分页 rows 本身就是当前页，口径一致）
                var onlyCurrentPage = self.options.sortCurrentPageOnly && !table.dataStore.remotePaging;

                // 执行排序（改数据）
                table.dataStore.sort(field, table.dataStore.sortOrder, onlyCurrentPage);

                // 发事件，Renderer 收到后重绘表头箭头 + 表身
                table.eventBus.emit('sortChange', {
                    field: field,
                    order: table.dataStore.sortOrder
                });
            });

            // 默认排序
            if (this.options.defaultField) {
                var onlyCurrentPage = this.options.sortCurrentPageOnly && !table.dataStore.remotePaging;
                table.dataStore.sort(this.options.defaultField, this.options.defaultOrder, onlyCurrentPage);
                table.eventBus.emit('sortChange', {
                    field: this.options.defaultField,
                    order: this.options.defaultOrder
                });
            }
        };

        /**
         * 按 field 取列配置（列级判断用）
         * @param {String} field 字段名
         * @return {Object|null}
         */
        Sort.prototype._findColumn = function(field) {
            var columns = (this.table && this.table.dataStore && this.table.dataStore.columns) || [];
            for (var i = 0; i < columns.length; i++) {
                if (columns[i] && columns[i].field === field) return columns[i];
            }
            return null;
        };

        Sort.prototype._extend = function(target) {
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
        MelUi.Table.plugins.Sort = Sort;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 分页插件
     * 底部分页栏，支持自定义位置和对齐方式
     * 样式统一放在 index.css（.mel-pagination 系列），本插件不再写内联样式
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.7.1
     * @Date：2026-10-10
     * @Pubdate：2026-11-04
     */

     (function(MelUi) {

        /**
         * Pagination 分页插件
         * @param {Object} options 配置
         *   pageSize: 每页条数，默认10
         *   pageMode: 分页模式 'list' 数字列表 / 'select' 下拉选择，默认'list'
         *   pageListSize: 数字列表模式显示几个页码，默认5
         *   position: 分页栏位置 'bottom'=表格下方 / 'top'=表格上方 / 'fixed'=固定页面底部，默认'bottom'
         *   align: 分页内容对齐 'left'=居左 / 'center'=居中 / 'right'=居右，默认'right'
         *   showQuickJumper: 是否显示页码快速跳转下拉(可选)，默认true。true显示"跳至__页"下拉，可选中某页直接跳转
         *   showSizeChanger: 是否显示每页条数切换下拉(可选)，默认true。true显示"每页__条"下拉，可选候选列表中的条数
         */
        function Pagination(options) {
            this.options = this._extend({
                pageSize: 10,
                pageMode: 'list',
                pageListSize: 5,
                position: 'bottom',
                align: 'right',
                showQuickJumper: true,
                showSizeChanger: true
            }, options || {});
        }

        Pagination.prototype = new MelUi.Table.PluginBase();
        Pagination.prototype.constructor = Pagination;

        /**
         * 初始化
         */
        Pagination.prototype.init = function(table) {
            this.table = table;
            var self = this;

            // 把分页位置回填到表格options，供renderer _applyLayout判断是否扣除分页高度
            // position !== 'fixed' 时分页在普通文档流，需要预留分页位置；fixed脱离文档流不需要预留
            table.options._paginationPos = this.options.position || 'bottom';

            table.dataStore.setPageSize(this.options.pageSize);

            // 分页插件用默认 pageSize 覆盖后，需再触发一次降级对齐：
            // remotePaging=true 且 enableRemotePagingFallback=true 且后端 total 不可信时，
            // 让 pageSize 对齐为当前数据长度，保证初始化铺满一页；用户手动切换下拉后以用户选择为准。
            if (table.dataStore._alignFallbackPageSize) {
                table.dataStore._alignFallbackPageSize();
            }

            table.eventBus.on('rendered', function() {
                self._renderBar();
            });

            table.eventBus.on('rowAdd', function() {
                self._updateTotal();
            });
            table.eventBus.on('rowDelete', function() {
                self._updateTotal();
            });
        };

        /**
         * 获取每页条数下拉候选列表
         * 固定候选值，若当前 pageSize 不在候选内则追加进去（并保持升序），确保下拉默认选中当前 pageSize
         * @param {Number} currentSize 当前每页条数
         * @return {Array}
         */
        Pagination.prototype._getPageSizeOptions = function(currentSize) {
            var defaults = [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 100, 150, 200, 300, 400, 500, 1000, 2000, 5000];
            var options = [];
            var hasCurrent = false;

            for (var i = 0; i < defaults.length; i++) {
                options.push(defaults[i]);
                if (defaults[i] === currentSize) {
                    hasCurrent = true;
                }
            }

            // 当前 pageSize 不在候选列表内时，追加并升序排列
            if (!hasCurrent && currentSize && currentSize > 0) {
                options.push(currentSize);
                options.sort(function(a, b) {
                    return a - b;
                });
            }

            return options;
        };

        /**
         * 渲染分页栏
         */
        Pagination.prototype._renderBar = function() {
            var ds = this.table.dataStore;
            // 总记录数取值（统一由 DataStore 矫正，保证与总页数、每页条数下拉口径一致）：
            //   - remotePaging=true：后端 total>0 且 >= 返回列表长度 → 采用后端 total；
            //     后端 total=0 或 < 返回列表长度（数据自相矛盾）→ 降级采用本次返回实际行数 rows.length。
            //   - remotePaging=false：取本地数据行数 rows.length。
            var total = ds.getEffectiveTotal();
            if (isNaN(total)) total = 0;
            var totalPages = ds.getTotalPages();
            var curpage = ds.currentPage;

            if (this.barDom && this.barDom.parentNode) {
                this.barDom.parentNode.removeChild(this.barDom);
            }

            // 位置class：fixed脱离文档流
            var posCls = '';
            if (this.options.position === 'fixed') {
                posCls = ' mel-pagination-fixed';
            }

            // 对齐class
            var alignMap = {left: 'left', center: 'center', right: 'right'};
            var alignCls = ' mel-pagination-align-' + (alignMap[this.options.align] || 'right');

            var html = '<div class="mel-pagination' + posCls + alignCls + '">';
            html += '<span class="mel-pagination-total">共 ' + total + ' 条</span>';

            if (this.options.pageMode === 'select') {
                html += '<select class="mel-page-select">';
                for (var i = 1; i <= totalPages; i++) {
                    html += '<option value="' + i + '"' + (i === curpage ? ' selected' : '') + '>第 ' + i + ' 页</option>';
                }
                html += '</select>';
            } else {
                // 翻页按钮禁用规则：
                //   - 总页数 <=0（如 remotePaging 且 total=0）时，四个翻页按钮全部禁用
                //   - 首页/上一页：curpage<=1 时禁用
                //   - 下一页/尾页：curpage>=totalPages 时禁用
                var disableAll = (totalPages <= 0);
                var disablePrev = disableAll || (curpage <= 1);
                var disableNext = disableAll || (curpage >= totalPages);

                var disabledAttr = function(isDisabled) {
                    return isDisabled ? ' disabled' : '';
                };

                html += '<button type="button" class="mel-page-btn" data-action="first"' + disabledAttr(disablePrev) + '>首页</button>';
                html += '<button type="button" class="mel-page-btn" data-action="prev"' + disabledAttr(disablePrev) + '>上一页</button>';

                if (totalPages > 0) {
                    var start = Math.max(1, curpage - Math.floor(this.options.pageListSize / 2));
                    var end = Math.min(totalPages, start + this.options.pageListSize - 1);
                    start = Math.max(1, end - this.options.pageListSize + 1);

                    for (var i = start; i <= end; i++) {
                        var activeCls = i === curpage ? ' active' : '';
                        html += '<button type="button" class="mel-page-num' + activeCls + '" data-page="' + i + '">' + i + '</button>';
                    }
                }

                html += '<button type="button" class="mel-page-btn" data-action="next"' + disabledAttr(disableNext) + '>下一页</button>';
                html += '<button type="button" class="mel-page-btn" data-action="last"' + disabledAttr(disableNext) + '>尾页</button>';
            }

            // 每页条数切换下拉（showSizeChanger）
            if (this.options.showSizeChanger) {
                // 选中项匹配值（统一走 DataStore 矫正）：
                //   - remotePaging=true 且 total 可信 → 对齐配置的 pageSize；
                //   - remotePaging=true 且 total 降级（=0 或 < 返回列表长度）→ 对齐返回列表长度 rows.length，
                //     若该值不在候选列表则自动追加进去，且此时强制单页（下拉只有这一页可选）。
                //   - remotePaging=false → 对齐配置的 pageSize（pageSize 不在候选时同样自动追加，见 _getPageSizeOptions）。
                var sizeMatch = ds.getEffectivePageSize();
                var sizeOptions = this._getPageSizeOptions(sizeMatch);
                html += '<span class="mel-pagination-size">每页';
                html += '<select class="mel-page-size-select">';
                for (var s = 0; s < sizeOptions.length; s++) {
                    var sizeVal = sizeOptions[s];
                    html += '<option value="' + sizeVal + '"' + (sizeVal === sizeMatch ? ' selected' : '') + '>' + sizeVal + ' 条</option>';
                }
                html += '</select>';
                html += '</span>';
            }

            // 页码快速跳转下拉（showQuickJumper）
            if (this.options.showQuickJumper) {
                html += '<span class="mel-pagination-jumper">跳至';
                html += '<select class="mel-page-jumper-select">';
                if (totalPages > 0) {
                    for (var j = 1; j <= totalPages; j++) {
                        html += '<option value="' + j + '"' + (j === curpage ? ' selected' : '') + '>第 ' + j + ' 页</option>';
                    }
                } else {
                    html += '<option value="1">第 1 页</option>';
                }
                html += '</select>';
                html += '</span>';
            }

            html += '</div>';

            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            this.barDom = tempDiv.firstChild;

            // 根据 position 决定插入位置
            if (this.options.position === 'top') {
                this.table.renderer.el.insertBefore(this.barDom, this.table.renderer.el.firstChild);
            } else {
                this.table.renderer.el.appendChild(this.barDom);
            }

            this._bindEvents();
        };

        /**
         * 绑定分页事件
         */
        Pagination.prototype._bindEvents = function() {
            var self = this;

            this.barDom.onclick = function(e) {
                var event = e || window.event;
                var target = event.target || event.srcElement;

                if (target.getAttribute && target.getAttribute('data-page')) {
                    var page = parseInt(target.getAttribute('data-page'));
                    self.goToPage(page);
                    return;
                }

                if (target.getAttribute && target.getAttribute('data-action')) {
                    var action = target.getAttribute('data-action');
                    var totalPages = self.table.dataStore.getTotalPages();
                    var curpage = self.table.dataStore.currentPage;

                    if (action === 'first') self.goToPage(1);
                    if (action === 'prev') self.goToPage(curpage - 1);
                    if (action === 'next') self.goToPage(curpage + 1);
                    if (action === 'last') self.goToPage(totalPages);
                }
            };

            var select = this.barDom.querySelector('.mel-page-select');
            if (select) {
                select.onchange = function() {
                    self.goToPage(parseInt(this.value));
                };
            }

            // 每页条数切换下拉（showSizeChanger）：改 pageSize，重置页码到第1页，触发 pageChange 让外部/本地重新分页
            var sizeSelect = this.barDom.querySelector('.mel-page-size-select');
            if (sizeSelect) {
                sizeSelect.onchange = function() {
                    var newSize = parseInt(this.value);
                    var ds = self.table.dataStore;
                    ds.setPageSize(newSize);
                    self.table.eventBus.emit('pageChange', {
                        curpage: ds.currentPage,
                        pagesize: newSize
                    });
                    self._renderBar();
                };
            }

            // 页码快速跳转下拉（showQuickJumper）：直接跳转到选中页
            var jumperSelect = this.barDom.querySelector('.mel-page-jumper-select');
            if (jumperSelect) {
                jumperSelect.onchange = function() {
                    self.goToPage(parseInt(this.value));
                };
            }
        };

        /**
         * 跳转到指定页
         * 边界防护：
         *   - 总页数 <=0（如 remotePaging 且 total=0）时，直接返回，不允许切换页码，避免非法页码导致切片/序号负数；
         *   - 页码越界时 clamp 到合法范围。
         */
        Pagination.prototype.goToPage = function(page) {
            var ds = this.table.dataStore;
            var totalPages = ds.getTotalPages();

            // total=0 无数据可翻页：直接拒绝，不触发分页事件
            if (totalPages <= 0) {
                return;
            }

            if (page < 1) page = 1;
            if (page > totalPages) page = totalPages;

            // 切换页码：清空当前页插队集合(addRowMode='currentPage'新增行标记)，新增行回归普通分页
            ds.clearTempAppend();

            ds.currentPage = page;

            this._renderBar();

            this.table.eventBus.emit('pageChange', {
                curpage: page,
                pagesize: this.options.pageSize
            });
        };

        /**
         * 更新总记录数
         * 远程分页(remotePaging=true)：total 由外部传入控制，新增/删除行不改变总条数，不重算；
         * 本地分页：重算 rows.length，并修正越界页码。
         */
        Pagination.prototype._updateTotal = function() {
            var ds = this.table.dataStore;
            if (ds.remotePaging) {
                this._renderBar();
                return;
            }
            var totalPages = ds.getTotalPages();
            if (ds.currentPage > totalPages) {
                ds.currentPage = totalPages;
            }
            this._renderBar();
        };

        /**
         * 简单对象合并
         */
        Pagination.prototype._extend = function(target) {
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
        MelUi.Table.plugins.Pagination = Pagination;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 合计行插件
     * 只负责计算合计数据，DOM 渲染由 Renderer 统一处理
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.1.1
     * @Date：2026-10-10
     * @Pubdate：2026-11-12 17:59:30
     */

     (function(MelUi) {

        /**
         * Summary 合计行插件
         * @param {Object} options 配置
         *   columns: 需要合计的字段名数组，如 ['mj', 'scjj']
         *   title: 合计行标题，默认 '合计'
         *   titleColumn: 标题放在第几列（索引），默认0
         *   scope: 合计统计范围，默认 'currentPage'
         *          'currentPage' —— 无论本地分页还是远程分页，只统计当前页可见行（含本页新增草稿行）
         *          'all'         —— 统计全部数据：
         *                           本地分页：前端对全量数据源自动聚合；
         *                           远程分页：前端拿不到全量数据，不自动计算，只渲染 externalData，未配置则显示 "—"
         *   externalData: 外部合计对象，仅 scope='all' 且远程分页时生效，key 与 columns 字段一一对应；scope='currentPage' 时忽略
         *   fixedFooter: 是否把合计行渲染到纵向固定表尾，默认 true。
         *          true  —— 合计行渲染到独立固定层，贴在表格可视区底部，垂直滚动不动、横向滚动跟随表身（默认）
         *          false —— 旧行为：合计行是表身末尾的普通行，跟随垂直滚动
         *          仅对单条全局合计行生效；可用高度不足时渲染层会自动降级回表身末尾并 warn
         */
        function Summary(options) {
            this.options = this._extend({
                columns: [],
                title: '合计',
                titleColumn: 0,
                scope: 'currentPage',
                externalData: {},
                fixedFooter: true
            }, options || {});
        }

        Summary.prototype = new MelUi.Table.PluginBase();
        Summary.prototype.constructor = Summary;

        /**
         * 初始化：只监听事件、算数据，不碰 DOM
         */
        Summary.prototype.init = function(table) {
            this.table = table;
            this._warned = false;
            var self = this;

            // 监听 Renderer 请求合计数据（每次重绘表身后触发）
            table.eventBus.on('summaryRequest', function() {
                self._emitSums(self._calcSums());
            });

            // 单元格变化时重新计算
            table.eventBus.on('cellChange', function() {
                self._emitSums(self._calcSums());
            });
        };

        /**
         * 发出合计数据
         * 渲染层只认载荷里的 fixed 标记决定渲染目标（表身末尾 / 固定表尾），
         * 这样插件不需要去读 renderer 内部结构，耦合点只有这一个布尔值
         * @param {Object} sums 合计数据
         */
        Summary.prototype._emitSums = function(sums) {
            this.table.eventBus.emit('summaryChange', {
                sums: sums,
                fixed: this.options.fixedFooter === true
            });
        };

        /**
         * 计算各列合计值
         * @return {Object} {data, title, titleColumn, blank}
         */
        Summary.prototype._calcSums = function() {
            var opts = this.options;
            var ds = this.table.dataStore;
            var isAll = String(opts.scope).toLowerCase() === 'all';

            // 默认 currentPage：本地 / 远程一律只统计当前页可见行，externalData 不参与
            if (!isAll) {
                return this._build(this._sumRows(this._getPageRows()), false);
            }

            // scope = 'all' + 远程分页：前端无全量数据，只渲染外部传入的合计
            if (ds.remotePaging) {
                if (this._hasExternalData()) {
                    return this._build(this._pickExternal(), false);
                }
                // 未配置 externalData：控制台告警 + 合计行显示 "—"（让使用者一眼看出没配/配错）
                this._warnMissingExternal();
                return this._build(this._dashSums(), true);
            }

            // scope = 'all' + 本地分页：对全量数据源聚合
            return this._build(this._sumRows(ds.rows || []), false);
        };

        /**
         * 取当前页可见行：dataStore.getVisibleRows 已处理本地切片 / 远程 / 兜底降级 / 新增草稿行
         */
        Summary.prototype._getPageRows = function() {
            var ds = this.table.dataStore;
            if (typeof ds.getVisibleRows === 'function') {
                return ds.getVisibleRows() || [];
            }
            return ds.rows || [];
        };

        /**
         * 按行数组聚合各列合计
         * @return {Object} {字段: 合计值}
         */
        Summary.prototype._sumRows = function(rows) {
            var sums = {};
            var columns = this.options.columns;

            for (var i = 0; i < columns.length; i++) {
                var field = columns[i];
                sums[field] = 0;

                for (var j = 0; j < rows.length; j++) {
                    var val = parseFloat(rows[j][field]);
                    if (!isNaN(val)) {
                        sums[field] += val;
                    }
                }
            }

            return sums;
        };

        /**
         * 组装给 Renderer 的合计结构
         * @param {Object} sums 各列合计值
         * @param {Boolean} blank 是否无数据可算（true 时合计单元格渲染为占位符 "—"）
         */
        Summary.prototype._build = function(sums, blank) {
            return {
                data: sums,
                title: this.options.title,
                titleColumn: this.options.titleColumn,
                blank: !!blank
            };
        };

        /**
         * 合计行整行显示 "—"（远程分页 scope='all' 但没给 externalData）
         */
        Summary.prototype._dashSums = function() {
            var sums = {};
            var columns = this.options.columns;

            for (var i = 0; i < columns.length; i++) {
                sums[columns[i]] = '—';
            }

            return sums;
        };

        /**
         * 是否配置了有效的外部合计数据（对象且至少一个合计字段有值）
         */
        Summary.prototype._hasExternalData = function() {
            var ext = this.options.externalData;
            if (!ext || typeof ext !== 'object') return false;

            var columns = this.options.columns;
            for (var i = 0; i < columns.length; i++) {
                var v = ext[columns[i]];
                if (v !== undefined && v !== null && v !== '') return true;
            }
            return false;
        };

        /**
         * 取外部合计值，统一转成数字，缺失字段按 0（避免出现 NaN / 字符串 toFixed 报错）
         */
        Summary.prototype._pickExternal = function() {
            var ext = this.options.externalData || {};
            var sums = {};
            var columns = this.options.columns;

            for (var i = 0; i < columns.length; i++) {
                var field = columns[i];
                var num = parseFloat(ext[field]);
                sums[field] = isNaN(num) ? 0 : num;
            }
            return sums;
        };

        /**
         * 远程分页 + scope='all' 未配置 externalData：只告警一次
         */
        Summary.prototype._warnMissingExternal = function() {
            if (this._warned) return;
            this._warned = true;

            if (window.console && window.console.warn) {
                window.console.warn(
                    '[MelUi Table / Summary] 远程分页模式下前端无法计算全量合计。'
                    + '如需展示全部数据总合计，请配置 externalData（后端返回的合计对象）；'
                    + '如需统计当前页合计，请把 scope 改为 "currentPage"。合计行已显示为 "—"。'
                );
            }
        };

        Summary.prototype._extend = function(target) {
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
        MelUi.Table.plugins.Summary = Summary;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 导出插件
     * 支持导出 Excel（.xls / .xlsx）与 CSV
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.3.0
     * @Date：2026-10-10
     * @Pubdate：2026-11-11 12:16:46
     */

     (function(MelUi) {

        // ==================== CRC32（xlsx 的 ZIP 容器用） ====================

        var _crcTable = null;

        /**
         * 构建 CRC32 查表（首次调用生成，之后复用）
         */
        function getCrcTable() {
            if (_crcTable) return _crcTable;
            var table = [];
            for (var n = 0; n < 256; n++) {
                var c = n;
                for (var k = 0; k < 8; k++) {
                    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                }
                table[n] = c >>> 0;
            }
            _crcTable = table;
            return table;
        }

        /**
         * 计算字节数组的 CRC32
         * @param {Uint8Array} bytes 数据
         * @return {Number} CRC32 值
         */
        function crc32(bytes) {
            var table = getCrcTable();
            var crc = 0xFFFFFFFF;
            for (var i = 0; i < bytes.length; i++) {
                crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
            }
            return (crc ^ 0xFFFFFFFF) >>> 0;
        }

        // ==================== 字节工具 ====================

        /**
         * 字符串 → UTF-8 字节数组（不依赖 TextEncoder，IE10 可用）
         * @param {String} str 文本
         * @return {Uint8Array}
         */
        function utf8Bytes(str) {
            var text = String(str == null ? '' : str);
            var bytes = [];
            for (var i = 0; i < text.length; i++) {
                var c = text.charCodeAt(i);
                if (c < 0x80) {
                    bytes.push(c);
                } else if (c < 0x800) {
                    bytes.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
                } else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < text.length) {
                    // 代理对（emoji 等）
                    var c2 = text.charCodeAt(++i);
                    var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
                    bytes.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
                } else {
                    bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
                }
            }
            return new Uint8Array(bytes);
        }

        /**
         * 小端 16 位字节
         */
        function u16(n) {
            return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]);
        }

        /**
         * 小端 32 位字节
         */
        function u32(n) {
            return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]);
        }

        /**
         * 拼接多段字节
         */
        function concatBytes(parts) {
            var total = 0;
            for (var i = 0; i < parts.length; i++) total += parts[i].length;
            var out = new Uint8Array(total);
            var offset = 0;
            for (var j = 0; j < parts.length; j++) {
                out.set(parts[j], offset);
                offset += parts[j].length;
            }
            return out;
        }

        // ==================== 插件 ====================

        /**
         * Export 导出插件
         * @param {Object} options 配置
         *   filename: 文件名（不含扩展名），默认 '导出数据'
         *   format: 导出格式，'xlsx'（默认，真 Excel 2007+）/ 'xls'（HTML 伪装 Excel，兼容 IE9）/ 'csv'（纯文本）
         *   csvDelimiter: 仅 format='csv' 生效，单元格分隔符，默认 '\t'（制表符，Excel 双击即按列展开）；
         *                 给后端使用(导入数据时)可改成 ','（Excel 里整行显示为一条，便于当纯文本行解析）
         *   includeInnerColumns: 是否导出内部列（field 以 _ 开头的序号 / 状态 / 选择列），默认 false
         *   includeHiddenColumns: 是否导出隐藏列（列配置 visible:false 的列），默认 false
         * 说明：
         *   includeInnerColumns 管"内部列"，includeHiddenColumns 管"业务隐藏列"，两者互不相关；
         *   扩展名由 format 决定；CSV 内部固定 UTF-16LE(FF FE) 编码，不对外暴露开关。
         */
        function Export(options) {
            this.options = this._extend({
                filename: '导出数据',
                format: 'xlsx',
                csvDelimiter: '\t',
                includeInnerColumns: false,
                includeHiddenColumns: false
            }, options || {});
        }

        Export.prototype = new MelUi.Table.PluginBase();
        Export.prototype.constructor = Export;

        /**
         * 初始化
         */
        Export.prototype.init = function(table) {
            this.table = table;
        };

        /**
         * 执行导出
         * @param {String} formatOverride 可选。临时指定格式 'xls' / 'xlsx' / 'csv'，不传则用 options.format
         */
        Export.prototype.export = function(formatOverride) {
            var format = String(formatOverride || this.options.format || 'xlsx').toLowerCase();
            if (format !== 'csv' && format !== 'xlsx') format = 'xls';

            // xlsx 要二进制 Blob（ZIP），csv 要二进制 Blob（UTF-16 字节）；
            // IE9 完全没有 Blob、IE10 的 Blob 不吃二进制片段，两者都得降级成 xls（HTML，中文与分列都正常）
            if (format !== 'xls' && !this._canBinaryBlob()) {
                var tip = format === 'csv' ? '.csv' : '.xlsx';
                var ok = window.confirm('您当前是老掉牙的IE9，不能导出' + tip + '，系统将自动降级导出.xls，确认要导出吗？');
                if (!ok) return;
                format = 'xls';
            }

            var columns = this._getExportColumns();
            var rows = this.table.dataStore.rows || [];

            if (format === 'csv') {
                this._exportCsv(columns, rows);
            } else if (format === 'xlsx') {
                this._exportXlsx(columns, rows);
            } else {
                this._exportXls(columns, rows);
            }
        };

        /**
         * 当前环境是否有 Blob（IE9 没有，只能走 iframe + SaveAs 文本兜底）
         */
        Export.prototype._canBlob = function() {
            return !!(window.Blob && window.URL && window.URL.createObjectURL);
        };

        /**
         * 当前环境的 Blob 是否支持「二进制片段」（Uint8Array 作为 parts）
         * IE10 的 Blob 只支持字符串片段，塞 Uint8Array 进去会被吞掉/报错，
         * xlsx（ZIP 二进制）就是靠它，所以必须单独探一次；探不到就降级 xls。
         */
        Export.prototype._canBinaryBlob = function() {
            if (!this._canBlob()) return false;
            try {
                var probe = new Blob([new Uint8Array([0xE7, 0xBC, 0x96])]);
                return probe.size === 3;
            } catch (e) {
                return false;
            }
        };

        /**
         * 取需要导出的列
         * 按两个开关过滤：
         *   includeInnerColumns=false  → 跳过 field 以 _ 开头的内部列（序号 / 状态 / 勾选等）
         *   includeHiddenColumns=false → 跳过 visible:false 的隐藏列
         * @return {Array}
         */
        Export.prototype._getExportColumns = function() {
            var columns = this.table.dataStore.columns || [];
            var out = [];

            for (var i = 0; i < columns.length; i++) {
                var col = columns[i];
                if (!col) continue;

                if (!this.options.includeInnerColumns && col.field && col.field.charAt(0) === '_') continue;
                if (!this.options.includeHiddenColumns && col.visible === false) continue;

                out.push(col);
            }
            return out;
        };

        /**
         * 取单元格导出值：先取值，再走列 formatter，最后转字符串
         */
        Export.prototype._getCellValue = function(row, col) {
            var value = row[col.field];
            if (value === undefined || value === null) value = '';

            if (typeof col.formatter === 'function') {
                value = col.formatter(value, row);
            }
            if (value === undefined || value === null) value = '';
            return String(value);
        };

        // ==================== xls（HTML 伪装，IE9 也能用） ====================

        /**
         * 导出 Excel（.xls，HTML 伪装表格；Excel 打开可能提示"格式与扩展名不一致"）
         */
        Export.prototype._exportXls = function(columns, rows) {
            var html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel">';
            html += '<head><meta charset="UTF-8"></head>';
            html += '<body>';
            html += '<table border="1">';

            // 表头
            html += '<tr>';
            for (var i = 0; i < columns.length; i++) {
                html += '<th>' + this._escapeHtml(columns[i].title || '') + '</th>';
            }
            html += '</tr>';

            // 数据行
            for (var r = 0; r < rows.length; r++) {
                html += '<tr>';
                for (var c = 0; c < columns.length; c++) {
                    html += '<td>' + this._escapeHtml(this._getCellValue(rows[r], columns[c])) + '</td>';
                }
                html += '</tr>';
            }

            html += '</table>';
            html += '</body></html>';

            if (this._canBlob()) {
                this._save(new Blob([html], {type: 'application/vnd.ms-excel;charset=UTF-8'}), this.options.filename + '.xls');
            } else {
                // IE9：没有 Blob，直接把 HTML 文本交给 iframe 兜底
                this._save(null, this.options.filename + '.xls', html);
            }
        };

        // ==================== xlsx（真 OOXML，纯 JS 手写 ZIP） ====================

        /**
         * 导出真 xlsx（Excel 2007+ 标准格式，打开无格式警告）
         * 结构：ZIP 容器 + 5 个 XML 部件，store（不压缩）方式写入
         */
        Export.prototype._exportXlsx = function(columns, rows) {
            var sheetXml = this._buildSheetXml(columns, rows);

            var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                + '<Default Extension="xml" ContentType="application/xml"/>'
                + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                + '</Types>';

            var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                + '</Relationships>';

            var workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
                + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                + '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>'
                + '</workbook>';

            var workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
                + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
                + '</Relationships>';

            var zip = this._zip([
                {'name': '[Content_Types].xml', 'text': contentTypes},
                {'name': '_rels/.rels', 'text': rootRels},
                {'name': 'xl/workbook.xml', 'text': workbook},
                {'name': 'xl/_rels/workbook.xml.rels', 'text': workbookRels},
                {'name': 'xl/worksheets/sheet1.xml', 'text': sheetXml},
                {'name': 'xl/styles.xml', 'text': this._buildStylesXml()}
            ]);

            this._save(zip, this.options.filename + '.xlsx');
        };

        /**
         * 生成 sheet1.xml
         * 数字写数值单元格（Excel 里可直接求和），其余写内联字符串（免维护 sharedStrings）
         */
        Export.prototype._buildSheetXml = function(columns, rows) {
            var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

            // 冻结首行（sheetViews 必须排在 cols / sheetData 之前）
            xml += '<sheetViews><sheetView workbookViewId="0">'
                + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
                + '</sheetView></sheetViews>';

            // 列宽（单位：字符宽度，约等于 px/7）
            xml += '<cols>';
            for (var i = 0; i < columns.length; i++) {
                var px = columns[i].width || 100;
                xml += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (Math.round(px / 7) || 12) + '" customWidth="1"/>';
            }
            xml += '</cols>';

            xml += '<sheetData>';

            // 表头行（加粗样式 s="1"）
            xml += '<row r="1">';
            for (var h = 0; h < columns.length; h++) {
                xml += '<c r="' + this._colName(h) + '1" t="inlineStr" s="1"><is><t>' + this._escapeXml(columns[h].title || '') + '</t></is></c>';
            }
            xml += '</row>';

            // 数据行
            for (var r = 0; r < rows.length; r++) {
                var rowNum = r + 2;
                xml += '<row r="' + rowNum + '">';
                for (var c = 0; c < columns.length; c++) {
                    var ref = this._colName(c) + rowNum;
                    var val = this._getCellValue(rows[r], columns[c]);
                    if (/^-?\d+(\.\d+)?$/.test(val)) {
                        xml += '<c r="' + ref + '"><v>' + val + '</v></c>';
                    } else if (val !== '') {
                        xml += '<c r="' + ref + '" t="inlineStr"><is><t>' + this._escapeXml(val) + '</t></is></c>';
                    }
                }
                xml += '</row>';
            }

            xml += '</sheetData>';
            xml += '</worksheet>';
            return xml;
        };

        /**
         * 生成 styles.xml
         * 注意：格式（字体/填充/边框）必须独立成 xl/styles.xml 部件，
         * 塞进 worksheet 里 Excel 会判定文件损坏（fills 也要求至少 2 项）。
         * @return {String}
         */
        Export.prototype._buildStylesXml = function() {
            return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                + '<fonts count="2">'
                + '<font><sz val="11"/><name val="宋体"/><charset val="134"/></font>'
                + '<font><b/><sz val="11"/><name val="宋体"/><charset val="134"/></font>'
                + '</fonts>'
                + '<fills count="2">'
                + '<fill><patternFill patternType="none"/></fill>'
                + '<fill><patternFill patternType="gray125"/></fill>'
                + '</fills>'
                + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
                + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
                + '<cellXfs count="2">'
                + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
                + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
                + '</cellXfs>'
                + '<cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles>'
                + '</styleSheet>';
        };

        /**
         * 列号 → Excel 列名（0 → A，25 → Z，26 → AA）
         */
        Export.prototype._colName = function(index) {
            var name = '';
            var n = index;
            while (n >= 0) {
                name = String.fromCharCode(65 + (n % 26)) + name;
                n = Math.floor(n / 26) - 1;
            }
            return name;
        };

        /**
         * 手写 ZIP（store 方式，不压缩；xlsx 规范允许 store）
         * @param {Array} files [{name: '路径', text: '内容'}]
         * @return {Blob}
         */
        Export.prototype._zip = function(files) {
            var parts = [];
            var centralParts = [];
            var offset = 0;

            // 固定时间戳（DOS 格式）：2026-11-11 11:22
            var dosTime = ((11 & 0x1F) << 11) | ((22 & 0x3F) << 5) | 0;
            var dosDate = (((2026 - 1980) & 0x7F) << 9) | ((11 & 0x0F) << 5) | 11;

            for (var i = 0; i < files.length; i++) {
                var nameBytes = utf8Bytes(files[i].name);
                var dataBytes = utf8Bytes(files[i].text);
                var crc = crc32(dataBytes);

                // 本地文件头
                var local = concatBytes([
                    u32(0x04034b50),       // 签名
                    u16(20),               // 解压所需版本
                    u16(0),                // 标志位（文件名全 ASCII，无需 UTF-8 标志）
                    u16(0),                // 压缩方式：0 = store
                    u16(dosTime),
                    u16(dosDate),
                    u32(crc),
                    u32(dataBytes.length), // 压缩后大小
                    u32(dataBytes.length), // 原始大小
                    u16(nameBytes.length),
                    u16(0)                 // extra 长度
                ]);

                parts.push(local, nameBytes, dataBytes);

                // 中央目录项
                centralParts.push(concatBytes([
                    u32(0x02014b50),       // 签名
                    u16(20),               // 创建版本
                    u16(20),               // 解压所需版本
                    u16(0),                // 标志位
                    u16(0),                // 压缩方式
                    u16(dosTime),
                    u16(dosDate),
                    u32(crc),
                    u32(dataBytes.length),
                    u32(dataBytes.length),
                    u16(nameBytes.length),
                    u16(0),                // extra
                    u16(0),                // 注释
                    u16(0),                // 起始磁盘
                    u16(0),                // 内部属性
                    u32(0),                // 外部属性
                    u32(offset),           // 本地头偏移
                    nameBytes
                ]));

                offset += local.length + nameBytes.length + dataBytes.length;
            }

            var centralStart = offset;
            var centralSize = 0;
            for (var c = 0; c < centralParts.length; c++) {
                parts.push(centralParts[c]);
                centralSize += centralParts[c].length;
            }

            // 中央目录结束记录
            parts.push(concatBytes([
                u32(0x06054b50),
                u16(0), u16(0),
                u16(files.length), u16(files.length),
                u32(centralSize),
                u32(centralStart),
                u16(0)
            ]));

            var all = concatBytes(parts);
            return new Blob([all], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        };

        // ==================== csv ====================

        /**
         * 导出 CSV（原生纯文本）
         * 要点：
         *   1. 编码固定 UTF-16LE + BOM(FF FE)，Excel 一看就按 Unicode 解析，中文不会乱码；
         *   2. 分隔符默认 Tab（Excel 的 Unicode 文本解析器只认 Tab，按 Tab 一列列展开）；
         *      给后端消费时把 csvDelimiter 改成 ','，Excel 里整行显示为一条，便于按纯文本行解析；
         *   3. 单元格含 分隔符 / 双引号 / 换行 时，整体用双引号包裹，内部引号翻倍；
         *   4. 行分隔用 \r\n，兼容 Windows 记事本与 Excel。
         */
        Export.prototype._exportCsv = function(columns, rows) {
            var delimiter = this._getCsvDelimiter();
            var lines = [];
            var i;

            var headCells = [];
            for (i = 0; i < columns.length; i++) {
                headCells.push(this._csvCell(columns[i].title || '', delimiter));
            }
            lines.push(headCells.join(delimiter));

            for (var r = 0; r < rows.length; r++) {
                var cells = [];
                for (i = 0; i < columns.length; i++) {
                    cells.push(this._csvCell(this._getCellValue(rows[r], columns[i]), delimiter));
                }
                lines.push(cells.join(delimiter));
            }

            var text = lines.join('\r\n');

            // 编码固定 UTF-16LE（首两字节 FF FE）：这是 Excel 无条件按 Unicode 解析的标记，
            // 不依赖 BOM 探测，也不会被"把文件当文本重编码"的下载链路吃掉；
            // 分隔符由 csvDelimiter 决定，默认 Tab —— Excel 的 Unicode 文本解析器只认 Tab，
            // 用逗号会让整行挤成一列（这就是之前"一堆文本"的原因）。
            this._save(
                new Blob([this._utf16Bytes(text)], {type: 'text/csv;charset=utf-16le'}),
                this.options.filename + '.csv'
            );
        };

        /**
         * 取 CSV 分隔符（只认单字符；非法值退回 Tab）
         * 注意：插件内部按 \t / tab / 单字符 三种写法识别
         * @return {String}
         */
        Export.prototype._getCsvDelimiter = function() {
            var d = this.options.csvDelimiter;
            if (d === '\\t' || d === 'tab') return '\t';
            if (typeof d === 'string' && d.length === 1) return d;
            return '\t';
        };

        /**
         * 文本 → UTF-16LE 字节（首两字节 FF FE，即 Unicode BOM）
         * Excel 见到 FF FE 会直接按 Unicode 解析，不用猜编码
         * @param {String} text 文本
         * @return {Uint8Array}
         */
        Export.prototype._utf16Bytes = function(text) {
            var str = String(text == null ? '' : text);
            var bytes = new Uint8Array(2 + str.length * 2);
            bytes[0] = 0xFF;
            bytes[1] = 0xFE;
            for (var i = 0; i < str.length; i++) {
                var code = str.charCodeAt(i);
                bytes[2 + i * 2] = code & 0xFF;
                bytes[3 + i * 2] = (code >> 8) & 0xFF;
            }
            return bytes;
        };

        /**
         * CSV 单元格转义
         */
        Export.prototype._csvCell = function(text, delimiter) {
            var str = String(text === undefined || text === null ? '' : text);
            var sep = delimiter || this._getCsvDelimiter();
            var quoted = str.indexOf('"') >= 0 || str.indexOf('\r') >= 0 || str.indexOf('\n') >= 0 ||
                (sep === '\t' ? str.indexOf('\t') >= 0 : str.indexOf(sep) >= 0);
            if (quoted) {
                str = '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        // ==================== 通用 ====================

        /**
         * HTML 转义（.xls 分支用，防止值里的 < & 把表格结构撑坏）
         */
        Export.prototype._escapeHtml = function(text) {
            return String(text === undefined || text === null ? '' : text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        };

        /**
         * XML 文本转义（xlsx 分支用）
         */
        Export.prototype._escapeXml = function(text) {
            return String(text === undefined || text === null ? '' : text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/\r?\n/g, '&#10;');
        };

        /**
         * 触发下载
         * @param {Blob} blob 文件内容
         * @param {String} fileName 文件名（含扩展名）
         * @param {String} textFallback IE9 兜底用的文本内容（可选）
         */
        Export.prototype._save = function(blob, fileName, textFallback) {
            if (this._canBlob()) {
                // IE10 / IE11：浏览器不支持 a[download]，点 blob 链接会抛「拒绝访问」，
                // 必须走自家的 msSaveOrOpenBlob（IE10 起提供）
                if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                    try {
                        window.navigator.msSaveOrOpenBlob(blob, fileName);
                        return;
                    } catch (e) {}
                }

                var link = document.createElement('a');
                if (typeof link.download === 'undefined') {
                    // 没有 download 属性（老 IE 且 msSave 也失败）：退回文本兜底，别去点它会报拒绝访问
                    this._saveByIframe(fileName, textFallback);
                    return;
                }

                link.href = window.URL.createObjectURL(blob);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                if (window.URL.revokeObjectURL) {
                    var href = link.href;
                    setTimeout(function() {
                        try {
                            window.URL.revokeObjectURL(href);
                        } catch (e) {}
                    }, 100);
                }
                return;
            }

            this._saveByIframe(fileName, textFallback);
        };

        /**
         * IE9 兜底：把文本写进隐藏 iframe，再调 execCommand('SaveAs')
         * @param {String} fileName 文件名
         * @param {String} text 文本内容
         */
        Export.prototype._saveByIframe = function(fileName, text) {
            var iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            var doc = iframe.contentWindow.document;
            doc.open();
            doc.write('<meta charset="UTF-8">' + (text || ''));
            doc.close();
            iframe.contentWindow.document.execCommand('SaveAs', true, fileName);
            document.body.removeChild(iframe);
        };

        /**
         * 简单对象合并
         */
        Export.prototype._extend = function(target) {
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
        MelUi.Table.plugins.Export = Export;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 纯文本渲染器
     * 将单元格值渲染为纯文本显示
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.0.0
     * @Date：2026-10-10
     * @Pubdate：2026-10-10
     */

    (function(MelUi) {

        /**
         * 渲染纯文本单元格内容
         * @param {*} value 单元格值
         * @param {Object} column 列配置
         * @param {Object} rowData 行数据
         * @return {String} HTML字符串
         */
        function render(value, column, rowData) {
            // 如果有 formatter，先格式化
            if (typeof column.formatter === 'function') {
                value = column.formatter(value, rowData);
            }

            // 空值显示空
            if (value === null || value === undefined) value = '';

            return '<span class="mel-cell-text">' + value + '</span>';
        }

        MelUi.Table = MelUi.Table || {};
        MelUi.Table.cellRenderers = MelUi.Table.cellRenderers || {};
        MelUi.Table.cellRenderers.text = render;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 单行输入框渲染器
     * 将单元格渲染为 input 输入框
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.0.0
     * @Date：2026-10-10
     * @Pubdate：2026-10-10
     */

    (function(MelUi) {

        /**
         * 渲染单行输入框单元格内容
         * @param {*} value 单元格值
         * @param {Object} column 列配置
         * @param {Object} rowData 行数据
         * @return {String} HTML字符串
         */
        function render(value, column, rowData) {
            // 空值处理
            if (value === null || value === undefined) value = '';

            // 数字类型，保留小数位
            if (column.digit !== undefined && column.digit !== '' && value !== '') {
                var num = parseFloat(value);
                if (!isNaN(num)) {
                    value = num.toFixed(parseInt(column.digit));
                }
            }

            var attrs = '';

            // 只读
            if (column.readonly) {
                attrs += ' readonly="readonly"';
            }

            // 禁用
            if (column.disabled) {
                attrs += ' disabled="disabled"';
            }

            // 必填提示
            var placeholder = '';
            if (column.required) {
                placeholder = ' placeholder="请输入' + column.title + '"';
            }

            return '<input type="text" class="mel-cell-input" value="' + value + '"' + attrs + placeholder + '>';
        }

        MelUi.Table = MelUi.Table || {};
        MelUi.Table.cellRenderers = MelUi.Table.cellRenderers || {};
        MelUi.Table.cellRenderers.input = render;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 多行输入框渲染器
     * 将单元格渲染为 textarea 输入框
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.0.0
     * @Date：2026-10-10
     * @Pubdate：2026-10-10
     */

    (function(MelUi) {

        /**
         * 渲染多行输入框单元格内容
         * @param {*} value 单元格值
         * @param {Object} column 列配置
         * @param {Object} rowData 行数据
         * @return {String} HTML字符串
         */
        function render(value, column, rowData) {
            if (value === null || value === undefined) value = '';

            var attrs = '';
            if (column.readonly) attrs += ' readonly="readonly"';
            if (column.disabled) attrs += ' disabled="disabled"';

            var placeholder = '';
            if (column.required) {
                placeholder = ' placeholder="请输入' + column.title + '"';
            }

            return '<textarea class="mel-cell-textarea"' + attrs + placeholder + '>' + value + '</textarea>';
        }

        MelUi.Table = MelUi.Table || {};
        MelUi.Table.cellRenderers = MelUi.Table.cellRenderers || {};
        MelUi.Table.cellRenderers.textarea = render;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 单选按钮渲染器
     * 将单元格渲染为 radio 单选按钮组
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.0.0
     * @Date：2026-10-10
     * @Pubdate：2026-10-10
     */

    (function(MelUi) {

        /**
         * 渲染单选按钮组单元格内容
         * @param {*} value 单元格值
         * @param {Object} column 列配置
         * @param {Object} rowData 行数据
         * @return {String} HTML字符串
         */
        function render(value, column, rowData) {
            var options = column.radioOptions || {yes: '1', no: '0'};
            var yesVal = options.yes !== undefined ? options.yes : '1';
            var noVal = options.no !== undefined ? options.no : '0';
            var yesText = column.formatter ? column.formatter(yesVal, rowData) : (yesVal === '1' ? '是' : yesVal);
            var noText = column.formatter ? column.formatter(noVal, rowData) : (noVal === '0' ? '否' : noVal);

            var name = 'mel_radio_' + column.field + '_' + (rowData._rowIndex !== undefined ? rowData._rowIndex : '0');

            var checkedYes = value == yesVal ? ' checked="checked"' : '';
            var checkedNo = value == noVal ? ' checked="checked"' : '';

            var attrs = '';
            if (column.readonly) attrs += ' readonly="readonly"';
            if (column.disabled) attrs += ' disabled="disabled"';

            var html = '';
            html += '<label class="mel-radio-item">';
            html += '<input type="radio" name="' + name + '" value="' + yesVal + '"' + checkedYes + attrs + '>';
            html += '<span>' + yesText + '</span>';
            html += '</label>';

            html += '<label class="mel-radio-item">';
            html += '<input type="radio" name="' + name + '" value="' + noVal + '"' + checkedNo + attrs + '>';
            html += '<span>' + noText + '</span>';
            html += '</label>';

            return html;
        }

        MelUi.Table = MelUi.Table || {};
        MelUi.Table.cellRenderers = MelUi.Table.cellRenderers || {};
        MelUi.Table.cellRenderers.radio = render;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 勾选框单元格渲染器
     * 将单元格渲染为 checkbox(多选) 或 radio(单选)，用于选择列
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.1.0
     * @Date：2026-10-10
     * @Pubdate：2026-11-03
     */

     (function(MelUi) {

        /**
         * 渲染勾选框单元格内容
         * @param {*} value 单元格值
         * @param {Object} column 列配置
         * @param {Object} rowData 行数据
         * @return {String} HTML字符串
         */
        function render(value, column, rowData) {
            var checked = (rowData._selected || value == 1 || value === true) ? ' checked="checked"' : '';
            var isSingle = column && column.mode === 'single';

            if (isSingle) {
                return '<input type="radio" class="mel-cell-checkbox" name="mel-table-radio"' + checked + '>';
            }
            return '<input type="checkbox" class="mel-cell-checkbox"' + checked + '>';
        }

        MelUi.Table = MelUi.Table || {};
        MelUi.Table.cellRenderers = MelUi.Table.cellRenderers || {};
        MelUi.Table.cellRenderers.checkbox = render;

    })(window.MelUi = window.MelUi || {});

    /**
     * MelUi Table 表格组件 - 按钮渲染器
     * 将单元格渲染为操作按钮
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.0.0
     * @Date：2026-10-10
     * @Pubdate：2026-10-10
     */

    (function(MelUi) {

        /**
         * 渲染按钮单元格内容
         * @param {*} value 单元格值
         * @param {Object} column 列配置
         * @param {Object} rowData 行数据
         * @return {String} HTML字符串
         */
        function render(value, column, rowData) {
            var text = column.buttonText || '按钮';
            var icon = column.buttonIcon || '';

            var iconHtml = '';
            if (icon) {
                iconHtml = '<i class="fa fa-' + icon + '"></i> ';
            }

            var attrs = '';
            if (column.disabled) attrs += ' disabled="disabled"';

            return '<button type="button" class="mel-cell-button"' + attrs + '>' + iconHtml + text + '</button>';
        }

        MelUi.Table = MelUi.Table || {};
        MelUi.Table.cellRenderers = MelUi.Table.cellRenderers || {};
        MelUi.Table.cellRenderers.button = render;

    })(window.MelUi = window.MelUi || {});

}));

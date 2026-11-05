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
     * @Version：v1.10.3
     * @Date：2026-10-10
     * @Pubdate：2026-11-04
     */

     (function(MelUi) {

        /**
         * DataStore 构造函数
         * @param {Object} options 配置项
         * @param {Boolean} options.remotePaging 是否后端远程分页（默认false，前端本地分页）
         * @param {Number} options.total 远程分页时的总记录数（由外部传入）
         */
        function DataStore(options) {
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
            row._rowIndex = 0;
            row._status = 's';  // i=新增, u=修改, s=已保存
            row._selected = false;
            row._node = null;

            return row;
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
            return this.pageSize;
        };

        /**
         * 获取总页数
         * 基于 getEffectiveTotal / getEffectivePageSize 计算，与分页栏展示口径完全统一。
         * @return {Number}
         */
        DataStore.prototype.getTotalPages = function() {
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
            return this.addRow(data, position);
        };

        /**
         * 替换整表数据（远程分页回填用，也支持普通全量替换）
         * @param {Array} data 行数据数组
         */
        DataStore.prototype.setRows = function(data) {
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
     * @Version：v1.8.2
     * @Date：2026-10-10
     * @Pubdate：2026-11-04
     */

     (function(MelUi) {

        /**
         * Renderer 构造函数
         * @param {Object} options 配置项
         * @param {Object} dataStore DataStore 实例
         * @param {Object} eventBus EventBus 实例
         */
        function Renderer(options, dataStore, eventBus) {
            this.options = options;
            this.dataStore = dataStore;
            this.eventBus = eventBus;
            this.el = typeof options.el === 'string' ? document.querySelector(options.el) : options.el;
            this.isRenderComplete = false;

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
                self._renderSummaryRow(data.sums);
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
            this.eventBus.emit('rendered');
        };

        /**
         * 获取列宽总和
         */
        Renderer.prototype._getTotalWidth = function() {
            var totalWidth = 0;
            for (var i = 0; i < this.dataStore.columns.length; i++) {
                totalWidth += this.dataStore.columns[i].width || 100;
            }
            return totalWidth;
        };

        /**
         * 渲染外层容器结构
         */
        Renderer.prototype._renderContainer = function() {
            var html = [
                '<div class="mel-table-container">',
                '  <div class="mel-table-header-wrapper">',
                '    <table class="mel-table-header">',
                '      <colgroup></colgroup>',
                '      <thead><tr></tr></thead>',
                '    </table>',
                '  </div>',
                '  <div class="mel-table-body-wrapper">',
                '    <table class="mel-table-body">',
                '      <colgroup></colgroup>',
                '      <tbody></tbody>',
                '    </table>',
                '  </div>',
                '</div>'
            ].join('\r\n');

            this.el.innerHTML = html;

            this.container = this.el.querySelector('.mel-table-container');
            this.headerWrapper = this.el.querySelector('.mel-table-header-wrapper');
            this.headerTable = this.el.querySelector('.mel-table-header');
            this.bodyWrapper = this.el.querySelector('.mel-table-body-wrapper');
            this.bodyTable = this.el.querySelector('.mel-table-body');
            this.theadTr = this.headerTable ? this.headerTable.querySelector('thead tr') : null;
            this.tbody = this.bodyTable ? this.bodyTable.querySelector('tbody') : null;

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
                col.style.width = (columns[i].width || 100) + 'px';
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
                        hcols[i].style.width = (columns[i].width || 100) + 'px';
                    }
                }
            }

            if (this.bodyTable) {
                var bcg = this.bodyTable.querySelector('colgroup');
                if (bcg) {
                    var bcols = bcg.children;
                    for (j = 0; j < bcols.length && j < columns.length; j++) {
                        bcols[j].style.width = (columns[j].width || 100) + 'px';
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

            if (opts.bordered !== false && this.container) {
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
                paginationHeight = paginationDom ? paginationDom.offsetHeight : 0;
            }

            // container目标border-box高度 = el content高度 - 分页栏高度
            var containerTargetBox = elContent - paginationHeight;
            if (containerTargetBox <= 0) return;

            this.container.style.boxSizing = 'border-box';
            this.container.style.height = containerTargetBox + 'px';

            // 读取container自己的border
            var cs = this._getBoxInfo(this.container);

            // 表头实际高度：headerHeight 为'auto'时读表头实际渲染高度；为数值时用指定值
            // 配置来自defaults合并结果，不写死数字
            var headerHeight = this.options.headerHeight;
            if (typeof headerHeight === 'number' && !isNaN(headerHeight)) {
                headerHeight = headerHeight;
            } else {
                // 'auto'：读取表头 wrapper 实际高度（内容撑开）
                headerHeight = this.headerWrapper ? this.headerWrapper.offsetHeight : 0;
            }

            // bodyWrapper目标border-box高度 = container高度 - container border上下 - 表头高度
            var bodyHeight = containerTargetBox - cs.borderTop - cs.borderBottom - headerHeight;
            if (bodyHeight > 0) {
                this.bodyWrapper.style.height = bodyHeight + 'px';
                this.bodyWrapper.style.overflow = 'auto';
            }

            // 表身高变化后，垂直滚动条可能出现/消失，导致 bodyClientWidth 变化；
            // 重新对齐表头 wrapper 宽度到 bodyWrapper.clientWidth，保证表头表身不错行
            this._syncHeaderWidth();
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
        };

        /**
         * 应用固定列样式到当前表头/表身的固定列 td/th
         * 仅设置样式(相对定位、z-index、背景、当前left)，不重复绑定滚动事件。
         * 在 render 初始、翻页、增删行(_renderBody)后调用，保证重建后的固定列样式不丢失。
         * 【背景色关键】冻结 td 不能写死固定色，必须实时取所属行 tr 的实际渲染背景色
         * (含斑马纹、hover)，否则下层滚动内容会穿透，且行间颜色不一致。
         */
        Renderer.prototype._applyFixedColumns = function() {
            var fixedLeft = this.options.fixedLeftColumns || 0;
            if (fixedLeft <= 0) return;
            if (!this.theadTr || !this.tbody) return;

            var scrollLeft = this.bodyWrapper ? this.bodyWrapper.scrollLeft : 0;

            // 表头固定列（表头背景固定 #f5f7fa）
            var ths = this.theadTr.children;
            for (var i = 0; i < fixedLeft && i < ths.length; i++) {
                ths[i].style.position = 'relative';
                ths[i].style.left = scrollLeft + 'px';
                ths[i].style.zIndex = '2';
                ths[i].style.backgroundColor = '#f5f7fa';
                this._setFixedShadow(ths[i]);
            }

            // 表身固定列：背景取所属行 tr 的实际渲染色
            var trs = this.tbody.children;
            for (var r = 0; r < trs.length; r++) {
                var rowBg = this._getRowBackground(trs[r]);
                var tds = trs[r].children;
                for (var c = 0; c < fixedLeft && c < tds.length; c++) {
                    tds[c].style.position = 'relative';
                    tds[c].style.left = scrollLeft + 'px';
                    tds[c].style.zIndex = '1';
                    tds[c].style.backgroundColor = rowBg;
                    this._setFixedShadow(tds[c]);
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

                // 固定列平移（左侧连续N列）
                // 注意：left 取 +scrollLeft，因为滚动容器内容向左移动了 scrollLeft，
                // 固定列需向右补偿相同距离才能保持视觉原位（方案X position:relative+left 平移）
                if (fixedLeft > 0) {
                    var offset = this.scrollLeft;
                    var trs = self.tbody ? self.tbody.children : [];
                    for (var r = 0; r < trs.length; r++) {
                        var tds = trs[r].children;
                        for (var c = 0; c < fixedLeft && c < tds.length; c++) {
                            tds[c].style.position = 'relative';
                            tds[c].style.left = offset + 'px';
                            tds[c].style.zIndex = '1';
                        }
                    }

                    var ths = self.theadTr ? self.theadTr.children : [];
                    for (var i = 0; i < fixedLeft && i < ths.length; i++) {
                        ths[i].style.position = 'relative';
                        ths[i].style.left = offset + 'px';
                        ths[i].style.zIndex = '2';
                    }
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
        Renderer.prototype._setTheadHtml = function(html) {
            if (!this.theadTr) return;

            // IE9 兼容【彻底方案】：table / tbody / tr 系列元素直接赋 innerHTML（内容含表格内部标签）
            // 会抛"该操作的目标元件无效"(Invalid target element for this operation)，这是 IE9 的硬性限制，
            // 无论该 table 是否已挂到文档。因此不再用 table 元素做解析容器，
            // 改用普通 div 容器：div 是通用容器，IE9 允许对 div 赋含 <table> 结构的 innerHTML，
            // 再从中取出解析好的 <tr> 节点迁移到真实 theadTr，彻底规避该限制。
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = '<table><tbody><tr>' + html + '</tr></tbody></table>';
            var tempTbody = tempDiv.getElementsByTagName('tbody')[0];
            var newTr = tempTbody ? tempTbody.getElementsByTagName('tr')[0] : null;

            if (!newTr) return;

            // 原地替换：先清空旧 theadTr，再逐个迁移 newTr 的子节点（th）到旧 theadTr。
            // 保留 this.theadTr 引用不变，避免 replaceChild 换节点导致已绑定的排序点击事件丢失。
            while (this.theadTr.firstChild) {
                this.theadTr.removeChild(this.theadTr.firstChild);
            }
            while (newTr.firstChild) {
                this.theadTr.appendChild(newTr.firstChild);
            }
        };

        /**
         * 渲染表头
         */
        Renderer.prototype._renderHeader = function() {
            if (!this.theadTr) return;

            var html = '';
            var columns = this.dataStore.columns;
            var sortField = this.dataStore.sortField;
            var sortOrder = this.dataStore.sortOrder;

            for (var i = 0; i < columns.length; i++) {
                var col = columns[i];
                var title = col.title || '';
                var subtitle = col.subtitle || '';
                var align = col.align || 'center';
                var alignClass = 'mel-align-' + align;

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
                    if (subtitle) {
                        thContent += '<em class="mel-th-subtitle">' + subtitle + '</em>';
                    }
                    thContent += arrow;
                    thContent += '</div>';
                }

                html += '<th class="' + alignClass + '" data-field="' + (col.field || '') + '">';
                html += thContent;
                html += '</th>';
            }

            this._setTheadHtml(html);

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
            var headerCheckbox = this.theadTr.querySelector('.mel-header-checkbox');
            if (headerCheckbox) {
                var self = this;
                headerCheckbox.onclick = function(e) {
                    var event = e || window.event;
                    event.cancelBubble = true;
                    var checked = this.checked;
                    self.dataStore.selectAll(checked);
                    self.eventBus.emit('selectChange', {
                        selectedRows: self.dataStore.getSelectedRows()
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

                var renderer = this._renderers[col.renderer] || this._renderers.text;
                var cellContent = renderer(value, col, rowData);

                html += '<td class="' + alignClass + '" data-field="' + (col.field || '') + '" data-row-index="' + rowData._rowIndex + '" style="height:' + rowH + 'px;">';
                html += cellContent;
                html += '</td>';
            }

            html += '</tr>';
            return html;
        };

        /**
         * 缓存每行 DOM 节点引用
         */
        Renderer.prototype._cacheRowNodes = function() {
            if (!this.tbody) return;

            var trs = this.tbody.children;
            var visibleRows = this.dataStore.getVisibleRows();
            for (var i = 0; i < trs.length; i++) {
                if (visibleRows[i]) {
                    visibleRows[i]._node = trs[i];
                }
            }
        };

        /**
         * 画合计行
         */
        Renderer.prototype._renderSummaryRow = function(sums) {
            if (!this.tbody) return;

            var oldRows = this.tbody.querySelectorAll('.mel-summary-row');
            for (var i = 0; i < oldRows.length; i++) {
                if (oldRows[i].parentNode) {
                    oldRows[i].parentNode.removeChild(oldRows[i]);
                }
            }

            if (!sums) return;

            var columns = this.dataStore.columns;
            var html = '<tr class="mel-summary-row">';

            for (var c = 0; c < columns.length; c++) {
                var col = columns[c];
                var cellHtml = '';

                if (sums.titleColumn === c) {
                    cellHtml = '<strong>' + (sums.title || '合计') + '</strong>';
                } else if (sums.data[col.field] !== undefined && !isNaN(sums.data[col.field])) {
                    cellHtml = '<strong>' + sums.data[col.field].toFixed(2) + '</strong>';
                }

                html += '<td>' + cellHtml + '</td>';
            }

            html += '</tr>';

            if (this.tbody.insertAdjacentHTML) {
                this.tbody.insertAdjacentHTML('beforeend', html);
            } else {
                // IE9 兜底【彻底方案】：改用普通 div 容器解析含 <table> 结构的 html，
                // 再取出 <tr> 迁移到 tbody，规避 IE9 对 table/tbody 赋 innerHTML 写表格内部标签的限制。
                var tempDiv = document.createElement('div');
                tempDiv.innerHTML = '<table><tbody>' + html + '</tbody></table>';
                var tempTbody = tempDiv.getElementsByTagName('tbody')[0];
                var tr = tempTbody ? tempTbody.getElementsByTagName('tr')[0] : null;
                if (tr) this.tbody.appendChild(tr);
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
            if (!this.tbody || !this.theadTr) return;

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

                self.eventBus.emit('cellClick', {
                    rowData: rowData,
                    cell: {rowIndex: rowIndex, field: field, element: td}
                });
                self.eventBus.emit('rowClick', {rowData: rowData, rowIndex: rowIndex});
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
                self.eventBus.emit('cellChange', {
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
                    self.eventBus.emit('cellChange', {
                        rowIndex: rowIndex, field: field,
                        newValue: newValue, oldValue: oldValue
                    });
                });
            }

            this.theadTr.onclick = function(e) {
                var event = e || window.event;
                var target = event.target || event.srcElement;

                var th = self._findParent(target, 'TH');
                if (!th) return;

                var field = th.getAttribute('data-field');
                if (!field) return;

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
                    var tds = tr.children;
                    for (var c = 0; c < fixedLeft && c < tds.length; c++) {
                        tds[c].style.backgroundColor = rowBg;
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
        Renderer.prototype._destroy = function() {
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
     * @Version：v1.2.1
     * @Date：2026-10-10
     * @Pubdate：2026-11-03
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
                self.table.eventBus.emit('selectChange', {
                    selectedRows: self.table.dataStore.getSelectedRows()
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
     * @Version：v1.1.0
     * @Date：2026-10-10
     * @Pubdate：2026-11-04
     */

     (function(MelUi) {

        /**
         * Sort 排序插件
         * @param {Object} options 配置
         *   defaultField: 默认排序列字段名
         *   defaultOrder: 默认排序方向 'asc' / 'desc'
         *   sortCurrentPageOnly: 是否仅对当前页排序(可选)，默认false。
         *     仅 remotePaging=false 前端本地分页时有效；remotePaging=true 时本参数无效，强制全量排序。
         *     true：只对当前页切片区间排序并回填数据源该区间，其他数据顺序不变，不会出现排序后数据跑到其他页。
         *     false：对整个数据源排序（原有逻辑），排序后重新分页切片。
         */
        function Sort(options) {
            this.options = this._extend({
                defaultField: '',
                defaultOrder: 'asc',
                sortCurrentPageOnly: false
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

            // 监听表头点击 → 改排序状态 → 发事件让 Renderer 重绘
            table.eventBus.on('headerClick', function(data) {
                var field = data.field;
                if (!field || field.charAt(0) === '_') return;

                // 切换排序方向
                if (table.dataStore.sortField === field) {
                    table.dataStore.sortOrder = table.dataStore.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    table.dataStore.sortField = field;
                    table.dataStore.sortOrder = 'asc';
                }

                // 仅本地分页(remotePaging=false)时 sortCurrentPageOnly 生效；远程分页强制全量排序
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
     * @Version：v1.0.2
     * @Date：2026-10-10
     * @Pubdate：2026-10-10
     */

    (function(MelUi) {

        /**
         * Summary 合计行插件
         * @param {Object} options 配置
         *   columns: 需要合计的字段名数组，如 ['mj', 'scjj']
         *   title: 合计行标题，默认 '合计'
         *   titleColumn: 标题放在第几列（索引），默认0
         */
        function Summary(options) {
            this.options = this._extend({
                columns: [],
                title: '合计',
                titleColumn: 0
            }, options || {});
        }

        Summary.prototype = new MelUi.Table.PluginBase();
        Summary.prototype.constructor = Summary;

        /**
         * 初始化：只监听事件、算数据，不碰 DOM
         */
        Summary.prototype.init = function(table) {
            this.table = table;
            var self = this;

            // 监听 Renderer 请求合计数据（每次重绘表身后触发）
            table.eventBus.on('summaryRequest', function() {
                var sums = self._calcSums();
                table.eventBus.emit('summaryChange', {sums: sums});
            });

            // 单元格变化时重新计算
            table.eventBus.on('cellChange', function() {
                var sums = self._calcSums();
                table.eventBus.emit('summaryChange', {sums: sums});
            });
        };

        /**
         * 计算各列合计值
         */
        Summary.prototype._calcSums = function() {
            var rows = this.table.dataStore.rows;
            var sums = {};

            for (var i = 0; i < this.options.columns.length; i++) {
                var field = this.options.columns[i];
                sums[field] = 0;

                for (var j = 0; j < rows.length; j++) {
                    var val = parseFloat(rows[j][field]);
                    if (!isNaN(val)) {
                        sums[field] += val;
                    }
                }
            }

            return {
                data: sums,
                title: this.options.title,
                titleColumn: this.options.titleColumn
            };
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
     * MelUi Table 表格组件 - 导出Excel插件
     * 将表格数据导出为 Excel 文件（.xls）
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.0.0
     * @Date：2026-10-10
     * @Pubdate：2026-10-10
     */

    (function(MelUi) {

        /**
         * Export 导出Excel插件
         * @param {Object} options 配置
         *   filename: 文件名，默认 '导出数据'
         *   extension: 扩展名 '.xls'（默认）/ '.xlsx'
         *   includeHiddenColumns: 是否包含隐藏列，默认false
         */
        function Export(options) {
            this.options = this._extend({
                filename: '导出数据',
                extension: '.xls',
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
         */
        Export.prototype.export = function() {
            var columns = this.table.dataStore.columns;
            var rows = this.table.dataStore.rows;

            // 生成 HTML 表格
            var html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel">';
            html += '<head><meta charset="UTF-8"></head>';
            html += '<body>';
            html += '<table border="1">';

            // 表头
            html += '<tr>';
            for (var i = 0; i < columns.length; i++) {
                // 跳过内部字段列
                if (columns[i].field.charAt(0) === '_' && !this.options.includeHiddenColumns) continue;
                html += '<th>' + (columns[i].title || '') + '</th>';
            }
            html += '</tr>';

            // 数据行
            for (var r = 0; r < rows.length; r++) {
                html += '<tr>';
                for (var c = 0; c < columns.length; c++) {
                    var col = columns[c];
                    if (col.field.charAt(0) === '_' && !this.options.includeHiddenColumns) continue;

                    var value = rows[r][col.field];
                    if (value === undefined || value === null) value = '';

                    // 如果有 formatter，格式化后再导出
                    if (typeof col.formatter === 'function') {
                        value = col.formatter(value, rows[r]);
                    }

                    html += '<td>' + value + '</td>';
                }
                html += '</tr>';
            }

            html += '</table>';
            html += '</body></html>';

            // 创建下载链接
            var fileName = this.options.filename + this.options.extension;

            if (window.Blob && window.URL) {
                // 现代浏览器
                var blob = new Blob([html], {encoding: 'UTF-8', type: 'text/html'});
                var link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                // IE9 兼容
                var iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
                var doc = iframe.contentWindow.document;
                doc.open();
                doc.write(html);
                doc.close();
                iframe.contentWindow.document.execCommand('SaveAs', true, fileName);
                document.body.removeChild(iframe);
            }
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

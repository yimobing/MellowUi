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
     * 已销毁实例调用API时的告警开关
     * true：打印 console.warn，开发期便于发现"表格已销毁但仍有异步回调在写数据"的误用；
     * false：静默（生产环境如需零日志可改为false）。
     * 仅影响提示日志，不影响守卫本身：已销毁实例的调用一律被忽略。
     */
    var DESTROYED_WARN = true;

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
        if (DESTROYED_WARN && window.console && console.warn) {
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

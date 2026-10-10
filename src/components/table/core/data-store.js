/**
 * MelUi Table 表格组件 - 数据存储
 * 负责管理表格所有数据：行数据、列配置、选中状态、排序状态
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.1.0
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * DataStore 构造函数
     * @param {Object} options 配置项
     */
    function DataStore(options) {
        this.columns = options.columns || [];
        this.rows = [];
        this.sortField = '';
        this.sortOrder = '';
        this.selectedRowIndexes = [];
        this.currentPage = 1;  // 当前页码
        this.pageSize = 0;     // 每页条数，0表示不分页

        // 初始化数据
        if (options.data && options.data.length) {
            for (var i = 0; i < options.data.length; i++) {
                var row = this._createRow(options.data[i]);
                row._rowIndex = i;
                this.rows.push(row);
            }
        }
    }

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
     * @return {Object|null}
     */
    DataStore.prototype.getRow = function(rowIndex) {
        if (rowIndex < 0 || rowIndex >= this.rows.length) return null;
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
     * @param {String} position 位置：'first' 插入最前 / 'last' 追加最后
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

        if (position === 'first') {
            this.rows.unshift(row);
        } else {
            this.rows.push(row);
        }

        this._updateRowIndexes();
        return row;
    };

    /**
     * 删除一行
     * @param {Number} rowIndex 行索引
     */
    DataStore.prototype.removeRow = function(rowIndex) {
        if (rowIndex < 0 || rowIndex >= this.rows.length) return;
        this.rows.splice(rowIndex, 1);
        this._updateRowIndexes();
    };

    /**
     * 清空所有行
     */
    DataStore.prototype.clearRows = function() {
        this.rows = [];
        this.selectedRowIndexes = [];
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
     * @param {Boolean} selected 是否选中
     */
    DataStore.prototype.selectAll = function(selected) {
        this.selectedRowIndexes = [];
        for (var i = 0; i < this.rows.length; i++) {
            this.rows[i]._selected = selected;
            if (selected) this.selectedRowIndexes.push(i);
        }
    };

    /**
     * 反选
     */
    DataStore.prototype.invertSelect = function() {
        this.selectedRowIndexes = [];
        for (var i = 0; i < this.rows.length; i++) {
            this.rows[i]._selected = !this.rows[i]._selected;
            if (this.rows[i]._selected) this.selectedRowIndexes.push(i);
        }
    };

    /**
     * 排序
     * @param {String} field 字段名
     * @param {String} order 排序方向：'asc' / 'desc'
     */
    DataStore.prototype.sort = function(field, order) {
        this.sortField = field;
        this.sortOrder = order;

        this.rows.sort(function(a, b) {
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
        });

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
     * @return {Array}
     */
    DataStore.prototype.getVisibleRows = function() {
        if (!this.pageSize || this.pageSize <= 0) {
            return this.rows;
        }
        var start = (this.currentPage - 1) * this.pageSize;
        var end = start + this.pageSize;
        return this.rows.slice(start, end);
    };

    /**
     * 获取总页数
     * @return {Number}
     */
    DataStore.prototype.getTotalPages = function() {
        if (!this.pageSize || this.pageSize <= 0) return 1;
        return Math.ceil(this.rows.length / this.pageSize);
    };

    // 暴露到命名空间
    MelUi.Table = MelUi.Table || {};
    MelUi.Table.DataStore = DataStore;

})(window.MelUi = window.MelUi || {});

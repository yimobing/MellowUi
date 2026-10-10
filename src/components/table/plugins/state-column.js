/**
 * MelUi Table 表格组件 - 状态列插件
 * 在表格最后插入一列状态标记（新增/修改/已保存）
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.0
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * StateColumn 状态列插件
     * @param {Object} options 配置
     *   width: 列宽，默认60
     *   newText: 新增标记文字，默认 '新'
     *   unsaveText: 修改标记文字，默认 '改'
     *   savedText: 已保存标记文字，默认 ''
     */
    function StateColumn(options) {
        this.options = this._extend({
            width: 60,
            newText: '新',
            unsaveText: '改',
            savedText: ''
        }, options || {});
    }

    StateColumn.prototype = new MelUi.Table.PluginBase();
    StateColumn.prototype.constructor = StateColumn;

    /**
     * 初始化
     */
    StateColumn.prototype.init = function(table) {
        this.table = table;

        // 在列配置最后面插入状态列
        table.dataStore.columns.push({
            field: '_state',
            title: '状态',
            width: this.options.width,
            renderer: 'text',
            align: 'center'
        });

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

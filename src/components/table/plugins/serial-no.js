/**
 * MelUi Table 表格组件 - 序号列插件
 * 在表格最前面插入一列序号
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.0
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * SerialNo 序号列插件
     * @param {Object} options 配置
     *   width: 列宽，默认50
     */
    function SerialNo(options) {
        this.options = this._extend({
            width: 50
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
     */
    SerialNo.prototype._updateSerialNumbers = function() {
        var rows = this.table.dataStore.rows;
        for (var i = 0; i < rows.length; i++) {
            rows[i]._serialNo = (i + 1).toString();
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

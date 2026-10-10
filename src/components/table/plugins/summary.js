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

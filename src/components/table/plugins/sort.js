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

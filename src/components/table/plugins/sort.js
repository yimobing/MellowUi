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
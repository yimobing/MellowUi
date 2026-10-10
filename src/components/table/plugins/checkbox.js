/**
 * MelUi Table 表格组件 - 多选列插件
 * 只负责修改选中状态数据，DOM 渲染由 Renderer 统一处理
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.1.0
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * Checkbox 多选列插件
     * @param {Object} options 配置
     *   width: 列宽，默认60（要放得下"合计"两个字）
     */
    function Checkbox(options) {
        this.options = this._extend({
            width: 60
        }, options || {});
    }

    Checkbox.prototype = new MelUi.Table.PluginBase();
    Checkbox.prototype.constructor = Checkbox;

    /**
     * 初始化：只加列配置 + 监听事件改数据，不碰 DOM
     */
    Checkbox.prototype.init = function(table) {
        this.table = table;
        var self = this;

        // 在列配置最前面插入复选列
        table.dataStore.columns.unshift({
            field: '_checkbox',
            title: '',
            width: this.options.width,
            renderer: 'checkbox',
            align: 'center'
        });

        // 监听渲染完成后，给 tbody 加点击监听（只监听复选框点击）
        table.eventBus.on('rendered', function() {
            self._bindClickEvent();
        });
    };

    /**
     * 绑定复选框点击事件（此时 DOM 已就绪）
     */
    Checkbox.prototype._bindClickEvent = function() {
        var tbody = this.table.renderer.tbody;
        if (!tbody) return;

        var self = this;

        var handler = function(e) {
            var event = e || window.event;
            var target = event.target || event.srcElement;

            if (target.tagName !== 'INPUT' || target.type !== 'checkbox') return;

            var td = self._findParent(target, 'TD');
            if (!td) return;

            var rowIndex = parseInt(td.getAttribute('data-row-index'));

            // 改数据
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

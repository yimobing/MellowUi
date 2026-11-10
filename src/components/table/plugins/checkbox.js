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

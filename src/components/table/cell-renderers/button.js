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

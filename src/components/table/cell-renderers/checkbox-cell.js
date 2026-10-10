/**
 * MelUi Table 表格组件 - 复选框单元格渲染器
 * 将单元格渲染为单个 checkbox（用于选中列）
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.0
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * 渲染复选框单元格内容
     * @param {*} value 单元格值
     * @param {Object} column 列配置
     * @param {Object} rowData 行数据
     * @return {String} HTML字符串
     */
    function render(value, column, rowData) {
        var checked = (rowData._selected || value == 1 || value === true) ? ' checked="checked"' : '';
        return '<input type="checkbox" class="mel-cell-checkbox"' + checked + '>';
    }

    MelUi.Table = MelUi.Table || {};
    MelUi.Table.cellRenderers = MelUi.Table.cellRenderers || {};
    MelUi.Table.cellRenderers.checkbox = render;

})(window.MelUi = window.MelUi || {});

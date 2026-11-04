/**
 * MelUi Table 表格组件 - 勾选框单元格渲染器
 * 将单元格渲染为 checkbox(多选) 或 radio(单选)，用于选择列
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.1.0
 * @Date：2026-10-10
 * @Pubdate：2026-11-03
 */

 (function(MelUi) {

    /**
     * 渲染勾选框单元格内容
     * @param {*} value 单元格值
     * @param {Object} column 列配置
     * @param {Object} rowData 行数据
     * @return {String} HTML字符串
     */
    function render(value, column, rowData) {
        var checked = (rowData._selected || value == 1 || value === true) ? ' checked="checked"' : '';
        var isSingle = column && column.mode === 'single';

        if (isSingle) {
            return '<input type="radio" class="mel-cell-checkbox" name="mel-table-radio"' + checked + '>';
        }
        return '<input type="checkbox" class="mel-cell-checkbox"' + checked + '>';
    }

    MelUi.Table = MelUi.Table || {};
    MelUi.Table.cellRenderers = MelUi.Table.cellRenderers || {};
    MelUi.Table.cellRenderers.checkbox = render;

})(window.MelUi = window.MelUi || {});

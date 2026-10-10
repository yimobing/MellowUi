/**
 * MelUi Table 表格组件 - 多行输入框渲染器
 * 将单元格渲染为 textarea 输入框
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.0
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * 渲染多行输入框单元格内容
     * @param {*} value 单元格值
     * @param {Object} column 列配置
     * @param {Object} rowData 行数据
     * @return {String} HTML字符串
     */
    function render(value, column, rowData) {
        if (value === null || value === undefined) value = '';

        var attrs = '';
        if (column.readonly) attrs += ' readonly="readonly"';
        if (column.disabled) attrs += ' disabled="disabled"';

        var placeholder = '';
        if (column.required) {
            placeholder = ' placeholder="请输入' + column.title + '"';
        }

        return '<textarea class="mel-cell-textarea"' + attrs + placeholder + '>' + value + '</textarea>';
    }

    MelUi.Table = MelUi.Table || {};
    MelUi.Table.cellRenderers = MelUi.Table.cellRenderers || {};
    MelUi.Table.cellRenderers.textarea = render;

})(window.MelUi = window.MelUi || {});

/**
 * MelUi Table 表格组件 - 单行输入框渲染器
 * 将单元格渲染为 input 输入框
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.0
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * 渲染单行输入框单元格内容
     * @param {*} value 单元格值
     * @param {Object} column 列配置
     * @param {Object} rowData 行数据
     * @return {String} HTML字符串
     */
    function render(value, column, rowData) {
        // 空值处理
        if (value === null || value === undefined) value = '';

        // 数字类型，保留小数位
        if (column.digit !== undefined && column.digit !== '' && value !== '') {
            var num = parseFloat(value);
            if (!isNaN(num)) {
                value = num.toFixed(parseInt(column.digit));
            }
        }

        var attrs = '';

        // 只读
        if (column.readonly) {
            attrs += ' readonly="readonly"';
        }

        // 禁用
        if (column.disabled) {
            attrs += ' disabled="disabled"';
        }

        // 必填提示
        var placeholder = '';
        if (column.required) {
            placeholder = ' placeholder="请输入' + column.title + '"';
        }

        return '<input type="text" class="mel-cell-input" value="' + value + '"' + attrs + placeholder + '>';
    }

    MelUi.Table = MelUi.Table || {};
    MelUi.Table.cellRenderers = MelUi.Table.cellRenderers || {};
    MelUi.Table.cellRenderers.input = render;

})(window.MelUi = window.MelUi || {});

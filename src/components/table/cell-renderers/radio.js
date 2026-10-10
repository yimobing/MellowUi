/**
 * MelUi Table 表格组件 - 单选按钮渲染器
 * 将单元格渲染为 radio 单选按钮组
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.0
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * 渲染单选按钮组单元格内容
     * @param {*} value 单元格值
     * @param {Object} column 列配置
     * @param {Object} rowData 行数据
     * @return {String} HTML字符串
     */
    function render(value, column, rowData) {
        var options = column.radioOptions || {yes: '1', no: '0'};
        var yesVal = options.yes !== undefined ? options.yes : '1';
        var noVal = options.no !== undefined ? options.no : '0';
        var yesText = column.formatter ? column.formatter(yesVal, rowData) : (yesVal === '1' ? '是' : yesVal);
        var noText = column.formatter ? column.formatter(noVal, rowData) : (noVal === '0' ? '否' : noVal);

        var name = 'mel_radio_' + column.field + '_' + (rowData._rowIndex !== undefined ? rowData._rowIndex : '0');

        var checkedYes = value == yesVal ? ' checked="checked"' : '';
        var checkedNo = value == noVal ? ' checked="checked"' : '';

        var attrs = '';
        if (column.readonly) attrs += ' readonly="readonly"';
        if (column.disabled) attrs += ' disabled="disabled"';

        var html = '';
        html += '<label class="mel-radio-item">';
        html += '<input type="radio" name="' + name + '" value="' + yesVal + '"' + checkedYes + attrs + '>';
        html += '<span>' + yesText + '</span>';
        html += '</label>';

        html += '<label class="mel-radio-item">';
        html += '<input type="radio" name="' + name + '" value="' + noVal + '"' + checkedNo + attrs + '>';
        html += '<span>' + noText + '</span>';
        html += '</label>';

        return html;
    }

    MelUi.Table = MelUi.Table || {};
    MelUi.Table.cellRenderers = MelUi.Table.cellRenderers || {};
    MelUi.Table.cellRenderers.radio = render;

})(window.MelUi = window.MelUi || {});

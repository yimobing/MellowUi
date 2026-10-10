/**
 * MelUi Table 表格组件 - 纯文本渲染器
 * 将单元格值渲染为纯文本显示
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.0
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * 渲染纯文本单元格内容
     * @param {*} value 单元格值
     * @param {Object} column 列配置
     * @param {Object} rowData 行数据
     * @return {String} HTML字符串
     */
    function render(value, column, rowData) {
        // 如果有 formatter，先格式化
        if (typeof column.formatter === 'function') {
            value = column.formatter(value, rowData);
        }

        // 空值显示空
        if (value === null || value === undefined) value = '';

        return '<span class="mel-cell-text">' + value + '</span>';
    }

    MelUi.Table = MelUi.Table || {};
    MelUi.Table.cellRenderers = MelUi.Table.cellRenderers || {};
    MelUi.Table.cellRenderers.text = render;

})(window.MelUi = window.MelUi || {});

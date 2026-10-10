/**
 * MelUi Table 表格组件 - 导出Excel插件
 * 将表格数据导出为 Excel 文件（.xls）
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.0
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * Export 导出Excel插件
     * @param {Object} options 配置
     *   filename: 文件名，默认 '导出数据'
     *   extension: 扩展名 '.xls'（默认）/ '.xlsx'
     *   includeHiddenColumns: 是否包含隐藏列，默认false
     */
    function Export(options) {
        this.options = this._extend({
            filename: '导出数据',
            extension: '.xls',
            includeHiddenColumns: false
        }, options || {});
    }

    Export.prototype = new MelUi.Table.PluginBase();
    Export.prototype.constructor = Export;

    /**
     * 初始化
     */
    Export.prototype.init = function(table) {
        this.table = table;
    };

    /**
     * 执行导出
     */
    Export.prototype.export = function() {
        var columns = this.table.dataStore.columns;
        var rows = this.table.dataStore.rows;

        // 生成 HTML 表格
        var html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel">';
        html += '<head><meta charset="UTF-8"></head>';
        html += '<body>';
        html += '<table border="1">';

        // 表头
        html += '<tr>';
        for (var i = 0; i < columns.length; i++) {
            // 跳过内部字段列
            if (columns[i].field.charAt(0) === '_' && !this.options.includeHiddenColumns) continue;
            html += '<th>' + (columns[i].title || '') + '</th>';
        }
        html += '</tr>';

        // 数据行
        for (var r = 0; r < rows.length; r++) {
            html += '<tr>';
            for (var c = 0; c < columns.length; c++) {
                var col = columns[c];
                if (col.field.charAt(0) === '_' && !this.options.includeHiddenColumns) continue;

                var value = rows[r][col.field];
                if (value === undefined || value === null) value = '';

                // 如果有 formatter，格式化后再导出
                if (typeof col.formatter === 'function') {
                    value = col.formatter(value, rows[r]);
                }

                html += '<td>' + value + '</td>';
            }
            html += '</tr>';
        }

        html += '</table>';
        html += '</body></html>';

        // 创建下载链接
        var fileName = this.options.filename + this.options.extension;

        if (window.Blob && window.URL) {
            // 现代浏览器
            var blob = new Blob([html], {encoding: 'UTF-8', type: 'text/html'});
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            // IE9 兼容
            var iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            var doc = iframe.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();
            iframe.contentWindow.document.execCommand('SaveAs', true, fileName);
            document.body.removeChild(iframe);
        }
    };

    /**
     * 简单对象合并
     */
    Export.prototype._extend = function(target) {
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
    MelUi.Table.plugins.Export = Export;

})(window.MelUi = window.MelUi || {});

/**
 * MelUi Table 表格组件 - 导出插件
 * 支持导出 Excel（.xls / .xlsx）与 CSV
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.3.0
 * @Date：2026-10-10
 * @Pubdate：2026-11-11 12:16:46
 */

 (function(MelUi) {

    // ==================== CRC32（xlsx 的 ZIP 容器用） ====================

    var _crcTable = null;

    /**
     * 构建 CRC32 查表（首次调用生成，之后复用）
     */
    function getCrcTable() {
        if (_crcTable) return _crcTable;
        var table = [];
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[n] = c >>> 0;
        }
        _crcTable = table;
        return table;
    }

    /**
     * 计算字节数组的 CRC32
     * @param {Uint8Array} bytes 数据
     * @return {Number} CRC32 值
     */
    function crc32(bytes) {
        var table = getCrcTable();
        var crc = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) {
            crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // ==================== 字节工具 ====================

    /**
     * 字符串 → UTF-8 字节数组（不依赖 TextEncoder，IE10 可用）
     * @param {String} str 文本
     * @return {Uint8Array}
     */
    function utf8Bytes(str) {
        var text = String(str == null ? '' : str);
        var bytes = [];
        for (var i = 0; i < text.length; i++) {
            var c = text.charCodeAt(i);
            if (c < 0x80) {
                bytes.push(c);
            } else if (c < 0x800) {
                bytes.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
            } else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < text.length) {
                // 代理对（emoji 等）
                var c2 = text.charCodeAt(++i);
                var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
                bytes.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
            } else {
                bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
            }
        }
        return new Uint8Array(bytes);
    }

    /**
     * 小端 16 位字节
     */
    function u16(n) {
        return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]);
    }

    /**
     * 小端 32 位字节
     */
    function u32(n) {
        return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]);
    }

    /**
     * 拼接多段字节
     */
    function concatBytes(parts) {
        var total = 0;
        for (var i = 0; i < parts.length; i++) total += parts[i].length;
        var out = new Uint8Array(total);
        var offset = 0;
        for (var j = 0; j < parts.length; j++) {
            out.set(parts[j], offset);
            offset += parts[j].length;
        }
        return out;
    }

    // ==================== 插件 ====================

    /**
     * Export 导出插件
     * @param {Object} options 配置
     *   filename: 文件名（不含扩展名），默认 '导出数据'
     *   format: 导出格式，'xlsx'（默认，真 Excel 2007+）/ 'xls'（HTML 伪装 Excel，兼容 IE9）/ 'csv'（纯文本）
     *   csvDelimiter: 仅 format='csv' 生效，单元格分隔符，默认 '\t'（制表符，Excel 双击即按列展开）；
     *                 给后端使用(导入数据时)可改成 ','（Excel 里整行显示为一条，便于当纯文本行解析）
     *   includeInnerColumns: 是否导出内部列（field 以 _ 开头的序号 / 状态 / 选择列），默认 false
     *   includeHiddenColumns: 是否导出隐藏列（列配置 visible:false 的列），默认 false
     * 说明：
     *   includeInnerColumns 管"内部列"，includeHiddenColumns 管"业务隐藏列"，两者互不相关；
     *   扩展名由 format 决定；CSV 内部固定 UTF-16LE(FF FE) 编码，不对外暴露开关。
     */
    function Export(options) {
        this.options = this._extend({
            filename: '导出数据',
            format: 'xlsx',
            csvDelimiter: '\t',
            includeInnerColumns: false,
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
     * @param {String} formatOverride 可选。临时指定格式 'xls' / 'xlsx' / 'csv'，不传则用 options.format
     */
    Export.prototype.export = function(formatOverride) {
        var format = String(formatOverride || this.options.format || 'xlsx').toLowerCase();
        if (format !== 'csv' && format !== 'xlsx') format = 'xls';

        // xlsx 要二进制 Blob（ZIP），csv 要二进制 Blob（UTF-16 字节）；
        // IE9 完全没有 Blob、IE10 的 Blob 不吃二进制片段，两者都得降级成 xls（HTML，中文与分列都正常）
        if (format !== 'xls' && !this._canBinaryBlob()) {
            var tip = format === 'csv' ? '.csv' : '.xlsx';
            var ok = window.confirm('您当前是老掉牙的IE9，不能导出' + tip + '，系统将自动降级导出.xls，确认要导出吗？');
            if (!ok) return;
            format = 'xls';
        }

        var columns = this._getExportColumns();
        var rows = this.table.dataStore.rows || [];

        if (format === 'csv') {
            this._exportCsv(columns, rows);
        } else if (format === 'xlsx') {
            this._exportXlsx(columns, rows);
        } else {
            this._exportXls(columns, rows);
        }
    };

    /**
     * 当前环境是否有 Blob（IE9 没有，只能走 iframe + SaveAs 文本兜底）
     */
    Export.prototype._canBlob = function() {
        return !!(window.Blob && window.URL && window.URL.createObjectURL);
    };

    /**
     * 当前环境的 Blob 是否支持「二进制片段」（Uint8Array 作为 parts）
     * IE10 的 Blob 只支持字符串片段，塞 Uint8Array 进去会被吞掉/报错，
     * xlsx（ZIP 二进制）就是靠它，所以必须单独探一次；探不到就降级 xls。
     */
    Export.prototype._canBinaryBlob = function() {
        if (!this._canBlob()) return false;
        try {
            var probe = new Blob([new Uint8Array([0xE7, 0xBC, 0x96])]);
            return probe.size === 3;
        } catch (e) {
            return false;
        }
    };

    /**
     * 取需要导出的列
     * 按两个开关过滤：
     *   includeInnerColumns=false  → 跳过 field 以 _ 开头的内部列（序号 / 状态 / 勾选等）
     *   includeHiddenColumns=false → 跳过 visible:false 的隐藏列
     * @return {Array}
     */
    Export.prototype._getExportColumns = function() {
        var columns = this.table.dataStore.columns || [];
        var out = [];

        for (var i = 0; i < columns.length; i++) {
            var col = columns[i];
            if (!col) continue;

            if (!this.options.includeInnerColumns && col.field && col.field.charAt(0) === '_') continue;
            if (!this.options.includeHiddenColumns && col.visible === false) continue;

            out.push(col);
        }
        return out;
    };

    /**
     * 取单元格导出值：先取值，再走列 formatter，最后转字符串
     */
    Export.prototype._getCellValue = function(row, col) {
        var value = row[col.field];
        if (value === undefined || value === null) value = '';

        if (typeof col.formatter === 'function') {
            value = col.formatter(value, row);
        }
        if (value === undefined || value === null) value = '';
        return String(value);
    };

    // ==================== xls（HTML 伪装，IE9 也能用） ====================

    /**
     * 导出 Excel（.xls，HTML 伪装表格；Excel 打开可能提示"格式与扩展名不一致"）
     */
    Export.prototype._exportXls = function(columns, rows) {
        var html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel">';
        html += '<head><meta charset="UTF-8"></head>';
        html += '<body>';
        html += '<table border="1">';

        // 表头
        html += '<tr>';
        for (var i = 0; i < columns.length; i++) {
            html += '<th>' + this._escapeHtml(columns[i].title || '') + '</th>';
        }
        html += '</tr>';

        // 数据行
        for (var r = 0; r < rows.length; r++) {
            html += '<tr>';
            for (var c = 0; c < columns.length; c++) {
                html += '<td>' + this._escapeHtml(this._getCellValue(rows[r], columns[c])) + '</td>';
            }
            html += '</tr>';
        }

        html += '</table>';
        html += '</body></html>';

        if (this._canBlob()) {
            this._save(new Blob([html], {type: 'application/vnd.ms-excel;charset=UTF-8'}), this.options.filename + '.xls');
        } else {
            // IE9：没有 Blob，直接把 HTML 文本交给 iframe 兜底
            this._save(null, this.options.filename + '.xls', html);
        }
    };

    // ==================== xlsx（真 OOXML，纯 JS 手写 ZIP） ====================

    /**
     * 导出真 xlsx（Excel 2007+ 标准格式，打开无格式警告）
     * 结构：ZIP 容器 + 5 个 XML 部件，store（不压缩）方式写入
     */
    Export.prototype._exportXlsx = function(columns, rows) {
        var sheetXml = this._buildSheetXml(columns, rows);

        var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            + '<Default Extension="xml" ContentType="application/xml"/>'
            + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            + '</Types>';

        var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            + '</Relationships>';

        var workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
            + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            + '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>'
            + '</workbook>';

        var workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            + '</Relationships>';

        var zip = this._zip([
            {'name': '[Content_Types].xml', 'text': contentTypes},
            {'name': '_rels/.rels', 'text': rootRels},
            {'name': 'xl/workbook.xml', 'text': workbook},
            {'name': 'xl/_rels/workbook.xml.rels', 'text': workbookRels},
            {'name': 'xl/worksheets/sheet1.xml', 'text': sheetXml},
            {'name': 'xl/styles.xml', 'text': this._buildStylesXml()}
        ]);

        this._save(zip, this.options.filename + '.xlsx');
    };

    /**
     * 生成 sheet1.xml
     * 数字写数值单元格（Excel 里可直接求和），其余写内联字符串（免维护 sharedStrings）
     */
    Export.prototype._buildSheetXml = function(columns, rows) {
        var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

        // 冻结首行（sheetViews 必须排在 cols / sheetData 之前）
        xml += '<sheetViews><sheetView workbookViewId="0">'
            + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
            + '</sheetView></sheetViews>';

        // 列宽（单位：字符宽度，约等于 px/7）
        xml += '<cols>';
        for (var i = 0; i < columns.length; i++) {
            var px = columns[i].width || 100;
            xml += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (Math.round(px / 7) || 12) + '" customWidth="1"/>';
        }
        xml += '</cols>';

        xml += '<sheetData>';

        // 表头行（加粗样式 s="1"）
        xml += '<row r="1">';
        for (var h = 0; h < columns.length; h++) {
            xml += '<c r="' + this._colName(h) + '1" t="inlineStr" s="1"><is><t>' + this._escapeXml(columns[h].title || '') + '</t></is></c>';
        }
        xml += '</row>';

        // 数据行
        for (var r = 0; r < rows.length; r++) {
            var rowNum = r + 2;
            xml += '<row r="' + rowNum + '">';
            for (var c = 0; c < columns.length; c++) {
                var ref = this._colName(c) + rowNum;
                var val = this._getCellValue(rows[r], columns[c]);
                if (/^-?\d+(\.\d+)?$/.test(val)) {
                    xml += '<c r="' + ref + '"><v>' + val + '</v></c>';
                } else if (val !== '') {
                    xml += '<c r="' + ref + '" t="inlineStr"><is><t>' + this._escapeXml(val) + '</t></is></c>';
                }
            }
            xml += '</row>';
        }

        xml += '</sheetData>';
        xml += '</worksheet>';
        return xml;
    };

    /**
     * 生成 styles.xml
     * 注意：格式（字体/填充/边框）必须独立成 xl/styles.xml 部件，
     * 塞进 worksheet 里 Excel 会判定文件损坏（fills 也要求至少 2 项）。
     * @return {String}
     */
    Export.prototype._buildStylesXml = function() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            + '<fonts count="2">'
            + '<font><sz val="11"/><name val="宋体"/><charset val="134"/></font>'
            + '<font><b/><sz val="11"/><name val="宋体"/><charset val="134"/></font>'
            + '</fonts>'
            + '<fills count="2">'
            + '<fill><patternFill patternType="none"/></fill>'
            + '<fill><patternFill patternType="gray125"/></fill>'
            + '</fills>'
            + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            + '<cellXfs count="2">'
            + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            + '</cellXfs>'
            + '<cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles>'
            + '</styleSheet>';
    };

    /**
     * 列号 → Excel 列名（0 → A，25 → Z，26 → AA）
     */
    Export.prototype._colName = function(index) {
        var name = '';
        var n = index;
        while (n >= 0) {
            name = String.fromCharCode(65 + (n % 26)) + name;
            n = Math.floor(n / 26) - 1;
        }
        return name;
    };

    /**
     * 手写 ZIP（store 方式，不压缩；xlsx 规范允许 store）
     * @param {Array} files [{name: '路径', text: '内容'}]
     * @return {Blob}
     */
    Export.prototype._zip = function(files) {
        var parts = [];
        var centralParts = [];
        var offset = 0;

        // 固定时间戳（DOS 格式）：2026-11-11 11:22
        var dosTime = ((11 & 0x1F) << 11) | ((22 & 0x3F) << 5) | 0;
        var dosDate = (((2026 - 1980) & 0x7F) << 9) | ((11 & 0x0F) << 5) | 11;

        for (var i = 0; i < files.length; i++) {
            var nameBytes = utf8Bytes(files[i].name);
            var dataBytes = utf8Bytes(files[i].text);
            var crc = crc32(dataBytes);

            // 本地文件头
            var local = concatBytes([
                u32(0x04034b50),       // 签名
                u16(20),               // 解压所需版本
                u16(0),                // 标志位（文件名全 ASCII，无需 UTF-8 标志）
                u16(0),                // 压缩方式：0 = store
                u16(dosTime),
                u16(dosDate),
                u32(crc),
                u32(dataBytes.length), // 压缩后大小
                u32(dataBytes.length), // 原始大小
                u16(nameBytes.length),
                u16(0)                 // extra 长度
            ]);

            parts.push(local, nameBytes, dataBytes);

            // 中央目录项
            centralParts.push(concatBytes([
                u32(0x02014b50),       // 签名
                u16(20),               // 创建版本
                u16(20),               // 解压所需版本
                u16(0),                // 标志位
                u16(0),                // 压缩方式
                u16(dosTime),
                u16(dosDate),
                u32(crc),
                u32(dataBytes.length),
                u32(dataBytes.length),
                u16(nameBytes.length),
                u16(0),                // extra
                u16(0),                // 注释
                u16(0),                // 起始磁盘
                u16(0),                // 内部属性
                u32(0),                // 外部属性
                u32(offset),           // 本地头偏移
                nameBytes
            ]));

            offset += local.length + nameBytes.length + dataBytes.length;
        }

        var centralStart = offset;
        var centralSize = 0;
        for (var c = 0; c < centralParts.length; c++) {
            parts.push(centralParts[c]);
            centralSize += centralParts[c].length;
        }

        // 中央目录结束记录
        parts.push(concatBytes([
            u32(0x06054b50),
            u16(0), u16(0),
            u16(files.length), u16(files.length),
            u32(centralSize),
            u32(centralStart),
            u16(0)
        ]));

        var all = concatBytes(parts);
        return new Blob([all], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    };

    // ==================== csv ====================

    /**
     * 导出 CSV（原生纯文本）
     * 要点：
     *   1. 编码固定 UTF-16LE + BOM(FF FE)，Excel 一看就按 Unicode 解析，中文不会乱码；
     *   2. 分隔符默认 Tab（Excel 的 Unicode 文本解析器只认 Tab，按 Tab 一列列展开）；
     *      给后端消费时把 csvDelimiter 改成 ','，Excel 里整行显示为一条，便于按纯文本行解析；
     *   3. 单元格含 分隔符 / 双引号 / 换行 时，整体用双引号包裹，内部引号翻倍；
     *   4. 行分隔用 \r\n，兼容 Windows 记事本与 Excel。
     */
    Export.prototype._exportCsv = function(columns, rows) {
        var delimiter = this._getCsvDelimiter();
        var lines = [];
        var i;

        var headCells = [];
        for (i = 0; i < columns.length; i++) {
            headCells.push(this._csvCell(columns[i].title || '', delimiter));
        }
        lines.push(headCells.join(delimiter));

        for (var r = 0; r < rows.length; r++) {
            var cells = [];
            for (i = 0; i < columns.length; i++) {
                cells.push(this._csvCell(this._getCellValue(rows[r], columns[i]), delimiter));
            }
            lines.push(cells.join(delimiter));
        }

        var text = lines.join('\r\n');

        // 编码固定 UTF-16LE（首两字节 FF FE）：这是 Excel 无条件按 Unicode 解析的标记，
        // 不依赖 BOM 探测，也不会被"把文件当文本重编码"的下载链路吃掉；
        // 分隔符由 csvDelimiter 决定，默认 Tab —— Excel 的 Unicode 文本解析器只认 Tab，
        // 用逗号会让整行挤成一列（这就是之前"一堆文本"的原因）。
        this._save(
            new Blob([this._utf16Bytes(text)], {type: 'text/csv;charset=utf-16le'}),
            this.options.filename + '.csv'
        );
    };

    /**
     * 取 CSV 分隔符（只认单字符；非法值退回 Tab）
     * 注意：插件内部按 \t / tab / 单字符 三种写法识别
     * @return {String}
     */
    Export.prototype._getCsvDelimiter = function() {
        var d = this.options.csvDelimiter;
        if (d === '\\t' || d === 'tab') return '\t';
        if (typeof d === 'string' && d.length === 1) return d;
        return '\t';
    };

    /**
     * 文本 → UTF-16LE 字节（首两字节 FF FE，即 Unicode BOM）
     * Excel 见到 FF FE 会直接按 Unicode 解析，不用猜编码
     * @param {String} text 文本
     * @return {Uint8Array}
     */
    Export.prototype._utf16Bytes = function(text) {
        var str = String(text == null ? '' : text);
        var bytes = new Uint8Array(2 + str.length * 2);
        bytes[0] = 0xFF;
        bytes[1] = 0xFE;
        for (var i = 0; i < str.length; i++) {
            var code = str.charCodeAt(i);
            bytes[2 + i * 2] = code & 0xFF;
            bytes[3 + i * 2] = (code >> 8) & 0xFF;
        }
        return bytes;
    };

    /**
     * CSV 单元格转义
     */
    Export.prototype._csvCell = function(text, delimiter) {
        var str = String(text === undefined || text === null ? '' : text);
        var sep = delimiter || this._getCsvDelimiter();
        var quoted = str.indexOf('"') >= 0 || str.indexOf('\r') >= 0 || str.indexOf('\n') >= 0 ||
            (sep === '\t' ? str.indexOf('\t') >= 0 : str.indexOf(sep) >= 0);
        if (quoted) {
            str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    // ==================== 通用 ====================

    /**
     * HTML 转义（.xls 分支用，防止值里的 < & 把表格结构撑坏）
     */
    Export.prototype._escapeHtml = function(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    /**
     * XML 文本转义（xlsx 分支用）
     */
    Export.prototype._escapeXml = function(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/\r?\n/g, '&#10;');
    };

    /**
     * 触发下载
     * @param {Blob} blob 文件内容
     * @param {String} fileName 文件名（含扩展名）
     * @param {String} textFallback IE9 兜底用的文本内容（可选）
     */
    Export.prototype._save = function(blob, fileName, textFallback) {
        if (this._canBlob()) {
            // IE10 / IE11：浏览器不支持 a[download]，点 blob 链接会抛「拒绝访问」，
            // 必须走自家的 msSaveOrOpenBlob（IE10 起提供）
            if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                try {
                    window.navigator.msSaveOrOpenBlob(blob, fileName);
                    return;
                } catch (e) {}
            }

            var link = document.createElement('a');
            if (typeof link.download === 'undefined') {
                // 没有 download 属性（老 IE 且 msSave 也失败）：退回文本兜底，别去点它会报拒绝访问
                this._saveByIframe(fileName, textFallback);
                return;
            }

            link.href = window.URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (window.URL.revokeObjectURL) {
                var href = link.href;
                setTimeout(function() {
                    try {
                        window.URL.revokeObjectURL(href);
                    } catch (e) {}
                }, 100);
            }
            return;
        }

        this._saveByIframe(fileName, textFallback);
    };

    /**
     * IE9 兜底：把文本写进隐藏 iframe，再调 execCommand('SaveAs')
     * @param {String} fileName 文件名
     * @param {String} text 文本内容
     */
    Export.prototype._saveByIframe = function(fileName, text) {
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        var doc = iframe.contentWindow.document;
        doc.open();
        doc.write('<meta charset="UTF-8">' + (text || ''));
        doc.close();
        iframe.contentWindow.document.execCommand('SaveAs', true, fileName);
        document.body.removeChild(iframe);
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

/**
 * @File    third.js
 * @Desc    MelUI 第三方适配层：导出 Excel / 网页导出图片
 * @Version 0.1.2
 * @Date    2026-11-18
 * @PubDate 2026-11-20 12:14:00
 * @Author  ChenMufeng
 *
 * ── 第三方依赖（本包不内置，也不动态加载 CDN，需业务页面自行引入）──
 *   SheetJS（export2Excel）
 *     官网：   https://sheetjs.com/
 *     文档：   https://docs.sheetjs.com/
 *     GitHub： https://github.com/SheetJS/sheetjs
 *     文件：   xlsx.full.min.js，全局变量 XLSX
 *   html2canvas（exportWeb2Image）
 *     官网：   http://html2canvas.hertzen.com/
 *     GitHub： https://github.com/niklasvh/html2canvas
 *     文件：   html2canvas.min.js，全局变量 html2canvas
 * ──────────────────────────────────────────────────────
 *
 * 【依赖边界】
 *   1. 本包不内置任何第三方库，也不在 js 里动态插 script 加载 CDN；
 *      业务需要自行在页面引入 SheetJS（导出 Excel）或 html2canvas（导出图片）。
 *   2. export2Excel 直接调用 SheetJS 的 table_to_sheet / writeFile，
 *      行列与合并单元格交给 SheetJS 解析，不依赖表格插件。
 *   3. 提示优先调用 melui.alert（dialog 组件提供），没有则退回原生 alert。
 * 【对外形态】melui.third.export2Excel / melui.third.exportWeb2Image
 * ──────────────────────────────────────────────────────
 */

import { mergeObj } from '../util/base/object.js';

/** 内部：提示，优先 dialog 组件的 melui.alert */
function internalTip(message) {
  if (window.melui && typeof window.melui.alert === 'function') {
    try {
      window.melui.alert({
        message: String(message),
        buttons: [{ text: '知道了，马上修改', type: 'warning' }]
      });
      return;
    } catch (e) {
      /* 组件异常时退回原生提示 */
    }
  }
  window.alert(String(message).replace(/<[^>]+>/g, ''));
}

/** 内部：是否移动端 */
function internalIsMobile() {
  return /android|iphone|ipad|ipod|windows phone|mobile/i.test(navigator.userAgent);
}

/** 内部：IE 版本，非 IE 返回 0 */
function internalIEVersion() {
  var ua = navigator.userAgent;
  var match = ua.match(/MSIE\s(\d+)/);
  var trident = ua.match(/Trident\/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  if (trident) {
    return parseInt(trident[1], 10) + 4;
  }
  return 0;
}

/** 内部：解析选择器 / DOM 元素 */
function internalResolveElement(o) {
  if (!o) {
    return null;
  }
  if (typeof o !== 'string') {
    return o.nodeType === 1 ? o : null;
  }
  if (o === 'body') {
    return document.body;
  }
  if (o.charAt(0) === '#') {
    return document.getElementById(o.substr(1));
  }
  if (o.charAt(0) === '.') {
    return document.getElementsByClassName ? document.getElementsByClassName(o.substr(1))[0] || null : null;
  }
  return document.querySelector ? document.querySelector(o) : null;
}

/** 内部：补零 */
function internalPad(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** 内部：时间戳字符串 yyyyMMddHHmmss */
function internalTimeStr() {
  var d = new Date();
  return '' + d.getFullYear() + internalPad(d.getMonth() + 1) + internalPad(d.getDate()) +
    internalPad(d.getHours()) + internalPad(d.getMinutes()) + internalPad(d.getSeconds());
}

/** 内部：规范化扩展名与 SheetJS 的 bookType */
function internalBookType(ext) {
  var e = (ext || '.xls').toLowerCase();
  if (e.charAt(0) !== '.') {
    e = '.' + e;
  }
  if (e === '.xlsx') {
    return { ext: '.xlsx', type: 'xlsx' };
  }
  if (e === '.csv') {
    return { ext: '.csv', type: 'csv' };
  }
  return { ext: '.xls', type: 'biff8' };
}

/**
 * 导出表格为 Excel
 * 依赖：SheetJS（全局 XLSX），本包不内置、不动态加载 CDN
 *   官网：   https://sheetjs.com/
 *   文档：   https://docs.sheetjs.com/
 *   GitHub： https://github.com/SheetJS/sheetjs
 *   引入：   页面自行加载 xlsx.full.min.js
 * 说明：本函数使用 SheetJS，行列与合并单元格由 SheetJS 解析。
 * @param {Object} opt 可选
 * @param {Boolean} opt.enable 是否启用，默认 true
 * @param {String} opt.filename 文件名前缀，默认“导出报表-”
 * @param {Boolean} opt.fileAutoTime 文件名自动加时间，默认 true
 * @param {String} opt.extension 扩展名，.xls（默认）/ .xlsx / .csv
 * @param {String|HTMLElement} opt.table 表格节点，默认 .mel-table
 * @param {String} opt.exclude 不导出的节点选择器，默认 .noExl
 * @return {Boolean} 是否发起导出
 */
export function export2Excel(opt) {
  var settings = mergeObj({
    enable: true,
    filename: '导出报表-',
    fileAutoTime: true,
    extension: '.xls',
    table: '.mel-table',
    exclude: '.noExl'
  }, opt);
  var tableNode = internalResolveElement(settings.table);
  var clone;
  var excludes;
  var i;
  var book;
  var filename;
  var sheet;
  var workbook;

  if (!settings.enable) {
    internalTip('您已禁用导出 EXCEL 功能，请先启用');
    return false;
  }
  if (internalIEVersion() > 0 && internalIEVersion() < 11) {
    internalTip('导出 EXCEL 功能暂不支持 IE11 以下版本\n请使用 360（极速模式）、Firefox、Chrome 等浏览器');
    return false;
  }
  if (!tableNode) {
    internalTip('表格根节点 ' + settings.table + ' 不存在，请检查');
    return false;
  }
  if (typeof window.XLSX === 'undefined') {
    internalTip('请先引入 SheetJS（xlsx.full.min.js）再使用导出功能');
    return false;
  }

  clone = tableNode.cloneNode(true);
  excludes = clone.querySelectorAll(settings.exclude);
  for (i = excludes.length - 1; i >= 0; i--) {
    if (excludes[i].parentNode) {
      excludes[i].parentNode.removeChild(excludes[i]);
    }
  }

  book = internalBookType(settings.extension);
  filename = settings.filename === '' || typeof settings.filename === 'undefined'
    ? '导出报表-'
    : settings.filename;
  if (settings.fileAutoTime !== false) {
    filename += internalTimeStr();
  }
  filename += book.ext;

  sheet = window.XLSX.utils.table_to_sheet(clone, { raw: true });
  workbook = {
    SheetNames: ['Sheet1'],
    Sheets: { Sheet1: sheet }
  };
  window.XLSX.writeFile(workbook, filename, { bookType: book.type });
  return true;
}

/**
 * 网页导出图片
 * 依赖：html2canvas（全局 html2canvas），本包不内置、不动态加载 CDN
 *   官网：   http://html2canvas.hertzen.com/
 *   GitHub： https://github.com/niklasvh/html2canvas
 *   引入：   页面自行加载 html2canvas.min.js
 * @param {Object} opt 可选
 * @param {String|HTMLElement} opt.element 要导出的节点，默认 body
 * @param {String} opt.filename 文件名，默认“下载图片.png”
 * @param {String} opt.caption 移动端提示文字，默认“长按图片保存到手机”
 * @param {Function} opt.closeCallBack 移动端预览关闭回调
 * @return {Promise|null}
 */
export function exportWeb2Image(opt) {
  var settings = mergeObj({
    element: 'body',
    filename: '下载图片.png',
    caption: '长按图片“保存到手机”',
    closeCallBack: null
  }, opt);
  var node = internalResolveElement(settings.element);
  var filename = settings.filename || '下载图片.png';
  var caption = settings.caption || '长按图片“保存到手机”';

  if (!node) {
    internalTip('节点不存在，请检查：' + settings.element);
    return null;
  }
  if (typeof window.html2canvas === 'undefined') {
    internalTip('请先引入 html2canvas（html2canvas.min.js）再使用导出图片功能');
    return null;
  }
  if (!/\.(png|jpg|jpeg)$/i.test(filename)) {
    filename += '.png';
  }

  return window.html2canvas(node).then(function (canvas) {
    var imgUri = canvas.toDataURL('image/png');
    var pic;
    var overlay;
    var img;
    var text;
    var closeBtn;

    if (!internalIsMobile()) {
      pic = document.createElement('a');
      pic.href = imgUri;
      pic.download = filename;
      document.body.appendChild(pic);
      pic.click();
      document.body.removeChild(pic);
      return;
    }

    overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.zIndex = '9999';
    overlay.style.background = 'rgba(0,0,0,.85)';
    overlay.style.textAlign = 'center';
    overlay.style.overflow = 'auto';

    img = document.createElement('img');
    img.src = imgUri;
    img.style.maxWidth = '92%';
    img.style.margin = '40px auto 12px';
    img.style.display = 'block';

    text = document.createElement('div');
    text.style.color = '#fff';
    text.style.fontSize = '14px';
    text.style.margin = '0 0 20px';
    text.innerHTML = caption;

    closeBtn = document.createElement('div');
    closeBtn.style.display = 'inline-block';
    closeBtn.style.padding = '8px 24px';
    closeBtn.style.border = '1px solid rgba(255,255,255,.6)';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.color = '#fff';
    closeBtn.style.fontSize = '14px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.innerHTML = '关闭';

    closeBtn.onclick = function () {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (typeof settings.closeCallBack === 'function') {
        settings.closeCallBack();
      }
    };
    overlay.appendChild(img);
    overlay.appendChild(text);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
  });
}

/** 内部：与 util 入口一致，把本包函数并入 melui.third */
var thirdAll = {
  export2Excel: export2Excel,
  exportWeb2Image: exportWeb2Image
};
var key;
var ThirdNS;
if (typeof window !== 'undefined') {
  ThirdNS = window.melui || (window.melui = {});
  if (!window.MelUi) {
    window.MelUi = ThirdNS;
  }
  ThirdNS.third = ThirdNS.third || {};
  for (key in thirdAll) {
    if (Object.prototype.hasOwnProperty.call(thirdAll, key)) {
      ThirdNS.third[key] = thirdAll[key];
    }
  }
}

export default thirdAll;

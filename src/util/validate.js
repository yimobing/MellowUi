/**
 * @File    validate.js
 * @Desc    MelUI Util 工具层：格式校验 / 设备与浏览器判断 / 危险字符检测
 * @Version 0.1.2
 * @Date    2026-11-17
 * @PubDate 2026-11-20 15:15:00
 * @Author  ChenMufeng
 *
 * 【提示约定】危险字符命中时优先调用 melui.alert（dialog 组件的别名），
 *            组件不存在时退回原生 alert。
 * 【实现约定】checkIsMobile 统一转小写后匹配；checkIsImage 包含 jpg。
 * 【对外形态】melui.util.validate.xxx
 * ──────────────────────────────────────────────────────
 */

import { mergeObj } from './base/object.js';

/**
 * 内部：简易 trim
 * @param {String} str
 * @return {String}
 */
function internalTrim(str) {
  return str == null ? '' : str.toString().replace(/^\s+|\s+$/g, '');
}

/**
 * 内部：危险字符提示
 * 优先走 dialog 组件的 melui.alert，没有该组件时退回原生 alert
 * @param {String} htmlTip 带 <br> 的提示内容
 */
function internalAlertTip(htmlTip) {
  var meluiNs = typeof window !== 'undefined' ? window.melui : null;
  var plainTip = htmlTip.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  if (meluiNs && typeof meluiNs.alert === 'function') {
    try {
      meluiNs.alert({
        message: htmlTip,
        buttons: [
          { text: '知道了，马上修改', type: 'warning' }
        ]
      });
      return;
    } catch (e) {
      // 组件内部异常时退回原生提示，避免校验流程中断
    }
  }
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(plainTip);
  }
}

/**
 * 校验字符串是否包含 SQL / 数据库危险字符
 * @param {String} psStr 原字符串
 * @param {Object} psOpts 可选
 * @param {Boolean} psOpts.popup 命中时是否提示，默认 true
 * @param {String} psOpts.additionalTip 追加提示文案
 * @returns {Boolean} true 表示含危险字符；false 表示不含或入参为 null/undefined/空串
 * @example
 * checkHasDangerousChars("a'b", { popup: false }) // true
 * checkHasDangerousChars('正常文本', { popup: false }) // false
 * checkHasDangerousChars('', { popup: false }) // false
 * // popup 默认 true，命中时会调用 melui.alert 或原生 alert
 */
export function checkHasDangerousChars(psStr, psOpts) {
  if (psStr === null || psStr === undefined || psStr === '') {
    return false;
  }
  var finals = mergeObj({
    popup: true,
    additionalTip: ''
  }, psOpts);
  var str = psStr.toString();
  var charMap = {
    ';': '分号',
    '\'': '单引号',
    '"': '双引号',
    '--': '两个短横线',
    '(': '左括号',
    ')': '右括号',
    '\\': '反斜杠',
    '`': '反引号',
    '?': '问号',
    '&': '和号',
    '/*': '左多行注释符',
    '*/': '右多行注释符',
    ' AND ': '关键字 AND',
    ' OR ': '关键字 OR'
  };
  var regParts = [];
  var key;
  var dangerousReg;
  var matchArr;
  var uniqueArr = [];
  var showArr = [];
  var i;
  var tip;

  for (key in charMap) {
    if (Object.prototype.hasOwnProperty.call(charMap, key)) {
      regParts.push(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  }
  dangerousReg = new RegExp(regParts.join('|'), 'gi');
  matchArr = str.match(dangerousReg);
  if (!matchArr || matchArr.length === 0) {
    return false;
  }
  for (i = 0; i < matchArr.length; i++) {
    if (uniqueArr.indexOf(matchArr[i]) === -1) {
      uniqueArr.push(matchArr[i]);
    }
  }
  for (i = 0; i < uniqueArr.length; i++) {
    showArr.push(charMap[uniqueArr[i]] || uniqueArr[i]);
  }
  if (finals.popup) {
    tip = '内容包含非法危险字符：' + uniqueArr.join(' ') +
      '<br>（对应中文：' + showArr.join('、') + '）<br>请删除这些字符或修改成其它字符';
    if (internalTrim(finals.additionalTip) !== '') {
      tip += '<br>（' + finals.additionalTip + '）';
    }
    internalAlertTip(tip);
  }
  return true;
}

/**
 * 判断是否 DOM 元素
 * @param {*} psObj 目标对象
 * @returns {Boolean} true 表示元素节点（nodeType 为 1）；文本节点、普通对象、null 返回 false
 * @example
 * checkIsDomObject(document.body) // true
 * checkIsDomObject(document.createTextNode('x')) // false
 * checkIsDomObject({}) // false
 */
export function checkIsDomObject(psObj) {
  if (typeof HTMLElement === 'object') {
    return psObj instanceof HTMLElement;
  }
  return !!(psObj && typeof psObj === 'object' && psObj.nodeType === 1 && typeof psObj.nodeName === 'string');
}

/**
 * 判断数据源是否带有效 data 数组
 * @param {Object} psSource 数据源
 * @returns {Boolean} true 表示对象至少有一个自有属性，且 data 不为 null/undefined 并有 length > 0
 * @example
 * checkJsonHasData({ data: [1, 2] }) // true
 * checkJsonHasData({ data: 'abc' })  // true（字符串也有 length）
 * checkJsonHasData({ data: [] })     // false
 * checkJsonHasData({ foo: 1 })       // false
 * checkJsonHasData(null)             // false
 */
export function checkJsonHasData(psSource) {
  var hasKey = false;
  var key;
  if (!psSource || typeof psSource !== 'object') {
    return false;
  }
  for (key in psSource) {
    if (Object.prototype.hasOwnProperty.call(psSource, key)) {
      hasKey = true;
      break;
    }
  }
  if (!hasKey) {
    return false;
  }
  return typeof psSource.data !== 'undefined' && psSource.data !== null && psSource.data.length > 0;
}

/**
 * 判断是否普通 JSON 对象（排除数组）
 * @param {*} psObj 目标对象
 * @returns {Boolean} true 表示 Object 原型对象且 length 为假值（undefined 或 0）；数组、null、DOM、日期、正则返回 false
 * @example
 * checkIsJsonObject({ a: 1 }) // true
 * checkIsJsonObject([])       // false
 * checkIsJsonObject({ length: 0 }) // true（普通对象带 length 0 也会被当成 JSON 对象）
 * checkIsJsonObject(null)     // false
 */
export function checkIsJsonObject(psObj) {
  return typeof psObj === 'object' &&
    psObj !== null &&
    Object.prototype.toString.call(psObj).toLowerCase() === '[object object]' &&
    !psObj.length;
}

/**
 * 判断是否 JSON 字符串
 * @param {String} str 字符串
 * @returns {Boolean} true 表示 JSON.parse 成功且结果是对象或数组；'null'、数字、布尔、非法 JSON 返回 false
 * @example
 * checkIsJsonString('{"a":1}') // true
 * checkIsJsonString('[1,2]')   // true
 * checkIsJsonString('null')    // false（解析结果是 null）
 * checkIsJsonString('abc')     // false
 * checkIsJsonString('')        // false
 */
export function checkIsJsonString(str) {
  var obj;
  if (typeof str !== 'string') {
    return false;
  }
  try {
    obj = JSON.parse(str);
    return typeof obj === 'object' && !!obj;
  } catch (e) {
    return false;
  }
}

/**
 * 校验电话
 * @param {String} str 电话字符串
 * @param {Object} options 可选
 * @param {String} options.mode standard 标准（默认）/ loose 只校验位数
 * @param {String} options.pattern mobilephone（默认）/ telephone / both
 * @param {Object} options.bit 宽松模式位数范围 {from, to}，默认 6~12
 * @returns {Boolean} true 表示通过；standard 下未知 pattern 返回 false；loose 下只比较去空格后的长度
 * @example
 * checkTel('13800138000') // true
 * checkTel('13800138000', { mode: 'loose' }) // true
 * checkTel('12345', { mode: 'loose', bit: { from: 5, to: 8 } }) // true
 * checkTel('abc') // false
 */
export function checkTel(str, options) {
  var settings = mergeObj({
    mode: 'standard',
    pattern: 'mobilephone',
    bit: { from: 6, to: 12 }
  }, options);
  var mode = settings.mode;
  var pattern = settings.pattern;
  var from = parseInt(settings.bit.from, 10);
  var to = parseInt(settings.bit.to, 10);
  var regMobile = /^(0|86)?1\d{10}$/;
  var regTelephone = /^((0|\+)?86(\s{1})?)?(0?\d{2,3}(\-|\s{1})?)?\d{7,8}$/;
  var value = internalTrim(str);
  if (mode === 'standard') {
    if (pattern === 'mobilephone') {
      return regMobile.test(value);
    }
    if (pattern === 'telephone') {
      return regTelephone.test(value);
    }
    if (pattern === 'both') {
      return regMobile.test(value) || regTelephone.test(value);
    }
    return false;
  }
  return value.length <= to && value.length >= from;
}

/**
 * 校验邮箱
 * @param {String} email
 * @returns {Boolean} true 表示符合内置邮箱正则；null、空串、格式不完整返回 false
 * @example
 * checkEmail('a@b.com')   // true
 * checkEmail('a@b')       // false
 * checkEmail('a b@c.com') // false
 */
export function checkEmail(email) {
  var emailReg = /^([a-zA-Z0-9]+[_|_.]?)*[a-zA-Z0-9]+@([a-zA-Z0-9]+[_|_.]?)*[a-zA-Z0-9]+\.[a-zA-Z]{2,4}$/;
  return emailReg.test(email);
}

/**
 * 是否移动端设备
 * @returns {Boolean} true 表示 UA 命中 mobile / android / iphone / ipad 等移动端标记
 * @example
 * // iPhone Safari UA
 * checkIsMobile() // true
 * // Windows Chrome UA
 * checkIsMobile() // false
 */
export function checkIsMobile() {
  var ua = navigator.userAgent.toLowerCase();
  var agents = ['mobile', 'android', 'iphone', 'sysbian', 'windows phone', 'ipad', 'ipod', 'blackberry'];
  var i;
  for (i = 0; i < agents.length; i++) {
    if (ua.indexOf(agents[i]) >= 0) {
      return true;
    }
  }
  return false;
}

/**
 * 是否苹果设备（iPhone / iPad / iPod / Mac）
 * @returns {Boolean} true 表示 UA 命中 iphone / ipod / ipad / mac
 * @example
 * // Mac Safari UA
 * checkIsApple() // true
 * // Windows Chrome UA
 * checkIsApple() // false
 */
export function checkIsApple() {
  return /iphone|ipod|mac|ipad/i.test(navigator.userAgent.toLowerCase());
}

/**
 * 是否图片地址
 * @param {String} str 地址
 * @returns {Boolean} true 表示以 .png/.gif/.jpg/.jpeg/.webp 结尾（不区分大小写）；带查询参数或 hash 返回 false
 * @example
 * checkIsImage('a.JPG')        // true
 * checkIsImage('a.webp')       // true
 * checkIsImage('a.png?x=1')    // false（正则只匹配结尾）
 * checkIsImage('a.svg')        // false
 */
export function checkIsImage(str) {
  return /\.(png|gif|jpg|jpeg|webp)$/i.test(str);
}

/**
 * 是否纯数字（不含小数点、负号）
 * @param {String} psStr
 * @returns {Boolean} true 表示只由 0-9 组成；空串、空格、小数、负号、字母返回 false
 * @example
 * checkIsNumeric('123')  // true
 * checkIsNumeric(123)    // true
 * checkIsNumeric('1.2')  // false
 * checkIsNumeric('')     // false
 */
export function checkIsNumeric(psStr) {
  var value = typeof psStr === 'undefined' ? '' : psStr;
  return /^[0-9]+$/.test(value.toString());
}

/**
 * 是否数值（正整数或正小数）
 * @param {String} psStr
 * @returns {Boolean} true 表示正整数或不带负号的十进制小数；负号、开头小数点、结尾小数点返回 false
 * @example
 * checkIsNumerType('123')  // true
 * checkIsNumerType('1.25') // true
 * checkIsNumerType('-1')   // false
 * checkIsNumerType('.5')   // false
 * checkIsNumerType('1.')   // false
 */
export function checkIsNumerType(psStr) {
  var value = typeof psStr === 'undefined' ? '' : psStr;
  return /^[0-9]+(\.[0-9]+)?$/.test(value.toString());
}

/**
 * 是否小数（必须带小数部分，可为负）
 * @param {String} psStr
 * @returns {Boolean} true 表示带小数点的十进制数，且小数点前后都有数字；整数、'.5'、'1.' 返回 false
 * @example
 * checkIsDecimal('1.25')  // true
 * checkIsDecimal('-1.25') // true
 * checkIsDecimal('1')     // false
 * checkIsDecimal('1.')    // false
 * checkIsDecimal('.5')    // false
 */
export function checkIsDecimal(psStr) {
  var value = typeof psStr === 'undefined' ? '' : psStr;
  return /^\-?[0-9]+\.[0-9]+$/.test(value.toString());
}

/**
 * 是否整数（正整数或负整数）
 * @param {String} psStr
 * @returns {Boolean} true 表示可选一个负号的纯数字；'+1'、'1.0'、'1.' 返回 false
 * @example
 * checkIsInteger('123')  // true
 * checkIsInteger('-123') // true
 * checkIsInteger('+123') // false
 * checkIsInteger('1.0')  // false
 */
export function checkIsInteger(psStr) {
  var value = typeof psStr === 'undefined' ? '' : psStr;
  return /^\-?[0-9]+$/.test(value.toString());
}

/**
 * 浏览器类型
 * @returns {String|undefined} ie6~ie11 / firefox / opera / safari / chrome / edge；无法识别返回 undefined
 * @example
 * // Chrome UA
 * checkBrowserType() // 'chrome'
 * // Firefox UA
 * checkBrowserType() // 'firefox'
 * // 某些未覆盖的 UA
 * checkBrowserType() // undefined
 */
export function checkBrowserType() {
  var userAgent = navigator.userAgent;
  var isOpera = userAgent.indexOf('Opera') > -1;
  var isIE = !!(window.ActiveXObject || 'ActiveXObject' in window);
  var isEdge = userAgent.indexOf('Edge') > -1;
  var isFF = userAgent.indexOf('Firefox') > -1;
  var isSafari = userAgent.indexOf('Safari') > -1 && userAgent.indexOf('Chrome') === -1;
  var isChrome = userAgent.indexOf('Chrome') > -1 && userAgent.indexOf('Safari') > -1 && !isEdge;
  var reIE;
  var version;
  if (isIE) {
    if (userAgent.indexOf('MSIE 6.0') !== -1) {
      return 'ie6';
    }
    reIE = new RegExp('MSIE (\\d+\\.\\d+);');
    reIE.test(userAgent);
    version = parseFloat(RegExp.$1);
    if (version === 7) {
      return 'ie7';
    }
    if (version === 8) {
      return 'ie8';
    }
    if (version === 9) {
      return 'ie9';
    }
    if (version === 10) {
      return 'ie10';
    }
    if (userAgent.toLowerCase().match(/rv:([\d.]+)\) like gecko/)) {
      return 'ie11';
    }
    return '0';
  }
  if (isFF) {
    return 'firefox';
  }
  if (isOpera) {
    return 'opera';
  }
  if (isSafari) {
    return 'safari';
  }
  if (isChrome) {
    return 'chrome';
  }
  if (isEdge) {
    return 'edge';
  }
}

/**
 * 是否 IE 浏览器（含 Edge 的 ActiveXObject 判定口径）
 * @returns {Boolean} true 表示 window 上存在 ActiveXObject
 * @example
 * checkIsIE() // 现代 Chrome 返回 false，IE 返回 true
 */
export function checkIsIE() {
  return !!(window.ActiveXObject || 'ActiveXObject' in window);
}

/**
 * IE 版本号
 * @returns {Number|String} IE 返回 6~11 的整数；无法识别返回 0；非 IE 返回提示文字
 * @example
 * // IE10
 * checkIEVersion() // 10
 * // Chrome
 * checkIEVersion() // '抱歉，不是IE浏览器，无法检测IE版本'
 */
export function checkIEVersion() {
  var userAgent = navigator.userAgent;
  var isIE = !!(window.ActiveXObject || 'ActiveXObject' in window);
  var reIE;
  var version;
  if (!isIE) {
    return '抱歉，不是IE浏览器，无法检测IE版本';
  }
  if (userAgent.indexOf('MSIE 6.0') !== -1) {
    return 6;
  }
  reIE = new RegExp('MSIE (\\d+\\.\\d+);');
  reIE.test(userAgent);
  version = parseFloat(RegExp.$1);
  if (version === 7) {
    return 7;
  }
  if (version === 8) {
    return 8;
  }
  if (version === 9) {
    return 9;
  }
  if (version === 10) {
    return 10;
  }
  if (userAgent.toLowerCase().match(/rv:([\d.]+)\) like gecko/)) {
    return 11;
  }
  return 0;
}

/**
 * 网络是否在线
 * @returns {Boolean} true 表示 navigator.onLine 不是明确的 false；onLine 为 undefined 时也返回 true
 * @example
 * checkNetWorkOnline() // 在线 true，离线 false
 */
export function checkNetWorkOnline() {
  return navigator.onLine !== false;
}

/**
 * 是否“时:分”格式（00:00 ~ 23:59）
 * @param {String} psStr
 * @returns {Boolean} true 表示严格两位小时、两位分钟的 24 小时制时间；'9:05'、'24:00' 返回 false
 * @example
 * checkIsHourMinute('09:05') // true
 * checkIsHourMinute('23:59') // true
 * checkIsHourMinute('9:05')  // false
 * checkIsHourMinute('24:00') // false
 */
export function checkIsHourMinute(psStr) {
  if (internalTrim(psStr) === '') {
    return false;
  }
  return /^([0-1]{1}[0-9]{1}|2[0-3]{1}):[0-5]{1}[0-9]{1}$/.test(psStr);
}

/**
 * 是否“时:分:秒”格式（00:00:00 ~ 23:59:59）
 * @param {String} psStr
 * @returns {Boolean} true 表示严格两位时/分/秒的 24 小时制时间；缺位、越界返回 false
 * @example
 * checkIsHourMinuteSecond('09:05:30') // true
 * checkIsHourMinuteSecond('23:59:59') // true
 * checkIsHourMinuteSecond('9:05:30')  // false
 * checkIsHourMinuteSecond('24:00:00') // false
 */
export function checkIsHourMinuteSecond(psStr) {
  if (internalTrim(psStr) === '') {
    return false;
  }
  return /^([0-1]{1}[0-9]{1}|2[0-3]{1}):[0-5]{1}[0-9]{1}:[0-5]{1}[0-9]{1}$/.test(psStr);
}

/**
 * 当前网络类型（读 UA 中的 NetType 标记，常见于移动端 WebView）
 * @returns {String} wifi / 4g / 3g / 2g / other；没有 NetType 标记或无法识别时返回 other
 * @example
 * // UA 含 NetType/wifi
 * getNetworkType() // 'wifi'
 * // UA 含 NetType/3gnet
 * getNetworkType() // '3g'
 * // 普通浏览器 UA
 * getNetworkType() // 'other'
 */
export function getNetworkType() {
  var ua = navigator.userAgent;
  var netStr = ua.match(/NetType\/\w+/) ? ua.match(/NetType\/\w+/)[0] : 'NetType/other';
  netStr = netStr.toLowerCase().replace('nettype/', '');
  if (netStr === 'wifi') {
    return 'wifi';
  }
  if (netStr === '4g') {
    return '4g';
  }
  if (netStr === '3g' || netStr === '3gnet') {
    return '3g';
  }
  if (netStr === '2g') {
    return '2g';
  }
  return 'other';
}

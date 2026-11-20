/**
 * @File    string.js
 * @Desc    MelUI Util 工具层：URL 参数 / HTML 编解码 / 字符串转义 / 输入过滤与限制
 * @Version 0.1.2
 * @Date    2026-11-17
 * @PubDate 2026-11-20 15:10:00
 * @Author  ChenMufeng
 *
 * 【实现约定】
 *   htmlEncode 先转义 & < >，再补引号，避免 &apos; / &quot; 被二次转义；
 *   htmlEncode / htmlDecode 需要 document 做实体转换，属于工具层函数；
 *   restrict 依赖的 repeatedChar 收在本文件，不跨模块调用 filter。
 * 【对外形态】melui.util.string.xxx
 * ──────────────────────────────────────────────────────
 */

/**
 * 内部：简易 trim（不依赖 String.prototype.trim 的扩展）
 * @param {String} str
 * @return {String}
 */
function internalTrim(str) {
  return str == null ? '' : str.toString().replace(/^\s+|\s+$/g, '');
}

/**
 * 内部：是否移动端（供 htmlEncode 决定空格处理方式）
 * 与 validate 的 checkIsMobile 判定口径保持一致，避免 string 反向依赖 validate
 * @return {Boolean}
 */
function internalIsMobile() {
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
 * 获取 URL 参数
 * @param {String} psKey 参数名；不传则返回全部参数组成的对象
 * @param {String} psUrl 目标 URL；不传则取当前页面地址
 * @returns {String|Object|null} 传了 key 时返回 decodeURI 后的参数值，参数不存在返回 null；
 *          不传 key 时返回全部参数对象，值为原始（未解码）字符串；没有参数时返回 {}
 * @example
 * // 地址：https://a.com/?name=%E5%BC%A0%E4%B8%89&age=18
 * getUrlParams('name')  // '张三'
 * getUrlParams('none')  // null
 * getUrlParams()        // { name: '%E5%BC%A0%E4%B8%89', age: '18' }（值为原始字符串，未解码）
 * getUrlParams('age', 'https://a.com/?age=18') // '18'
 */
export function getUrlParams(psKey, psUrl) {
  var url = (typeof psUrl === 'undefined' || internalTrim(psUrl) === '')
    ? location.search
    : psUrl.replace(/(.*?)\?(.*?)$/, '?$2');
  var pairs = url.replace(/^\?/, '').split('&');
  var paramsObj = {};
  var i;
  var param;
  for (i = 0; i < pairs.length; i++) {
    param = pairs[i].split('=');
    if (internalTrim(param[0]) !== '') {
      paramsObj[param[0]] = param[1];
    }
  }
  if (psKey) {
    var key = psKey.toString().replace(/(%3C%=|%3C%|%%3E)/g, '');
    var value = typeof paramsObj[key] === 'undefined' ? null : decodeURI(paramsObj[key]);
    return value == null ? null : value;
  }
  return paramsObj;
}

/**
 * 取 URL 中问号后面的部分
 * @param {String} psUrl 链接
 * @returns {String} 问号后的原始字符串（不解码、不去 hash）；无参数或没有问号时返回 ''
 * @example
 * getUrlQueryString('https://a.com/list?page=2&size=10')
 * // 'page=2&size=10'
 * getUrlQueryString('https://a.com/list')
 * // ''
 * getUrlQueryString()
 * // ''
 */
export function getUrlQueryString(psUrl) {
  if (typeof psUrl === 'undefined' || psUrl.indexOf('?') < 0) {
    return '';
  }
  return psUrl.substr(psUrl.indexOf('?') + 1);
}

/**
 * HTML 编码：把文本转成可入库的带 <p> 排版的 HTML 实体内容
 *
 * 有 document 时先用 textContent 转义，再补单双引号；换行会变成 <br>，
 * 多个换行会包成 <p> 段落；桌面端连续空白转 &nbsp;，移动端合并为一个空格。
 * 没有 document 时走字符串替换分支，只保证实体转义，不做 DOM 排版。
 *
 * @param {String} psStr 原始文本
 * @returns {String} 编码后的 HTML 字符串；null/undefined 返回 ''
 * @example
 * htmlEncode('a<b&c')
 * // 'a&lt;b&amp;c'
 * htmlEncode('第一行\n第二行')
 * // '<p>第一行</p><p>第二行</p>'（桌面端空白会进一步转 &nbsp;）
 * htmlEncode(null)
 * // ''
 */
export function htmlEncode(psStr) {
  var str = psStr == null ? '' : psStr.toString();
  var output;
  var temp;
  var isMobile;

  if (typeof document !== 'undefined') {
    temp = document.createElement('div');
    if (temp.textContent != null) {
      temp.textContent = str;
    } else {
      temp.innerText = str;
    }
    // innerHTML 已完成 & < > 的转义，这里只补单双引号，避免二次转义
    output = temp.innerHTML.toString().replace(/'/g, '&apos;').replace(/"/g, '&quot;');
    output = output.replace(/\r/g, '<br>').replace(/\n/g, '<br>');
    if (output.indexOf('<br>') > -1) {
      output = output.replace(/<br>/g, '</p><p>');
      output = output.replace(/^(?!<.*)/g, '<p>');
      output = output.replace(/(?!>.*)$/g, '</p>');
      output = output.replace(/(<p><\/p>)/g, '');
    }
    isMobile = internalIsMobile();
    if (isMobile) {
      output = output.replace(/\t/g, '').replace(/(\s+)/g, ' ');
    } else {
      output = output.replace(/\t/g, '&nbsp;').replace(/(\s+)/g, '&nbsp;');
    }
    output = output.replace(/&lt;div&gt;([\s\S]*?)&lt;\/div&gt;/gi, '&lt;p&gt;$1&lt;/p&gt;');
    output = output.replace(/\\/g, '/');
    temp = null;
    return output;
  }

  output = str.replace(/\r/g, '<br>').replace(/\n/g, '<br>');
  if (output.indexOf('<br>') > -1) {
    output = output.replace(/<br>/g, '</p><p>');
    output = output.replace(/^(?!<.*)/g, '<p>');
    output = output.replace(/(?!>.*)$/g, '</p>');
    output = output.replace(/(<p><\/p>)/g, '');
  }
  output = output.replace(/\t/g, '&nbsp;').replace(/(\s+)/g, '&nbsp;');
  output = output.replace(/&/g, '&amp;');
  output = output.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  output = output.replace(/'/g, '&apos;').replace(/"/g, '&quot;');
  return output.replace(/\\/g, '/');
}

/**
 * HTML 解码：把实体内容还原为纯文本（用于回填 textarea / 编辑器）
 * @param {String} psStr 带 HTML 实体的字符串
 * @returns {String} 解码后的文本；null / 空串返回 ''；没有 document 时原样返回入参
 * @example
 * htmlDecode('a&lt;b&amp;c')
 * // 'a<b&c'
 * htmlDecode('<p>第一行</p><p>第二行</p>')
 * // '第一行\n第二行' 或 '第一行第二行'（块级标签是否换行取决于浏览器 innerText）
 * htmlDecode(null)
 * // ''
 */
export function htmlDecode(psStr) {
  if (typeof document === 'undefined') {
    return psStr;
  }
  if (psStr == null || psStr === '') {
    return '';
  }
  var temp = document.createElement('div');
  temp.innerHTML = psStr;
  var output = temp.innerText || temp.textContent;
  temp = null;
  return output;
}

/**
 * 转义字符串特殊字符（JSON / JS 字符串场景）
 * @param {String} str 原始字符串
 * @param {Boolean} needUrlEncode 是否再做 URL 编码
 * @returns {String} 转义后的字符串；非字符串或 null/undefined 返回 ''
 * @example
 * escapeSpecialChars('a"b\nc')
 * // 'a\\"b\\nc'
 * escapeSpecialChars('a"b', true)
 * // 'a%5C%22b'（先转义引号，再做 encodeURIComponent）
 * escapeSpecialChars(null)
 * // ''
 */
export function escapeSpecialChars(str, needUrlEncode) {
  var urlEncode = needUrlEncode === true;
  if (str == null || typeof str !== 'string') {
    return '';
  }
  var escapedStr = str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, '\\\'')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\v/g, '\\v');
  if (urlEncode) {
    escapedStr = encodeURIComponent(escapedStr);
  }
  return escapedStr;
}

/**
 * 反转义（配合 escapeSpecialChars）
 * @param {String} str 转义后的字符串
 * @param {Boolean} needUrlDecode 是否先做 URL 解码
 * @returns {String} 还原后的字符串；非字符串或 null/undefined 返回 ''
 * @example
 * unescapeSpecialChars('a\\"b\\nc')
 * // 'a"b\nc'
 * unescapeSpecialChars('a%5C%22b', true)
 * // 'a"b'
 * unescapeSpecialChars(null)
 * // ''
 */
export function unescapeSpecialChars(str, needUrlDecode) {
  var urlDecode = needUrlDecode === true;
  if (str == null || typeof str !== 'string') {
    return '';
  }
  var result = str;
  if (urlDecode) {
    result = decodeURIComponent(result);
  }
  return result
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\f/g, '\f')
    .replace(/\\v/g, '\v')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

/**
 * 表单入库清洗：过滤 HTML 标签、控制字符、高危字符等
 * @param {String} psStr 原始字符串
 * @param {Object} options 可选配置，字段见函数内 config：
 *        filterHtmlTag 去标签、filterRiskTag 去危险标签、filterControlChar 去控制字符、
 *        filterFullWidthSpace 全角空格转半角、escapeNewLine 换行转字面量 \n、
 *        escapeTab 制表符转字面量 \t、mergeSpace 合并连续空格、dangerMode 危险字符模式
 * @returns {String} 清洗后的字符串；null/undefined 返回 ''，其余入参会先转成字符串
 * @example
 * html('<p>你好</p><script>alert(1)</script>')
 * // '你好'
 * html('a\nb')
 * // 'ab'（filterControlChar 默认先删掉换行；要保留换行需关掉该开关）
 * html('a\nb', { filterControlChar: false })
 * // 'a\\nb'（escapeNewLine 默认 true，把换行转成字面量 \n）
 * html(null)
 * // ''
 */
export function html(psStr, options) {
  var config = {
    filterHtmlTag: true,
    filterRiskTag: true,
    filterControlChar: true,
    filterFullWidthSpace: true,
    escapeNewLine: true,
    escapeTab: true,
    mergeSpace: true,
    dangerMode: 'loose'
  };
  var final = {};
  var key;
  var str;
  for (key in config) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      final[key] = config[key];
    }
  }
  if (options && typeof options === 'object') {
    for (key in options) {
      if (Object.prototype.hasOwnProperty.call(options, key)) {
        final[key] = options[key];
      }
    }
  }
  if (psStr == null) {
    return '';
  }
  str = psStr.toString();
  if (final.filterControlChar) {
    str = str.replace(/[\x00-\x1F]/g, '');
  }
  if (final.filterFullWidthSpace) {
    str = str.replace(/\u3000/g, ' ');
  }
  str = dangerousChars(str, final.dangerMode);
  str = str.replace(/<style[\s\S]*>[\s\S]*<\/style>/gi, '');
  str = str.replace(/<script[\s\S]*>[\s\S]*<\/script>/gi, '');
  str = str.replace(/<!--[\s\S]*?-->/g, '');
  str = str.replace(/(&nbsp;|&ensp;|&emsp;|&thinsp;)/ig, '');
  if (final.filterHtmlTag) {
    str = str.replace(/<[^<>]+?>/g, '');
  } else if (final.filterRiskTag) {
    str = str.replace(/<(iframe|svg|link|frameset)[\s\S]*?>/gi, '');
  }
  str = str.replace(/\\/g, '\\\\');
  if (final.escapeNewLine) {
    str = str.replace(/\r/g, '').replace(/\n/g, '\\n');
  }
  if (final.escapeTab) {
    str = str.replace(/\t/g, '\\t');
  }
  if (final.mergeSpace) {
    str = str.replace(/ +/g, ' ');
  }
  return str;
}

/**
 * 过滤 SQL / 数据库高危字符
 * @param {String} psStr 原字符串
 * @param {String} psMethod loose 宽松（默认，替换为全角或中文符号）/ strict 严格（直接删除）
 * @returns {String} 处理后的字符串；null/undefined 返回 ''，其余入参会先转成字符串
 * @example
 * dangerousChars('a;b(c)', 'strict') // 'abc'
 * dangerousChars('a;b(c)')           // 'a；b（c）'
 * dangerousChars('a--b')             // 'a-b'
 */
export function dangerousChars(psStr, psMethod) {
  if (psStr == null) {
    return '';
  }
  var method = psMethod === 'strict' ? 'strict' : 'loose';
  var str = psStr.toString();
  if (method === 'strict') {
    str = str.replace(/(&|--|\\|;|"|'|`|\?|\(|\))/g, '');
  } else {
    str = str.replace(/(\\|`)/g, '');
    str = str.replace(/&/g, '＆');
    str = str.replace(/\?/g, '？');
    str = str.replace(/;/g, '；');
    str = str.replace(/\(/g, '（');
    str = str.replace(/\)/g, '）');
    str = str.replace(/"([^"]*)"/g, '\u201c$1\u201d');
    str = str.replace(/'([^']*)'/g, '\u2018$1\u2019');
    str = str.replace(/"/g, '\u201c');
    str = str.replace(/'/g, '\u201c');
    str = str.replace(/--/g, '-');
  }
  str = str.replace('/*', '/ *').replace('*/', '* /');
  str = str.replace(/(\s+)(and|or)(\s+)/gi, '$2');
  return str;
}

/**
 * 强净化：清掉脚本、样式、标签、空白等
 * @param {String} psStr 原始字符串
 * @param {Object} psOpts 可选开关，字段见函数内 defaults：
 *        javascript / css / space / html / lineFeed / tab
 * @returns {String} 净化后的字符串；null 或非字符串返回 ''
 * @example
 * charCode('<p>a</p><script>x</script>')
 * // 'a'
 * charCode(' a\tb\nc ')
 * // 'abc'（space、lineFeed、tab 默认全部开启）
 * charCode('<b>a</b>', { html: false })
 * // '<b>a</b>'（标签保留，空格仍被清理）
 */
export function charCode(psStr, psOpts) {
  if (psStr == null || typeof psStr !== 'string') {
    return '';
  }
  var defaults = {
    javascript: true,
    css: true,
    space: true,
    html: true,
    lineFeed: true,
    tab: true
  };
  var settings = {};
  var key;
  var result = psStr.toString();
  for (key in defaults) {
    if (Object.prototype.hasOwnProperty.call(defaults, key)) {
      settings[key] = defaults[key];
    }
  }
  if (psOpts && typeof psOpts === 'object') {
    for (key in psOpts) {
      if (Object.prototype.hasOwnProperty.call(psOpts, key)) {
        settings[key] = psOpts[key];
      }
    }
  }
  if (settings.javascript) {
    result = result.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  }
  if (settings.css) {
    result = result.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  }
  if (settings.space) {
    result = result.replace(/\s+/g, '');
    result = result.replace(/(&nbsp;|&ensp;|&emsp;|&thinsp;)/ig, '');
  }
  if (settings.html) {
    result = result.replace(/<[^<>]+?>/g, '');
  }
  if (settings.lineFeed) {
    result = result.replace(/[\r\n]/g, '');
  }
  if (settings.tab) {
    result = result.replace(/\t/g, '');
  }
  return result;
}

/**
 * 只保留数字字符
 * @param {String} psStr 原字符串
 * @returns {String} 只由 0-9 组成的字符串；小数点、负号、空格、字母都会被删掉
 * @example
 * notNumericChar('a1-2.3') // '123'
 * notNumericChar(10086)    // '10086'
 */
export function notNumericChar(psStr) {
  return psStr.toString().replace(/\D/g, '');
}

/**
 * 相同字符只保留第一个（可指定只处理某个字符）
 * @param {String} psStr 原字符串
 * @param {String} psChar 指定字符；不传则对所有重复字符生效
 * @returns {String} 去重后的字符串；传了 psChar 时只去掉该字符的重复项，其它重复字符保留
 * @example
 * repeatedChar('aabbcc')     // 'abc'
 * repeatedChar('aabbcc', 'a') // 'abbcc'
 * repeatedChar('1122', '2')   // '112'
 */
export function repeatedChar(psStr, psChar) {
  var char = typeof psChar === 'undefined' ? '' : psChar;
  return psStr.replace(/./g, function (s, index) {
    return psStr.indexOf(s) === index ? s : (char === '' ? '' : (char === s ? '' : s));
  });
}

/**
 * 过滤空格
 * @param {String} psStr 原字符串
 * @param {String} psMethod all 全部去掉（默认）/ one 只保留一个
 * @returns {String|Null} 处理后的字符串；null/undefined 原样返回；只处理半角空格，不处理制表符和换行
 * @example
 * blankSpace('a  b   c')       // 'abc'
 * blankSpace('a  b   c', 'one') // 'a b c'
 * blankSpace(null)              // null
 */
export function blankSpace(psStr, psMethod) {
  if (psStr == null) {
    return psStr;
  }
  if (psMethod === 'one') {
    return psStr.toString().replace(/([ ]+)/g, ' ');
  }
  return psStr.toString().replace(/ +/g, '');
}

/**
 * 去掉结尾的小数点
 *
 * 注意：当前实现只要字符串以点结尾，就会删除字符串里的所有点，
 * 不是只删末尾那一个；例如 '1.2.' 会变成 '12'。不以点结尾时原样返回。
 *
 * @param {String} psStr 原字符串
 * @returns {String|*} 以点结尾时返回去掉所有点后的字符串；否则原样返回入参（可能是数字等非字符串）
 * @example
 * lastDotChar('12.')  // '12'
 * lastDotChar('1.2.') // '12'
 * lastDotChar('1.2')  // '1.2'
 */
export function lastDotChar(psStr) {
  if (/^(.*?)\.$/.test(psStr)) {
    return psStr.toString().replace(/([.]+)/g, '');
  }
  return psStr;
}

/**
 * 输入限制：只保留正整数
 * @param {String} str
 * @returns {String} 只保留 0-9 的字符串；负号、小数点、空格都会被删掉
 * @example
 * onlyInterval('-12.3') // '123'
 * onlyInterval('a1b2')  // '12'
 */
export function onlyInterval(str) {
  return str.toString().replace(/[^\d]/g, '');
}

/**
 * 输入限制：只保留正负整数，负号归位到最前
 * @param {String} str
 * @returns {String} 只保留数字和最多一个负号；负号出现在中间时会移到最前
 * @example
 * negativeInterval('a-1b2')  // '-12'
 * negativeInterval('12-34')  // '-1234'
 * negativeInterval('--5')    // '-5'
 */
export function negativeInterval(str) {
  var value = str.toString().replace(/[^\d\-]/g, '');
  value = repeatedChar(value, '-');
  return value.indexOf('-') > 0 ? '-' + value.replace('-', '') : value;
}

/**
 * 输入限制：只保留正小数
 * @param {String} str
 * @returns {String} 只保留数字和小数点；开头的点、重复的点会被去掉，负号会被删掉
 * @example
 * onlyFloat('a1.2.3') // '1.23'
 * onlyFloat('.5')     // '5'
 * onlyFloat('-1.2')   // '1.2'
 */
export function onlyFloat(str) {
  var value = str.toString().replace(/[^\d.]/g, '');
  value = value.replace(/^[.]/g, '');
  return repeatedChar(value, '.');
}

/**
 * 输入限制：只保留正负小数，负号归位到最前
 * @param {String} str
 * @returns {String} 只保留数字、小数点和最多一个负号；会去掉开头的点、重复的点和重复的负号
 * @example
 * negativeFloat('a-1.2')  // '-1.2'
 * negativeFloat('1.2-3')  // '-1.23'
 * negativeFloat('-.5')    // '5'（当前实现会把 '-.' 一起删掉）
 */
export function negativeFloat(str) {
  var value = str.toString().replace(/[^\d.\-]/g, '');
  value = value.replace(/^[.]/g, '');
  value = value.replace('-.', '');
  value = repeatedChar(value, '.');
  value = repeatedChar(value, '-');
  return value.indexOf('-') > 0 ? '-' + value.replace('-', '') : value;
}

/**
 * 数值输入框失焦清洗：去掉尾部小数点 / 负号、去掉前导 0
 * @param {String} psStr 原值
 * @returns {String|*} 清洗后的值；不以点或负号结尾、且不是 0 开头的数字时原样返回
 * @example
 * numericalOnBlur('12.')   // '12'
 * numericalOnBlur('12-')   // '12'
 * numericalOnBlur('01.2')  // '1.2'
 * numericalOnBlur('0.5')   // '.5'（前导 0 被去掉，当前实现保留了点）
 */
export function numericalOnBlur(psStr) {
  var value = psStr;
  if (/^(.*?)\.$/.test(value)) {
    value = value.replace(/([.]+)/g, '');
  }
  if (/^(.*?)\-$/.test(value)) {
    value = value.replace(/([\-]+)/g, '');
  }
  if (/^0([\d.]+)$/.test(value)) {
    value = value.replace(/^0(.*?)/g, '$1');
  }
  return value;
}

/**
 * 输入限制：只保留“时:分”，小时最大 23、分钟最大 59
 * @param {String} str
 * @returns {String} 带冒号的时分字符串；小时为 1 位时会补 0，分钟不强制补 0；
 *          数字足够长但还没冒号时，按前两位为小时、后两位为分钟自动补冒号
 * @example
 * hourMinute('9:5')    // '09:5'
 * hourMinute('9:05')   // '09:05'
 * hourMinute('24:00')  // '23:00'
 * hourMinute('1234')   // '12:34'
 * hourMinute('12:9')   // '12:9'
 */
export function hourMinute(str) {
  var value = str.toString().replace(/[^\d:]/g, '');
  value = repeatedChar(value, ':');
  var hour;
  var minute;
  var arr;
  var newValue;
  var tmpHour;
  var tmpMinute;
  if (value.indexOf(':') >= 0) {
    arr = value.split(':');
    hour = arr[0];
    minute = arr[1];
    minute = minute.length >= 2 ? minute.substr(0, 2) : minute;
    if (hour.length === 1) {
      hour = '0' + hour;
    }
    if (parseInt(hour) > 23) {
      hour = 23;
    }
    if (parseInt(minute) > 59) {
      minute = 59;
    }
    return hour + ':' + minute;
  }
  if (value.length >= 4) {
    tmpHour = value.substr(0, 2);
    tmpMinute = value.replace(/([:]+)/g, '').substr(2, 2);
    if (parseInt(tmpHour) > 23) {
      tmpHour = 23;
    }
    if (parseInt(tmpMinute) > 59) {
      tmpMinute = 59;
    }
    newValue = tmpHour + ':' + tmpMinute;
    return tmpMinute === '' ? value : newValue;
  }
  return value;
}

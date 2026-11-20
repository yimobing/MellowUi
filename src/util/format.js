/**
 * @File    format.js
 * @Desc    MelUI Util 工具层：数字格式化 / 金额单位换算 / 百分数换算 / 中文数字
 * @Version 0.1.2
 * @Date    2026-11-18
 * @PubDate 2026-11-20 15:35:00
 * @Author  ChenMufeng
 *
 * 【实现约定】
 *   toFixed 是独立函数，不改写 Number.prototype；
 *   scientific2String 用 ES5 展开，正负指数都支持；
 *   decimal2Percent / percent2Decimal / 元↔万元 保持统一的取整口径。
 * 【对外形态】melui.util.format.xxx
 * ──────────────────────────────────────────────────────
 */

/**
 * 内部：简易 trim
 * @param {String} str
 * @return {String}
 */
function internalTrim(str) {
  return str == null ? '' : str.toString().replace(/^\s+|\s+$/g, '');
}

/**
 * 内部：字符串重复
 * @param {String} str
 * @param {Number} count
 * @return {String}
 */
function internalRepeat(str, count) {
  var result = '';
  var i;
  for (i = 0; i < count; i++) {
    result += str;
  }
  return result;
}

/**
 * 数字千分位（整数部分每三位加逗号，小数部分原样保留）
 * @param {String|Number} psStr 原始数字
 * @returns {String} 加千分位后的字符串；非数字字符不会被剔除，长度不足三位时原样返回
 * @example
 * thousandth(1234567.89) // '1,234,567.89'
 * thousandth('-1234')    // '-1,234'
 * thousandth('abc')      // 'abc'
 */
export function thousandth(psStr) {
  var arr = psStr.toString().split('.');
  return arr[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (arr.length <= 1 ? '' : '.' + arr[1]);
}

/**
 * 修复精度的 toFixed（不改写 Number.prototype）
 * @param {Number} psNumber 要处理的数字
 * @param {Number} psDigit 小数位数 0~20
 * @returns {String} 固定位数的小数字符串；位数非法时返回原数字字符串；
 *          数字不是有效数字或大于等于 1e21 时返回 Number#toString 的结果
 * @example
 * toFixed(1.005, 2) // '1.01'
 * toFixed(1.5, 0)   // '2'
 * toFixed(1.2, 3)   // '1.200'
 * toFixed(1.2, -1)  // '1.2'（位数非法，原样返回）
 * toFixed('abc', 2) // 'NaN'
 */
export function toFixed(psNumber, psDigit) {
  var n = parseInt(psDigit, 10);
  var number = Number(psNumber);
  var result;
  var arr;
  var integer;
  var decimal;
  var last;
  var x;
  var i;

  if (isNaN(n) || n > 20 || n < 0) {
    return String(psNumber);
  }
  if (isNaN(number) || number >= Math.pow(10, 21)) {
    return number.toString();
  }
  if (n === 0) {
    return Math.round(number).toString();
  }
  result = number.toString();
  arr = result.split('.');
  if (arr.length < 2) {
    result += '.';
    for (i = 0; i < n; i++) {
      result += '0';
    }
    return result;
  }
  integer = arr[0];
  decimal = arr[1];
  if (decimal.length === n) {
    return result;
  }
  if (decimal.length < n) {
    for (i = 0; i < n - decimal.length; i++) {
      result += '0';
    }
    return result;
  }
  result = integer + '.' + decimal.substr(0, n);
  last = decimal.substr(n, 1);
  if (parseInt(last, 10) >= 5) {
    x = Math.pow(10, n);
    result = String((Math.round(parseFloat(result) * x) + 1) / x);
    result = toFixed(parseFloat(result), n);
  }
  return result;
}

/**
 * 小数转百分数
 * @param {String|Number} psDecimalStr 小数字符串
 * @param {String} psMethod round 四舍五入（默认，按 ×100 后取整）/ floor 向下取整 / ceil 向上取整
 *        floor / ceil 当前是直接对小数本身取整，不是对百分数取整，通常只会得到 0% 或 1%
 * @param {Number} psDigit 小数位数，默认 -1 不处理
 * @param {Boolean} psIsEmptyTips 空值是否返回引导文案
 * @returns {String} 百分数字符串；空值返回 ''；空值且 psIsEmptyTips 为 true 时返回引导文案并追加 %
 * @example
 * decimal2Percent('0.3')         // '30%'
 * decimal2Percent('0.3333', 'round', 2) // '33.33%'
 * decimal2Percent('')            // ''
 * decimal2Percent('', 'round', -1, true) // '如30%，请输入0.3%'（当前实现会给提示文案追加 %）
 */
export function decimal2Percent(psDecimalStr, psMethod, psDigit, psIsEmptyTips) {
  var method = typeof psMethod === 'undefined' || psMethod === '' ? 'round' : psMethod;
  var digit = typeof psDigit === 'undefined' || psDigit === '' ? -1 : parseInt(psDigit, 10);
  var isEmptyTips = psIsEmptyTips === true;
  var percent = '';
  var decimal = psDecimalStr.toString().replace(/[%]/g, '');
  decimal = decimal.replace(/\.(?=.*\.)/g, '');
  if (decimal !== '') {
    if (method === 'round') {
      percent = decimal * 1000000 / 10000;
      if (digit >= 0) {
        percent = toFixed(percent, digit);
      }
    }
    if (method === 'floor') {
      percent = Math.floor(decimal);
    }
    if (method === 'ceil') {
      percent = Math.ceil(decimal);
    }
  } else if (isEmptyTips) {
    percent = '如30%，请输入0.3';
  }
  return percent === '' ? '' : percent + '%';
}

/**
 * 百分数转小数
 * @param {String|Number} psPercentStr 百分数字符串
 * @param {Number} psDigit 小数位数，默认 -1 不处理
 * @returns {Number|String} 百分数除以 100 的结果；psDigit > 0 时返回固定位数的小数字符串，否则返回 Number
 * @example
 * percent2Decimal('30%')      // 0.3
 * percent2Decimal('33.33%')   // 0.3333
 * percent2Decimal('33.33%', 2) // '0.33'
 */
export function percent2Decimal(psPercentStr, psDigit) {
  var digit = typeof psDigit === 'undefined' || psDigit === '' ? -1 : parseInt(psDigit, 10);
  var decimal = psPercentStr.toString().replace(/[%]/g, '') * 1000000 / 100000000;
  if (digit > 0) {
    decimal = toFixed(decimal, digit);
  }
  return decimal;
}

/**
 * 元 → 万元
 * @param {String|Number} psStr 元
 * @param {String} psMethod round 四舍五入（默认）/ floor / ceil
 * @param {Number} psDigit 小数位数，默认 -1 不处理
 * @param {Boolean} psIsEmptyTips 空值是否返回空串（当前分支结果都是空串，参数不改变返回值）
 * @returns {Number|String} 万元数值；空值或无法解析时返回 ''；round 且 psDigit >= 0 时返回字符串
 * @example
 * yuan2TenThousand(10000)       // 1
 * yuan2TenThousand('12345', 'round', 2) // '1.23'
 * yuan2TenThousand('')          // ''
 */
export function yuan2TenThousand(psStr, psMethod, psDigit, psIsEmptyTips) {
  var method = typeof psMethod === 'undefined' ? 'round' : psMethod;
  var digit = typeof psDigit === 'undefined' ? -1 : parseInt(psDigit, 10);
  var isEmptyTips = psIsEmptyTips === true;
  var wanYuan = '';
  var str;
  if (internalTrim(psStr) !== '') {
    str = parseFloat(psStr.toString().replace(/[^0-9.]/ig, ''));
    wanYuan = str * 1000000 / 10000000000;
    if (method === 'round') {
      if (digit >= 0) {
        wanYuan = toFixed(wanYuan, digit);
      }
    }
    if (method === 'floor') {
      wanYuan = Math.floor(wanYuan);
    }
    if (method === 'ceil') {
      wanYuan = Math.ceil(wanYuan);
    }
  } else if (isEmptyTips) {
    wanYuan = '';
  }
  if (isNaN(wanYuan)) {
    wanYuan = '';
  }
  return wanYuan;
}

/**
 * 万元 → 元
 * @param {String|Number} psStr 万元
 * @param {Number} psDigit 小数位数：>0 保留，0 取整，-1（默认）不处理
 * @returns {Number|String} 元数值；空值或无有效数字返回 ''；psDigit > 0 时返回字符串，0 时向下取整
 * @example
 * tenThousand2Yuan(1)        // 10000
 * tenThousand2Yuan('1.2345') // 12345
 * tenThousand2Yuan('1.5', 0) // 15000
 * tenThousand2Yuan('')       // ''
 */
export function tenThousand2Yuan(psStr, psDigit) {
  if (internalTrim(psStr) === '') {
    return '';
  }
  var digit = typeof psDigit === 'undefined' ? -1 : parseInt(psDigit, 10);
  var str = parseFloat(psStr.toString().replace(/[^0-9.]/ig, ''));
  var yuan = str * 10000000000 / 1000000;
  if (digit > 0) {
    yuan = toFixed(yuan, digit);
  }
  if (digit === 0) {
    yuan = Math.floor(yuan);
  }
  if (isNaN(yuan)) {
    yuan = '';
  }
  return yuan;
}

/**
 * 全零字符串转空串（0、0.00、-0.000 都算零）
 * 判定规则：去掉所有空格后，字符只由 0、.、- 组成时返回空串；
 * 只要出现其它字符，就原样返回。
 * @param {String|Number} psStr 待处理值
 * @returns {String|Number|null|undefined} 全零返回 ''；非全零原样返回；
 *          null / undefined 原样返回
 * @example
 * zeroString2Empty('0.00')    // ''
 * zeroString2Empty('-0.0000') // ''
 * zeroString2Empty(0)         // ''
 * zeroString2Empty('0.01')    // '0.01'
 * zeroString2Empty('abc')     // 'abc'
 * zeroString2Empty(null)      // null
 */
export function zeroString2Empty(psStr) {
  if (psStr == null) {
    return psStr;
  }
  var newstr = psStr.toString().replace(/ +/g, '');
  var flag = false;
  var i;
  var each;
  if (newstr !== '') {
    for (i = 0; i < newstr.length; i++) {
      each = newstr.charAt(i);
      if (each !== '0' && each !== '.' && each !== '-') {
        flag = true;
        break;
      }
    }
  }
  return flag ? psStr : '';
}

/**
 * 空串转 0（只有空格也算空）
 * @param {String|Number} psStr 待处理值
 * @returns {String|Number|null|undefined} 空串/空白返回 0；非空原样返回；
 *          null / undefined 原样返回
 * @example
 * emptyString2Zero('')    // 0
 * emptyString2Zero('   ') // 0
 * emptyString2Zero('0.00') // '0.00'
 * emptyString2Zero(null)  // null
 */
export function emptyString2Zero(psStr) {
  if (psStr == null) {
    return psStr;
  }
  return internalTrim(psStr) === '' ? 0 : psStr;
}

/**
 * 数字转中文（支持到万级）
 * @param {Number|String} num 原始数字
 * @returns {String} 中文数字；无法转成整数时返回 ''；只处理整数部分，小数会被 parseInt 截掉
 * @example
 * numToChines(12345) // '一万二千三百四十五'
 * numToChines('100') // '一百'
 * numToChines('abc') // ''
 */
export function numToChines(num) {
  var changeNum = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var unit = ['', '十', '百', '千', '万'];
  var value = parseInt(num, 10);
  var overWan;
  var noWan;
  var getWan = function (temp) {
    var strArr = temp.toString().split('').reverse();
    var newNum = '';
    var i;
    var digit;
    for (i = 0; i < strArr.length; i++) {
      digit = strArr[i];
      newNum = (i === 0 && digit === '0'
        ? ''
        : (i > 0 && digit === '0' && strArr[i - 1] === '0'
          ? ''
          : changeNum[digit] + (digit === '0' ? unit[0] : unit[i]))) + newNum;
    }
    return newNum;
  };
  if (isNaN(value)) {
    return '';
  }
  overWan = Math.floor(value / 10000);
  noWan = value % 10000;
  if (noWan.toString().length < 4) {
    noWan = '0' + noWan;
  }
  return overWan ? getWan(overWan) + '万' + getWan(noWan) : getWan(value);
}

/**
 * 科学计数法转普通数字字符串
 * @param {String} psStr 例 1.5E+006 / 1.32e-006
 * @returns {String} 普通数字字符串；无法识别时原样返回；null/undefined 返回 ''
 * @example
 * scientific2String('1.5E+006')  // '1500000'
 * scientific2String('1.32e-006') // '0.00000132'
 * scientific2String('abc')       // 'abc'
 */
export function scientific2String(psStr) {
  var str = psStr == null ? '' : psStr.toString();
  var match = /^([+-]?)(\d+)(?:\.(\d+))?e([+-]?)(\d+)$/i.exec(str);
  var sign;
  var intPart;
  var fracPart;
  var expSign;
  var exp;
  var digits;
  var totalLen;
  var result;
  if (!match) {
    return str;
  }
  sign = match[1] === '-' ? '-' : '';
  intPart = match[2];
  fracPart = match[3] || '';
  expSign = match[4] === '-' ? '-' : '+';
  exp = parseInt(match[5], 10);
  digits = intPart + fracPart;
  if (expSign === '-') {
    result = '0.' + internalRepeat('0', exp - 1) + digits;
  } else if (exp >= fracPart.length) {
    result = digits + internalRepeat('0', exp - fracPart.length);
  } else {
    result = digits.substr(0, intPart.length + exp) + '.' + digits.substr(intPart.length + exp);
  }
  return sign + result;
}

/**
 * 把不规范的数据结构转成标准结构（{data:[...]} → 平铺对象或标准数组对象）
 * @param {Object} psSource 数据源
 * @param {Object} psOpts 可选
 * @param {Boolean} psOpts.oneWiki 是否强制转成一维对象
 * @returns {Object|null|undefined} 无 data 时原样返回；单条或 oneWiki 时
 *          返回 { return:'ok', ...单条字段 }；多条时返回 { return:'ok', data:原数组 }
 * @example
 * nonstandardObjectToStandardData({ data: [{ a: 1 }] })      // { return:'ok', a:1 }
 * nonstandardObjectToStandardData({ data: [{ a:1 }, { a:2 }] }) // { return:'ok', data:[...] }
 * nonstandardObjectToStandardData({})                        // {}
 */
export function nonstandardObjectToStandardData(psSource, psOpts) {
  var settings = { oneWiki: false };
  var key;
  var row;
  var newSource = {};
  var v;
  var source = psSource;
  if (psOpts && typeof psOpts === 'object') {
    for (key in psOpts) {
      if (Object.prototype.hasOwnProperty.call(psOpts, key)) {
        settings[key] = psOpts[key];
      }
    }
  }
  if (!source || typeof source.data === 'undefined') {
    return source;
  }
  if (settings.oneWiki || source.data.length === 1) {
    row = source.data[0];
    newSource['return'] = 'ok';
    for (v in row) {
      if (Object.prototype.hasOwnProperty.call(row, v)) {
        newSource[v] = row[v];
      }
    }
  } else {
    newSource['return'] = 'ok';
    newSource.data = source.data;
  }
  for (key in newSource) {
    if (Object.prototype.hasOwnProperty.call(newSource, key)) {
      return newSource;
    }
  }
  return source;
}

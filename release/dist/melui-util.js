(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global._MelUiUtilTemp = factory());
})(this, (function () { 'use strict';

  /**
   * @File    type.js
   * @Desc    MelUI Util 基础层：类型判断（纯函数，无 DOM）
   * @Version 0.1.2
   * @Date    2026-11-13
   * @PubDate 2026-11-20 15:30:00
   * @Author  ChenMufeng
   *
   * ── 层级定位：共享基础层（base）──────────────────────────
   * 与 core/internal 的私有层不是一回事，看名字就能分辨：
   *   base    = 允许多方 import 的底层公共函数
   *   internal= 只允许本模块内部 import 的私有实现
   *
   * 【可见性】可共享：core、components、util 其它模块都可以 import 本文件。
   * 【打包归属】随主包 melui.js 打包，被引用到才进包，不会整目录塞进去。
   * 【对外形态】业务方通过 melui.util.xxx 调用，不直接 import 源码文件。
   * 【硬约束】纯函数、无副作用；禁止任何 DOM 操作；禁止 import core / components。
   * ──────────────────────────────────────────────────────
   */

  /**
   * 通用类型串
   * @param {*} val
   * @return {String} 例如 '[object Object]'
   */
  function internalTag(val) {
    return Object.prototype.toString.call(val);
  }

  /**
   * 是否普通对象（排除 null、数组、DOM 节点、日期、正则）
   * @param {*} val
   * @returns {Boolean} true 表示 Object 原型对象且不是 DOM/window；null、数组、函数、日期、正则返回 false
   * @example
   * isPlainObject({ a: 1 })       // true
   * isPlainObject(Object.create(null)) // true
   * isPlainObject([])             // false
   * isPlainObject(document.body)  // false
   * isPlainObject(null)           // false
   */
  function isPlainObject(val) {
    if (val === null || typeof val !== 'object') {
      return false;
    }
    if (internalTag(val) !== '[object Object]') {
      return false;
    }
    // DOM 节点 / window 等宿主对象不算普通对象
    if (typeof val.nodeType === 'number' || val === val.window) {
      return false;
    }
    return true;
  }

  /**
   * 是否数组
   * @param {*} val
   * @returns {Boolean} true 表示 Array；类数组对象、字符串返回 false
   * @example
   * isArray([])        // true
   * isArray([1, 2])    // true
   * isArray('abc')     // false
   * isArray({ 0: 'a', length: 1 }) // false
   */
  function isArray(val) {
    return internalTag(val) === '[object Array]';
  }

  /**
   * 是否函数
   * @param {*} val
   * @returns {Boolean} true 表示 typeof 为 function
   * @example
   * isFunction(function () {}) // true
   * isFunction(() => {})       // true
   * isFunction({})             // false
   */
  function isFunction(val) {
    return typeof val === 'function';
  }

  /**
   * 是否数字（NaN 不算）
   * @param {*} val
   * @returns {Boolean} true 表示 typeof 为 number 且不是 NaN；'123' 字符串返回 false
   * @example
   * isNumber(123)  // true
   * isNumber(NaN)  // false
   * isNumber('123') // false
   */
  function isNumber(val) {
    return typeof val === 'number' && !isNaN(val);
  }

  /**
   * 是否字符串
   * @param {*} val
   * @returns {Boolean} true 表示 typeof 为 string；String 对象返回 false
   * @example
   * isString('abc')        // true
   * isString('')           // true
   * isString(new String('a')) // false
   */
  function isString(val) {
    return typeof val === 'string';
  }

  /**
   * 是否 DOM 元素节点
   * @param {*} val
   * @returns {Boolean} true 表示 nodeType 为 1；文本节点、普通对象、null 返回 false
   * @example
   * isElement(document.body) // true
   * isElement(document.createTextNode('x')) // false
   * isElement({ nodeType: 1 }) // true（只判断 nodeType，不要求真实 DOM）
   */
  function isElement(val) {
    return !!(val && val.nodeType === 1);
  }

  var type = /*#__PURE__*/Object.freeze({
    __proto__: null,
    isPlainObject: isPlainObject,
    isArray: isArray,
    isFunction: isFunction,
    isNumber: isNumber,
    isString: isString,
    isElement: isElement
  });

  /**
   * @File    object.js
   * @Desc    MelUI Util 基础层：对象工具（深合并 / 浅拷贝，不污染入参）
   * @Version 0.1.2
   * @Date    2026-11-13
   * @PubDate 2026-11-20 15:28:00
   * @Author  ChenMufeng
   *
   * ── 层级定位：共享基础层（base）──────────────────────────
   * 与 core/internal 的私有层不是一回事，看名字就能分辨：
   *   base    = 允许多方 import 的底层公共函数
   *   internal= 只允许本模块内部 import 的私有实现
   *
   * 【可见性】可共享：core、components、util 其它模块都可以 import 本文件。
   * 【打包归属】随主包 melui.js 打包，被引用到才进包，不会整目录塞进去。
   * 【对外形态】业务方通过 melui.util.xxx 调用，不直接 import 源码文件。
   * 【硬约束】纯函数、无副作用；禁止任何 DOM 操作；禁止 import core / components。
   * ──────────────────────────────────────────────────────
   */

  /**
   * 克隆一个值：
   * 普通对象递归克隆，数组递归克隆每个元素，其它（函数 / DOM / 基本类型）原样返回
   * @param {*} val
   * @returns {*} 克隆后的值；函数、DOM、日期等非普通对象不复制，直接返回引用
   */
  function internalClone(val) {
    var result;
    var i;
    var key;
    if (isPlainObject(val)) {
      result = {};
      for (key in val) {
        if (Object.prototype.hasOwnProperty.call(val, key)) {
          result[key] = internalClone(val[key]);
        }
      }
      return result;
    }
    if (isArray(val)) {
      result = [];
      for (i = 0; i < val.length; i++) {
        result.push(internalClone(val[i]));
      }
      return result;
    }
    return val;
  }

  /**
   * 深合并多个对象，返回全新对象
   * - 不做 Object.assign（IE9 不支持）
   * - 不修改任何入参对象，避免污染调用方 options
   * - 同名属性：都为普通对象时递归合并，否则后者覆盖前者
   *
   * @param {...Object} 任意个对象，后面的覆盖前面的
   * @returns {Object} 合并后的新对象；非普通对象参数会被忽略；数组按值递归克隆，不共享引用
   * @example
   * mergeObj({ a: 1, nested: { x: 1 } }, { b: 2, nested: { y: 2 } })
   * // { a: 1, b: 2, nested: { x: 1, y: 2 } }
   * mergeObj({ a: 1 }, { a: 2 })
   * // { a: 2 }
   * mergeObj(null, { a: 1 })
   * // { a: 1 }
   */
  function mergeObj() {
    var result = {};
    var i;
    var source;
    var key;
    for (i = 0; i < arguments.length; i++) {
      source = arguments[i];
      if (!isPlainObject(source)) {
        continue;
      }
      for (key in source) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) {
          continue;
        }
        if (isPlainObject(source[key]) && isPlainObject(result[key])) {
          result[key] = mergeObj(result[key], source[key]);
        } else {
          result[key] = internalClone(source[key]);
        }
      }
    }
    return result;
  }

  /**
   * 浅拷贝对象
   * @param {Object} val
   * @returns {Object} 只含自有可枚举属性的新对象；非普通对象返回 {}；属性值是引用，不递归克隆
   * @example
   * shallowCopy({ a: 1, b: { c: 2 } })
   * // { a: 1, b: { c: 2 } }（b 仍是原引用）
   * shallowCopy(null)
   * // {}
   */
  function shallowCopy(val) {
    var result = {};
    var key;
    if (!isPlainObject(val)) {
      return result;
    }
    for (key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        result[key] = val[key];
      }
    }
    return result;
  }

  var object = /*#__PURE__*/Object.freeze({
    __proto__: null,
    mergeObj: mergeObj,
    shallowCopy: shallowCopy
  });

  /**
   * @File    date.js
   * @Desc    MelUI Util 日期工具：格式化、日期边界、日期偏移、时间戳互转、星期转换
   * @Version 0.1.1
   * @Date    2026-11-18
   * @PubDate 2026-11-20 12:14:00
   * @Author  ChenMufeng
   *
   * ── 文件职责：纯日期计算（不读写 DOM、不依赖组件）────────────
   * 对外统一通过 melui.util.date.xxx 调用；所有函数返回字符串或数字，
   * 非法输入按各函数注释约定返回空串 / 0 / 原值，不弹窗、不改全局原型。
   * ──────────────────────────────────────────────────────
   */

  /* ==================== 内部格式化 ==================== */

  /**
   * 内部：补零
   * @private
   * @param {Number} n
   * @returns {String}
   */
  function internalPad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  /**
   * 内部：按位数补零
   * @private
   * @param {String|Number} value
   * @param {Number} length
   * @returns {String}
   */
  function internalPadValue(value, length) {
    var str = String(value);
    while (str.length < length) {
      str = '0' + str;
    }
    return str;
  }

  /**
   * 内部：按格式串格式化 Date
   * 支持 y / M / d / H / m / s / q / S 占位符，占位符重复次数决定补零位数。
   * noPad 为 true 时忽略占位符长度，直接输出原始数字。
   * @private
   * @param {Date} date
   * @param {String} str 格式串
   * @param {Boolean} noPad 是否不补零
   * @returns {String}
   */
  function internalFormat(date, str, noPad) {
    var o = {
      'M+': date.getMonth() + 1,
      'd+': date.getDate(),
      'H+': date.getHours(),
      'm+': date.getMinutes(),
      's+': date.getSeconds(),
      'q+': Math.floor((date.getMonth() + 3) / 3),
      'S': date.getMilliseconds()
    };
    var result = str == null ? '' : String(str);
    var pad = noPad !== true;
    var yearMatch;
    var key;
    var re;
    var match;
    var token;
    var value;

    yearMatch = result.match(/(y+)/);
    if (yearMatch) {
      token = yearMatch[0];
      value = (date.getFullYear() + '').substr(4 - token.length);
      result = result.replace(token, value);
    }

    for (key in o) {
      if (!Object.prototype.hasOwnProperty.call(o, key)) {
        continue;
      }
      re = new RegExp('(' + key + ')');
      match = result.match(re);
      while (match) {
        token = match[1];
        value = o[key];
        result = result.replace(re, pad ? internalPadValue(value, token.length) : String(value));
        match = result.match(re);
      }
    }
    return result;
  }

  /**
   * 内部：把中文标签格式转成占位符格式
   * @private
   * @param {String} formatStr
   * @returns {String}
   */
  function internalMapPattern(formatStr) {
    if (formatStr === '年-月-日') {
      return 'yyyy年MM月dd日';
    }
    if (formatStr === '年-月') {
      return 'yyyy年MM月';
    }
    if (formatStr === '月-日') {
      return 'MM月dd日';
    }
    return formatStr;
  }

  /**
   * 内部：格式串里是否含可识别的日期占位符
   * @private
   * @param {String} formatStr
   * @returns {Boolean}
   */
  function internalHasToken(formatStr) {
    return /[yMdHmsqS]/.test(formatStr);
  }

  /**
   * 内部：兼容 IE / iOS 的日期字符串
   * @private
   * @param {String|Date} value
   * @returns {String}
   */
  function internalSlashDate(value) {
    return value == null ? '' : value.toString().replace(/-/g, '/');
  }

  /**
   * 内部：某年某月的天数（1 月 = 1）
   * 闰年规则：能被 400 整除，或能被 4 整除但不能被 100 整除
   * @private
   * @param {Number} year
   * @param {Number} month
   * @returns {Number}
   */
  function internalDaysInMonth(year, month) {
    var days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) {
      return 29;
    }
    return days[month - 1] || 0;
  }

  /**
   * 内部：上一个月（处理跨年）
   * @private
   * @param {Number} year
   * @param {Number} month
   * @returns {Object} { year, month }
   */
  function internalPrevMonth(year, month) {
    if (month <= 1) {
      return { year: year - 1, month: 12 };
    }
    return { year: year, month: month - 1 };
  }

  /**
   * 内部：Date 转 yyyy-MM-dd
   * @private
   * @param {Date} date
   * @returns {String}
   */
  function internalYmd(date) {
    return internalFormat(date, 'yyyy-MM-dd', false);
  }

  /* ==================== 比较与判断 ==================== */

  /**
   * 比较两个日期字符串的先后
   * @param {String} dateStr1 日期 1
   * @param {String} dateStr2 日期 2
   * @returns {String} ">" 前者晚；"<" 前者早；"=" 相同或任一无法解析
   * @example
   * compareTwoDates('2026-01-01', '2026-01-02') // '<'
   * compareTwoDates('2026-01-02', '2026-01-01') // '>'
   * compareTwoDates('2026-01-01', '2026-01-01') // '='
   */
  function compareTwoDates(dateStr1, dateStr2) {
    var t1 = new Date(internalSlashDate(dateStr1)).getTime();
    var t2 = new Date(internalSlashDate(dateStr2)).getTime();
    if (t1 > t2) {
      return '>';
    }
    if (t1 < t2) {
      return '<';
    }
    return '=';
  }

  /**
   * 是否可被 Date 解析的日期字符串（不认只有年份的 "2018"）
   * @param {String} str 待判断值
   * @returns {Boolean} true 可解析；false 为空、纯数字或非法日期
   * @example
   * isDateString('2026-11-20') // true
   * isDateString('2026-13-01') // false
   * isDateString('2026')       // false
   */
  function isDateString(str) {
    return !!str && isNaN(str) && !isNaN(Date.parse(str));
  }

  /**
   * 两个日期相差的天数（后者减前者）
   * @param {String} date1 开始日期
   * @param {String} date2 结束日期
   * @returns {Number} 天数；date2 早于 date1 时为负数；任一参数非法返回 0
   * @example
   * getNumberOfDays('2026-01-01', '2026-01-03') // 2
   * getNumberOfDays('2026-01-03', '2026-01-01') // -2
   * getNumberOfDays('bad', '2026-01-01')        // 0
   */
  function getNumberOfDays(date1, date2) {
    var t1;
    var t2;
    if (!isDateString(date1) || !isDateString(date2)) {
      return 0;
    }
    t1 = new Date(internalSlashDate(date1)).getTime();
    t2 = new Date(internalSlashDate(date2)).getTime();
    return parseInt((t2 - t1) / (1000 * 60 * 60 * 24), 10);
  }

  /* ==================== 当前时间 ==================== */

  /**
   * 当前时间，按格式串返回
   * @param {Object} [options] 可选配置
   * @param {Boolean} [options.zero=true] 月/日/时/分/秒是否补零
   * @param {String} [options.format='yyyy-MM-dd HH:mm:ss'] 格式串
   *        支持 y/M/d/H/m/s/q/S 占位符，也兼容 年-月-日、年-月、月-日
   * @returns {String} 格式化后的当前时间；格式串为空时使用默认格式
   * @example
   * 以下示例按当前时间 2026-11-20 09:30:00 说明：
   * getNowTime()                                  // '2026-11-20 09:30:00'
   * getNowTime({ format: 'yyyy-MM-dd' })           // '2026-11-20'
   * getNowTime({ format: 'HH:mm' })                // '09:30'
   * getNowTime({ zero: false })                    // '2026-11-20 9:30:0'
   */
  function getNowTime(options) {
    var finals = mergeObj({
      zero: true,
      format: 'yyyy-MM-dd HH:mm:ss'
    }, options);
    var formatStr = finals.format;

    if (formatStr == null || formatStr === '') {
      formatStr = 'yyyy-MM-dd HH:mm:ss';
    }
    formatStr = internalMapPattern(String(formatStr));

    return internalFormat(new Date(), formatStr, finals.zero === false);
  }

  /* ==================== 本月 / 本季度 / 本年 ==================== */

  /**
   * 本月第一天
   * @returns {String} yyyy-MM-01
   * @example
   * getMonthFirstDay() // 当前为 2026-11 时返回 '2026-11-01'
   */
  function getMonthFirstDay() {
    var now = new Date();
    return now.getFullYear() + '-' + internalPad(now.getMonth() + 1) + '-01';
  }

  /**
   * 本月最后一天
   * @returns {String} yyyy-MM-dd；自动处理大小月和闰年
   * @example
   * getMonthLastDay() // 2026-11 返回 '2026-11-30'；2024-02 返回 '2024-02-29'
   */
  function getMonthLastDay() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    return year + '-' + internalPad(month) + '-' + internalPad(internalDaysInMonth(year, month));
  }

  /**
   * 本季度第一天
   * @returns {String} yyyy-MM-01
   * @example
   * getQuarterFirstDay() // 当前为 2026-11 时返回 '2026-10-01'
   */
  function getQuarterFirstDay() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    var startMon = Math.floor((month - 1) / 3) * 3 + 1;
    return year + '-' + internalPad(startMon) + '-01';
  }

  /**
   * 本季度最后一天
   * @returns {String} yyyy-MM-dd；自动处理季度末月份的天数
   * @example
   * getQuarterLastDay() // 当前为 2026-11 时返回 '2026-12-31'
   */
  function getQuarterLastDay() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    var startMon = Math.floor((month - 1) / 3) * 3 + 1;
    var endMon = startMon + 2;
    return year + '-' + internalPad(endMon) + '-' + internalPad(internalDaysInMonth(year, endMon));
  }

  /**
   * 本年第一天
   * @returns {String} yyyy-01-01
   * @example
   * getYearFirstDay() // '2026-01-01'
   */
  function getYearFirstDay() {
    return new Date().getFullYear() + '-01-01';
  }

  /**
   * 本年最后一天
   * @returns {String} yyyy-12-31
   * @example
   * getYearLastDay() // '2026-12-31'
   */
  function getYearLastDay() {
    return new Date().getFullYear() + '-12-31';
  }

  /**
   * 上个月第一天
   * @returns {String} yyyy-MM-01；1 月会自动跨到上一年 12 月
   * @example
   * getLastMonthFirstDay() // 当前为 2026-01 时返回 '2025-12-01'
   */
  function getLastMonthFirstDay() {
    var now = new Date();
    var prev = internalPrevMonth(now.getFullYear(), now.getMonth() + 1);
    return prev.year + '-' + internalPad(prev.month) + '-01';
  }

  /**
   * 上个月最后一天
   * @returns {String} yyyy-MM-dd；自动处理跨年、大小月和闰年
   * @example
   * getLastMonthLastDay() // 当前为 2026-01 时返回 '2025-12-31'
   */
  function getLastMonthLastDay() {
    var now = new Date();
    var prev = internalPrevMonth(now.getFullYear(), now.getMonth() + 1);
    return prev.year + '-' + internalPad(prev.month) + '-' + internalPad(internalDaysInMonth(prev.year, prev.month));
  }

  /**
   * 去年第一天
   * @returns {String} yyyy-01-01
   * @example
   * getLastYearFirstDay() // '2025-01-01'
   */
  function getLastYearFirstDay() {
    return (new Date().getFullYear() - 1) + '-01-01';
  }

  /**
   * 去年最后一天
   * @returns {String} yyyy-12-31
   * @example
   * getLastYearLastDay() // '2025-12-31'
   */
  function getLastYearLastDay() {
    return (new Date().getFullYear() - 1) + '-12-31';
  }

  /* ==================== 日期偏移 ==================== */

  /**
   * 今天前后 N 天
   * @param {Number} day 正数向后，负数向前，0 表示今天
   * @returns {String} yyyy-MM-dd；参数不是有效数字时返回空串
   * @example
   * getNDay(0)  // '2026-11-20'
   * getNDay(-7) // '2026-11-13'
   */
  function getNDay(day) {
    var time = new Date();
    var n = parseInt(day, 10);
    if (isNaN(n)) {
      return '';
    }
    time.setDate(time.getDate() + n);
    return internalYmd(time);
  }

  /**
   * 今天前后 N 个月（目标月没有该日期时由 Date 自动顺延）
   * @param {Number} month 正数向后，负数向前，0 表示本月
   * @returns {String} yyyy-MM-dd；参数不是有效数字时返回空串
   * @example
   * getNMonth(1)  // '2026-12-20'
   * getNMonth(-1) // '2026-10-20'
   */
  function getNMonth(month) {
    var time = new Date();
    var n = parseInt(month, 10);
    if (isNaN(n)) {
      return '';
    }
    time.setMonth(time.getMonth() + n);
    return internalYmd(time);
  }

  /**
   * 今天前后 N 年（2 月 29 日会自动落到 2 月 28 日或 3 月 1 日）
   * @param {Number} year 正数向后，负数向前，0 表示今年
   * @returns {String} yyyy-MM-dd；参数不是有效数字时返回空串
   * @example
   * getNYear(1)  // '2027-11-20'
   * getNYear(-1) // '2025-11-20'
   */
  function getNYear(year) {
    var time = new Date();
    var n = parseInt(year, 10);
    if (isNaN(n)) {
      return '';
    }
    time.setFullYear(time.getFullYear() + n);
    return internalYmd(time);
  }

  /* ==================== 星期 ==================== */

  /**
   * 日期转星期几
   * @param {String} date 日期字符串，如 2026-11-20
   * @returns {String} 星期日 ~ 星期六；日期非法时返回空串
   * @example
   * dateToWeek('2026-11-20') // '星期五'
   * dateToWeek('bad')        // ''
   */
  function dateToWeek(date) {
    var time = new Date(internalSlashDate(date));
    var weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    if (isNaN(time.getTime())) {
      return '';
    }
    return weekdays[time.getDay()];
  }

  /**
   * 数字转星期；传数组返回数组，传单个值返回字符串
   * @param {String|Array} psNumArrStr 1~7（1 = 星期一），支持 '1,3,5' 形式
   * @returns {String|Array} 单值返回字符串；数组返回同长度数组；undefined 返回空数组
   * @example
   * numToWeek('1')       // '星期一'
   * numToWeek('1,3,5')   // '星期一,星期三,星期五'
   * numToWeek(['1','2']) // ['星期一','星期二']
   */
  function numToWeek(psNumArrStr) {
    var isArr;
    var numData;
    var standWeekArr;
    var resultWeekArr;
    var tmpArr;
    var resArr;
    var j;
    var i;

    if (typeof psNumArrStr === 'undefined') {
      return [];
    }
    isArr = Object.prototype.toString.call(psNumArrStr) === '[object Array]';
    numData = isArr ? psNumArrStr : [psNumArrStr.toString()];
    standWeekArr = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
    resultWeekArr = [];
    for (j = 0; j < numData.length; j++) {
      tmpArr = [];
      resArr = numData[j].toString().split(',').sort();
      for (i = 0; i < resArr.length; i++) {
        tmpArr.push(standWeekArr[parseInt(resArr[i], 10) - 1]);
      }
      resultWeekArr.push(tmpArr.join(','));
    }
    return isArr ? resultWeekArr : resultWeekArr[0];
  }

  /* ==================== 格式化与时间戳 ==================== */

  /**
   * 日期格式化 / 标准化日期字符串
   * 支持入参：10-19-2017、2017/10/19、2017-10-19（可带时分秒）
   * @param {String} dateTime 日期字符串
   * @param {String} [formatStr='yyyy-MM-dd HH:mm:ss'] 格式串
   *        含 y/M/d/H/m/s/q/S 占位符时返回字符串；
   *        不含可识别占位符时返回拆解后的对象。
   * @returns {String|Object} 非法日期返回 ''；正常日期返回格式化字符串或
   *          { year, mon, day, hours, minutes, seconds } 对象
   * @example
   * dateFormat('2026-11-20 09:30:00')                         // '2026-11-20 09:30:00'
   * dateFormat('2026-11-20', 'yyyy/MM/dd')                    // '2026/11/20'
   * dateFormat('2026-11-20', '年-月-日')                       // '2026年11月20日'
   * dateFormat('2026-11-20', 'unknown')                       // { year:'2026', mon:'11', ... }
   * dateFormat('2026-13-01')                                  // ''
   */
  function dateFormat(dateTime, formatStr) {
    var ua;
    var normalized;
    var fmt;
    var timestamp;
    var time;
    var year;
    var month;
    var day;
    var hour;
    var minute;
    var second;

    if (dateTime == null || dateTime === '') {
      return '';
    }
    ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    normalized = (/iphone|ipod|mac|ipad/i.test(ua) ||
      (typeof window !== 'undefined' && (window.ActiveXObject || 'ActiveXObject' in window)))
      ? dateTime.toString().replace(/-/g, '/')
      : dateTime;
    timestamp = Date.parse(new Date(normalized));
    if (isNaN(timestamp)) {
      return '';
    }
    time = new Date(timestamp);
    fmt = typeof formatStr === 'undefined' ? 'yyyy-MM-dd HH:mm:ss' : String(formatStr);
    fmt = internalMapPattern(fmt);

    year = String(time.getFullYear());
    month = internalPad(time.getMonth() + 1);
    day = internalPad(time.getDate());
    hour = internalPad(time.getHours());
    minute = internalPad(time.getMinutes());
    second = internalPad(time.getSeconds());

    if (internalHasToken(fmt)) {
      return internalFormat(time, fmt, false);
    }
    return {
      year: year,
      mon: month,
      day: day,
      hours: hour,
      minutes: minute,
      seconds: second
    };
  }

  /**
   * 时间戳转日期字符串
   * @param {Number|String} timestamp 时间戳
   * @param {Object} [opts] 可选配置
   * @param {Number} [opts.bit=13] 13 表示毫秒，10 表示秒
   * @param {String} [opts.format='yyyy-MM-dd HH:mm:ss'] 格式串
   * @returns {String} 格式化后的日期；时间戳非法返回空串
   * @example
   * timestampToTime(1790000000000)                       // '2026-09-21 22:13:20'（UTC+8）
   * timestampToTime(1790000000, { bit: 10 })             // 秒级时间戳
   * timestampToTime(1790000000000, { format: 'yyyy-MM-dd' }) // '2026-09-21'
   */
  function timestampToTime(timestamp, opts) {
    var settings = mergeObj({
      bit: 13,
      format: 'yyyy-MM-dd HH:mm:ss'
    }, opts);
    var bit = parseInt(settings.bit, 10);
    var hasMillisecond;
    var date;

    if (isNaN(bit)) {
      bit = 13;
    }
    hasMillisecond = bit !== 10;
    date = new Date(parseInt(timestamp, 10) * (hasMillisecond ? 1 : 1000));
    if (isNaN(date.getTime())) {
      return '';
    }
    return internalFormat(date, settings.format, false);
  }

  /**
   * 日期字符串转时间戳
   * @param {String} time 日期字符串
   * @param {Boolean} [isMilliSecond=true] true 返回毫秒，false 返回秒
   * @returns {Number|String} 时间戳；日期非法返回 ''
   * @example
   * timeToTimestamp('2026-11-20 09:30:00')        // 1795138200000（UTC+8，13 位）
   * timeToTimestamp('2026-11-20 09:30:00', false) // 10 位秒级时间戳
   * timeToTimestamp('bad')                        // ''
   */
  function timeToTimestamp(time, isMilliSecond) {
    var hasMillisecond = isMilliSecond === undefined ? true : isMilliSecond !== false;
    var date = new Date(internalSlashDate(time));
    var thirteen;
    if (isNaN(date.getTime())) {
      return '';
    }
    thirteen = date.getTime();
    if (hasMillisecond) {
      return thirteen;
    }
    return parseInt(thirteen / 1000, 10);
  }

  /**
   * 时间数值转“天小时分钟秒”
   * @param {String|Number} psTimeStr 时间数值
   * @param {Object} [psOpt] 可选配置
   * @param {String} [psOpt.unit='小时'] 输入单位：小时 / 分钟 / 秒
   * @param {String} [psOpt.accurate='秒'] 输出精度：天 / 小时 / 分钟 / 秒 / 毫秒
   * @param {Boolean} [psOpt.zeroing=false] 不足一级时是否补出 0 单位
   * @returns {String} 中文时长；空值或非数字返回 ''；负数返回提示文案
   * @example
   * timeStringToDayHourMinuteSecond(25)                       // '1天1小时'
   * timeStringToDayHourMinuteSecond(25, { zeroing: true })    // '1天1小时0分钟0秒'
   * timeStringToDayHourMinuteSecond(25, { accurate: '小时' })  // '1天1小时'
   * timeStringToDayHourMinuteSecond('')                       // ''
   */
  function timeStringToDayHourMinuteSecond(psTimeStr, psOpt) {
    var settings;
    var unit;
    var accurate;
    var times;
    var day;
    var hour;
    var minute;
    var second;
    var millisecond;
    var dayStr;
    var hourStr;
    var minuteStr;
    var secondStr;
    var millisecondStr;

    if (psTimeStr == null || psTimeStr.toString().replace(/\s+/g, '') === '') {
      return '';
    }
    if (isNaN(parseFloat(psTimeStr))) {
      return '';
    }
    if (parseFloat(psTimeStr) < 0) {
      return 'Time string is a negative number, please check it!';
    }
    settings = mergeObj({
      unit: '小时',
      accurate: '秒',
      zeroing: false
    }, psOpt);
    unit = settings.unit;
    accurate = settings.accurate;
    times = parseFloat(psTimeStr);

    if (unit === 'hour' || unit === '小时') {
      day = Math.floor(times / 24);
      hour = Math.floor(times % 24);
      minute = Math.floor((times % 1) * 60);
      second = Math.floor((((times % 1) * 60) % 1) * 60);
      millisecond = Math.floor(((((times % 1) * 60) % 1) * 60 % 1) * 1000);
    } else if (unit === 'minute' || unit === '分钟') {
      day = Math.floor(times / 1440);
      hour = Math.floor((times % 1440) / 60);
      minute = Math.floor(times % 60);
      second = Math.floor(((times % 1) * 60));
      millisecond = Math.floor((((times % 1) * 60) % 1) * 1000);
    } else if (unit === 'second' || unit === '秒') {
      day = Math.floor(times / 86400);
      hour = Math.floor((times % 86400) / 3600);
      minute = Math.floor(((times % 86400) % 3600) / 60);
      second = Math.floor(times % 60);
      millisecond = Math.floor((times % 1) * 1000);
    } else {
      return '';
    }

    dayStr = day + '天';
    hourStr = hour + '小时';
    minuteStr = minute + '分钟';
    secondStr = second + '秒';
    millisecondStr = millisecond + '毫秒';
    if (settings.zeroing === false) {
      if (day <= 0) {
        dayStr = '';
      }
      if (hour <= 0) {
        hourStr = '';
      }
      if (minute <= 0) {
        minuteStr = '';
      }
      if (second <= 0) {
        secondStr = '';
      }
      if (millisecond <= 0) {
        millisecondStr = '';
      }
    }
    if (accurate === 'day' || accurate === '天') {
      return dayStr;
    }
    if (accurate === 'hour' || accurate === '小时') {
      return dayStr + hourStr;
    }
    if (accurate === 'minute' || accurate === '分钟') {
      return dayStr + hourStr + minuteStr;
    }
    if (accurate === 'millisecond' || accurate === '毫秒') {
      return dayStr + hourStr + minuteStr + secondStr + millisecondStr;
    }
    return dayStr + hourStr + minuteStr + secondStr;
  }

  var date = /*#__PURE__*/Object.freeze({
    __proto__: null,
    compareTwoDates: compareTwoDates,
    isDateString: isDateString,
    getNumberOfDays: getNumberOfDays,
    getNowTime: getNowTime,
    getMonthFirstDay: getMonthFirstDay,
    getMonthLastDay: getMonthLastDay,
    getQuarterFirstDay: getQuarterFirstDay,
    getQuarterLastDay: getQuarterLastDay,
    getYearFirstDay: getYearFirstDay,
    getYearLastDay: getYearLastDay,
    getLastMonthFirstDay: getLastMonthFirstDay,
    getLastMonthLastDay: getLastMonthLastDay,
    getLastYearFirstDay: getLastYearFirstDay,
    getLastYearLastDay: getLastYearLastDay,
    getNDay: getNDay,
    getNMonth: getNMonth,
    getNYear: getNYear,
    dateToWeek: dateToWeek,
    numToWeek: numToWeek,
    dateFormat: dateFormat,
    timestampToTime: timestampToTime,
    timeToTimestamp: timeToTimestamp,
    timeStringToDayHourMinuteSecond: timeStringToDayHourMinuteSecond
  });

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
  function internalTrim$2(str) {
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
  function thousandth(psStr) {
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
  function toFixed(psNumber, psDigit) {
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
  function decimal2Percent(psDecimalStr, psMethod, psDigit, psIsEmptyTips) {
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
  function percent2Decimal(psPercentStr, psDigit) {
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
  function yuan2TenThousand(psStr, psMethod, psDigit, psIsEmptyTips) {
    var method = typeof psMethod === 'undefined' ? 'round' : psMethod;
    var digit = typeof psDigit === 'undefined' ? -1 : parseInt(psDigit, 10);
    var isEmptyTips = psIsEmptyTips === true;
    var wanYuan = '';
    var str;
    if (internalTrim$2(psStr) !== '') {
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
  function tenThousand2Yuan(psStr, psDigit) {
    if (internalTrim$2(psStr) === '') {
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
  function zeroString2Empty(psStr) {
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
  function emptyString2Zero(psStr) {
    if (psStr == null) {
      return psStr;
    }
    return internalTrim$2(psStr) === '' ? 0 : psStr;
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
  function numToChines(num) {
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
  function scientific2String(psStr) {
    var str = psStr == null ? '' : psStr.toString();
    var match = /^([+-]?)(\d+)(?:\.(\d+))?e([+-]?)(\d+)$/i.exec(str);
    var sign;
    var intPart;
    var fracPart;
    var expSign;
    var exp;
    var digits;
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
  function nonstandardObjectToStandardData(psSource, psOpts) {
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

  var format = /*#__PURE__*/Object.freeze({
    __proto__: null,
    thousandth: thousandth,
    toFixed: toFixed,
    decimal2Percent: decimal2Percent,
    percent2Decimal: percent2Decimal,
    yuan2TenThousand: yuan2TenThousand,
    tenThousand2Yuan: tenThousand2Yuan,
    zeroString2Empty: zeroString2Empty,
    emptyString2Zero: emptyString2Zero,
    numToChines: numToChines,
    scientific2String: scientific2String,
    nonstandardObjectToStandardData: nonstandardObjectToStandardData
  });

  /**
   * @File    dom.js
   * @Desc    MelUI Util 工具层：DOM 查询 / 类名 / 节点插入 / 位置尺寸 / 滚动 / 输入增强
   * @Version 0.1.3
   * @Date    2026-11-18
   * @PubDate 2026-11-20 15:04:00
   * @Author  ChenMufeng
   *
   * 【实现约定】
   *   1. getChildElement 只筛选子元素，不删除注释/空白文本节点；
   *   2. addClass 用内部判定，兼容没有 classList 的 IE9；
   *   3. appendHtml 直接插入，不向 HTMLElement.prototype 挂方法；
   *   4. prependChild 在容器只有 script/style 时改为追加；
   *   5. makeTextareaExpanding 每次重新计算高度，不会被 maxHeight 永久卡住。
   * 【对外形态】melui.util.dom.xxx
   * ──────────────────────────────────────────────────────
   */

  /** 内部：事件绑定（attachEvent 场景把 this 绑回元素） */
  function internalBind(fn, context) {
    return function () {
      return fn.apply(context, arguments);
    };
  }

  /** 内部：元素是否带某个 class */
  function internalHasClass(el, cls) {
    if (!el || !el.className) {
      return false;
    }
    return (' ' + el.className.replace(/\s+/g, ' ') + ' ').indexOf(' ' + cls + ' ') > -1;
  }

  /** 内部：节点是否匹配类名或标签名 */
  function internalMatchNode(node, classOrTagName) {
    var name = classOrTagName.toString().toLowerCase();
    if (node.tagName && node.tagName.toLowerCase() === name) {
      return true;
    }
    return internalHasClass(node, classOrTagName);
  }

  /** 内部：把选择器 / NodeList / DOM 统一成 DOM 元素 */
  function internalResolveElement(o) {
    if (o == null) {
      return null;
    }
    if (typeof o === 'string') {
      var str = o.replace(/^\s+|\s+$/g, '');
      if (str.charAt(0) === '#') {
        return document.getElementById(str.substr(1));
      }
      if (str.charAt(0) === '.') {
        var byClass = document.getElementsByClassName
          ? document.getElementsByClassName(str.substr(1))
          : [];
        return byClass.length ? byClass[0] : null;
      }
      return document.querySelector ? document.querySelector(str) : null;
    }
    if (o.nodeType === 1) {
      return o;
    }
    if (typeof o.item === 'function') {
      return o.item(0) || null;
    }
    if (o.length && o[0] && o[0].nodeType === 1) {
      return o[0];
    }
    return null;
  }

  /**
   * 读取 data-* 属性（IE11 以下无 dataset）
   * @param {HTMLElement} ele DOM 元素
   * @returns {Object} 属性键值对象，键会从连字符转成驼峰；无元素时返回空对象
   * @example
   * // <div class="slide" data-auto-play="true" data-delay="3000"></div>
   * getDataset(document.querySelector('.slide'))
   * // { autoPlay: 'true', delay: '3000' }
   * getDataset(null)
   * // {}
   */
  function getDataset(ele) {
    var dataset;
    var attrs;
    var i;
    var matchStr;
    var name;
    if (!ele) {
      return {};
    }
    if (ele.dataset) {
      return ele.dataset;
    }
    attrs = ele.attributes;
    dataset = {};
    for (i = 0; i < attrs.length; i++) {
      matchStr = attrs[i].name.match(/^data-(.+)/);
      if (matchStr) {
        name = matchStr[1].replace(/-([\da-z])/gi, function (all, letter) {
          return letter.toUpperCase();
        });
        dataset[name] = attrs[i].value;
      }
    }
    return dataset;
  }

  /**
   * 添加 class（兼容无 classList 的 IE9）
   * @param {HTMLElement} el
   * @param {String} cls
   * @returns {void} 无返回值，直接修改元素的 className；元素为空时不做任何事
   * @example
   * addClass(document.querySelector('.box'), 'active')
   * // <div class="box active">
   */
  function addClass(el, cls) {
    if (!el) {
      return;
    }
    if (el.classList) {
      el.classList.add(cls);
    } else if (!internalHasClass(el, cls)) {
      el.className += (el.className ? ' ' : '') + cls;
    }
  }

  /**
   * 移除 class（兼容无 classList 的 IE9）
   * @param {HTMLElement} el
   * @param {String} cls
   * @returns {void} 无返回值，直接修改元素的 className；元素为空或本来没有该 class 时不做任何事
   * @example
   * removeClass(document.querySelector('.box'), 'active')
   * // <div class="box">
   */
  function removeClass(el, cls) {
    var arr;
    var idx;
    if (!el) {
      return;
    }
    if (el.classList) {
      el.classList.remove(cls);
      return;
    }
    arr = el.className.replace(/^\s+|\s+$/g, '').split(/\s+/);
    idx = arr.indexOf(cls);
    if (idx > -1) {
      arr.splice(idx, 1);
    }
    el.className = arr.join(' ');
  }

  /**
   * 取直接子元素（可按类名或标签名过滤）
   * @param {HTMLElement} o 父节点
   * @param {String} classOrTagName 可选，类名或标签名
   * @returns {Array|null} 直接子元素组成的新数组，不是 NodeList；父节点为空时返回 null，无匹配返回 []
   * @example
   * // <div><p></p><div class="active"></div></div>
   * getChildElement(box)
   * // [<p>, <div class="active">]
   * getChildElement(box, 'active')
   * // [<div class="active">]
   * getChildElement(null)
   * // null
   */
  function getChildElement(o, classOrTagName) {
    var children;
    var result = [];
    var i;
    var node;
    if (o == null) {
      return null;
    }
    children = o.childNodes;
    if (typeof classOrTagName === 'undefined') {
      for (i = 0; i < children.length; i++) {
        if (children[i].nodeType === 1) {
          result.push(children[i]);
        }
      }
      return result;
    }
    for (i = 0; i < children.length; i++) {
      node = children[i];
      if (node.nodeType === 1 && internalMatchNode(node, classOrTagName)) {
        result.push(node);
      }
    }
    return result;
  }

  /**
   * 取子孙元素（含自身，可按类名或标签名过滤）
   * @param {HTMLElement} o 当前节点
   * @param {String} classOrTagName 可选，类名或标签名；不传则返回自身及全部后代元素
   * @returns {Array} 匹配到的元素组成的新数组；节点为空或无匹配返回 []
   * @example
   * // <div class="box"><span class="item"></span><span class="item"></span></div>
   * getChildrenElement(box, 'item')
   * // [<span class="item">, <span class="item">]
   * getChildrenElement(box)
   * // [<div class="box">, <span class="item">, <span class="item">]（包含 box 自身）
   */
  function getChildrenElement(o, classOrTagName) {
    var result = [];
    function search(node) {
      var i;
      var child;
      if (!node || node.nodeType !== 1) {
        return;
      }
      if (typeof classOrTagName === 'undefined' || internalMatchNode(node, classOrTagName)) {
        result.push(node);
      }
      for (i = 0; i < node.childNodes.length; i++) {
        child = node.childNodes[i];
        if (child.nodeType === 1) {
          search(child);
        }
      }
    }
    search(o);
    return result;
  }

  /**
   * 第一个子元素
   * @param {HTMLElement} o
   * @returns {HTMLElement|null} 第一个元素子节点；没有元素子节点或父节点为空时返回 null
   * @example
   * getFirstChildElement(document.querySelector('.box'))
   * // <p> 或 null
   */
  function getFirstChildElement(o) {
    if (o == null) {
      return null;
    }
    return o.children[0] || null;
  }

  /**
   * 最后一个子元素
   * @param {HTMLElement} o
   * @returns {HTMLElement|null} 最后一个元素子节点；没有元素子节点或父节点为空时返回 null
   * @example
   * getLastChildElement(document.querySelector('.box'))
   * // <div> 或 null
   */
  function getLastChildElement(o) {
    if (o == null) {
      return null;
    }
    return o.children[o.children.length - 1] || null;
  }

  /**
   * 下一个兄弟元素（跳过文本节点）
   * @param {HTMLElement} o
   * @returns {HTMLElement|null} 下一个元素兄弟节点；没有则返回 null
   * @example
   * getNextElement(document.querySelector('.item'))
   * // <span class="item"> 或 null
   */
  function getNextElement(o) {
    var e;
    if (o == null) {
      return null;
    }
    e = o.nextSibling;
    while (e) {
      if (e.nodeType === 1) {
        return e;
      }
      e = e.nextSibling;
    }
    return null;
  }

  /**
   * 上一个兄弟元素（跳过文本节点）
   * @param {HTMLElement} o
   * @returns {HTMLElement|null} 上一个元素兄弟节点；没有则返回 null
   * @example
   * getPrevElement(document.querySelector('.item'))
   * // <span class="item"> 或 null
   */
  function getPrevElement(o) {
    var e;
    if (o == null) {
      return null;
    }
    e = o.previousSibling;
    while (e) {
      if (e.nodeType === 1) {
        return e;
      }
      e = e.previousSibling;
    }
    return null;
  }

  /**
   * 全部兄弟元素（不含自身）
   * @param {HTMLElement} o
   * @returns {Array} 同级元素组成的新数组，不含自身；无父节点时返回 []
   * @example
   * // <div><p></p><span></span><a></a></div>
   * getAllSiblingElement(span)
   * // [<p>, <a>]
   */
  function getAllSiblingElement(o) {
    var result = [];
    var siblings;
    var i;
    if (!o || !o.parentNode) {
      return result;
    }
    siblings = o.parentNode.children;
    for (i = 0; i < siblings.length; i++) {
      if (siblings[i] !== o) {
        result.push(siblings[i]);
      }
    }
    return result;
  }

  /**
   * 前面的全部兄弟元素
   * @param {HTMLElement} o
   * @returns {Array} 自身前面的同级元素组成的新数组；是第一个子元素或无父节点时返回 []
   * @example
   * // <div><p></p><span></span><a></a></div>
   * getAllPrevElement(a)
   * // [<p>, <span>]
   */
  function getAllPrevElement(o) {
    var arr = [];
    var parent;
    var i;
    if (!o || !o.parentNode) {
      return arr;
    }
    parent = o.parentNode;
    for (i = 0; i < parent.children.length; i++) {
      if (parent.children[i] === o) {
        break;
      }
      arr.push(parent.children[i]);
    }
    return arr;
  }

  /**
   * 后面的全部兄弟元素
   * @param {HTMLElement} o
   * @param {String} classOrTagName 可选，类名或标签名
   * @returns {Array} 自身后面的同级元素组成的新数组；无匹配、是最后一个子元素或无父节点时返回 []
   * @example
   * // <div><p></p><span class="item"></span><a class="item"></a></div>
   * getAllNextElement(p, 'item')
   * // [<span class="item">, <a class="item">]
   */
  function getAllNextElement(o, classOrTagName) {
    var arr = [];
    var parent;
    var i;
    var index = -1;
    var child;
    if (!o || !o.parentNode) {
      return arr;
    }
    parent = o.parentNode;
    for (i = 0; i < parent.children.length; i++) {
      child = parent.children[i];
      if (child === o) {
        index = i;
        continue;
      }
      if (index !== -1 && i > index) {
        if (typeof classOrTagName === 'undefined' || internalMatchNode(child, classOrTagName)) {
          arr.push(child);
        }
      }
    }
    return arr;
  }

  /**
   * 读取节点内部 HTML（innerHTML）
   * @param {HTMLElement|String|NodeList} el 元素、选择器或节点集合
   * @returns {String} 元素 innerHTML；取不到元素时返回空串
   * @example
   * getHtml('#box')
   * // '<p>内容</p>'
   * getHtml('#missing')
   * // ''
   */
  function getHtml(el) {
    var node = internalResolveElement(el);
    return node ? node.innerHTML : '';
  }

  /**
   * 写入节点内部 HTML
   * @param {HTMLElement|String|NodeList} el 元素、选择器或节点集合
   * @param {String} str HTML 字符串，传 null / undefined 视为空串
   * @returns {HTMLElement|null} 被写入的元素；取不到元素时返回 null，且不执行写入
   * @example
   * setHtml('#box', '<p>新内容</p>')
   * // 返回 #box，页面内容变为 <p>新内容</p>
   * setHtml('#missing', 'x')
   * // null
   */
  function setHtml(el, str) {
    var node = internalResolveElement(el);
    if (!node) {
      return null;
    }
    node.innerHTML = str == null ? '' : String(str);
    return node;
  }

  /**
   * 读取带表单当前值的 HTML
   *
   * 解决的问题：innerHTML 只反映标签上的初始属性；用户在 input / textarea /
   * radio / checkbox / option 上输入、勾选、选择后，改变的是运行时状态，
   * 直接读 innerHTML 拿到的是旧值。本函数先把运行时状态同步回标签属性，再读 innerHTML。
   *
   * 处理范围：input、button、textarea、radio、checkbox、option；
   *          不处理 contenteditable。
   * 注意：会改写目标节点内部控件的 value / checked / selected 属性；
   *      返回内容包含用户输入，重新插入页面前需自行保证内容可信，存在 XSS 风险。
   *
   * @param {HTMLElement|String|NodeList} el 容器元素、选择器或节点集合
   * @returns {String} 同步后的 innerHTML；取不到元素时返回空串；元素不支持 querySelectorAll 时直接返回原 innerHTML
   * @example
   * // <div id="form"><input value="旧值"><textarea>旧文本</textarea></div>
   * // 用户输入后：
   * getCurrentFormHtml('#form')
   * // '<input value="新值"><textarea>新文本</textarea>'
   * getCurrentFormHtml('#missing')
   * // ''
   */
  function getCurrentFormHtml(el) {
    var node = internalResolveElement(el);
    var inputs;
    var textareas;
    var choices;
    var options;
    var i;

    if (!node) {
      return '';
    }
    if (!node.querySelectorAll) {
      return node.innerHTML;
    }

    inputs = node.querySelectorAll('input, button');
    for (i = 0; i < inputs.length; i++) {
      var type = (inputs[i].getAttribute('type') || 'text').toLowerCase();
      // radio / checkbox 的 value 由属性直接反射，checked 单独处理；
      // file 的 value 受安全限制无法写回属性，这三类跳过 value 同步
      if (type === 'radio' || type === 'checkbox' || type === 'file') {
        continue;
      }
      inputs[i].setAttribute('value', inputs[i].value);
    }

    textareas = node.querySelectorAll('textarea');
    for (i = 0; i < textareas.length; i++) {
      if (typeof textareas[i].textContent !== 'undefined') {
        textareas[i].textContent = textareas[i].value;
      } else {
        textareas[i].innerText = textareas[i].value;
      }
    }

    choices = node.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    for (i = 0; i < choices.length; i++) {
      if (choices[i].checked) {
        choices[i].setAttribute('checked', 'checked');
      } else {
        choices[i].removeAttribute('checked');
      }
    }

    options = node.querySelectorAll('option');
    for (i = 0; i < options.length; i++) {
      if (options[i].selected) {
        options[i].setAttribute('selected', 'selected');
      } else {
        options[i].removeAttribute('selected');
      }
    }

    return node.innerHTML;
  }

  /**
   * 往容器末尾插入 HTML 字符串
   * @param {String} str HTML 字符串
   * @param {HTMLElement} el 容器
   * @returns {void} 无返回值，直接向容器追加节点
   * @example
   * appendHtml('<p>新内容</p>', document.querySelector('.box'))
   * // .box 末尾新增一个 <p>
   */
  function appendHtml(str, el) {
    var divTemp = document.createElement('div');
    var nodes;
    var fragment = document.createDocumentFragment();
    var i;
    divTemp.innerHTML = str;
    nodes = divTemp.childNodes;
    for (i = 0; i < nodes.length; i++) {
      fragment.appendChild(nodes[i].cloneNode(true));
    }
    el.appendChild(fragment);
    divTemp = null;
  }

  /**
   * 往容器最前面插入 HTML 字符串
   * @param {String} str HTML 字符串
   * @param {HTMLElement} el 容器
   * @returns {void} 无返回值，直接向容器最前面插入节点
   * @example
   * prependHtml('<p>新内容</p>', document.querySelector('.box'))
   * // .box 第一个子节点变为新插入的 <p>
   */
  function prependHtml(str, el) {
    var divTemp = document.createElement('div');
    var nodes;
    var fragment = document.createDocumentFragment();
    var i;
    divTemp.innerHTML = str;
    nodes = divTemp.childNodes;
    for (i = 0; i < nodes.length; i++) {
      fragment.appendChild(nodes[i].cloneNode(true));
    }
    el.insertBefore(fragment, el.firstChild);
    divTemp = null;
  }

  /**
   * 追加子节点：定位最后一个普通子节点，插到它后面
   *
   * 会跳过尾部连续的 script / style / .controls，但如果这些节点后面还有普通子节点，
   * 就以最后一个普通子节点为准，新节点会排到这些特殊节点之后。
   *
   * @param {HTMLElement} childNode 子节点
   * @param {HTMLElement} fatherNode 父节点
   * @returns {void} 无返回值，直接移动/插入节点；父节点没有普通子节点时直接 append 到末尾
   * @example
   * // <div class="box"><p></p><script></script></div>
   * appendChild(document.createElement('span'), document.querySelector('.box'))
   * // 新 <span> 插在 <p> 后面、<script> 前面
   */
  function appendChild(childNode, fatherNode) {
    var childrenNode = fatherNode.children;
    var i;
    var target = null;
    for (i = childrenNode.length - 1; i >= 0; i--) {
      if (childrenNode[i].tagName === 'STYLE' ||
        childrenNode[i].tagName === 'SCRIPT' ||
        childrenNode[i].className === 'controls') {
        continue;
      }
      target = childrenNode[i];
      break;
    }
    if (target) {
      insertAfter(childNode, target);
    } else {
      fatherNode.appendChild(childNode);
    }
  }

  /**
   * 插入子节点到容器最前面，跳过 script / style
   * @param {HTMLElement} childNode 子节点
   * @param {HTMLElement} fatherNode 父节点
   * @returns {void} 无返回值，直接移动/插入节点；容器只有 script/style 或为空时 append 到末尾
   * @example
   * prependChild(document.createElement('p'), document.querySelector('.box'))
   * // 新 <p> 插在 .box 内第一个普通子节点之前
   */
  function prependChild(childNode, fatherNode) {
    var childrenNode = fatherNode.children;
    var i;
    var inserted = false;
    for (i = 0; i < childrenNode.length; i++) {
      if (childrenNode[i].tagName === 'STYLE' || childrenNode[i].tagName === 'SCRIPT') {
        continue;
      }
      fatherNode.insertBefore(childNode, childrenNode[i]);
      inserted = true;
      break;
    }
    if (!inserted) {
      fatherNode.appendChild(childNode);
    }
  }

  /**
   * 在已有节点后面插入新节点
   * @param {HTMLElement} newNode 新节点
   * @param {HTMLElement} existingNode 已有节点
   * @returns {void} 无返回值，直接插入节点；已有节点是父节点最后一个元素时直接 append
   * @example
   * insertAfter(document.createElement('p'), document.querySelector('.item'))
   * // 新 <p> 出现在 .item 后面
   */
  function insertAfter(newNode, existingNode) {
    var parent = existingNode.parentNode;
    var lastNode = parent.lastElementChild || parent.lastChild;
    var siblingNode = existingNode.nextElementSibling || existingNode.nextSibling;
    if (lastNode === existingNode) {
      parent.appendChild(newNode);
    } else {
      parent.insertBefore(newNode, siblingNode);
    }
  }

  /**
   * 移除节点
   * @param {HTMLElement} node
   * @returns {void} 无返回值；节点为空或已没有父节点时不做任何事
   * @example
   * removeNode(document.querySelector('.item'))
   * // .item 从页面移除
   */
  function removeNode(node) {
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }

  /**
   * 取元素的计算样式
   * @param {HTMLElement} o
   * @returns {CSSStyleDeclaration|Object} 现代浏览器返回 getComputedStyle 结果；旧 IE 返回 currentStyle
   * @example
   * getElementStyle(document.querySelector('.box')).width
   * // '200px'
   */
  function getElementStyle(o) {
    if (window.getComputedStyle) {
      return window.getComputedStyle(o, null);
    }
    return o.currentStyle;
  }

  /**
   * 元素到文档顶部的距离（含祖先 offsetTop 与 html 的 margin-top）
   * @param {HTMLElement} o
   * @returns {Number} 相对文档顶部的像素值，包含逐级 offsetParent 的 offsetTop 与 html 的 margin-top
   * @example
   * getElementTop(document.querySelector('.box'))
   * // 120
   */
  function getElementTop(o) {
    var actualTop = o.offsetTop;
    var current = o.offsetParent;
    var docStyle;
    var docMarTop;
    while (current !== null) {
      actualTop += current.offsetTop;
      current = current.offsetParent;
    }
    docStyle = getElementStyle(document.documentElement);
    docMarTop = parseInt(String(docStyle.marginTop).replace(/px/g, ''), 10);
    if (!isNaN(docMarTop)) {
      actualTop += docMarTop;
    }
    return actualTop;
  }

  /**
   * 元素到文档左侧的距离（含祖先 offsetLeft 与页面居中补偿）
   * @param {HTMLElement} o
   * @returns {Number} 相对文档左侧的像素值；页面宽度大于文档宽度时补上居中偏移
   * @example
   * getElementLeft(document.querySelector('.box'))
   * // 80
   */
  function getElementLeft(o) {
    var actualLeft = o.offsetLeft;
    var current = o.offsetParent;
    var winW;
    var docStyle;
    var docW;
    while (current !== null) {
      actualLeft += current.offsetLeft;
      current = current.offsetParent;
    }
    winW = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    docStyle = getElementStyle(document.documentElement);
    docW = parseFloat(String(docStyle.width).replace(/px/g, ''));
    if (isNaN(docW) || docW <= 0) {
      return actualLeft;
    }
    if (winW === docW || document.documentElement.clientWidth === docW || document.body.clientWidth === docW) {
      return actualLeft;
    }
    return actualLeft + Math.ceil((winW - docW) / 2);
  }

  /**
   * 元素宽度（隐藏元素用 clientWidth + padding + border 兜底）
   * @param {HTMLElement} o
   * @returns {Number} 元素像素宽度；元素为空或无法测量时返回 0
   * @example
   * getElementWidth(document.querySelector('.box'))
   * // 200
   * getElementWidth(null)
   * // 0
   */
  function getElementWidth(o) {
    var styles;
    var w;
    var paddingLeft;
    var paddingRight;
    var borderLeft;
    var borderRight;
    if (!o) {
      return 0;
    }
    styles = getElementStyle(o);
    w = o.offsetWidth;
    paddingLeft = parseFloat(styles.paddingLeft);
    paddingRight = parseFloat(styles.paddingRight);
    borderLeft = parseFloat(styles.borderLeftWidth);
    borderRight = parseFloat(styles.borderRightWidth);
    if (w === 0 && !isNaN(paddingLeft) && !isNaN(paddingRight) && !isNaN(borderLeft) && !isNaN(borderRight)) {
      w = o.clientWidth;
      w += isNaN(paddingLeft) ? 0 : paddingLeft;
      w += isNaN(paddingRight) ? 0 : paddingRight;
      w += isNaN(borderLeft) ? 0 : borderLeft;
      w += isNaN(borderRight) ? 0 : borderRight;
    }
    return w;
  }

  /**
   * 元素高度（隐藏元素用 clientHeight + padding + border 兜底）
   * @param {HTMLElement} o
   * @returns {Number} 元素像素高度；元素为空或无法测量时返回 0
   * @example
   * getElementHeight(document.querySelector('.box'))
   * // 80
   * getElementHeight(null)
   * // 0
   */
  function getElementHeight(o) {
    var styles;
    var h;
    var paddingTop;
    var paddingBottom;
    var borderTop;
    var borderBottom;
    if (!o) {
      return 0;
    }
    styles = getElementStyle(o);
    h = o.offsetHeight;
    paddingTop = parseFloat(styles.paddingTop);
    paddingBottom = parseFloat(styles.paddingBottom);
    borderTop = parseFloat(styles.borderTopWidth);
    borderBottom = parseFloat(styles.borderBottomWidth);
    if (h === 0 && !isNaN(paddingTop) && !isNaN(paddingBottom) && !isNaN(borderTop) && !isNaN(borderBottom)) {
      h = o.clientHeight;
      h += isNaN(paddingTop) ? 0 : paddingTop;
      h += isNaN(paddingBottom) ? 0 : paddingBottom;
      h += isNaN(borderTop) ? 0 : borderTop;
      h += isNaN(borderBottom) ? 0 : borderBottom;
    }
    return h;
  }

  /**
   * 浏览器滚动条宽度
   * @returns {Number} 滚动条占用的像素宽度，一般为 15~21；用覆盖式滚动条或没有 body 时返回 0
   * @example
   * getScrollbarWidth()
   * // 17
   */
  function getScrollbarWidth() {
    var outer;
    var inner;
    var width;
    if (!document.body) {
      return 0;
    }
    outer = document.createElement('div');
    inner = document.createElement('div');
    outer.style.position = 'absolute';
    outer.style.top = '-1000px';
    outer.style.left = '-1000px';
    outer.style.width = '100px';
    outer.style.height = '100px';
    outer.style.overflow = 'auto';
    inner.style.width = '100%';
    inner.style.height = '200px';
    outer.appendChild(inner);
    document.body.appendChild(outer);
    width = outer.offsetWidth - outer.clientWidth;
    document.body.removeChild(outer);
    return width;
  }

  /**
   * 滚动到指定位置，完成后回调
   *
   * window 场景使用原生 window.scrollTo(left, top)，不传 behavior；
   * 元素场景优先用 element.scrollTo({ top, left, behavior })，不支持时退回直接赋值。
   * 回调在滚动位置与目标相差 1px 以内时触发；已在目标位置则同步触发。
   *
   * @param {Object} options
   * @param {HTMLElement|Window} options.element 滚动容器，默认 window
   * @param {Number} options.top 目标纵向位置，默认 0
   * @param {Number} options.left 目标横向位置，默认 0
   * @param {String} options.behavior auto（默认）/ smooth（仅元素场景且浏览器支持时生效）
   * @param {Function} options.callback 滚动结束回调
   * @returns {void} 无返回值，只执行滚动并可选触发回调
   * @example
   * elementScrollTo({
   *   element: document.querySelector('.list'),
   *   top: 100,
   *   behavior: 'smooth',
   *   callback: function () { console.log('滚动结束'); }
   * });
   */
  function elementScrollTo(options) {
    var opt = options || {};
    var element = opt.element || window;
    var top = typeof opt.top === 'number' ? opt.top : 0;
    var left = typeof opt.left === 'number' ? opt.left : 0;
    var behavior = opt.behavior || 'auto';
    var callback = opt.callback;
    var isWindow = element === window;
    var running;

    function currentTop() {
      return isWindow ? (window.pageYOffset || document.documentElement.scrollTop || 0) : element.scrollTop;
    }

    function done() {
      if (typeof callback === 'function') {
        callback();
      }
    }

    if (isWindow) {
      window.scrollTo(left, top);
    } else if (typeof element.scrollTo === 'function') {
      try {
        element.scrollTo({ top: top, left: left, behavior: behavior });
      } catch (e) {
        element.scrollTop = top;
        element.scrollLeft = left;
      }
    } else {
      element.scrollTop = top;
      element.scrollLeft = left;
    }
    if (typeof callback !== 'function') {
      return;
    }
    if (Math.abs(currentTop() - top) <= 1) {
      done();
      return;
    }
    running = function () {
      if (Math.abs(currentTop() - top) <= 1) {
        if (element.removeEventListener) {
          element.removeEventListener('scroll', running, false);
        } else if (element.detachEvent) {
          element.detachEvent('onscroll', running);
        }
        done();
      }
    };
    if (element.addEventListener) {
      element.addEventListener('scroll', running, false);
    } else if (element.attachEvent) {
      element.attachEvent('onscroll', running);
    }
  }

  /**
   * 兼容 IE8- 的事件绑定
   * @param {HTMLElement|Window} ele 绑定对象
   * @param {String} event 事件名
   * @param {Function} fn 回调
   * @returns {void} 无返回值；现代浏览器用 addEventListener，旧 IE 用 attachEvent 并把 this 绑回 ele
   * @example
   * addEventListener(document.querySelector('.btn'), 'click', function () {
   *   console.log('clicked');
   * });
   */
  function addEventListener(ele, event, fn) {
    if (ele.addEventListener) {
      ele.addEventListener(event, fn, false);
    } else if (ele.attachEvent) {
      ele.attachEvent('on' + event, internalBind(fn, ele));
    }
  }

  /**
   * textarea 随内容自动增高
   * @param {HTMLElement|String|NodeList} el 元素、选择器或节点集合
   * @param {Object} opt 可选
   * @param {Number} opt.initHeight 初始高度，默认 28
   * @param {Number} opt.maxHeight 最大高度，默认 120；传 0 或负数表示不限制
   * @returns {void} 无返回值；找不到元素时不做任何事，找到后会立即设置一次高度并监听 input / 删除键 / 剪切
   * @example
   * makeTextareaExpanding('#remark', { initHeight: 32, maxHeight: 160 })
   * // textarea 初始 32px，随输入增高，最高 160px，超过后出现纵向滚动条
   */
  function makeTextareaExpanding(el, opt) {
    var target = internalResolveElement(el);
    var option = opt || {};
    var initHeight = typeof option.initHeight === 'undefined' ? 28 : parseInt(option.initHeight, 10);
    var maxHeight = typeof option.maxHeight === 'undefined' ? 120 : parseInt(option.maxHeight, 10);
    var delayedResize;
    var setStyle;

    if (!target) {
      return;
    }
    if (isNaN(initHeight)) {
      initHeight = 28;
    }
    if (isNaN(maxHeight)) {
      maxHeight = 120;
    }
    setStyle = function () {
      var height = target.scrollHeight;
      if (height < initHeight) {
        height = initHeight;
      }
      if (maxHeight > 0 && height > maxHeight) {
        height = maxHeight;
        target.style.overflowY = 'auto';
      } else {
        target.style.overflowY = 'hidden';
      }
      target.style.height = height + 'px';
      target.style.maxHeight = maxHeight > 0 ? maxHeight + 'px' : 'none';
    };
    delayedResize = function () {
      window.setTimeout(setStyle, 0);
    };
    if (target.addEventListener) {
      target.addEventListener('input', setStyle, false);
    } else if (target.attachEvent) {
      target.attachEvent('onpropertychange', setStyle);
    }
    if (target.addEventListener) {
      target.addEventListener('keydown', function () {
        var key = window.event ? window.event.keyCode : 0;
        if (key === 8 || key === 46) {
          delayedResize();
        }
      }, false);
      target.addEventListener('cut', delayedResize, false);
    } else if (target.attachEvent) {
      target.attachEvent('onkeydown', function () {
        var key = window.event ? window.event.keyCode : 0;
        if (key === 8 || key === 46) {
          delayedResize();
        }
      });
      target.attachEvent('oncut', delayedResize);
    }
    setStyle();
  }

  /**
   * 阅读更多：先截断内容，点“阅读全文”后还原
   * 注意：只处理纯文本长度，不切断标签
   * @param {HTMLElement|String|NodeList} psSelector 容器
   * @param {Number} psLength 默认显示的字符数，默认 600
   * @param {String} psMoreText 按钮文字，默认“阅读全文”
   * @returns {void} 无返回值；找不到容器或内容长度未超过限制时不做任何事，否则改写容器内容并在其后插入按钮
   * @example
   * readMore('#article', 300, '展开全文')
   * // 正文只显示前 300 个可见字符并追加“ ......”，后面出现“展开全文”按钮；点击后恢复原文并移除按钮
   */
  function readMore(psSelector, psLength, psMoreText) {
    var node = internalResolveElement(psSelector);
    var limit = typeof psLength === 'undefined' ? 600 : parseInt(psLength, 10);
    var moreText = typeof psMoreText === 'undefined' ? '阅读全文' : psMoreText;
    var html;
    var inTag = false;
    var count = 0;
    var cut = 0;
    var i;
    var ch;
    var wrap;
    var btn;

    if (!node) {
      return;
    }
    html = node.innerHTML;
    if (typeof limit !== 'number' || isNaN(limit)) {
      limit = 600;
    }
    for (i = 0; i < html.length && count < limit; i++) {
      ch = html.charAt(i);
      if (ch === '<') {
        inTag = true;
      } else if (ch === '>' && inTag) {
        inTag = false;
      } else if (!inTag) {
        count++;
      }
      cut = i + 1;
    }
    if (html.length <= cut) {
      return;
    }
    node.innerHTML = html.substring(0, cut) + ' ......';

    wrap = document.createElement('div');
    wrap.className = 'bodymore';
    wrap.style.margin = '15px auto';
    wrap.style.textAlign = 'center';

    btn = document.createElement('span');
    btn.className = 'bodymore-btn';
    btn.style.display = 'inline-block';
    btn.style.padding = '10px 35px';
    btn.style.backgroundColor = '#ece7e7';
    btn.style.color = '#695e5e';
    btn.style.textAlign = 'center';
    btn.style.fontSize = '13px';
    btn.style.cursor = 'pointer';
    btn.innerHTML = moreText;
    wrap.appendChild(btn);
    insertAfter(wrap, node);

    addEventListener(btn, 'click', function () {
      node.innerHTML = html;
      removeNode(wrap);
    });
  }

  /**
   * 把选择器 / NodeList / 类数组集合统一成 DOM 元素
   * @param {HTMLElement|String|NodeList} o
   * @returns {HTMLElement|null} 解析到的第一个元素；传入 null、空集合或匹配不到时返回 null
   * @example
   * anyToDomObject('.item')
   * // 第一个 .item 元素
   * anyToDomObject(document.querySelectorAll('.item'))
   * // 第一个 .item 元素
   * anyToDomObject('#missing')
   * // null
   */
  function anyToDomObject(o) {
    return internalResolveElement(o);
  }

  var dom = /*#__PURE__*/Object.freeze({
    __proto__: null,
    getDataset: getDataset,
    addClass: addClass,
    removeClass: removeClass,
    getChildElement: getChildElement,
    getChildrenElement: getChildrenElement,
    getFirstChildElement: getFirstChildElement,
    getLastChildElement: getLastChildElement,
    getNextElement: getNextElement,
    getPrevElement: getPrevElement,
    getAllSiblingElement: getAllSiblingElement,
    getAllPrevElement: getAllPrevElement,
    getAllNextElement: getAllNextElement,
    getHtml: getHtml,
    setHtml: setHtml,
    getCurrentFormHtml: getCurrentFormHtml,
    appendHtml: appendHtml,
    prependHtml: prependHtml,
    appendChild: appendChild,
    prependChild: prependChild,
    insertAfter: insertAfter,
    removeNode: removeNode,
    getElementStyle: getElementStyle,
    getElementTop: getElementTop,
    getElementLeft: getElementLeft,
    getElementWidth: getElementWidth,
    getElementHeight: getElementHeight,
    getScrollbarWidth: getScrollbarWidth,
    elementScrollTo: elementScrollTo,
    addEventListener: addEventListener,
    makeTextareaExpanding: makeTextareaExpanding,
    readMore: readMore,
    anyToDomObject: anyToDomObject
  });

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
  function internalTrim$1(str) {
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
  function getUrlParams(psKey, psUrl) {
    var url = (typeof psUrl === 'undefined' || internalTrim$1(psUrl) === '')
      ? location.search
      : psUrl.replace(/(.*?)\?(.*?)$/, '?$2');
    var pairs = url.replace(/^\?/, '').split('&');
    var paramsObj = {};
    var i;
    var param;
    for (i = 0; i < pairs.length; i++) {
      param = pairs[i].split('=');
      if (internalTrim$1(param[0]) !== '') {
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
  function getUrlQueryString(psUrl) {
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
  function htmlEncode(psStr) {
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
  function htmlDecode(psStr) {
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
  function escapeSpecialChars(str, needUrlEncode) {
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
  function unescapeSpecialChars(str, needUrlDecode) {
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
  function html(psStr, options) {
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
  function dangerousChars(psStr, psMethod) {
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
  function charCode(psStr, psOpts) {
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
  function notNumericChar(psStr) {
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
  function repeatedChar(psStr, psChar) {
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
  function blankSpace(psStr, psMethod) {
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
  function lastDotChar(psStr) {
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
  function onlyInterval(str) {
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
  function negativeInterval(str) {
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
  function onlyFloat(str) {
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
  function negativeFloat(str) {
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
  function numericalOnBlur(psStr) {
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
  function hourMinute(str) {
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

  var string = /*#__PURE__*/Object.freeze({
    __proto__: null,
    getUrlParams: getUrlParams,
    getUrlQueryString: getUrlQueryString,
    htmlEncode: htmlEncode,
    htmlDecode: htmlDecode,
    escapeSpecialChars: escapeSpecialChars,
    unescapeSpecialChars: unescapeSpecialChars,
    html: html,
    dangerousChars: dangerousChars,
    charCode: charCode,
    notNumericChar: notNumericChar,
    repeatedChar: repeatedChar,
    blankSpace: blankSpace,
    lastDotChar: lastDotChar,
    onlyInterval: onlyInterval,
    negativeInterval: negativeInterval,
    onlyFloat: onlyFloat,
    negativeFloat: negativeFloat,
    numericalOnBlur: numericalOnBlur,
    hourMinute: hourMinute
  });

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
  function checkHasDangerousChars(psStr, psOpts) {
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
  function checkIsDomObject(psObj) {
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
  function checkJsonHasData(psSource) {
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
  function checkIsJsonObject(psObj) {
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
  function checkIsJsonString(str) {
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
  function checkTel(str, options) {
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
  function checkEmail(email) {
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
  function checkIsMobile() {
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
  function checkIsApple() {
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
  function checkIsImage(str) {
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
  function checkIsNumeric(psStr) {
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
  function checkIsNumerType(psStr) {
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
  function checkIsDecimal(psStr) {
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
  function checkIsInteger(psStr) {
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
  function checkBrowserType() {
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
  function checkIsIE() {
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
  function checkIEVersion() {
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
  function checkNetWorkOnline() {
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
  function checkIsHourMinute(psStr) {
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
  function checkIsHourMinuteSecond(psStr) {
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
  function getNetworkType() {
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

  var validate = /*#__PURE__*/Object.freeze({
    __proto__: null,
    checkHasDangerousChars: checkHasDangerousChars,
    checkIsDomObject: checkIsDomObject,
    checkJsonHasData: checkJsonHasData,
    checkIsJsonObject: checkIsJsonObject,
    checkIsJsonString: checkIsJsonString,
    checkTel: checkTel,
    checkEmail: checkEmail,
    checkIsMobile: checkIsMobile,
    checkIsApple: checkIsApple,
    checkIsImage: checkIsImage,
    checkIsNumeric: checkIsNumeric,
    checkIsNumerType: checkIsNumerType,
    checkIsDecimal: checkIsDecimal,
    checkIsInteger: checkIsInteger,
    checkBrowserType: checkBrowserType,
    checkIsIE: checkIsIE,
    checkIEVersion: checkIEVersion,
    checkNetWorkOnline: checkNetWorkOnline,
    checkIsHourMinute: checkIsHourMinute,
    checkIsHourMinuteSecond: checkIsHourMinuteSecond,
    getNetworkType: getNetworkType
  });

  /**
   * @File    array.js
   * @Desc    MelUI Util 工具层：数组去重 / 排序 / 重复检测 / 相邻分组
   * @Version 0.1.2
   * @Date    2026-11-17
   * @PubDate 2026-11-20 15:20:00
   * @Author  ChenMufeng
   *
   * 【实现约定】排序类函数在副本上执行，不修改调用方数组；
   *            不使用 IE 不支持的 Array.prototype.includes。
   * 【对外形态】melui.util.array.xxx
   * ──────────────────────────────────────────────────────
   */

  /**
   * 数组去重（保持首次出现的顺序）
   * @param {Array} psArr 原数组
   * @returns {Array} 去重后的新数组；非数组返回 []；对象按引用比较，NaN 不会被去掉
   * @example
   * uniqueArray([1, 2, 2, 3, 1]) // [1, 2, 3]
   * uniqueArray(['a', 'a', 'b']) // ['a', 'b']
   * uniqueArray('abc')           // []
   */
  function uniqueArray(psArr) {
    if (!isArray(psArr)) {
      return [];
    }
    return psArr.filter(function (element, index, self) {
      return self.indexOf(element) === index;
    });
  }

  /**
   * 快速排序（升序），不修改入参数组
   * @param {Array} arr 原数组
   * @returns {Array} 排序后的新数组；非数组返回 []，空数组或单元素数组返回副本
   * @example
   * quickSort([3, 1, 2]) // [1, 2, 3]
   * quickSort([3, 1, 2]).length // 3
   * quickSort(null) // []
   */
  function quickSort(arr) {
    if (!isArray(arr) || arr.length <= 1) {
      return isArray(arr) ? arr.slice(0) : [];
    }
    var list = arr.slice(0);
    var index = Math.floor(list.length / 2);
    var pivot = list.splice(index, 1)[0];
    var left = [];
    var right = [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] < pivot) {
        left.push(list[i]);
      } else {
        right.push(list[i]);
      }
    }
    return quickSort(left).concat(pivot, quickSort(right));
  }

  /**
   * 冒泡排序（升序），不修改入参数组
   * @param {Array} arr 原数组
   * @returns {Array} 排序后的新数组；非数组返回 []
   * @example
   * bubbleSort([3, 1, 2]) // [1, 2, 3]
   * bubbleSort('abc')     // []
   */
  function bubbleSort(arr) {
    var list = isArray(arr) ? arr.slice(0) : [];
    var len = list.length;
    var i;
    var j;
    var temp;
    for (i = 0; i < len - 1; i++) {
      for (j = 0; j < len - 1 - i; j++) {
        if (list[j] > list[j + 1]) {
          temp = list[j];
          list[j] = list[j + 1];
          list[j + 1] = temp;
        }
      }
    }
    return list;
  }

  /**
   * 数组排序
   * @param {Array} arr 原数组
   * @param {String} method asc 升序（默认）/ desc 降序
   * @returns {Array} 排序后的新数组；非数组返回 []；method 不是 desc 时按升序处理
   * @example
   * arraySort([3, 1, 2])          // [1, 2, 3]
   * arraySort([3, 1, 2], 'desc')  // [3, 2, 1]
   * arraySort(null)               // []
   */
  function arraySort(arr, method) {
    var sorted = quickSort(arr);
    if (method === 'desc') {
      return sorted.reverse();
    }
    return sorted;
  }

  /**
   * 自定义 key 集合，替代 Object.keys（IE9 无 Object.keys）
   * @param {Object} obj 目标对象
   * @returns {Array} 自有可枚举属性名组成的新数组；null、非对象、无属性时返回 []
   * @example
   * getOwnKeys({ a: 1, b: 2 }) // ['a', 'b']
   * getOwnKeys([10, 20])       // ['0', '1']（数组返回下标字符串）
   * getOwnKeys(null)           // []
   */
  function getOwnKeys(obj) {
    var keyList = [];
    var prop;
    if (!obj || typeof obj !== 'object') {
      return keyList;
    }
    for (prop in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        keyList.push(prop);
      }
    }
    return keyList;
  }

  /**
   * 深度对比两个值是否相等
   * - 严格相等直接通过
   * - 数组逐项递归、普通对象逐键递归
   * - NaN 与 NaN 视为相等
   * @param {*} a 值 a
   * @param {*} b 值 b
   * @returns {Boolean} true 表示结构相等；日期、正则、函数等非普通对象只按引用比较；循环引用会递归溢出
   * @example
   * isValueEqual([1, { a: 2 }], [1, { a: 2 }]) // true
   * isValueEqual(NaN, NaN)                    // true
   * isValueEqual({ a: 1 }, { a: 2 })          // false
   * isValueEqual(new Date(0), new Date(0))    // false（不是普通对象分支）
   */
  function isValueEqual(a, b) {
    if (a === b) {
      return true;
    }
    var typeA = Object.prototype.toString.call(a);
    var typeB = Object.prototype.toString.call(b);
    var i;
    var keysA;
    var keysB;
    var key;
    if (typeA !== typeB) {
      return false;
    }
    if (typeA === '[object Number]' && isNaN(a) && isNaN(b)) {
      return true;
    }
    if (typeA === '[object Array]') {
      if (a.length !== b.length) {
        return false;
      }
      for (i = 0; i < a.length; i++) {
        if (!isValueEqual(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }
    if (typeA === '[object Object]') {
      keysA = getOwnKeys(a);
      keysB = getOwnKeys(b);
      if (keysA.length !== keysB.length) {
        return false;
      }
      for (i = 0; i < keysA.length; i++) {
        key = keysA[i];
        if (!isValueEqual(a[key], b[key])) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  /**
   * 检测数组中是否已存在某个元素
   * @param {Array} arr 目标数组
   * @param {Object} opts 配置
   * @param {String} opts.key 指定对象字段，非空时走字段匹配（严格相等）
   * @param {*} opts.value 字段对应的值
   * @param {*} opts.targetItem 整元素深度比对的内容
   * @returns {Boolean} true 表示找到重复；arr 不是数组、key 为 null 且 targetItem 为 null 时返回 false
   * @example
   * arrayHasDuplicate([{ id: 1 }, { id: 2 }], { key: 'id', value: 2 })
   * // true
   * arrayHasDuplicate([1, 2, 3], { targetItem: 2 })
   * // true
   * arrayHasDuplicate([1, 2], {})
   * // false
   */
  function arrayHasDuplicate(arr, opts) {
    var defaults = {
      key: null,
      value: null,
      targetItem: null
    };
    var finals = mergeObj(defaults, opts);
    var len;
    var i;
    var item;
    if (!isArray(arr)) {
      return false;
    }
    len = arr.length;
    if (finals.key !== null) {
      for (i = 0; i < len; i++) {
        item = arr[i];
        if (item && typeof item === 'object' && item[finals.key] === finals.value) {
          return true;
        }
      }
      return false;
    }
    if (finals.targetItem === null) {
      return false;
    }
    for (i = 0; i < len; i++) {
      if (isValueEqual(arr[i], finals.targetItem)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 把一维数组里相邻元素按固定差值分组成二维数组
   * 例：[1,2,3,4, 9,13,16]（差值 1）→ [[1,2,3,4],[9],[13],[16]]
   * @param {Array} psArr 一维数组
   * @param {Number} psValue 指定的相邻差值，默认 1
   * @returns {Array} 分组后的二维数组；非数组返回 []；单元素数组返回 [[该元素]]
   * @example
   * combineNextElementToArray([1, 2, 3, 4, 9, 13, 16])
   * // [[1, 2, 3, 4], [9], [13], [16]]
   * combineNextElementToArray([1, 3, 5, 9], 2)
   * // [[1, 3, 5], [9]]
   * combineNextElementToArray(null)
   * // []
   */
  function combineNextElementToArray(psArr, psValue) {
    var subValue = typeof psValue === 'undefined' ? 1 : psValue;
    var tmpArr = [];
    var resultArr = [];
    var k = 0;
    var loops = 0;
    var i;
    var j;
    var value1;
    var value2;
    var row;
    if (!isArray(psArr)) {
      return [];
    }
    for (i = 0; i < psArr.length; i++) {
      value1 = psArr[i];
      tmpArr[k] = isArray(tmpArr[k]) ? tmpArr[k] : [];
      j = i + 1;
      if (psArr.length === 1) {
        tmpArr[k].push(value1);
        continue;
      }
      if (j < psArr.length) {
        value2 = psArr[j];
        if (loops === 0 && tmpArr[k].indexOf(value1) === -1) {
          tmpArr[k].push(value1);
        }
        if (value2 - value1 === subValue) {
          tmpArr[k].push(value2);
          loops++;
        } else {
          k++;
          tmpArr[k] = isArray(tmpArr[k]) ? tmpArr[k] : [];
          if (tmpArr[k].indexOf(value2) === -1) {
            tmpArr[k].push(value2);
          }
          loops = 0;
        }
      }
    }
    for (i = 0; i < tmpArr.length; i++) {
      row = tmpArr[i];
      if (row.length !== 0) {
        resultArr.push(row);
      }
    }
    return resultArr;
  }

  var array = /*#__PURE__*/Object.freeze({
    __proto__: null,
    uniqueArray: uniqueArray,
    quickSort: quickSort,
    bubbleSort: bubbleSort,
    arraySort: arraySort,
    getOwnKeys: getOwnKeys,
    isValueEqual: isValueEqual,
    arrayHasDuplicate: arrayHasDuplicate,
    combineNextElementToArray: combineNextElementToArray
  });

  /**
   * @File    random.js
   * @Desc    MelUI Util 工具层：随机数 / 随机字符串 / 随机颜色
   * @Version 0.1.2
   * @Date    2026-11-17
   * @PubDate 2026-11-20 15:25:00
   * @Author  ChenMufeng
   *
   * 【实现约定】只依赖 base/object.js 的 mergeObj；不写全局变量、不弹窗。
   * 【对外形态】melui.util.random.xxx
   * ──────────────────────────────────────────────────────
   */

  /**
   * 生成 [n, m] 区间内的随机整数（含两端）
   * @param {Number} n 最小值
   * @param {Number} m 最大值
   * @returns {Number} 区间内的整数；n 大于 m 时结果不保证落在区间内（函数不做参数校验）
   * @example
   * getRandomMinMaxNumber(1, 10)
   * // 可能返回 1、2 ... 10
   * getRandomMinMaxNumber(5, 5)
   * // 5
   */
  function getRandomMinMaxNumber(n, m) {
    return Math.floor(Math.random() * (m - n + 1) + n);
  }

  /**
   * 生成 n 位纯数字随机串
   * 注：逐位随机，位与位之间可能重复，不做去重
   * @param {Number} n 位数
   * @returns {String} 长度为 n 的数字字符串，可能以 0 开头；n 不是正数时默认 5 位
   * @example
   * getRandomNumber(4) // '0372'（每次不同）
   * getRandomNumber(0) // 5 位数字
   * getRandomNumber()  // 5 位数字
   */
  function getRandomNumber(n) {
    var len = typeof n === 'number' && n > 0 ? Math.floor(n) : 5;
    var result = '';
    var i;
    for (i = 0; i < len; i++) {
      result += String(Math.floor(Math.random() * 10));
    }
    return result;
  }

  /**
   * 生成固定长度随机字符串（数字 + 大小写字母）
   * @param {Number} psLen 长度，默认 8
   * @param {Object} psOpts 可选配置
   * @param {String} psOpts.pureType 空=不限制，number=纯数字，letter=纯字母
   * @param {Boolean} psOpts.upperCase 是否包含大写字母，默认 true
   * @returns {String} 指定长度的随机字符串；长度不是正数时默认 8 位
   * @example
   * getRandomString(8)                         // 8 位数字 + 大小写字母
   * getRandomString(6, { pureType: 'number' }) // 6 位纯数字
   * getRandomString(6, { pureType: 'letter', upperCase: false }) // 6 位纯小写字母
   */
  function getRandomString(psLen, psOpts) {
    var len = typeof psLen === 'number' && psLen > 0 ? Math.floor(psLen) : 8;
    var original = {
      pureType: '',
      upperCase: true
    };
    var config = mergeObj(original, psOpts);
    var upperStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var lowerStr = 'abcdefghijklmnopqrstuvwxyz';
    var numberStr = '0123456789';
    var chars = numberStr + lowerStr;
    var newStr = '';
    var i;
    // pureType 明确指定时，以 pureType 为准：number 只出数字，letter 只出字母
    // pureType 优先，避免调用方还要同时传 upperCase:false 才能拿到干净结果
    if (config.pureType === 'number') {
      chars = numberStr;
    } else if (config.pureType === 'letter') {
      chars = config.upperCase ? lowerStr + upperStr : lowerStr;
    } else if (config.upperCase) {
      chars += upperStr;
    }
    for (i = 0; i < len; i++) {
      newStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return newStr;
  }

  /**
   * 生成随机字符串（字母 + 数字），长度可固定也可在区间内浮动
   * @param {Number} min 最小长度
   * @param {Number} max 最大长度，默认等于 min
   * @param {Boolean} isRandomed 是否随机长度，默认 true
   * @returns {String} 由数字和大小写字母组成的随机串；长度在 [min, max] 内，isRandomed 为 false 时固定 min 位
   * @example
   * getRandomWord(6, 10)          // 6~10 位随机串
   * getRandomWord(6, 10, false)   // 固定 6 位
   * getRandomWord(4)              // 固定 4 位
   */
  function getRandomWord(min, max, isRandomed) {
    var maxLen = typeof max === 'undefined' ? min : max;
    var randomed = typeof isRandomed === 'undefined' ? true : isRandomed !== false;
    var range = min;
    var str = '';
    var arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    var i;
    var pos;
    if (randomed) {
      range = Math.round(Math.random() * (maxLen - min)) + min;
    }
    for (i = 0; i < range; i++) {
      pos = Math.round(Math.random() * (arr.length - 1));
      str += arr[pos];
    }
    return str;
  }

  /**
   * 生成不固定长度的随机串（基于 36 进制随机数）
   * @returns {String} 由 0-9、a-z 组成的随机串，长度不固定；随机值为 0 时可能返回空串
   * @example
   * getRandomChar() // 例如 'k3j9x2'
   * // 长度每次不同，不适合需要固定位数的场景
   */
  function getRandomChar() {
    return Math.random().toString(36).substr(2);
  }

  /* ==================== 随机颜色：内部私有实现 ==================== */

  var HEX_TABLE = '0123456789ABCDEF';

  /** 数值转两位十六进制 */
  function internalToHex(val) {
    var v = Math.round(Math.max(0, Math.min(255, val)));
    return HEX_TABLE.charAt(Math.floor(v / 16)) + HEX_TABLE.charAt(v % 16);
  }

  /** HSL 转 #RRGGBB */
  function internalHsl2Hex(h, s, l) {
    var hh = h / 360;
    var ss = s / 100;
    var ll = l / 100;
    var r;
    var g;
    var b;
    var q;
    var p;

    function hue2rgb(pp, qq, t) {
      var tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return pp + (qq - pp) * 6 * tt;
      if (tt < 1 / 2) return qq;
      if (tt < 2 / 3) return pp + (qq - pp) * (2 / 3 - tt) * 6;
      return pp;
    }

    if (ss === 0) {
      r = ll;
      g = ll;
      b = ll;
    } else {
      q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
      p = 2 * ll - q;
      r = hue2rgb(p, q, hh + 1 / 3);
      g = hue2rgb(p, q, hh);
      b = hue2rgb(p, q, hh - 1 / 3);
    }
    return '#' + internalToHex(r * 255) + internalToHex(g * 255) + internalToHex(b * 255);
  }

  /** #RRGGBB 转 [r, g, b] */
  function internalHex2Rgb(hex) {
    var str = hex.replace('#', '');
    return [
      parseInt(str.substring(0, 2), 16),
      parseInt(str.substring(2, 4), 16),
      parseInt(str.substring(4, 6), 16)
    ];
  }

  /** WCAG 相对亮度 */
  function internalGetLum(r, g, b) {
    function calc(x) {
      var v = x / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * calc(r) + 0.7152 * calc(g) + 0.0722 * calc(b);
  }

  /** 对比度比值 */
  function internalGetContrast(l1, l2) {
    var light = Math.max(l1, l2);
    var dark = Math.min(l1, l2);
    return (light + 0.05) / (dark + 0.05);
  }

  /** 模式 1：纯随机 RGB */
  function internalMode1() {
    var res = '';
    var i;
    for (i = 0; i < 6; i++) {
      res += HEX_TABLE.charAt(Math.floor(Math.random() * 16));
    }
    return '#' + res;
  }

  /** 模式 2：HSL 限定亮度 */
  function internalMode2(cfg) {
    var h = Math.floor(Math.random() * 360);
    var s = 60 + Math.floor(Math.random() * 30);
    var l = cfg.minLight + Math.floor(Math.random() * (cfg.maxLight - cfg.minLight + 1));
    return internalHsl2Hex(h, s, l);
  }

  /** 模式 3：按 WCAG 对比度循环校验 */
  function internalMode3(cfg) {
    var rgbBg = internalHex2Rgb(cfg.bgColor);
    var bgL = internalGetLum(rgbBg[0], rgbBg[1], rgbBg[2]);
    var color;
    var frgb;
    var fL;
    var cr;
    var retryCount = 0;
    var maxRetry = 50;
    do {
      color = internalMode2(cfg);
      frgb = internalHex2Rgb(color);
      fL = internalGetLum(frgb[0], frgb[1], frgb[2]);
      cr = internalGetContrast(bgL, fL);
      retryCount++;
      if (retryCount >= maxRetry) {
        break;
      }
    } while (cr < cfg.minContrast);
    return color;
  }

  /**
   * 生成随机颜色（三种模式）
   * @param {Object} opt 可选配置
   * @param {Number} opt.mode 1 纯随机 / 2 限定亮度 HSL（默认）/ 3 WCAG 对比度校验
   * @param {String} opt.bgColor 背景色，mode 3 使用，默认 #FFFFFF
   * @param {Number} opt.minContrast 最小对比度，默认 4.5
   * @param {Number} opt.minLight 亮度下限 0-100，默认 20
   * @param {Number} opt.maxLight 亮度上限 0-100，默认 55
   * @param {Number} opt.count 1 返回字符串；2 / 3 返回同色系深浅数组；其它大于 1 的值在 mode 2/3 下返回 []
   * @returns {String|Array} #RRGGBB 字符串，或颜色字符串数组
   * @example
   * getRandomColor()                 // '#7A3B2E'（mode 2，每次不同）
   * getRandomColor({ mode: 1 })      // '#A1B2C3'（纯随机）
   * getRandomColor({ mode: 3, count: 3 }) // ['#...', '#...', '#...']（同色系深浅）
   * getRandomColor({ count: 2 })     // 两个同色系颜色
   */
  function getRandomColor(opt) {
    var defOpt = {
      mode: 2,
      count: 1,
      minLight: 20,
      maxLight: 55,
      bgColor: '#FFFFFF',
      minContrast: 4.5
    };
    var cfg = mergeObj(defOpt, opt);
    var colorList = [];
    var i;
    var baseH;
    var baseS;
    var gap;
    var darkL;
    var midL;
    var lightL;
    var rgbBg;
    var bgLum;
    var cIdx;
    var currHex;
    var currRgb;
    var currLum;
    var currCr;
    var currL;
    var retry;

    if (cfg.count > 1) {
      if (cfg.mode === 1) {
        for (i = 0; i < cfg.count; i++) {
          colorList.push(internalMode1());
        }
        return colorList;
      }
      baseH = Math.floor(Math.random() * 360);
      baseS = 60 + Math.floor(Math.random() * 30);
      gap = 20;
      darkL = Math.max(0, cfg.minLight);
      midL = Math.min(100, darkL + gap);
      lightL = Math.min(100, midL + gap);
      if (cfg.count === 2) {
        colorList.push(internalHsl2Hex(baseH, baseS, darkL));
        colorList.push(internalHsl2Hex(baseH, baseS, lightL));
      } else if (cfg.count === 3) {
        colorList.push(internalHsl2Hex(baseH, baseS, darkL));
        colorList.push(internalHsl2Hex(baseH, baseS, midL));
        colorList.push(internalHsl2Hex(baseH, baseS, lightL));
      }
      if (cfg.mode === 3) {
        rgbBg = internalHex2Rgb(cfg.bgColor);
        bgLum = internalGetLum(rgbBg[0], rgbBg[1], rgbBg[2]);
        for (cIdx = 0; cIdx < colorList.length; cIdx++) {
          currHex = colorList[cIdx];
          retry = 0;
          currRgb = internalHex2Rgb(currHex);
          currLum = internalGetLum(currRgb[0], currRgb[1], currRgb[2]);
          currCr = internalGetContrast(bgLum, currLum);
          currL = [darkL, midL, lightL][cIdx];
          while (currCr < cfg.minContrast && retry < 30) {
            currL = Math.max(0, currL - 6);
            currHex = internalHsl2Hex(baseH, baseS, currL);
            currRgb = internalHex2Rgb(currHex);
            currLum = internalGetLum(currRgb[0], currRgb[1], currRgb[2]);
            currCr = internalGetContrast(bgLum, currLum);
            retry++;
          }
          colorList[cIdx] = currHex;
        }
      }
      return colorList;
    }
    if (cfg.mode === 1) {
      return internalMode1();
    }
    if (cfg.mode === 3) {
      return internalMode3(cfg);
    }
    return internalMode2(cfg);
  }

  var random = /*#__PURE__*/Object.freeze({
    __proto__: null,
    getRandomMinMaxNumber: getRandomMinMaxNumber,
    getRandomNumber: getRandomNumber,
    getRandomString: getRandomString,
    getRandomWord: getRandomWord,
    getRandomChar: getRandomChar,
    getRandomColor: getRandomColor
  });

  /**
   * @File    biz.js
   * @Desc    MelUI Util 工具层：业务辅助（电话提取 / 省市区去重分组）
   * @Version 0.1.2
   * @Date    2026-11-18
   * @PubDate 2026-11-20 15:40:00
   * @Author  ChenMufeng
   *
   * 【提示约定】参数不合法时优先走 melui.alert，组件不存在时退回原生 alert。
   * 【对外形态】melui.util.biz.xxx
   * ──────────────────────────────────────────────────────
   */

  /**
   * 内部：提示信息
   * @param {String} tipText 纯文本提示
   */
  function internalTip(tipText) {
    var meluiNs = typeof window !== 'undefined' ? window.melui : null;
    if (meluiNs && typeof meluiNs.alert === 'function') {
      try {
        meluiNs.alert({ message: tipText });
        return;
      } catch (e) {
        // 组件异常时退回原生提示
      }
    }
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(tipText);
    }
  }

  /**
   * 提取字符串中的电话号码（固话或手机号）
   * @param {String} psStr 待提取字符串
   * @param {Object} options 可选
   * @param {String} options.type first 只取第一处（默认）/ all 取全部
   * @returns {String|Array|null} first 返回号码字符串（去掉空格和横线），没有号码返回 ''；
   *          all 返回匹配到的原始号码数组，没有号码返回 null；type 不是 first/all 时返回 ''
   * @example
   * pickupTel('联系电话：010-12345678，手机 13800138000')
   * // '01012345678'
   * pickupTel('联系电话：010-12345678，手机 13800138000', { type: 'all' })
   * // ['010-12345678', '13800138000']
   * pickupTel('没有电话') // ''
   * pickupTel('没有电话', { type: 'all' }) // null
   */
  function pickupTel(psStr, options) {
    var settings = mergeObj({ type: 'first' }, options);
    var regFirst = /^(.*?)((((0|\+)?86(\s{1})?)?0?\d{2,3}([\-|\s]?))?[\d]{7,8})(.*)/gi;
    var regAll = /(((0|\+)?86(\s{1})?)?0?\d{2,3}([\-|\s]?))?[\d]{7,8}/gi;
    var str = '';
    var arr;
    if (psStr == null) {
      return settings.type === 'all' ? null : '';
    }
    if (regFirst.test(psStr)) {
      str = psStr.toString().replace(regFirst, '$2').replace(/([\-|\s]+)/g, '');
    }
    arr = psStr.match(regAll);
    if (settings.type === 'all') {
      return arr;
    }
    if (settings.type === 'first') {
      return str;
    }
    return '';
  }

  /**
   * 省市区数组去重并分组
   * 输入：[{province, city, county}, ...]
   * 输出：[{province, data:[{city, data:[{county}]}]}]
   * @param {Array} list 原始数组
   * @returns {Array} 按 province → city → county 去重后的分组数组；参数不是数组时提示并返回 []；
   *          空 county 会被忽略，重复 county 只保留一个
   * @example
   * getAreaDistinctGroup([
   *   { province: '广东', city: '广州', county: '天河' },
   *   { province: '广东', city: '广州', county: '天河' },
   *   { province: '广东', city: '深圳', county: '南山' }
   * ])
   * // [{ province:'广东', data:[
   * //   { city:'广州', data:[{ county:'天河' }] },
   * //   { city:'深圳', data:[{ county:'南山' }] }
   * // ]}]
   */
  function getAreaDistinctGroup(list) {
    var result = [];
    var provinceMap = {};
    var i;
    var m;
    var n;
    var item;
    var pName;
    var cName;
    var countyName;
    var provinceNode;
    var currProvince;
    var cityNode;
    var cityMap;
    var tempCity;
    var hasCounty;

    if (Object.prototype.toString.call(list) !== '[object Array]') {
      internalTip('函数：getAreaDistinctGroup() 传入的参数不是数组格式，请检查！');
      return result;
    }
    for (i = 0; i < list.length; i++) {
      item = list[i];
      pName = item.province;
      cName = item.city;
      countyName = item.county;

      if (!provinceMap[pName]) {
        provinceNode = { province: pName, data: [] };
        provinceMap[pName] = provinceNode;
        result.push(provinceNode);
      }
      currProvince = provinceMap[pName];

      cityNode = null;
      cityMap = {};
      for (m = 0; m < currProvince.data.length; m++) {
        tempCity = currProvince.data[m];
        cityMap[tempCity.city] = tempCity;
      }
      if (!cityMap[cName]) {
        cityNode = { city: cName, data: [] };
        currProvince.data.push(cityNode);
      } else {
        cityNode = cityMap[cName];
      }

      hasCounty = false;
      for (n = 0; n < cityNode.data.length; n++) {
        if (cityNode.data[n].county === countyName) {
          hasCounty = true;
          break;
        }
      }
      if (!hasCounty && countyName != null && countyName.toString().replace(/\s+/g, '') !== '') {
        cityNode.data.push({ county: countyName });
      }
    }
    return result;
  }

  var biz = /*#__PURE__*/Object.freeze({
    __proto__: null,
    pickupTel: pickupTel,
    getAreaDistinctGroup: getAreaDistinctGroup
  });

  /**
   * @File    widget.js
   * @Desc    MelUI Util 工具层：网页水印 / 返回顶部
   * @Version 0.1.2
   * @Date    2026-11-18
   * @PubDate 2026-11-20 15:42:00
   * @Author  ChenMufeng
   *
   * 【实现约定】goToTop 的必要样式内联，不依赖 core.css；
   *            重复调用复用已有节点，只绑定一次 scroll / click。
   * 【对外形态】melui.util.widget.waterMarker / melui.util.widget.goToTop
   * ──────────────────────────────────────────────────────
   */

  /**
   * 网页水印
   * @param {Object} options 可选
   * @param {Array} options.element 目标元素选择器数组，默认 ['body']
   * @param {String} options.word 水印文字，默认“水印”
   * @param {Number} options.width 画布宽，默认 250
   * @param {Number} options.height 画布高，默认 250
   * @param {Number} options.rotate 旋转角度，默认 -30
   * @param {String} options.font 字体，默认 16px Helvetica Neue
   * @param {String} options.fillStyle 文字颜色，默认 rgba(17,17,17,.5)
   * @param {String} options.textAlign 水平对齐，默认 left
   * @param {String} options.textBaseline 垂直基线，默认 middle
   * @returns {void} 无返回值；直接修改目标元素的 backgroundImage；canvas 不可用时直接返回
   * @example
   * waterMarker({ element: ['body'], word: '内部资料' })
   * // body 背景出现“内部资料”平铺水印
   * waterMarker({ element: ['.panel'], word: '仅限内部', rotate: -20 })
   * // .panel 背景出现旋转水印
   */
  function waterMarker(options) {
    var settings = mergeObj({
      element: ['body'],
      word: '水印',
      width: 250,
      height: 250,
      rotate: -30,
      font: '16px Helvetica Neue',
      fillStyle: 'rgba(17, 17, 17, .5)',
      textAlign: 'left',
      textBaseline: 'middle'
    }, options);
    var elemArr = settings.element;
    var can = document.createElement('canvas');
    var cans;
    var i;
    var ele;
    var dom;
    var url;

    can.style.display = 'none';
    can.width = settings.width;
    can.height = settings.height;
    cans = can.getContext('2d');
    if (!cans) {
      return;
    }
    cans.rotate(settings.rotate * Math.PI / 180);
    cans.font = settings.font;
    cans.fillStyle = settings.fillStyle;
    cans.textAlign = settings.textAlign;
    cans.textBaseline = settings.textBaseline;
    cans.fillText(settings.word, can.width / 3, can.height / 2);
    url = can.toDataURL('image/png');

    for (i = 0; i < elemArr.length; i++) {
      ele = elemArr[i];
      dom = null;
      if (ele === 'body') {
        dom = document.body;
      } else if (ele.charAt(0) === '#') {
        dom = document.getElementById(ele.substr(1));
      } else if (ele.charAt(0) === '.') {
        dom = document.getElementsByClassName
          ? document.getElementsByClassName(ele.substr(1))[0]
          : null;
      }
      if (dom) {
        dom.style.backgroundImage = 'url(' + url + ')';
      }
    }
  }

  /** 内部：把数值统一成 px 字符串 */
  function internalToPx(val, fallback) {
    if (typeof val === 'number') {
      return val + 'px';
    }
    var str = val == null ? '' : val.toString().replace(/^\s+|\s+$/g, '');
    if (str === '') {
      return fallback;
    }
    if (/^\d+$/.test(str) || /^\d+px$/.test(str)) {
      return str.replace(/px$/, '') + 'px';
    }
    return str;
  }

  /** 内部：滚动到顶部（100ms 线性动画，兼容无 requestAnimationFrame 的环境） */
  function internalScrollToTop(callback) {
    var start = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    var startTime = new Date().getTime();
    var duration = 100;
    function step() {
      var elapsed = new Date().getTime() - startTime;
      var progress = elapsed / duration;
      var top;
      if (progress >= 1) {
        window.scrollTo(0, 0);
        if (typeof callback === 'function') {
          callback();
        }
        return;
      }
      top = Math.floor(start * (1 - progress));
      window.scrollTo(0, top);
      window.setTimeout(step, 10);
    }
    step();
  }

  /**
   * 返回顶部控件
   * @param {Object} options 可选
   * @param {Boolean} options.enable 是否启用，默认 true
   * @param {Number} options.zIndex 层级，默认 2
   * @param {String} options.direction right（默认）/ left
   * @param {String} options.bottom 距底部距离，默认 5%
   * @param {Number} options.opacity 透明度 0~1，默认 0.6
   * @param {String} options.title 文字，默认 TOP
   * @param {Boolean} options.showTitle 是否显示文字，默认 true
   * @param {Number} options.distance 滚动多少距离后显示，默认 200
   * @param {Boolean} options.alwaysShow 是否常显，默认 false
   * @returns {HTMLElement|null} enable 为 false 时返回 null；已存在 .mel-goToTop 时返回已有节点；
   *          否则创建并返回新节点
   * @example
   * goToTop({ bottom: '20px', distance: 300 })
   * // 页面滚动超过 300px 后出现 TOP 按钮，点击回到顶部
   * goToTop({ enable: false })
   * // null（不会创建控件）
   * goToTop()
   * // 已存在控件时返回已有节点，不重复创建
   */
  function goToTop(options) {
    var settings = mergeObj({
      enable: true,
      zIndex: 2,
      direction: 'right',
      bottom: '5%',
      opacity: 0.6,
      title: 'TOP',
      showTitle: true,
      distance: 200,
      alwaysShow: false
    }, options);
    var existing;
    var div;
    var opacity;
    var bottom;
    var distance;
    var showTitle;
    var scrollHandler;

    if (settings.enable === false) {
      return null;
    }
    existing = document.getElementsByClassName('mel-goToTop')[0];
    if (existing) {
      return existing;
    }

    opacity = isNaN(parseFloat(settings.opacity)) ? 0.6 : parseFloat(settings.opacity);
    bottom = internalToPx(settings.bottom, '5%');
    distance = isNaN(parseFloat(String(settings.distance).replace(/px/g, '')))
      ? 200
      : parseFloat(String(settings.distance).replace(/px/g, ''));
    showTitle = settings.showTitle !== false && settings.title.toString().replace(/\s+/g, '') !== '';

    div = document.createElement('div');
    div.className = 'mel-goToTop' + (showTitle ? '' : ' has-no-text');
    div.style.position = 'fixed';
    div.style.zIndex = settings.zIndex;
    div.style.bottom = bottom;
    div.style.opacity = opacity;
    div.style.filter = 'alpha(opacity=' + (opacity * 100) + ')';
    div.style.cursor = 'pointer';
    div.style.padding = '10px 8px';
    div.style.fontSize = '12px';
    div.style.lineHeight = '1.2';
    div.style.textAlign = 'center';
    div.style.background = '#f2f2f2';
    div.style.color = '#333';
    div.style.border = '1px solid #d9d9d9';
    if (settings.direction === 'left') {
      div.style.left = '0';
      div.style.borderRadius = '0 4px 4px 0';
    } else {
      div.style.right = '0';
      div.style.borderRadius = '4px 0 0 4px';
    }
    div.style.display = settings.alwaysShow ? 'block' : 'none';
    div.innerHTML = showTitle ? '<span>' + settings.title + '</span>' : '↑';
    document.body.appendChild(div);

    if (settings.alwaysShow === false) {
      scrollHandler = function () {
        var top = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        div.style.display = top >= distance ? 'block' : 'none';
      };
      if (window.addEventListener) {
        window.addEventListener('scroll', scrollHandler, false);
      } else if (window.attachEvent) {
        window.attachEvent('onscroll', scrollHandler);
      }
      scrollHandler();
    }

    div.onclick = function () {
      internalScrollToTop();
    };
    return div;
  }

  var widget = /*#__PURE__*/Object.freeze({
    __proto__: null,
    waterMarker: waterMarker,
    goToTop: goToTop
  });

  /**
   * @File    util.js
   * @Desc    MelUI Util 扩展包入口：汇总全部工具，统一挂到 melui.util，不新增顶层全局
   * @Version 0.1.5
   * @Date    2026-11-13
   * @PubDate 2026-11-20 16:10:00
   * @Author  ChenMufeng
   *
   * ── 文件职责：工具扩展包入口（与 util 目录同名，不用 index.js）────
   * 打包入口为 release/dist/melui-util.js，可脱离 MelUI 主包单独使用。
   *
   * 【调用形态】无论引主包还是只引本扩展包，业务统一写 melui.util.xxx，
   *            不额外暴露 MelUiUtil 这类顶层全局。
   * 【UMD 占位名】rollup 的 output.name 只能写单层标识符，不能写 melui.util，
   *            所以配置里给一个临时占位名 _MelUiUtilTemp，
   *            构建时由配置里的 dropTempGlobal 插件在产物末尾 delete 掉，用户侧感知不到。
   * 【与主包共存】按 key 合并进已有 melui.util，不整体替换，
   *            避免主包先加载时把扩展工具冲掉，也避免后加载时覆盖主包 base。
   *
   * 【路径规则】本文件在 src/util/ 下，所以 base 层用 './base/xxx.js'，
   *            写完整文件名 + .js 后缀，不做目录简写。
   * 【语法】纯 ES5，不用 Object.assign / 对象展开，IE9 直接运行。
   * ──────────────────────────────────────────────────────
   */
   
   var utilAll = {};
   // base 的键直接扁平挂到 melui.util（如 melui.util.isArray）；
   // 业务模块按模块名分组挂载（如 melui.util.dom.getHtml）。
   var groups = [type, object];
   var modules = {
     date: date,
     format: format,
     dom: dom,
     string: string,
     validate: validate,
     array: array,
     random: random,
     biz: biz,
     widget: widget
   };
   var group;
   var module;
   var key;
   var subKey;
   var i;
   
   // ES5 合并：IE9 没有 Object.assign，也不用对象展开
   for (i = 0; i < groups.length; i++) {
     group = groups[i];
     for (key in group) {
       if (Object.prototype.hasOwnProperty.call(group, key)) {
         utilAll[key] = group[key];
       }
     }
   }
   
   // 业务模块按模块名分组，复制成普通对象，避免把 Rollup 的只读命名空间直接挂出去
   for (key in modules) {
     if (Object.prototype.hasOwnProperty.call(modules, key)) {
       module = modules[key];
       utilAll[key] = {};
       for (subKey in module) {
         if (Object.prototype.hasOwnProperty.call(module, subKey)) {
           utilAll[key][subKey] = module[subKey];
         }
       }
     }
   }
   
   /* ==================== 浏览器环境：统一挂载到 melui.util ==================== */
   if (typeof window !== 'undefined') {
     var MelUiNS = window.melui || (window.melui = {});
   
     // 主包没加载时也保证 window.MelUi 存在，后续组件可继续往上注册
     if (!window.MelUi) {
       window.MelUi = MelUiNS;
     }
   
     // 按 key 合并，不整体替换：主包内置的 base 与扩展工具都在同一个对象上
     MelUiNS.util = MelUiNS.util || {};
     for (key in utilAll) {
       if (Object.prototype.hasOwnProperty.call(utilAll, key)) {
         MelUiNS.util[key] = utilAll[key];
       }
     }
   
     // 注意：rollup 的 UMD 包装是「先执行工厂函数，再把返回值赋给全局名」，
     // 所以在这里 delete 临时全局是无效的（赋值发生在本函数之后）。
     // 清理动作交给 rollup 配置里的 dropTempGlobal 插件，在产物末尾追加。
   }

  return utilAll;

}));

;(function () { try { delete window._MelUiUtilTemp; } catch (e) { window._MelUiUtilTemp = undefined; } }());

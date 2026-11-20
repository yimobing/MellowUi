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

import { mergeObj } from './base/object.js';

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
export function compareTwoDates(dateStr1, dateStr2) {
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
export function isDateString(str) {
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
export function getNumberOfDays(date1, date2) {
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
export function getNowTime(options) {
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
export function getMonthFirstDay() {
  var now = new Date();
  return now.getFullYear() + '-' + internalPad(now.getMonth() + 1) + '-01';
}

/**
 * 本月最后一天
 * @returns {String} yyyy-MM-dd；自动处理大小月和闰年
 * @example
 * getMonthLastDay() // 2026-11 返回 '2026-11-30'；2024-02 返回 '2024-02-29'
 */
export function getMonthLastDay() {
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
export function getQuarterFirstDay() {
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
export function getQuarterLastDay() {
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
export function getYearFirstDay() {
  return new Date().getFullYear() + '-01-01';
}

/**
 * 本年最后一天
 * @returns {String} yyyy-12-31
 * @example
 * getYearLastDay() // '2026-12-31'
 */
export function getYearLastDay() {
  return new Date().getFullYear() + '-12-31';
}

/**
 * 上个月第一天
 * @returns {String} yyyy-MM-01；1 月会自动跨到上一年 12 月
 * @example
 * getLastMonthFirstDay() // 当前为 2026-01 时返回 '2025-12-01'
 */
export function getLastMonthFirstDay() {
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
export function getLastMonthLastDay() {
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
export function getLastYearFirstDay() {
  return (new Date().getFullYear() - 1) + '-01-01';
}

/**
 * 去年最后一天
 * @returns {String} yyyy-12-31
 * @example
 * getLastYearLastDay() // '2025-12-31'
 */
export function getLastYearLastDay() {
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
export function getNDay(day) {
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
export function getNMonth(month) {
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
export function getNYear(year) {
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
export function dateToWeek(date) {
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
export function numToWeek(psNumArrStr) {
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
export function dateFormat(dateTime, formatStr) {
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
export function timestampToTime(timestamp, opts) {
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
export function timeToTimestamp(time, isMilliSecond) {
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
export function timeStringToDayHourMinuteSecond(psTimeStr, psOpt) {
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

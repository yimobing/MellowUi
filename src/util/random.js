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

import { mergeObj } from './base/object.js';

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
export function getRandomMinMaxNumber(n, m) {
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
export function getRandomNumber(n) {
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
export function getRandomString(psLen, psOpts) {
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
export function getRandomWord(min, max, isRandomed) {
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
export function getRandomChar() {
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
export function getRandomColor(opt) {
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

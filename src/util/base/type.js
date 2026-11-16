/**
 * @File    type.js
 * @Desc    MelUI Util 基础层：类型判断（纯函数，无 DOM）
 * @Version 0.1.1
 * @Date    2026-11-13
 * @PubDate 2026-11-16 10:15:14
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
 * @return {Boolean}
 */
export function isPlainObject(val) {
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
 * @return {Boolean}
 */
export function isArray(val) {
  return internalTag(val) === '[object Array]';
}

/**
 * 是否函数
 * @param {*} val
 * @return {Boolean}
 */
export function isFunction(val) {
  return typeof val === 'function';
}

/**
 * 是否数字（NaN 不算）
 * @param {*} val
 * @return {Boolean}
 */
export function isNumber(val) {
  return typeof val === 'number' && !isNaN(val);
}

/**
 * 是否字符串
 * @param {*} val
 * @return {Boolean}
 */
export function isString(val) {
  return typeof val === 'string';
}

/**
 * 是否 DOM 元素节点
 * @param {*} val
 * @return {Boolean}
 */
export function isElement(val) {
  return !!(val && val.nodeType === 1);
}

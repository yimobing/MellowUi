/**
 * @File    object.js
 * @Desc    MelUI Util 基础层：对象工具（深合并 / 浅拷贝，不污染入参）
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

 import { isPlainObject, isArray } from './type.js';

 /**
  * 克隆一个值：
  * 普通对象递归克隆，数组浅拷贝，其它（函数 / DOM / 基本类型）原样返回
  * @param {*} val
  * @return {*}
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
  * @return {Object}
  */
 export function mergeObj() {
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
  * @return {Object}
  */
 export function shallowCopy(val) {
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
 
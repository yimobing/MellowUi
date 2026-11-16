(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global._MelUiUtilTemp = factory());
})(this, (function () { 'use strict';

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
   * @return {Boolean}
   */
  function isArray(val) {
    return internalTag(val) === '[object Array]';
  }

  /**
   * 是否函数
   * @param {*} val
   * @return {Boolean}
   */
  function isFunction(val) {
    return typeof val === 'function';
  }

  /**
   * 是否数字（NaN 不算）
   * @param {*} val
   * @return {Boolean}
   */
  function isNumber(val) {
    return typeof val === 'number' && !isNaN(val);
  }

  /**
   * 是否字符串
   * @param {*} val
   * @return {Boolean}
   */
  function isString(val) {
    return typeof val === 'string';
  }

  /**
   * 是否 DOM 元素节点
   * @param {*} val
   * @return {Boolean}
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
    * @return {Object}
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
   * @File    util.js
   * @Desc    MelUI Util 扩展包入口：汇总全部工具，统一挂到 melui.util，不新增顶层全局
   * @Version 0.1.4
   * @Date    2026-11-13
   * @PubDate 2026-11-16 18:20:00
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
   // 后续扩展：import * as date from './date.js'; import * as money from './money.js';
   //            一个文件一行，加进下面的 groups 数组即可
   
   var utilAll = {};
   var groups = [type, object];
   var group;
   var key;
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

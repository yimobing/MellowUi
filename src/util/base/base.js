/**
 * @File    base.js
 * @Desc    MelUI Util 基础层出口：汇总类型判断与对象工具，供 core 与 components 共用
 * @Version 0.1.2
 * @Date    2026-11-13
 * @PubDate 2026-11-16 16:42:00
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
 *
 * 【命名规则】入口文件与目录同名（base/base.js），不用 index.js。
 * 【导入写法】本项目一律写完整文件名 + .js 后缀，不做目录简写：
 *            import * as UtilBase from './util/base/base.js';
 * ──────────────────────────────────────────────────────
 */

 export { isPlainObject, isArray, isFunction, isNumber, isString, isElement } from './type.js';
 export { mergeObj, shallowCopy } from './object.js';
 
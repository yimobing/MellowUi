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

 import * as type from './base/type.js';
 import * as object from './base/object.js';
 import * as date from './date.js';
 import * as format from './format.js';
 import * as dom from './dom.js';
 import * as string from './string.js';
 import * as validate from './validate.js';
 import * as array from './array.js';
 import * as random from './random.js';
 import * as biz from './biz.js';
 import * as widget from './widget.js';
 
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
 
 export default utilAll;
 
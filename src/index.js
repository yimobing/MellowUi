/**
 * @File    index.js
 * @Desc    MelUI 全量入口：CSS 集中导入 + 组件 JS 引入 + core/util 装配
 * @Version 0.1.6
 * @Date    2026-11-13
 * @PubDate 2026-11-19 15:49:00
 * @Author  ChenMufeng
 *
 * ── 文件职责：全量打包入口 ───────────────────────────────
 * 1. 顶部集中导入全部 CSS，决定 melui.css 的输出顺序；
 * 2. 下方引入全部组件 JS（组件执行时自己挂到 window.MelUi）；
 * 3. 最后装配 core 白名单与 util/base，并把 window.melui 指向同一对象。
 *
 * 【CSS 标记】CSS 导入包在 __ROLLUP_ONLY__ 块注释里：
 *  - 浏览器 ESM 调试时整块是注释，不会请求 css，不报 MIME 错；
 *  - rollup 构建时由 activateRollupOnly 插件解开，交给 postcss 收集合并。
 *  该块内只允许写 css import，JS import 一律放块外。
 * 【导入写法】一律写完整文件名 + .js 后缀，不做目录简写。
 * ──────────────────────────────────────────────────────
 */

// 兼容补丁放在最前：组件 script 执行时就能用到 matches / bind / classList 等
import './core/polyfill.js';

//----------------------------------------
// CSS打包处理：把各个组件的CSS + 公用CSS 合并打包成一个CSS
// 以下css会被 `rollup-plugin-postcss` 提取，合并输出到：melui.css / melui.min.css
// 浏览器调试时本块是纯注释，不请求任何css
//----------------------------------------

//~~~~~~~~~~~~~~~~~~~~~~~~
// · 基础UI样式 → 核心库样式 → 组件样式（顺序即输出顺序）
//~~~~~~~~~~~~~~~~~~~~~~~~
/*#__ROLLUP_ONLY__
// 基础UI样式优先导入，保证css输出顺序正确，可被后面覆盖
import './components/layout/index.css';
import './components/button/index.css';

// 核心库样式：loading / spinner / 遮罩 / iframe
import './core/core.css';

// 各个组件样式
import './components/dialog/index.css';
import './components/datePicker/index.css';
import './components/drawer/index.css';
import './components/pagination/index.css';
import './components/table/index.css';
*/

//~~~~~~~~~~~~~~~~~~~~~~~~
// · 各个组件 JS：执行即自注册到 window.MelUi
//~~~~~~~~~~~~~~~~~~~~~~~~
// layout 组件
import './components/layout/index.js';

// dialog 组件
import './components/dialog/index.js';

// datePicker 组件
import './components/datePicker/index.js';

// drawer 组件
import './components/drawer/index.js';

// pagination 组件
import './components/pagination/index.js';

// table 组件
import './components/table/build-entry.js';


//~~~~~~~~~~~~~~~~~~~~~~~~
// · 核心库 + 工具库
//~~~~~~~~~~~~~~~~~~~~~~~~
import { publicApi } from './core/core.js';
import * as UtilBase from './util/base/base.js';

// 复用组件已经建好的命名空间，不要新建
var MelUiNS = window.MelUi || (window.MelUi = {});
var key;

// 若页面先加载了 melui-util.js，melui.util 里已经有全套扩展工具，
// 这里要把它们保留下来，不能被主包的 util/base 覆盖掉
var existedUtil = (window.melui && window.melui.util) || null;

// 白名单里的高频 API 扁平到顶层：melui.showLoading()，不用写 .Core
// 注意：core/core.js 不再导出 Core 对象，对外不存在 melui.Core
for (key in publicApi) {
  if (Object.prototype.hasOwnProperty.call(publicApi, key)) {
    MelUiNS[key] = publicApi[key];
  }
}

// 主包内置基础工具：来自 util/base（共享层，不是私有层）
// ⚠️ 不能把 UtilBase 直接赋给 melui.util：`import * as` 在 rollup 产物里是
//    Object.freeze 出来的只读命名空间对象，一旦挂上去，util 扩展包再按 key
//    合并就会报 Cannot assign to read only property，业务也改不动。
//    这里先复制成普通对象，再合并进已有的 util。
var baseUtil = {};
for (key in UtilBase) {
  if (Object.prototype.hasOwnProperty.call(UtilBase, key)) {
    baseUtil[key] = UtilBase[key];
  }
}

var mergedUtil = existedUtil || {};
for (key in baseUtil) {
  if (Object.prototype.hasOwnProperty.call(baseUtil, key)) {
    mergedUtil[key] = baseUtil[key];
  }
}
MelUiNS.util = mergedUtil;

// 小写 melui 只是别名，指向同一个对象，不产生第二份状态
window.melui = MelUiNS;


//~~~~~~~~~~~~~~~~~~~~~~~~
// · 导出
//~~~~~~~~~~~~~~~~~~~~~~~~
// 写到 export default 这一行入口就结束了。里面看不到任何 window.MelUi.Table = Table，
// 因为组件自己挂好了，入口再挂一遍就是重复。
export default window.MelUi;

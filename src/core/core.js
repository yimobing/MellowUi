/**
 * @File    core.js
 * @Desc    MelUI Core 对外出口：只登记 publicApi 白名单，不导出、不暴露 Core 对象
 * @Version 0.1.4
 * @Date    2026-11-13
 * @PubDate 2026-11-16 17:10:00
 * @Author  ChenMufeng
 *
 * ── 文件职责：core 的对外出口（与 core.css 同目录同名，一眼对应）────
 * 只做两件事：import 各模块、登记 publicApi。本文件不写任何函数实现。
 *
 * 【命名规则】本项目入口文件与目录同名（core/core.js、util/util.js、
 *            util/base/base.js），不再使用 index.js，
 *            让文件名自带语义，避免一堆同名 index.js 分不清。
 *
 * 【对外形态】只导出 publicApi 白名单，由 src/index.js 挂到 melui 顶层。
 *            不导出 Core 对象 —— 业务侧不存在 melui.Core，
 *            内部实现不构成对外契约，将来重构不受限制。
 * 【内部复用】组件若需要 loading/遮罩，直接 import './loading.js' 的函数，
 *            不要绕到全局 melui 上取，避免被业务覆盖或受加载顺序影响。
 * ──────────────────────────────────────────────────────
 */

 import { showLoading, closeLoading, createSpinner, isLoading } from './loading.js';

 /**
  * 唯一白名单：登记要提升到 melui.xxx 顶层的 API。
  * 只填真的在 loading.js 里实现过、且允许业务直接用的函数。
  */
 export var publicApi = {
   showLoading: showLoading,
   closeLoading: closeLoading,
   createSpinner: createSpinner,
   isLoading: isLoading
 };
 
 export default publicApi;
 
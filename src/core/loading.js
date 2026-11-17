/**
 * @File    loading.js
 * @Desc    MelUI Core：通用 Spinner 渲染 + 全局 Loading（遮罩 / 计数 / 滚动锁）
 * @Version 0.1.4
 * @Date    2026-11-13
 * @PubDate 2026-11-17 16:37:17
 * @Author  ChenMufeng
 *
 * ── 层级定位：core 公开能力层 ────────────────────────────
 * 本文件实现对外 API（showLoading / closeLoading / createSpinner），
 * 由 core/core.js 的 publicApi 白名单提升为 melui.xxx，业务不直接 import 本文件。
 *
 * 【依赖方向】只能依赖 util/base（共享基础函数）与 core/internal（私有实现）。
 * 【禁止】反向被 core/internal 依赖；不得引入 util 扩展工具（date/money 等）。
 * 【IE9】本文件不写 const / 箭头函数 / 对象展开，动画走 CSS class，IE9 静态降级。
 * ──────────────────────────────────────────────────────
 */

 import { mergeObj } from '../util/base/object.js';
 import {
   isIE9,
   warn,
   createEl,
   addClass,
   resolveElement,
   setTransform,
   setText,
   getStyle,
   removeEl
 } from './internal/dom.js';
 import { nextZIndex } from './internal/zIndex.js';
 
 /* ==================== 默认参数 ==================== */
 
 // Spinner 图形参数（只控制转圈本身）
 var spinnerDefaults = {
   size: 40,          // 尺寸，px
   color: '#1677ff',  // 圆点颜色
   speed: 1,          // 1 = 1 秒一圈
   strokeWidth: 4,    // 线宽，圆点直径 = strokeWidth * 2
   type: 'ring',      // 第一版只实现 ring
   customClass: ''
 };
 
 // Loading 浮层扩展参数（在 Spinner 参数之上）
 var loadingDefaults = {
   text: '加载中...',
   showText: true,
   mask: true,
   maskColor: 'rgba(0,0,0,0.4)',
   maskOpacity: 1,           // 遮罩透明度 0~1，1 为原色；只作用于遮罩，不影响转圈与文字
   textColor: '',            // 留空则按是否有遮罩自动取白色/深色
   el: null,                 // 挂载容器，null = document.body（全局）；可传 DOM 或选择器
   zIndex: 0,                // 0 = 由 Core 的 zIndex 管理器自动分配
   destroyOnClose: true      // false 时关闭只隐藏，下次复用 DOM
 };
 
 /* ==================== 模块私有状态 ==================== */
 
 var loadingCount = 0;        // 计数：show / close 必须配对
 var loadingInstance = null;  // 当前 Loading 实例（单例）
 var scrollState = null;      // 滚动锁快照，null 表示未锁定
 
 /* ==================== 私有工具 ==================== */
 
 /**
  * 转数字，非法值回退默认
  * @param {*} val
  * @param {Number} def
  * @return {Number}
  */
 function toNumber(val, def) {
   var num = parseFloat(val);
   if (isNaN(num)) {
     return def;
   }
   return num;
 }
 
 /**
  * 锁滚动：同时处理 html / body（不同浏览器滚动源不同），并补偿滚动条宽度
  */
 function internalLockScroll() {
   var html = document.documentElement;
   var body = document.body;
   var scrollBarWidth;
 
   if (scrollState) {
     return;
   }
 
   scrollState = {
     top: html.scrollTop || body.scrollTop || 0,
     left: html.scrollLeft || body.scrollLeft || 0,
     htmlOverflow: html.style.overflow,
     bodyOverflow: body.style.overflow,
     bodyPaddingRight: body.style.paddingRight
   };
 
   // 隐藏滚动条会让页面宽度变化，补上右侧 padding 防抖动
   scrollBarWidth = window.innerWidth - html.clientWidth;
   if (scrollBarWidth > 0) {
     body.style.paddingRight = scrollBarWidth + 'px';
   }
 
   html.style.overflow = 'hidden';
   body.style.overflow = 'hidden';
 }
 
 /**
  * 解锁滚动并还原滚动位置
  */
 function internalUnlockScroll() {
   var html = document.documentElement;
   var body = document.body;
 
   if (!scrollState) {
     return;
   }
 
   html.style.overflow = scrollState.htmlOverflow || '';
   body.style.overflow = scrollState.bodyOverflow || '';
   body.style.paddingRight = scrollState.bodyPaddingRight || '';
 
   // 先恢复 overflow 再还原位置，否则部分浏览器会跳回顶部
   window.scrollTo(scrollState.left, scrollState.top);
 
   scrollState = null;
 }
 
 /**
  * 销毁 Loading 实例：移除 DOM、清理引用
  */
 function internalDestroy() {
   var ins = loadingInstance;
 
   if (!ins) {
     return;
   }
 
   if (ins.spinner && ins.spinner.destroy) {
     ins.spinner.destroy();
   }
 
   removeEl(ins.root);
 
   if (ins.locked) {
     internalUnlockScroll();
     ins.locked = false;
   }
 
   if (ins.hostForcedRelative && ins.host) {
     ins.host.style.position = ins.hostOriginalPosition || '';
   }
 
   ins.root = null;
   ins.maskEl = null;
   ins.panelEl = null;
   ins.innerEl = null;
   ins.spinner = null;
   ins.textEl = null;
   ins.host = null;
   ins.opts = null;
 
   loadingInstance = null;
   loadingCount = 0;
 }
 
 /* ==================== 对外 API：Spinner ==================== */
 
 /**
  * 渲染一个纯转圈图形（无遮罩、无全局状态），可嵌在任意容器里
  * @param {HTMLElement|String} el 挂载容器，支持选择器
  * @param {Object} options spinner 参数
  * @return {Object|null} { el, options, destroy }
  */
 export function createSpinner(el, options) {
   var opts = mergeObj(spinnerDefaults, options);
   var host = resolveElement(el);
   var size;
   var dotSize;
   var radius;
   var root;
   var dot;
   var angle;
   var i;
   var duration;
 
   if (!host) {
     return null;
   }
 
   size = toNumber(opts.size, spinnerDefaults.size);
   if (size < 12) {
     size = 12;
   }
 
   dotSize = Math.round(toNumber(opts.strokeWidth, spinnerDefaults.strokeWidth) * 2);
   if (dotSize < 4) {
     dotSize = 4;
   }
   if (dotSize > size / 2) {
     dotSize = Math.floor(size / 2);
   }
 
   radius = (size - dotSize) / 2;
 
   root = createEl('div', 'mel-spinner mel-spinner-' + (opts.type || 'ring'));
   if (opts.customClass) {
     addClass(root, opts.customClass);
   }
   root.style.width = size + 'px';
   root.style.height = size + 'px';
 
   // 4 个圆点均匀分布，透明度递减形成旋转方向感
   for (i = 0; i < 4; i++) {
     dot = createEl('span', 'mel-spinner-dot');
     dot.style.left = '50%';
     dot.style.top = '50%';
     dot.style.width = dotSize + 'px';
     dot.style.height = dotSize + 'px';
     dot.style.marginLeft = (-dotSize / 2) + 'px';
     dot.style.marginTop = (-dotSize / 2) + 'px';
     dot.style.background = opts.color;
     dot.style.opacity = String(1 - i * 0.2);
 
     angle = i * 90;
     setTransform(dot, 'rotate(' + angle + 'deg) translate(0, -' + radius + 'px)');
     root.appendChild(dot);
   }
 
   // IE9 不支持 @keyframes：不加动画 class，静态降级
   if (!isIE9()) {
     addClass(root, 'mel-spinner-anim');
     duration = 1 / toNumber(opts.speed, spinnerDefaults.speed);
     if (duration <= 0) {
       duration = 1;
     }
     if ('animationDuration' in root.style) {
       root.style.animationDuration = duration + 's';
     }
     if ('webkitAnimationDuration' in root.style) {
       root.style.webkitAnimationDuration = duration + 's';
     }
   }
 
   host.appendChild(root);
 
   return {
     el: root,
     options: opts,
     destroy: function () {
       removeEl(root);
     }
   };
 }
 
 /* ==================== 对外 API：全局 Loading ==================== */
 
 /**
  * 打开全局 Loading
  * - 支持字符串简写：showLoading('加载中')
  * - 重复调用只加计数、复用 DOM，不会重建
  * @param {Object|String} options
  * @return {HTMLElement|null} Loading 根节点
  */
 export function showLoading(options) {
   var opts;
   var ins = loadingInstance;
   var host;
   var root;
   var isGlobal;
   var maskEl;
   var panelEl;
   var innerEl;
   var spinnerIns;
   var textEl;
   var forcedRelative;
   var originalPosition;
   var maskOpacity;
 
   if (typeof options === 'string') {
     options = { text: options };
   }
 
   // 已有实例：只更新文案 + 计数，不重建 DOM
   if (ins) {
     if (options && typeof options.text === 'string' && ins.textEl) {
       setText(ins.textEl, options.text);
     }
     if (ins.root.style.display === 'none') {
       ins.root.style.display = '';
       if (ins.isGlobal && ins.opts.mask) {
         internalLockScroll();
         ins.locked = true;
       }
     }
     loadingCount++;
     return ins.root;
   }
 
   opts = mergeObj(spinnerDefaults, loadingDefaults, options);
 
   host = resolveElement(opts.el);
   if (!host) {
     return null;
   }
 
   isGlobal = host === document.body;
 
   root = createEl('div', 'mel-loading');
   addClass(root, isGlobal ? 'mel-loading-global' : 'mel-loading-absolute');
   if (opts.customClass) {
     addClass(root, opts.customClass);
   }
   root.style.zIndex = String(opts.zIndex > 0 ? opts.zIndex : nextZIndex());
 
   // 遮罩
   maskEl = null;
   if (opts.mask) {
     maskEl = createEl('div', 'mel-loading-mask');
     maskEl.style.background = opts.maskColor;
 
     maskOpacity = toNumber(opts.maskOpacity, loadingDefaults.maskOpacity);
     if (maskOpacity < 0) {
       maskOpacity = 0;
     }
     if (maskOpacity > 1) {
       maskOpacity = 1;
     }
     maskEl.style.opacity = String(maskOpacity);
 
     root.appendChild(maskEl);
   }
 
   // 居中面板：用 table / table-cell 居中，避免 IE9 对 translate 百分比支持不稳
   panelEl = createEl('div', 'mel-loading-panel');
   innerEl = createEl('div', 'mel-loading-panel-inner');
   panelEl.appendChild(innerEl);
   root.appendChild(panelEl);
 
   // 转圈复用 createSpinner，不重复写转圈渲染
   spinnerIns = createSpinner(innerEl, opts);
   if (!spinnerIns) {
     removeEl(root);
     return null;
   }
 
   // 文字
   textEl = null;
   if (opts.showText && opts.text) {
     textEl = createEl('div', 'mel-loading-text');
     setText(textEl, opts.text);
     textEl.style.color = opts.textColor || (opts.mask ? '#FFFFFF' : '#333333');
     innerEl.appendChild(textEl);
   }
 
   // 非 body 宿主：绝对定位要求宿主是定位上下文，static 时临时改成 relative
   forcedRelative = false;
   originalPosition = '';
   if (!isGlobal && getStyle(host, 'position') === 'static') {
     originalPosition = host.style.position;
     host.style.position = 'relative';
     forcedRelative = true;
   }
 
   host.appendChild(root);
 
   loadingInstance = {
     root: root,
     maskEl: maskEl,
     panelEl: panelEl,
     innerEl: innerEl,
     spinner: spinnerIns,
     textEl: textEl,
     host: host,
     hostForcedRelative: forcedRelative,
     hostOriginalPosition: originalPosition,
     isGlobal: isGlobal,
     locked: false,
     opts: opts
   };
 
   // 只对全局 Loading 锁页面滚动；局部 Loading 不锁，避免影响其他区域
   if (isGlobal && opts.mask) {
     internalLockScroll();
     loadingInstance.locked = true;
   }
 
   loadingCount = 1;
   return root;
 }
 
 /**
  * 关闭全局 Loading（计数归零才真正销毁 / 隐藏）
  * @return {Boolean} 是否执行成功
  */
 export function closeLoading() {
   var ins = loadingInstance;
 
   if (loadingCount <= 0 || !ins) {
     warn('closeLoading 的调用次数多于 showLoading');
     return false;
   }
 
   loadingCount--;
 
   if (loadingCount > 0) {
     return true;
   }
 
   if (ins.locked) {
     internalUnlockScroll();
     ins.locked = false;
   }
 
   if (ins.opts.destroyOnClose) {
     internalDestroy();
   } else {
     ins.root.style.display = 'none';
   }
 
   return true;
 }
 
 /**
  * 当前是否有 Loading 在显示
  * @return {Boolean}
  */
 export function isLoading() {
   return loadingCount > 0;
 }
 
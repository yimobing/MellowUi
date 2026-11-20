/**
 * @File    mask.js
 * @Desc    MelUI Core：通用遮罩（多层叠放 / 滚动锁 / 点击关闭）
 * @Version 0.1.0
 * @Date    2026-11-19
 * @PubDate 2026-11-19 15:45:00
 * @Author  ChenMufeng
 *
 * ── 层级定位：core 公开能力层 ────────────────────────────
 * 由 core/core.js 的 publicApi 白名单提升为 melui.openMask / melui.closeMask，
 * 业务不直接 import 本文件。
 *
 * 【依赖方向】只能依赖 util/base 与 core/internal。
 * 【兼容说明】
 *   IE9：不写 const / 箭头 / 对象展开 / passive options；定位用 top/right/bottom/left，
 *        不用 inset；不使用 classList。
 *   iOS：只在遮罩上绑 touchmove 并 preventDefault，阻止页面被拖动；
 *        滚动锁交给 internal/scrollLock.js（含页面高度固定与位置还原），
 *        不直接操作业务页面的 html/body 内联样式之外的东西。
 *   多层：openMask 可重复调用，zIndex 自增；closeMask 按“后开先关”或指定 id 关闭，
 *        滚动锁引用计数归零才真正解锁。
 * ──────────────────────────────────────────────────────
 */

import { mergeObj } from '../util/base/object.js';
import { createEl, isElement, warn, removeEl } from './internal/dom.js';
import { nextZIndex } from './internal/zIndex.js';
import { lockScroll, unlockScroll } from './internal/scrollLock.js';

/* ==================== 默认参数 ==================== */

var maskDefaults = {
  id: '',                              // 遮罩 id，留空自动生成 mel-mask-N
  zIndex: 0,                           // 0 = 由 Core 的 zIndex 管理器分配
  color: 'rgba(0,0,0,0.4)',            // 遮罩底色
  opacity: 1,                          // 0~1，叠加在底色之上
  lockScroll: true,                    // 是否锁定页面滚动
  clickClose: false,                   // 点击遮罩是否关闭自己
  className: '',                       // 附加 class
  onClose: null                        // 关闭回调，参数 { id, el }
};

/* ==================== 模块私有状态 ==================== */

var maskSeed = 0;      // 自动 id 序号
var instances = [];    // 当前打开的遮罩，后开的在末尾

/* ==================== 私有工具 ==================== */

/**
 * 限制在 0~1
 * @param {*} val
 * @param {Number} def
 * @return {Number}
 */
function toOpacity(val, def) {
  var num = parseFloat(val);
  if (isNaN(num)) {
    return def;
  }
  if (num < 0) {
    return 0;
  }
  if (num > 1) {
    return 1;
  }
  return num;
}

/**
 * 规范化 id：允许传 '#xxx'
 * @param {String} id
 * @return {String}
 */
function normalizeId(id) {
  return String(id).replace(/^#/, '');
}

/**
 * 按 id 查找已打开的遮罩
 * @param {String} id
 * @return {Object|null}
 */
function findById(id) {
  var i;
  for (i = 0; i < instances.length; i++) {
    if (instances[i].id === id) {
      return instances[i];
    }
  }
  return null;
}

/**
 * 阻止 touchmove 默认行为（iOS 页面拖动）
 * @param {Event} e
 */
function preventTouchMove(e) {
  if (e && e.cancelable !== false && e.preventDefault) {
    e.preventDefault();
  }
}

/**
 * 绑定非 passive 的 touchmove：新浏览器用 options，老浏览器退回布尔值
 * @param {HTMLElement} el
 * @param {Function} fn
 */
function bindTouchMove(el, fn) {
  if (!('ontouchstart' in window)) {
    return;
  }
  try {
    el.addEventListener('touchmove', fn, { passive: false });
  } catch (e) {
    el.addEventListener('touchmove', fn, false);
  }
}

/**
 * 解绑 touchmove
 * @param {HTMLElement} el
 * @param {Function} fn
 */
function unbindTouchMove(el, fn) {
  if (!('ontouchstart' in window)) {
    return;
  }
  el.removeEventListener('touchmove', fn, false);
}

/**
 * 关闭单个实例：解绑事件、解锁滚动、移除节点
 * @param {Object} ins
 */
function closeInstance(ins) {
  var idx;
  if (!ins) {
    return;
  }
  if (ins.touchHandler) {
    unbindTouchMove(ins.el, ins.touchHandler);
  }
  if (ins.clickHandler) {
    ins.el.removeEventListener('click', ins.clickHandler, false);
  }
  if (ins.locked) {
    unlockScroll();
    ins.locked = false;
  }
  removeEl(ins.el);

  idx = instances.indexOf(ins);
  if (idx > -1) {
    instances.splice(idx, 1);
  }

  if (typeof ins.opts.onClose === 'function') {
    ins.opts.onClose({ id: ins.id, el: ins.el });
  }
}

/* ==================== 对外 API ==================== */

/**
 * 打开遮罩
 * @param {Object} options 可选
 * @param {String} options.id 遮罩 id，留空自动生成
 * @param {Number} options.zIndex 层级，0 = 自动
 * @param {String} options.color 底色，默认 rgba(0,0,0,0.4)
 * @param {Number} options.opacity 透明度 0~1，默认 1
 * @param {Boolean} options.lockScroll 是否锁滚动，默认 true
 * @param {Boolean} options.clickClose 点击遮罩是否关闭，默认 false
 * @param {String} options.className 附加 class
 * @param {Function} options.onClose 关闭回调
 * @return {HTMLElement|null} 遮罩节点
 */
export function openMask(options) {
  var opts = mergeObj(maskDefaults, options);
  var id = opts.id ? normalizeId(opts.id) : '';
  var existing;
  var el;
  var ins;

  if (id) {
    existing = findById(id);
    if (existing) {
      return existing.el;
    }
  } else {
    maskSeed++;
    id = 'mel-mask-' + maskSeed;
  }

  el = createEl('div', 'mel-mask' + (opts.className ? ' ' + opts.className : ''));
  el.id = id;
  el.setAttribute('aria-hidden', 'true');
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.right = '0';
  el.style.bottom = '0';
  el.style.left = '0';
  el.style.width = '100%';
  el.style.height = '100%';
  el.style.backgroundColor = opts.color;
  el.style.opacity = toOpacity(opts.opacity, maskDefaults.opacity);
  el.style.zIndex = typeof opts.zIndex === 'number' && opts.zIndex > 0
    ? opts.zIndex
    : nextZIndex();
  el.style.touchAction = 'none';
  el.style.webkitTapHighlightColor = 'transparent';
  el.style.webkitUserSelect = 'none';

  document.body.appendChild(el);

  ins = {
    id: id,
    el: el,
    opts: opts,
    locked: false,
    lastTouchMove: 0,
    touchHandler: null,
    clickHandler: null
  };

  if (opts.lockScroll !== false) {
    lockScroll({ preserveHeight: true });
    ins.locked = true;
  }

  // iOS / Android：在遮罩上阻断 touchmove，防止页面被拖着走
  ins.touchHandler = function (e) {
    ins.lastTouchMove = new Date().getTime();
    preventTouchMove(e);
  };
  bindTouchMove(el, ins.touchHandler);

  if (opts.clickClose === true) {
    ins.clickHandler = function (e) {
      // 刚在遮罩上拖动过，浏览器可能仍补发一次 click，这里忽略，避免误关
      if (new Date().getTime() - ins.lastTouchMove < 500) {
        return;
      }
      if (e.target === el) {
        closeMask(id);
      }
    };
    el.addEventListener('click', ins.clickHandler, false);
  }

  instances.push(ins);
  return el;
}

/**
 * 关闭遮罩
 * @param {String|HTMLElement} target 可选
 *       不传：关闭最后打开的一层
 *       传 'all'：关闭全部
 *       传 id 或节点：关闭指定遮罩
 * @return {Boolean} 是否关闭成功
 */
export function closeMask(target) {
  var ins = null;
  var i;

  if (target === 'all') {
    while (instances.length) {
      closeInstance(instances[instances.length - 1]);
    }
    return true;
  }

  if (target == null) {
    ins = instances.length ? instances[instances.length - 1] : null;
  } else if (isElement(target)) {
    for (i = 0; i < instances.length; i++) {
      if (instances[i].el === target) {
        ins = instances[i];
        break;
      }
    }
  } else if (typeof target === 'string') {
    ins = findById(normalizeId(target));
  }

  if (!ins) {
    warn('未找到要关闭的遮罩：' + target);
    return false;
  }
  closeInstance(ins);
  return true;
}

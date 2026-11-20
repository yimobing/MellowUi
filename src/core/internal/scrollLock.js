/**
 * @File    scrollLock.js
 * @Desc    MelUI Core 私有滚动锁：html/body 双锁 + 滚动条补偿 + 滚动位置还原
 * @Version 0.1.1
 * @Date    2026-11-19
 * @PubDate 2026-11-20 12:14:00
 * @Author  ChenMufeng
 *
 * ── 层级定位：core 私有实现层（internal）──────────────────
 * 只允许 src/core/ 目录内部 import。
 *
 * 【为什么需要引用计数】Loading 与 Mask 可能同时打开：
 *   两者各自调用 lock / unlock，只按“最后一次解锁”还原页面，避免先关的那个把
 *   另一个的滚动锁提前解开。
 *
 * 【兼容说明】
 *   IE9：不写 const / 箭头 / passive options；addEventListener 该版本已支持。
 *   iOS：只锁 html/body 的 overflow 并不足以阻止页面拖动，Mask 会在遮罩上单独
 *        绑定 touchmove 阻止默认行为；本模块负责页面高度与滚动位置不丢。
 *   页面高度：把 html/body 高度写成内容总高再 overflow:hidden，
 *        否则 iOS 上隐藏溢出会让页面塌陷、关掉后滚动位置跳回顶部。
 * ──────────────────────────────────────────────────────
 */

var lockCount = 0;      // 当前加锁次数
var scrollState = null; // 首次加锁时的现场快照

/**
 * 取当前页面纵向滚动位置（不同浏览器滚动源不同）
 * @return {Number}
 */
function getPageTop() {
  return window.pageYOffset ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0;
}

/**
 * 取当前页面横向滚动位置
 * @return {Number}
 */
function getPageLeft() {
  return window.pageXOffset ||
    document.documentElement.scrollLeft ||
    document.body.scrollLeft ||
    0;
}

/**
 * 按当前页面内容固定 html / body 高度（iOS 上仅 overflow:hidden 会让内容塌陷）
 * @param {Object} state 现场快照
 */
function applyPageHeight(state) {
  var html = document.documentElement;
  var body = document.body;
  var docHeight = Math.max(
    body.scrollHeight,
    html.scrollHeight,
    window.innerHeight || html.clientHeight || 0
  );

  if (docHeight > 0) {
    html.style.height = docHeight + 'px';
    body.style.height = docHeight + 'px';
    state.heightFixed = true;
  }
}

/**
 * 加锁：第一次调用时记录现场并锁住滚动，之后只增加计数
 * @param {Object} options 可选
 * @param {Boolean} options.preserveHeight 是否固定页面高度，默认 false
 *        Mask 需要（iOS 防塌陷）；Loading 只锁 overflow
 */
export function lockScroll(options) {
  var html = document.documentElement;
  var body = document.body;
  var scrollBarWidth;
  var preserveHeight = !!(options && options.preserveHeight === true);

  lockCount++;
  if (scrollState) {
    // 后开的浮层如果要求固定高度，补做一次；已经固定过则跳过
    if (preserveHeight && !scrollState.heightFixed) {
      applyPageHeight(scrollState);
    }
    return;
  }

  scrollState = {
    top: getPageTop(),
    left: getPageLeft(),
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    htmlHeight: html.style.height,
    bodyHeight: body.style.height,
    bodyPaddingRight: body.style.paddingRight,
    heightFixed: false
  };

  // 隐藏滚动条会让页面宽度变化，补右侧 padding 防抖动
  scrollBarWidth = window.innerWidth - html.clientWidth;
  if (scrollBarWidth > 0) {
    body.style.paddingRight = scrollBarWidth + 'px';
  }

  if (preserveHeight) {
    applyPageHeight(scrollState);
  }

  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
}

/**
 * 还原单条内联样式：原值为空时用 removeProperty 清掉，
 * 避免部分环境里 style.xxx = '' 不能真正移除内联样式
 * @param {HTMLElement} el
 * @param {String} prop 连字符写法，如 'padding-right'
 * @param {String} value 原始值
 */
function restoreStyle(el, prop, value) {
  if (value) {
    el.style[prop.replace(/-([a-z])/g, function (all, letter) {
      return letter.toUpperCase();
    })] = value;
    return;
  }
  if (el.style.removeProperty) {
    el.style.removeProperty(prop);
  } else {
    el.style[prop.replace(/-([a-z])/g, function (all, letter) {
      return letter.toUpperCase();
    })] = '';
  }
}

/**
 * 解锁：计数归零时才还原现场
 */
export function unlockScroll() {
  var html = document.documentElement;
  var body = document.body;

  if (lockCount <= 0) {
    return;
  }
  lockCount--;
  if (lockCount > 0 || !scrollState) {
    return;
  }

  restoreStyle(html, 'overflow', scrollState.htmlOverflow);
  restoreStyle(body, 'overflow', scrollState.bodyOverflow);
  restoreStyle(html, 'height', scrollState.htmlHeight);
  restoreStyle(body, 'height', scrollState.bodyHeight);
  restoreStyle(body, 'padding-right', scrollState.bodyPaddingRight);

  // 先恢复 overflow / height 再还原位置，否则部分浏览器会跳回顶部
  window.scrollTo(scrollState.left, scrollState.top);

  scrollState = null;
}

/**
 * 当前是否处于锁定状态
 * @return {Boolean}
 */
export function isScrollLocked() {
  return lockCount > 0;
}

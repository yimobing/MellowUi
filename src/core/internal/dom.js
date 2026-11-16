/**
 * @File    dom.js
 * @Desc    MelUI Core 私有 DOM 辅助（仅 core 内部使用，不对外暴露），兼容 IE9
 * @Version 0.1.0
 * @Date    2026-11-13
 * @PubDate 2026-11-13 18:09:21
 * @Author  ChenMufeng
 */

/**
 * 是否 IE9（IE9 不支持 @keyframes，转圈需静态降级）
 * IE10 / IE11 的 UA 里是 Trident，不走这里，按现代浏览器处理
 * @return {Boolean}
 */
 export function isIE9() {
    var ua = window.navigator.userAgent;
    var match = ua.match(/MSIE\s+(\d+)/);
    return !!(match && parseInt(match[1], 10) === 9);
  }
  
  /**
   * 控制台告警
   * @param {String} msg
   */
  export function warn(msg) {
    if (window.console && window.console.warn) {
      window.console.warn('[MelUI] ' + msg);
    }
  }
  
  /**
   * 创建元素
   * @param {String} tag
   * @param {String} className 可选
   * @return {HTMLElement}
   */
  export function createEl(tag, className) {
    var el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    return el;
  }
  
  /**
   * 是否 DOM 元素
   * @param {*} val
   * @return {Boolean}
   */
  export function isElement(val) {
    return !!(val && val.nodeType === 1);
  }
  
  /**
   * 解析挂载目标：支持选择器字符串 / DOM 元素 / 空（默认 body）
   * @param {String|HTMLElement|null} target
   * @return {HTMLElement|null}
   */
  export function resolveElement(target) {
    var el;
    if (!target) {
      return document.body;
    }
    if (typeof target === 'string') {
      el = document.querySelector(target);
      if (!el) {
        warn('挂载目标不存在：' + target);
        return null;
      }
      return el;
    }
    if (isElement(target)) {
      return target;
    }
    warn('挂载目标类型不支持，已忽略本次渲染');
    return null;
  }
  
  /**
   * 添加 class（IE9 的 classList 不可靠，统一用 className 处理）
   * @param {HTMLElement} el
   * @param {String} cls
   */
  export function addClass(el, cls) {
    var current;
    if (!el || !cls) {
      return;
    }
    current = ' ' + el.className + ' ';
    if (current.indexOf(' ' + cls + ' ') === -1) {
      el.className = (el.className ? el.className + ' ' : '') + cls;
    }
  }
  
  /**
   * 移除 class
   * @param {HTMLElement} el
   * @param {String} cls
   */
  export function removeClass(el, cls) {
    var current;
    if (!el || !cls) {
      return;
    }
    current = ' ' + el.className + ' ';
    el.className = current.replace(' ' + cls + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }
  
  /**
   * 设置 transform，同时写 -ms- 前缀（IE9 只认 -ms-transform）
   * @param {HTMLElement} el
   * @param {String} value 例如 'rotate(90deg) translate(0, -14px)'
   */
  export function setTransform(el, value) {
    if (!el) {
      return;
    }
    if ('transform' in el.style) {
      el.style.transform = value;
    }
    if ('msTransform' in el.style) {
      el.style.msTransform = value;
    }
    if ('webkitTransform' in el.style) {
      el.style.webkitTransform = value;
    }
  }
  
  /**
   * 设置文本（IE9 无 textContent，回退 innerText）
   * @param {HTMLElement} el
   * @param {String} text
   */
  export function setText(el, text) {
    if (!el) {
      return;
    }
    if ('textContent' in el) {
      el.textContent = text;
    } else {
      el.innerText = text;
    }
  }
  
  /**
   * 读取计算样式（IE9 有 getComputedStyle，老 IE 回退 currentStyle）
   * @param {HTMLElement} el
   * @param {String} prop 例如 'position'
   * @return {String}
   */
  export function getStyle(el, prop) {
    if (!el) {
      return '';
    }
    if (window.getComputedStyle) {
      return window.getComputedStyle(el, null)[prop] || '';
    }
    if (el.currentStyle) {
      return el.currentStyle[prop] || '';
    }
    return '';
  }
  
  /**
   * 移除节点（同时断开引用，避免内存泄漏）
   * @param {HTMLElement} el
   */
  export function removeEl(el) {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }
  
  /**
   * 给元素挂载子节点
   * @param {HTMLElement} parent
   * @param {HTMLElement} child
   */
  export function appendTo(parent, child) {
    if (parent && child) {
      parent.appendChild(child);
    }
  }
  
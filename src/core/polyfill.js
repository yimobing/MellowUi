/**
 * @File    polyfill.js
 * @Desc    MelUI Core 兼容补丁：只补 MelUI 与常见业务会用到、且 IE9~11 缺失的能力
 * @Version 0.1.2
 * @Date    2026-11-19
 * @PubDate 2026-11-20 18:40:11
 * @Author  ChenMufeng
 *
 * ── 层级定位：core 基础兼容层 ────────────────────────────
 * 只做“缺失才补”的守卫式补丁，现代浏览器加载后全部跳过，不覆盖原生实现。
 * 本文件不导出任何业务 API，仅由 src/index.js 在最前面 import 一次。
 *
 * 【为什么只产一份 core】不给现代浏览器单独出 -modern 产物：
 *   同一份 melui.js 在 IE9 执行补丁、在现代浏览器全部跳过，行为一致，
 *   业务不需要判断“我该引哪个文件”。
 *
 * 【刻意不补】
 *   Date.prototype.format：会污染全局 Date，MelUi 用 util.date.dateFormat；
 *   String.prototype.trim / Object.keys：IE9 已原生支持，无需重复。
 * ──────────────────────────────────────────────────────
 */

/* ==================== Function ==================== */

/**
 * Function.prototype.bind（IE9 已原生支持，这里只兜底更老环境）
 * 保留原生 bind 的部分参数与构造调用语义
 */
 function polyfillBind() {
  if (Function.prototype.bind) {
    return;
  }
  Function.prototype.bind = function (context) {
    var fn = this;
    var args = Array.prototype.slice.call(arguments, 1);
    var Noop = function () {};
    var bound;

    if (typeof fn !== 'function') {
      throw new TypeError('Function.prototype.bind - 被绑定的对象不是函数');
    }
    bound = function () {
      var innerArgs = Array.prototype.slice.call(arguments);
      return fn.apply(this instanceof Noop ? this : context, args.concat(innerArgs));
    };
    if (fn.prototype) {
      Noop.prototype = fn.prototype;
      bound.prototype = new Noop();
    }
    return bound;
  };
}

/* ==================== Array ==================== */

/**
 * Array.prototype.filter
 */
function polyfillArrayFilter() {
  if (Array.prototype.filter) {
    return;
  }
  Array.prototype.filter = function (fn, thisArg) {
    var len = this.length >>> 0;
    var result = [];
    var i;
    if (typeof fn !== 'function') {
      throw new TypeError('Array.prototype.filter 的参数必须是函数');
    }
    for (i = 0; i < len; i++) {
      if (i in this && fn.call(thisArg, this[i], i, this)) {
        result.push(this[i]);
      }
    }
    return result;
  };
}

/**
 * Array.prototype.indexOf
 */
function polyfillArrayIndexOf() {
  if (Array.prototype.indexOf) {
    return;
  }
  Array.prototype.indexOf = function (item, fromIndex) {
    var len = this.length >>> 0;
    var from = Number(fromIndex) || 0;
    from = from < 0 ? Math.ceil(from) : Math.floor(from);
    if (from < 0) {
      from += len;
    }
    for (; from < len; from++) {
      if (from in this && this[from] === item) {
        return from;
      }
    }
    return -1;
  };
}

/**
 * Array.prototype.forEach
 */
function polyfillArrayForEach() {
  if (Array.prototype.forEach) {
    return;
  }
  Array.prototype.forEach = function (fn, thisArg) {
    var len = this.length >>> 0;
    var i;
    if (typeof fn !== 'function') {
      throw new TypeError('Array.prototype.forEach 的参数必须是函数');
    }
    for (i = 0; i < len; i++) {
      if (i in this) {
        fn.call(thisArg, this[i], i, this);
      }
    }
  };
}

/**
 * Array.from（IE11 及以下缺失）
 * 只处理数组、类数组、字符串；不依赖 Symbol.iterator（IE 没有）
 */
function polyfillArrayFrom() {
  var toStr;
  var isCallable;
  var toInteger;
  var toLength;

  if (Array.from) {
    return;
  }
  toStr = Object.prototype.toString;
  isCallable = function (fn) {
    return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
  };
  toInteger = function (value) {
    var number = Number(value);
    if (isNaN(number)) {
      return 0;
    }
    if (number === 0 || !isFinite(number)) {
      return number;
    }
    return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
  };
  toLength = function (value) {
    var len = toInteger(value);
    return Math.min(Math.max(len, 0), 9007199254740991);
  };
  Array.from = function (arrayLike, mapFn, thisArg) {
    var items = Object(arrayLike);
    var len;
    var result;
    var i;
    if (arrayLike == null) {
      throw new TypeError('Array.from 的参数不能为 null 或 undefined');
    }
    if (typeof mapFn !== 'undefined' && !isCallable(mapFn)) {
      throw new TypeError('Array.from 的第二个参数必须是函数');
    }
    len = toLength(items.length);
    result = new Array(len);
    for (i = 0; i < len; i++) {
      if (typeof mapFn === 'undefined') {
        result[i] = items[i];
      } else {
        result[i] = mapFn.call(thisArg, items[i], i);
      }
    }
    result.length = len;
    return result;
  };
}

/* ==================== Document ==================== */

/**
 * document.getElementsByClassName（IE8 及以下缺失）
 * 注意：返回数组而不是 NodeList，与原生有差异，只作兜底
 */
function polyfillGetElementsByClassName() {
  if (document.getElementsByClassName) {
    return;
  }
  document.getElementsByClassName = function (className, element) {
    var root = element || document;
    var children = root.getElementsByTagName('*');
    var result = [];
    var i;
    var j;
    var classes;
    for (i = 0; i < children.length; i++) {
      classes = ' ' + children[i].className + ' ';
      classes = classes.replace(/\s+/g, ' ');
      if (classes.indexOf(' ' + className + ' ') > -1) {
        result.push(children[i]);
      }
    }
    return result;
  };
}

/* ==================== Element ==================== */

/**
 * Element.prototype.matches（IE9~11 缺失，优先用厂商前缀版本）
 */
function polyfillMatches() {
  var proto;

  if (typeof Element === 'undefined' || !Element.prototype) {
    return;
  }
  proto = Element.prototype;
  if (proto.matches) {
    return;
  }
  proto.matches = proto.msMatchesSelector ||
    proto.webkitMatchesSelector ||
    proto.mozMatchesSelector ||
    function (selector) {
      var nodes = (this.document || this.ownerDocument).querySelectorAll(selector);
      var i = nodes.length;
      while (i--) {
        if (nodes[i] === this) {
          return true;
        }
      }
      return false;
    };
}

/**
 * Element.prototype.closest（IE11 及以下缺失）
 */
function polyfillClosest() {
  var proto;

  if (typeof Element === 'undefined' || !Element.prototype) {
    return;
  }
  proto = Element.prototype;
  if (proto.closest) {
    return;
  }
  proto.closest = function (selector) {
    var el = this;
    do {
      if (!el || el.nodeType !== 1) {
        return null;
      }
      if (proto.matches.call(el, selector)) {
        return el;
      }
      el = el.parentElement || el.parentNode;
    } while (el && el.nodeType === 1);
    return null;
  };
}

/**
 * Element.prototype.classList（IE9 / IE10 缺失）
 * 用 defineProperty 挂 getter，每个元素独立一份，避免共用一个实例造成串值。
 * 只实现常用方法：add / remove / toggle / contains / item / length / value / toString。
 */
function polyfillClassList() {
  var proto;
  var descriptor;

  if (typeof Element === 'undefined' || !Element.prototype) {
    return;
  }
  proto = Element.prototype;

  // 不能直接读 proto.classList：现代浏览器在这里挂的是原生 getter，
  // this 指向 Element.prototype 而不是元素，会抛 Illegal invocation。
  // 用 descriptor 判断原生实现；data 属性值为 undefined 时仍继续补。
  try {
    descriptor = Object.getOwnPropertyDescriptor
      ? Object.getOwnPropertyDescriptor(proto, 'classList')
      : null;
  } catch (e) {
    descriptor = null;
  }

  if (descriptor) {
    if (descriptor.get || descriptor.set || typeof descriptor.value !== 'undefined') {
      return;
    }
  } else if ('classList' in proto) {
    return;
  }

  if (!Object.defineProperty) {
    return;
  }

  function createClassList(el) {
    function read() {
      var names = el.className ? el.className.replace(/^\s+|\s+$/g, '').split(/\s+/) : [];
      var result = [];
      var i;
      for (i = 0; i < names.length; i++) {
        if (names[i]) {
          result.push(names[i]);
        }
      }
      return result;
    }

    function write(names) {
      el.className = names.join(' ');
    }

    function contains(token) {
      var names = read();
      var i;
      for (i = 0; i < names.length; i++) {
        if (names[i] === token) {
          return true;
        }
      }
      return false;
    }

    var list = {
      add: function () {
        var names = read();
        var i;
        for (i = 0; i < arguments.length; i++) {
          if (!contains(arguments[i])) {
            names.push(arguments[i]);
          }
        }
        write(names);
      },
      remove: function () {
        var names = read();
        var token;
        var i;
        var j;
        for (i = 0; i < arguments.length; i++) {
          token = arguments[i];
          for (j = names.length - 1; j >= 0; j--) {
            if (names[j] === token) {
              names.splice(j, 1);
            }
          }
        }
        write(names);
      },
      toggle: function (token, force) {
        if (force === true) {
          this.add(token);
          return true;
        }
        if (force === false) {
          this.remove(token);
          return false;
        }
        if (contains(token)) {
          this.remove(token);
          return false;
        }
        this.add(token);
        return true;
      },
      contains: contains,
      item: function (index) {
        return read()[index] || null;
      },
      toString: function () {
        return read().join(' ');
      }
    };

    // IE9 的对象字面量不写 get 语法，统一用 defineProperty 挂动态属性
    try {
      Object.defineProperty(list, 'length', {
        get: function () {
          return read().length;
        }
      });
      Object.defineProperty(list, 'value', {
        get: function () {
          return read().join(' ');
        }
      });
    } catch (e) {
      /* 极老环境不支持访问器属性时，至少保留方法可用 */
    }
    return list;
  }

  try {
    Object.defineProperty(proto, 'classList', {
      configurable: true,
      get: function () {
        if (!this.__melClassList) {
          this.__melClassList = createClassList(this);
        }
        return this.__melClassList;
      }
    });
  } catch (e) {
    /* 部分老 IE 不支持在 DOM 原型上 defineProperty，保持无 classList，不阻断主流程 */
  }
}

/**
 * 执行全部补丁（可重复调用，已有原生实现全部跳过）
 */
export function applyPolyfills() {
  polyfillBind();
  polyfillArrayFilter();
  polyfillArrayIndexOf();
  polyfillArrayForEach();
  polyfillArrayFrom();
  polyfillGetElementsByClassName();
  polyfillMatches();
  polyfillClosest();
  polyfillClassList();
}

// 模块加载即执行，业务无需手动调用
applyPolyfills();

export default true;

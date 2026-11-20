/**
 * @File    iframe.js
 * @Desc    MelUI Core：iframe 弹窗（标题 / 打叉 / 按钮 / 遮罩 / 内嵌模式）
 * @Version 0.1.1
 * @Date    2026-11-19
 * @PubDate 2026-11-20 12:14:00
 * @Author  ChenMufeng
 *
 * ── 层级定位：core 公开能力层 ────────────────────────────
 * 由 core/core.js 的 publicApi 白名单提升为 melui.openIframe / melui.closeIframe。
 *
 * 【依赖方向】只能依赖 util/base 与 core/internal；遮罩复用 core/mask.js，
 *            不另建一套锁滚动和遮罩单例。
 *
 * 【兼容说明】
 *   IE9：纯 ES5；不用 classList / inset / flex；高度按 px 计算，内容区高度实测后写入；
 *        按钮与标题全部用 textContent 赋值，避免拼接 HTML 造成注入。
 *   iOS：iframe 加载完成后，尝试把子页面 html/body 改成 relative/fixed + 全屏，
 *        解决部分机型 iframe 被内容撑开、子页面 fixed 元素贴不住底部的问题；
 *        同源访问失败时静默跳过，不影响主流程。
 *   HTTPS：当前页为 https、目标地址明确为 http 时，浏览器会拦截混合内容，
 *        打开前直接提示，不创建弹窗。
 * ──────────────────────────────────────────────────────
 */

import { mergeObj } from '../util/base/object.js';
import { createEl, resolveElement, warn, setText, removeEl } from './internal/dom.js';
import { nextZIndex } from './internal/zIndex.js';
import { openMask, closeMask } from './mask.js';

/* ==================== 默认参数 ==================== */

var iframeDefaults = {
  url: '',
  caption: '',
  top: '1%',
  width: '98%',
  titleHeight: 35,
  titleFontSize: '',
  showCross: true,
  crossDirection: 'right',
  buttons: [],
  btnTheme: '',
  btnBgColor: [],
  btnDirection: 'horizontal',
  btnClickClose: false,
  btnCallBack: null,
  element: '',
  position: 'fixed',
  mask: true,
  params: {
    frameId: '',
    frameName: 'mel-frame-name',
    frameZindex: 0,
    frameRadius: true,
    frameBorder: true,
    maskId: '',
    maskZindex: 0,
    animation: {
      enable: true,
      direction: 'top'
    }
  },
  openCallBack: null,
  closeCallBack: null
};

/* ==================== 模块私有状态 ==================== */

var iframeSeed = 0;
var instances = [];

/* ==================== 私有工具 ==================== */

/**
 * 是否 iOS（含 iPad / iPod）
 * @return {Boolean}
 */
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * 当前页面是否 HTTPS
 * @return {Boolean}
 */
function isCurrentPageHttps() {
  return window.location.protocol === 'https:';
}

/**
 * 判断链接协议：true=https，false=http，null=相对路径 / 协议相对地址
 * @param {String} url
 * @return {Boolean|null}
 */
function isUrlHttps(url) {
  var match;
  var proto;

  if (!url || typeof url !== 'string') {
    return false;
  }
  match = url.match(/^(https?:)\/\/|^\/\//i);
  if (!match) {
    return null;
  }
  proto = match[1];
  if (proto) {
    return proto.toLowerCase() === 'https:';
  }
  return null;
}

/**
 * 是否会被浏览器按混合内容拦截
 * @param {String} url
 * @return {Boolean}
 */
function checkMixedContentRisk(url) {
  var pageHttps = isCurrentPageHttps();
  var urlHttps = isUrlHttps(url);

  if (!pageHttps) {
    return false;
  }
  if (urlHttps === true || urlHttps === null) {
    return false;
  }
  return true;
}

/**
 * 提示：优先 dialog 组件的 melui.alert，缺失时退回原生 alert
 * @param {String} message
 */
function internalTip(message) {
  var plain;

  if (window.melui && typeof window.melui.alert === 'function') {
    try {
      window.melui.alert({
        message: String(message),
        buttons: [{ text: '知道了，马上修改', type: 'warning' }]
      });
      return;
    } catch (e) {
      /* 组件异常时退回原生提示 */
    }
  }
  plain = String(message)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  window.alert(plain);
}

/**
 * 解析尺寸：百分比 / px / 纯数字
 * @param {String|Number} val
 * @param {Number} base 百分比的基准
 * @return {Object} { percent, px, style }
 */
function parseSize(val, base) {
  var str = String(val == null ? '' : val).replace(/^\s+|\s+$/g, '');
  var num;

  if (str === '') {
    return { percent: null, px: 0, style: '0px' };
  }
  if (str.indexOf('%') > -1) {
    num = parseFloat(str.replace(/%/g, ''));
    if (isNaN(num)) {
      num = 0;
    }
    return { percent: num, px: base * num / 100, style: num + '%' };
  }
  num = parseFloat(str.replace(/px/g, ''));
  if (isNaN(num)) {
    num = 0;
  }
  return { percent: null, px: num, style: num + 'px' };
}

/**
 * 取窗口高度
 * @return {Number}
 */
function getWinHeight() {
  return window.innerHeight ||
    document.documentElement.clientHeight ||
    document.body.clientHeight ||
    0;
}

/**
 * 按 id 查找 iframe 实例
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
 * 遍历子页面 html / body，修正 iOS iframe 被内容撑开的问题
 * 同源限制访问失败时静默跳过
 * @param {HTMLElement} frame
 */
function fixIOSFrame(frame) {
  var doc;
  var html;
  var body;

  try {
    doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
    if (!doc) {
      return;
    }
    html = doc.documentElement;
    body = doc.body;
    if (html) {
      html.style.position = 'relative';
      html.style.width = '100%';
      html.style.height = '100%';
      html.style.overflow = 'hidden';
    }
    if (body) {
      body.style.position = 'fixed';
      body.style.top = '0';
      body.style.left = '0';
      body.style.width = '100%';
      body.style.height = '100%';
      body.style.overflowY = 'auto';
      body.style.webkitOverflowScrolling = 'touch';
    }
  } catch (e) {
    /* 跨域子页面无权访问，保持原样 */
  }
}

/**
 * 关闭单个实例
 * @param {Object} ins
 */
function closeInstance(ins) {
  var idx;

  if (!ins) {
    return;
  }
  if (ins.resizeHandler) {
    if (window.removeEventListener) {
      window.removeEventListener('resize', ins.resizeHandler, false);
    } else if (window.detachEvent) {
      window.detachEvent('onresize', ins.resizeHandler);
    }
  }
  if (ins.maskId) {
    closeMask(ins.maskId);
  }
  removeEl(ins.root);

  idx = instances.indexOf(ins);
  if (idx > -1) {
    instances.splice(idx, 1);
  }

  if (typeof ins.opts.closeCallBack === 'function') {
    ins.opts.closeCallBack({ id: ins.id, el: ins.root });
  }
}

/* ==================== 对外 API ==================== */

/**
 * 打开 iframe 弹窗
 * @param {Object} options 参数，沿用 openIframe 的命名习惯
 * @param {String} options.url 链接地址
 * @param {String} options.caption 标题
 * @param {String|Number} options.top 距顶部距离，默认 1%
 * @param {String|Number} options.width 宽度，默认 98%
 * @param {Number} options.titleHeight 标题栏高度，默认 35
 * @param {String} options.titleFontSize 标题字号，可空
 * @param {Boolean} options.showCross 是否显示打叉，默认 true
 * @param {String} options.crossDirection left / right，默认 right
 * @param {Array} options.buttons 按钮文字数组
 * @param {String} options.btnTheme 按钮主题，空 / back
 * @param {Array} options.btnBgColor 按钮背景色数组
 * @param {String} options.btnDirection horizontal / vertical
 * @param {Boolean} options.btnClickClose 点按钮是否关闭，默认 false
 * @param {Function} options.btnCallBack 按钮回调，ret 从 1 开始
 * @param {String|HTMLElement} options.element 挂载节点，默认 body
 * @param {String} options.position fixed / relative
 * @param {Boolean} options.mask 是否显示遮罩，默认 true
 * @param {Object} options.params 内部参数（frameId / frameName / frameZindex /
 *        frameRadius / frameBorder / maskId / maskZindex / animation）
 * @param {Function} options.openCallBack 打开完成回调
 * @param {Function} options.closeCallBack 关闭回调
 * @return {Object|null} { id, el, iframe, close }
 */
export function openIframe(options) {
  var userOpts = options || {};
  var opts = mergeObj(iframeDefaults, userOpts);
  var frameSeed = iframeSeed + 1;
  var params;
  var host;
  var position;
  var topInfo;
  var widthInfo;
  var baseHeight;
  var rootHeight;
  var frameZ;
  var maskZ;
  var maskId;
  var root;
  var cross;
  var infoBar;
  var title;
  var btnBar;
  var content;
  var frame;
  var frameId;
  var ins;
  var infoH;
  var i;
  var btn;

  opts.params = mergeObj(iframeDefaults.params, userOpts.params || {});
  opts.params.animation = mergeObj(
    iframeDefaults.params.animation,
    (userOpts.params && userOpts.params.animation) || {}
  );

  // 按钮只接受数组：传字符串时按数组下标取值会变成逐字符渲染
  if (Object.prototype.toString.call(opts.buttons) !== '[object Array]') {
    opts.buttons = [];
  }
  if (Object.prototype.toString.call(opts.btnBgColor) !== '[object Array]') {
    opts.btnBgColor = [];
  }

  if (!opts.url || typeof opts.url !== 'string') {
    warn('openIframe 缺少 url');
    return null;
  }
  if (checkMixedContentRisk(opts.url)) {
    internalTip('打开链接失败！<br>原因：目标链接为 HTTP 协议，当前页面为 HTTPS 协议，无法直接嵌入。请将目标链接升级为 HTTPS。');
    return null;
  }

  host = opts.element ? resolveElement(opts.element) : document.body;
  if (!host) {
    return null;
  }

  position = opts.position === 'relative' ? 'relative' : 'fixed';
  params = opts.params;

  iframeSeed = frameSeed;
  frameId = params.frameId
    ? String(params.frameId).replace(/[.#]/g, '')
    : 'mel-frame-' + frameSeed;
  // 同一页面重复传同一个 frameId 时避免生成重复 DOM id
  if (document.getElementById(frameId)) {
    frameId = frameId + '-' + frameSeed;
  }
  maskId = opts.mask === false
    ? ''
    : (params.maskId ? String(params.maskId).replace(/^#/, '') : 'mel-iframe-mask-' + frameSeed);

  frameZ = parseInt(params.frameZindex, 10);
  if (isNaN(frameZ) || frameZ <= 0) {
    frameZ = nextZIndex();
  }
  maskZ = parseInt(params.maskZindex, 10);
  if (isNaN(maskZ) || maskZ <= 0) {
    maskZ = Math.max(frameZ - 10, 1);
  }

  baseHeight = position === 'fixed'
    ? getWinHeight()
    : (host.clientHeight || getWinHeight());
  topInfo = parseSize(opts.top, baseHeight);
  widthInfo = parseSize(opts.width, host.clientWidth || getWinHeight());
  rootHeight = baseHeight - 2 * topInfo.px;
  if (rootHeight < 0) {
    rootHeight = 0;
  }

  root = createEl('div', 'mel-iframe');
  root.id = 'mel-iframe-' + frameSeed;
  // 按钮回调里可通过 this.close() 关闭当前窗口
  opts.close = function () {
    closeIframe(root.id);
  };
  root.style.position = position;
  root.style.boxSizing = 'border-box';
  root.style.top = topInfo.style;
  root.style.width = widthInfo.style;
  root.style.height = rootHeight + 'px';
  root.style.zIndex = frameZ;
  if (widthInfo.percent !== null) {
    root.style.left = ((100 - widthInfo.percent) / 2) + '%';
  } else {
    root.style.left = '50%';
    root.style.marginLeft = (-widthInfo.px / 2) + 'px';
  }
  if (params.frameBorder === false) {
    root.className += ' mel-iframe-no-border';
  }
  if (params.frameRadius === false) {
    root.className += ' mel-iframe-no-radius';
  }
  if (opts.btnTheme) {
    root.className += ' mel-iframe-theme-' + opts.btnTheme;
  }
  if (params.animation && params.animation.enable === true) {
    root.className += ' mel-iframe-animation-' + (params.animation.direction || 'top');
  }

  // 打叉
  if (opts.showCross !== false) {
    cross = createEl('div', 'mel-iframe-close ' + (opts.crossDirection === 'left' ? 'left' : 'right'));
    setText(cross, '×');
    cross.addEventListener('click', function () {
      closeIframe(root.id);
    }, false);
    root.appendChild(cross);
  }

  // 标题 + 按钮
  infoBar = null;
  if (opts.caption !== '' || (opts.buttons && opts.buttons.length)) {
    infoBar = createEl('div', 'mel-iframe-info');

    if (opts.caption !== '') {
      title = createEl('div', 'mel-iframe-title');
      var titleH = parseInt(opts.titleHeight, 10);
      if (isNaN(titleH) || titleH < 0) {
        titleH = 35;
      }
      title.style.height = titleH + 'px';
      title.style.lineHeight = titleH + 'px';
      if (opts.titleFontSize) {
        title.style.fontSize = String(opts.titleFontSize).replace(/px/g, '') + 'px';
      }
      setText(title, opts.caption);
      infoBar.appendChild(title);
    }

    if (opts.buttons && opts.buttons.length) {
      btnBar = createEl('div', 'mel-iframe-buttons ' + (opts.btnDirection === 'vertical' ? 'vertical' : 'horizontal'));
      for (i = 0; i < opts.buttons.length; i++) {
        btn = createEl('button', 'mel-iframe-btn mel-iframe-btn-' + (i + 1));
        btn.type = 'button';
        setText(btn, opts.buttons[i]);
        if (opts.btnBgColor && opts.btnBgColor[i]) {
          btn.style.backgroundColor = opts.btnBgColor[i];
        }
        btn.setAttribute('data-index', String(i + 1));
        btn.addEventListener('click', (function (index) {
          return function () {
            if (opts.btnClickClose) {
              closeIframe(root.id);
            }
            if (typeof opts.btnCallBack === 'function') {
              opts.btnCallBack.call(opts, index);
            }
          };
        })(i + 1), false);
        btnBar.appendChild(btn);
      }
      infoBar.appendChild(btnBar);
    }
    root.appendChild(infoBar);
  }

  // iframe 内容区
  content = createEl('div', 'mel-iframe-content');
  frame = document.createElement('iframe');
  frame.className = 'mel-iframe-frame';
  frame.id = frameId;
  frame.name = params.frameName || 'mel-frame-name';
  frame.setAttribute('frameborder', '0');
  frame.style.width = '100%';
  frame.style.height = '100%';
  frame.style.border = '0';
  frame.style.display = 'block';

  if (isIOS()) {
    frame.addEventListener('load', function () {
      fixIOSFrame(frame);
    }, false);
  }
  content.appendChild(frame);
  root.appendChild(content);
  host.appendChild(root);

  frame.src = opts.url;

  // 内容区高度 = 弹窗内高 - 标题按钮区高度（IE9 不支持 flex，只能实测后写 px）
  infoH = infoBar ? (infoBar.offsetHeight || 0) : 0;
  content.style.height = Math.max(0, (root.clientHeight || rootHeight) - infoH) + 'px';

  if (opts.mask !== false) {
    openMask({
      id: maskId,
      zIndex: maskZ,
      color: 'rgba(0,0,0,0.3)',
      lockScroll: true,
      clickClose: false
    });
  }

  ins = {
    id: root.id,
    root: root,
    iframe: frame,
    maskId: maskId,
    opts: opts,
    resizeHandler: null,
    close: function () {
      closeIframe(root.id);
    }
  };

  // 尺寸随窗口变化重算，避免缩小窗口后内容区还是旧高度
  ins.resizeHandler = function () {
    var newBase = position === 'fixed'
      ? getWinHeight()
      : (host.clientHeight || getWinHeight());
    var newTop = parseSize(opts.top, newBase);
    var newRootH = newBase - 2 * newTop.px;
    var newInfoH = infoBar ? (infoBar.offsetHeight || 0) : 0;
    if (newRootH < 0) {
      newRootH = 0;
    }

    root.style.top = newTop.style;
    root.style.height = newRootH + 'px';
    content.style.height = Math.max(0, (root.clientHeight || newRootH) - newInfoH) + 'px';
  };
  if (window.addEventListener) {
    window.addEventListener('resize', ins.resizeHandler, false);
  } else if (window.attachEvent) {
    window.attachEvent('onresize', ins.resizeHandler);
  }

  instances.push(ins);

  if (typeof opts.openCallBack === 'function') {
    opts.openCallBack.call(opts);
  }
  return {
    id: ins.id,
    el: root,
    iframe: frame,
    close: ins.close
  };
}

/**
 * 关闭 iframe 弹窗
 * @param {String|HTMLElement} target 可选
 *        不传：关闭最后打开的一个
 *        'all'：关闭全部
 *        id / 节点：关闭指定
 * @return {Boolean}
 */
export function closeIframe(target) {
  var ins = null;
  var i;

  if (target === 'all') {
    var snapshot = instances.slice();
    for (i = 0; i < snapshot.length; i++) {
      closeInstance(snapshot[i]);
    }
    return true;
  }

  if (target == null) {
    ins = instances.length ? instances[instances.length - 1] : null;
  } else if (target.nodeType === 1) {
    for (i = 0; i < instances.length; i++) {
      if (instances[i].root === target || instances[i].iframe === target) {
        ins = instances[i];
        break;
      }
    }
  } else if (typeof target === 'string') {
    ins = findById(target.replace(/^#/, ''));
  }

  if (!ins) {
    // 不传 target 且已经没有实例时属于正常情况（例如 btnClickClose 后再手动 close），
    // 只有明确指定了 id / 节点却找不到才提示
    if (target != null) {
      warn('未找到要关闭的 iframe：' + target);
    }
    return false;
  }
  closeInstance(ins);
  return true;
}

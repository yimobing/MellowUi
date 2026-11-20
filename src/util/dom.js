/**
 * @File    dom.js
 * @Desc    MelUI Util 工具层：DOM 查询 / 类名 / 节点插入 / 位置尺寸 / 滚动 / 输入增强
 * @Version 0.1.3
 * @Date    2026-11-18
 * @PubDate 2026-11-20 15:04:00
 * @Author  ChenMufeng
 *
 * 【实现约定】
 *   1. getChildElement 只筛选子元素，不删除注释/空白文本节点；
 *   2. addClass 用内部判定，兼容没有 classList 的 IE9；
 *   3. appendHtml 直接插入，不向 HTMLElement.prototype 挂方法；
 *   4. prependChild 在容器只有 script/style 时改为追加；
 *   5. makeTextareaExpanding 每次重新计算高度，不会被 maxHeight 永久卡住。
 * 【对外形态】melui.util.dom.xxx
 * ──────────────────────────────────────────────────────
 */

/** 内部：事件绑定（attachEvent 场景把 this 绑回元素） */
function internalBind(fn, context) {
  return function () {
    return fn.apply(context, arguments);
  };
}

/** 内部：元素是否带某个 class */
function internalHasClass(el, cls) {
  if (!el || !el.className) {
    return false;
  }
  return (' ' + el.className.replace(/\s+/g, ' ') + ' ').indexOf(' ' + cls + ' ') > -1;
}

/** 内部：节点是否匹配类名或标签名 */
function internalMatchNode(node, classOrTagName) {
  var name = classOrTagName.toString().toLowerCase();
  if (node.tagName && node.tagName.toLowerCase() === name) {
    return true;
  }
  return internalHasClass(node, classOrTagName);
}

/** 内部：把选择器 / NodeList / DOM 统一成 DOM 元素 */
function internalResolveElement(o) {
  if (o == null) {
    return null;
  }
  if (typeof o === 'string') {
    var str = o.replace(/^\s+|\s+$/g, '');
    if (str.charAt(0) === '#') {
      return document.getElementById(str.substr(1));
    }
    if (str.charAt(0) === '.') {
      var byClass = document.getElementsByClassName
        ? document.getElementsByClassName(str.substr(1))
        : [];
      return byClass.length ? byClass[0] : null;
    }
    return document.querySelector ? document.querySelector(str) : null;
  }
  if (o.nodeType === 1) {
    return o;
  }
  if (typeof o.item === 'function') {
    return o.item(0) || null;
  }
  if (o.length && o[0] && o[0].nodeType === 1) {
    return o[0];
  }
  return null;
}

/**
 * 读取 data-* 属性（IE11 以下无 dataset）
 * @param {HTMLElement} ele DOM 元素
 * @returns {Object} 属性键值对象，键会从连字符转成驼峰；无元素时返回空对象
 * @example
 * // <div class="slide" data-auto-play="true" data-delay="3000"></div>
 * getDataset(document.querySelector('.slide'))
 * // { autoPlay: 'true', delay: '3000' }
 * getDataset(null)
 * // {}
 */
export function getDataset(ele) {
  var dataset;
  var attrs;
  var i;
  var matchStr;
  var name;
  if (!ele) {
    return {};
  }
  if (ele.dataset) {
    return ele.dataset;
  }
  attrs = ele.attributes;
  dataset = {};
  for (i = 0; i < attrs.length; i++) {
    matchStr = attrs[i].name.match(/^data-(.+)/);
    if (matchStr) {
      name = matchStr[1].replace(/-([\da-z])/gi, function (all, letter) {
        return letter.toUpperCase();
      });
      dataset[name] = attrs[i].value;
    }
  }
  return dataset;
}

/**
 * 添加 class（兼容无 classList 的 IE9）
 * @param {HTMLElement} el
 * @param {String} cls
 * @returns {void} 无返回值，直接修改元素的 className；元素为空时不做任何事
 * @example
 * addClass(document.querySelector('.box'), 'active')
 * // <div class="box active">
 */
export function addClass(el, cls) {
  if (!el) {
    return;
  }
  if (el.classList) {
    el.classList.add(cls);
  } else if (!internalHasClass(el, cls)) {
    el.className += (el.className ? ' ' : '') + cls;
  }
}

/**
 * 移除 class（兼容无 classList 的 IE9）
 * @param {HTMLElement} el
 * @param {String} cls
 * @returns {void} 无返回值，直接修改元素的 className；元素为空或本来没有该 class 时不做任何事
 * @example
 * removeClass(document.querySelector('.box'), 'active')
 * // <div class="box">
 */
export function removeClass(el, cls) {
  var arr;
  var idx;
  if (!el) {
    return;
  }
  if (el.classList) {
    el.classList.remove(cls);
    return;
  }
  arr = el.className.replace(/^\s+|\s+$/g, '').split(/\s+/);
  idx = arr.indexOf(cls);
  if (idx > -1) {
    arr.splice(idx, 1);
  }
  el.className = arr.join(' ');
}

/**
 * 取直接子元素（可按类名或标签名过滤）
 * @param {HTMLElement} o 父节点
 * @param {String} classOrTagName 可选，类名或标签名
 * @returns {Array|null} 直接子元素组成的新数组，不是 NodeList；父节点为空时返回 null，无匹配返回 []
 * @example
 * // <div><p></p><div class="active"></div></div>
 * getChildElement(box)
 * // [<p>, <div class="active">]
 * getChildElement(box, 'active')
 * // [<div class="active">]
 * getChildElement(null)
 * // null
 */
export function getChildElement(o, classOrTagName) {
  var children;
  var result = [];
  var i;
  var node;
  if (o == null) {
    return null;
  }
  children = o.childNodes;
  if (typeof classOrTagName === 'undefined') {
    for (i = 0; i < children.length; i++) {
      if (children[i].nodeType === 1) {
        result.push(children[i]);
      }
    }
    return result;
  }
  for (i = 0; i < children.length; i++) {
    node = children[i];
    if (node.nodeType === 1 && internalMatchNode(node, classOrTagName)) {
      result.push(node);
    }
  }
  return result;
}

/**
 * 取子孙元素（含自身，可按类名或标签名过滤）
 * @param {HTMLElement} o 当前节点
 * @param {String} classOrTagName 可选，类名或标签名；不传则返回自身及全部后代元素
 * @returns {Array} 匹配到的元素组成的新数组；节点为空或无匹配返回 []
 * @example
 * // <div class="box"><span class="item"></span><span class="item"></span></div>
 * getChildrenElement(box, 'item')
 * // [<span class="item">, <span class="item">]
 * getChildrenElement(box)
 * // [<div class="box">, <span class="item">, <span class="item">]（包含 box 自身）
 */
export function getChildrenElement(o, classOrTagName) {
  var result = [];
  function search(node) {
    var i;
    var child;
    if (!node || node.nodeType !== 1) {
      return;
    }
    if (typeof classOrTagName === 'undefined' || internalMatchNode(node, classOrTagName)) {
      result.push(node);
    }
    for (i = 0; i < node.childNodes.length; i++) {
      child = node.childNodes[i];
      if (child.nodeType === 1) {
        search(child);
      }
    }
  }
  search(o);
  return result;
}

/**
 * 第一个子元素
 * @param {HTMLElement} o
 * @returns {HTMLElement|null} 第一个元素子节点；没有元素子节点或父节点为空时返回 null
 * @example
 * getFirstChildElement(document.querySelector('.box'))
 * // <p> 或 null
 */
export function getFirstChildElement(o) {
  if (o == null) {
    return null;
  }
  return o.children[0] || null;
}

/**
 * 最后一个子元素
 * @param {HTMLElement} o
 * @returns {HTMLElement|null} 最后一个元素子节点；没有元素子节点或父节点为空时返回 null
 * @example
 * getLastChildElement(document.querySelector('.box'))
 * // <div> 或 null
 */
export function getLastChildElement(o) {
  if (o == null) {
    return null;
  }
  return o.children[o.children.length - 1] || null;
}

/**
 * 下一个兄弟元素（跳过文本节点）
 * @param {HTMLElement} o
 * @returns {HTMLElement|null} 下一个元素兄弟节点；没有则返回 null
 * @example
 * getNextElement(document.querySelector('.item'))
 * // <span class="item"> 或 null
 */
export function getNextElement(o) {
  var e;
  if (o == null) {
    return null;
  }
  e = o.nextSibling;
  while (e) {
    if (e.nodeType === 1) {
      return e;
    }
    e = e.nextSibling;
  }
  return null;
}

/**
 * 上一个兄弟元素（跳过文本节点）
 * @param {HTMLElement} o
 * @returns {HTMLElement|null} 上一个元素兄弟节点；没有则返回 null
 * @example
 * getPrevElement(document.querySelector('.item'))
 * // <span class="item"> 或 null
 */
export function getPrevElement(o) {
  var e;
  if (o == null) {
    return null;
  }
  e = o.previousSibling;
  while (e) {
    if (e.nodeType === 1) {
      return e;
    }
    e = e.previousSibling;
  }
  return null;
}

/**
 * 全部兄弟元素（不含自身）
 * @param {HTMLElement} o
 * @returns {Array} 同级元素组成的新数组，不含自身；无父节点时返回 []
 * @example
 * // <div><p></p><span></span><a></a></div>
 * getAllSiblingElement(span)
 * // [<p>, <a>]
 */
export function getAllSiblingElement(o) {
  var result = [];
  var siblings;
  var i;
  if (!o || !o.parentNode) {
    return result;
  }
  siblings = o.parentNode.children;
  for (i = 0; i < siblings.length; i++) {
    if (siblings[i] !== o) {
      result.push(siblings[i]);
    }
  }
  return result;
}

/**
 * 前面的全部兄弟元素
 * @param {HTMLElement} o
 * @returns {Array} 自身前面的同级元素组成的新数组；是第一个子元素或无父节点时返回 []
 * @example
 * // <div><p></p><span></span><a></a></div>
 * getAllPrevElement(a)
 * // [<p>, <span>]
 */
export function getAllPrevElement(o) {
  var arr = [];
  var parent;
  var i;
  if (!o || !o.parentNode) {
    return arr;
  }
  parent = o.parentNode;
  for (i = 0; i < parent.children.length; i++) {
    if (parent.children[i] === o) {
      break;
    }
    arr.push(parent.children[i]);
  }
  return arr;
}

/**
 * 后面的全部兄弟元素
 * @param {HTMLElement} o
 * @param {String} classOrTagName 可选，类名或标签名
 * @returns {Array} 自身后面的同级元素组成的新数组；无匹配、是最后一个子元素或无父节点时返回 []
 * @example
 * // <div><p></p><span class="item"></span><a class="item"></a></div>
 * getAllNextElement(p, 'item')
 * // [<span class="item">, <a class="item">]
 */
export function getAllNextElement(o, classOrTagName) {
  var arr = [];
  var parent;
  var i;
  var index = -1;
  var child;
  if (!o || !o.parentNode) {
    return arr;
  }
  parent = o.parentNode;
  for (i = 0; i < parent.children.length; i++) {
    child = parent.children[i];
    if (child === o) {
      index = i;
      continue;
    }
    if (index !== -1 && i > index) {
      if (typeof classOrTagName === 'undefined' || internalMatchNode(child, classOrTagName)) {
        arr.push(child);
      }
    }
  }
  return arr;
}

/**
 * 读取节点内部 HTML（innerHTML）
 * @param {HTMLElement|String|NodeList} el 元素、选择器或节点集合
 * @returns {String} 元素 innerHTML；取不到元素时返回空串
 * @example
 * getHtml('#box')
 * // '<p>内容</p>'
 * getHtml('#missing')
 * // ''
 */
export function getHtml(el) {
  var node = internalResolveElement(el);
  return node ? node.innerHTML : '';
}

/**
 * 写入节点内部 HTML
 * @param {HTMLElement|String|NodeList} el 元素、选择器或节点集合
 * @param {String} str HTML 字符串，传 null / undefined 视为空串
 * @returns {HTMLElement|null} 被写入的元素；取不到元素时返回 null，且不执行写入
 * @example
 * setHtml('#box', '<p>新内容</p>')
 * // 返回 #box，页面内容变为 <p>新内容</p>
 * setHtml('#missing', 'x')
 * // null
 */
export function setHtml(el, str) {
  var node = internalResolveElement(el);
  if (!node) {
    return null;
  }
  node.innerHTML = str == null ? '' : String(str);
  return node;
}

/**
 * 读取带表单当前值的 HTML
 *
 * 解决的问题：innerHTML 只反映标签上的初始属性；用户在 input / textarea /
 * radio / checkbox / option 上输入、勾选、选择后，改变的是运行时状态，
 * 直接读 innerHTML 拿到的是旧值。本函数先把运行时状态同步回标签属性，再读 innerHTML。
 *
 * 处理范围：input、button、textarea、radio、checkbox、option；
 *          不处理 contenteditable。
 * 注意：会改写目标节点内部控件的 value / checked / selected 属性；
 *      返回内容包含用户输入，重新插入页面前需自行保证内容可信，存在 XSS 风险。
 *
 * @param {HTMLElement|String|NodeList} el 容器元素、选择器或节点集合
 * @returns {String} 同步后的 innerHTML；取不到元素时返回空串；元素不支持 querySelectorAll 时直接返回原 innerHTML
 * @example
 * // <div id="form"><input value="旧值"><textarea>旧文本</textarea></div>
 * // 用户输入后：
 * getCurrentFormHtml('#form')
 * // '<input value="新值"><textarea>新文本</textarea>'
 * getCurrentFormHtml('#missing')
 * // ''
 */
export function getCurrentFormHtml(el) {
  var node = internalResolveElement(el);
  var inputs;
  var textareas;
  var choices;
  var options;
  var i;

  if (!node) {
    return '';
  }
  if (!node.querySelectorAll) {
    return node.innerHTML;
  }

  inputs = node.querySelectorAll('input, button');
  for (i = 0; i < inputs.length; i++) {
    var type = (inputs[i].getAttribute('type') || 'text').toLowerCase();
    // radio / checkbox 的 value 由属性直接反射，checked 单独处理；
    // file 的 value 受安全限制无法写回属性，这三类跳过 value 同步
    if (type === 'radio' || type === 'checkbox' || type === 'file') {
      continue;
    }
    inputs[i].setAttribute('value', inputs[i].value);
  }

  textareas = node.querySelectorAll('textarea');
  for (i = 0; i < textareas.length; i++) {
    if (typeof textareas[i].textContent !== 'undefined') {
      textareas[i].textContent = textareas[i].value;
    } else {
      textareas[i].innerText = textareas[i].value;
    }
  }

  choices = node.querySelectorAll('input[type="radio"], input[type="checkbox"]');
  for (i = 0; i < choices.length; i++) {
    if (choices[i].checked) {
      choices[i].setAttribute('checked', 'checked');
    } else {
      choices[i].removeAttribute('checked');
    }
  }

  options = node.querySelectorAll('option');
  for (i = 0; i < options.length; i++) {
    if (options[i].selected) {
      options[i].setAttribute('selected', 'selected');
    } else {
      options[i].removeAttribute('selected');
    }
  }

  return node.innerHTML;
}

/**
 * 往容器末尾插入 HTML 字符串
 * @param {String} str HTML 字符串
 * @param {HTMLElement} el 容器
 * @returns {void} 无返回值，直接向容器追加节点
 * @example
 * appendHtml('<p>新内容</p>', document.querySelector('.box'))
 * // .box 末尾新增一个 <p>
 */
export function appendHtml(str, el) {
  var divTemp = document.createElement('div');
  var nodes;
  var fragment = document.createDocumentFragment();
  var i;
  divTemp.innerHTML = str;
  nodes = divTemp.childNodes;
  for (i = 0; i < nodes.length; i++) {
    fragment.appendChild(nodes[i].cloneNode(true));
  }
  el.appendChild(fragment);
  divTemp = null;
}

/**
 * 往容器最前面插入 HTML 字符串
 * @param {String} str HTML 字符串
 * @param {HTMLElement} el 容器
 * @returns {void} 无返回值，直接向容器最前面插入节点
 * @example
 * prependHtml('<p>新内容</p>', document.querySelector('.box'))
 * // .box 第一个子节点变为新插入的 <p>
 */
export function prependHtml(str, el) {
  var divTemp = document.createElement('div');
  var nodes;
  var fragment = document.createDocumentFragment();
  var i;
  divTemp.innerHTML = str;
  nodes = divTemp.childNodes;
  for (i = 0; i < nodes.length; i++) {
    fragment.appendChild(nodes[i].cloneNode(true));
  }
  el.insertBefore(fragment, el.firstChild);
  divTemp = null;
}

/**
 * 追加子节点：定位最后一个普通子节点，插到它后面
 *
 * 会跳过尾部连续的 script / style / .controls，但如果这些节点后面还有普通子节点，
 * 就以最后一个普通子节点为准，新节点会排到这些特殊节点之后。
 *
 * @param {HTMLElement} childNode 子节点
 * @param {HTMLElement} fatherNode 父节点
 * @returns {void} 无返回值，直接移动/插入节点；父节点没有普通子节点时直接 append 到末尾
 * @example
 * // <div class="box"><p></p><script></script></div>
 * appendChild(document.createElement('span'), document.querySelector('.box'))
 * // 新 <span> 插在 <p> 后面、<script> 前面
 */
export function appendChild(childNode, fatherNode) {
  var childrenNode = fatherNode.children;
  var i;
  var target = null;
  for (i = childrenNode.length - 1; i >= 0; i--) {
    if (childrenNode[i].tagName === 'STYLE' ||
      childrenNode[i].tagName === 'SCRIPT' ||
      childrenNode[i].className === 'controls') {
      continue;
    }
    target = childrenNode[i];
    break;
  }
  if (target) {
    insertAfter(childNode, target);
  } else {
    fatherNode.appendChild(childNode);
  }
}

/**
 * 插入子节点到容器最前面，跳过 script / style
 * @param {HTMLElement} childNode 子节点
 * @param {HTMLElement} fatherNode 父节点
 * @returns {void} 无返回值，直接移动/插入节点；容器只有 script/style 或为空时 append 到末尾
 * @example
 * prependChild(document.createElement('p'), document.querySelector('.box'))
 * // 新 <p> 插在 .box 内第一个普通子节点之前
 */
export function prependChild(childNode, fatherNode) {
  var childrenNode = fatherNode.children;
  var i;
  var inserted = false;
  for (i = 0; i < childrenNode.length; i++) {
    if (childrenNode[i].tagName === 'STYLE' || childrenNode[i].tagName === 'SCRIPT') {
      continue;
    }
    fatherNode.insertBefore(childNode, childrenNode[i]);
    inserted = true;
    break;
  }
  if (!inserted) {
    fatherNode.appendChild(childNode);
  }
}

/**
 * 在已有节点后面插入新节点
 * @param {HTMLElement} newNode 新节点
 * @param {HTMLElement} existingNode 已有节点
 * @returns {void} 无返回值，直接插入节点；已有节点是父节点最后一个元素时直接 append
 * @example
 * insertAfter(document.createElement('p'), document.querySelector('.item'))
 * // 新 <p> 出现在 .item 后面
 */
export function insertAfter(newNode, existingNode) {
  var parent = existingNode.parentNode;
  var lastNode = parent.lastElementChild || parent.lastChild;
  var siblingNode = existingNode.nextElementSibling || existingNode.nextSibling;
  if (lastNode === existingNode) {
    parent.appendChild(newNode);
  } else {
    parent.insertBefore(newNode, siblingNode);
  }
}

/**
 * 移除节点
 * @param {HTMLElement} node
 * @returns {void} 无返回值；节点为空或已没有父节点时不做任何事
 * @example
 * removeNode(document.querySelector('.item'))
 * // .item 从页面移除
 */
export function removeNode(node) {
  if (node && node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

/**
 * 取元素的计算样式
 * @param {HTMLElement} o
 * @returns {CSSStyleDeclaration|Object} 现代浏览器返回 getComputedStyle 结果；旧 IE 返回 currentStyle
 * @example
 * getElementStyle(document.querySelector('.box')).width
 * // '200px'
 */
export function getElementStyle(o) {
  if (window.getComputedStyle) {
    return window.getComputedStyle(o, null);
  }
  return o.currentStyle;
}

/**
 * 元素到文档顶部的距离（含祖先 offsetTop 与 html 的 margin-top）
 * @param {HTMLElement} o
 * @returns {Number} 相对文档顶部的像素值，包含逐级 offsetParent 的 offsetTop 与 html 的 margin-top
 * @example
 * getElementTop(document.querySelector('.box'))
 * // 120
 */
export function getElementTop(o) {
  var actualTop = o.offsetTop;
  var current = o.offsetParent;
  var docStyle;
  var docMarTop;
  while (current !== null) {
    actualTop += current.offsetTop;
    current = current.offsetParent;
  }
  docStyle = getElementStyle(document.documentElement);
  docMarTop = parseInt(String(docStyle.marginTop).replace(/px/g, ''), 10);
  if (!isNaN(docMarTop)) {
    actualTop += docMarTop;
  }
  return actualTop;
}

/**
 * 元素到文档左侧的距离（含祖先 offsetLeft 与页面居中补偿）
 * @param {HTMLElement} o
 * @returns {Number} 相对文档左侧的像素值；页面宽度大于文档宽度时补上居中偏移
 * @example
 * getElementLeft(document.querySelector('.box'))
 * // 80
 */
export function getElementLeft(o) {
  var actualLeft = o.offsetLeft;
  var current = o.offsetParent;
  var winW;
  var docStyle;
  var docW;
  while (current !== null) {
    actualLeft += current.offsetLeft;
    current = current.offsetParent;
  }
  winW = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
  docStyle = getElementStyle(document.documentElement);
  docW = parseFloat(String(docStyle.width).replace(/px/g, ''));
  if (isNaN(docW) || docW <= 0) {
    return actualLeft;
  }
  if (winW === docW || document.documentElement.clientWidth === docW || document.body.clientWidth === docW) {
    return actualLeft;
  }
  return actualLeft + Math.ceil((winW - docW) / 2);
}

/**
 * 元素宽度（隐藏元素用 clientWidth + padding + border 兜底）
 * @param {HTMLElement} o
 * @returns {Number} 元素像素宽度；元素为空或无法测量时返回 0
 * @example
 * getElementWidth(document.querySelector('.box'))
 * // 200
 * getElementWidth(null)
 * // 0
 */
export function getElementWidth(o) {
  var styles;
  var w;
  var paddingLeft;
  var paddingRight;
  var borderLeft;
  var borderRight;
  if (!o) {
    return 0;
  }
  styles = getElementStyle(o);
  w = o.offsetWidth;
  paddingLeft = parseFloat(styles.paddingLeft);
  paddingRight = parseFloat(styles.paddingRight);
  borderLeft = parseFloat(styles.borderLeftWidth);
  borderRight = parseFloat(styles.borderRightWidth);
  if (w === 0 && !isNaN(paddingLeft) && !isNaN(paddingRight) && !isNaN(borderLeft) && !isNaN(borderRight)) {
    w = o.clientWidth;
    w += isNaN(paddingLeft) ? 0 : paddingLeft;
    w += isNaN(paddingRight) ? 0 : paddingRight;
    w += isNaN(borderLeft) ? 0 : borderLeft;
    w += isNaN(borderRight) ? 0 : borderRight;
  }
  return w;
}

/**
 * 元素高度（隐藏元素用 clientHeight + padding + border 兜底）
 * @param {HTMLElement} o
 * @returns {Number} 元素像素高度；元素为空或无法测量时返回 0
 * @example
 * getElementHeight(document.querySelector('.box'))
 * // 80
 * getElementHeight(null)
 * // 0
 */
export function getElementHeight(o) {
  var styles;
  var h;
  var paddingTop;
  var paddingBottom;
  var borderTop;
  var borderBottom;
  if (!o) {
    return 0;
  }
  styles = getElementStyle(o);
  h = o.offsetHeight;
  paddingTop = parseFloat(styles.paddingTop);
  paddingBottom = parseFloat(styles.paddingBottom);
  borderTop = parseFloat(styles.borderTopWidth);
  borderBottom = parseFloat(styles.borderBottomWidth);
  if (h === 0 && !isNaN(paddingTop) && !isNaN(paddingBottom) && !isNaN(borderTop) && !isNaN(borderBottom)) {
    h = o.clientHeight;
    h += isNaN(paddingTop) ? 0 : paddingTop;
    h += isNaN(paddingBottom) ? 0 : paddingBottom;
    h += isNaN(borderTop) ? 0 : borderTop;
    h += isNaN(borderBottom) ? 0 : borderBottom;
  }
  return h;
}

/**
 * 浏览器滚动条宽度
 * @returns {Number} 滚动条占用的像素宽度，一般为 15~21；用覆盖式滚动条或没有 body 时返回 0
 * @example
 * getScrollbarWidth()
 * // 17
 */
export function getScrollbarWidth() {
  var outer;
  var inner;
  var width;
  if (!document.body) {
    return 0;
  }
  outer = document.createElement('div');
  inner = document.createElement('div');
  outer.style.position = 'absolute';
  outer.style.top = '-1000px';
  outer.style.left = '-1000px';
  outer.style.width = '100px';
  outer.style.height = '100px';
  outer.style.overflow = 'auto';
  inner.style.width = '100%';
  inner.style.height = '200px';
  outer.appendChild(inner);
  document.body.appendChild(outer);
  width = outer.offsetWidth - outer.clientWidth;
  document.body.removeChild(outer);
  return width;
}

/**
 * 滚动到指定位置，完成后回调
 *
 * window 场景使用原生 window.scrollTo(left, top)，不传 behavior；
 * 元素场景优先用 element.scrollTo({ top, left, behavior })，不支持时退回直接赋值。
 * 回调在滚动位置与目标相差 1px 以内时触发；已在目标位置则同步触发。
 *
 * @param {Object} options
 * @param {HTMLElement|Window} options.element 滚动容器，默认 window
 * @param {Number} options.top 目标纵向位置，默认 0
 * @param {Number} options.left 目标横向位置，默认 0
 * @param {String} options.behavior auto（默认）/ smooth（仅元素场景且浏览器支持时生效）
 * @param {Function} options.callback 滚动结束回调
 * @returns {void} 无返回值，只执行滚动并可选触发回调
 * @example
 * elementScrollTo({
 *   element: document.querySelector('.list'),
 *   top: 100,
 *   behavior: 'smooth',
 *   callback: function () { console.log('滚动结束'); }
 * });
 */
export function elementScrollTo(options) {
  var opt = options || {};
  var element = opt.element || window;
  var top = typeof opt.top === 'number' ? opt.top : 0;
  var left = typeof opt.left === 'number' ? opt.left : 0;
  var behavior = opt.behavior || 'auto';
  var callback = opt.callback;
  var isWindow = element === window;
  var running;

  function currentTop() {
    return isWindow ? (window.pageYOffset || document.documentElement.scrollTop || 0) : element.scrollTop;
  }

  function done() {
    if (typeof callback === 'function') {
      callback();
    }
  }

  if (isWindow) {
    window.scrollTo(left, top);
  } else if (typeof element.scrollTo === 'function') {
    try {
      element.scrollTo({ top: top, left: left, behavior: behavior });
    } catch (e) {
      element.scrollTop = top;
      element.scrollLeft = left;
    }
  } else {
    element.scrollTop = top;
    element.scrollLeft = left;
  }
  if (typeof callback !== 'function') {
    return;
  }
  if (Math.abs(currentTop() - top) <= 1) {
    done();
    return;
  }
  running = function () {
    if (Math.abs(currentTop() - top) <= 1) {
      if (element.removeEventListener) {
        element.removeEventListener('scroll', running, false);
      } else if (element.detachEvent) {
        element.detachEvent('onscroll', running);
      }
      done();
    }
  };
  if (element.addEventListener) {
    element.addEventListener('scroll', running, false);
  } else if (element.attachEvent) {
    element.attachEvent('onscroll', running);
  }
}

/**
 * 兼容 IE8- 的事件绑定
 * @param {HTMLElement|Window} ele 绑定对象
 * @param {String} event 事件名
 * @param {Function} fn 回调
 * @returns {void} 无返回值；现代浏览器用 addEventListener，旧 IE 用 attachEvent 并把 this 绑回 ele
 * @example
 * addEventListener(document.querySelector('.btn'), 'click', function () {
 *   console.log('clicked');
 * });
 */
export function addEventListener(ele, event, fn) {
  if (ele.addEventListener) {
    ele.addEventListener(event, fn, false);
  } else if (ele.attachEvent) {
    ele.attachEvent('on' + event, internalBind(fn, ele));
  }
}

/**
 * textarea 随内容自动增高
 * @param {HTMLElement|String|NodeList} el 元素、选择器或节点集合
 * @param {Object} opt 可选
 * @param {Number} opt.initHeight 初始高度，默认 28
 * @param {Number} opt.maxHeight 最大高度，默认 120；传 0 或负数表示不限制
 * @returns {void} 无返回值；找不到元素时不做任何事，找到后会立即设置一次高度并监听 input / 删除键 / 剪切
 * @example
 * makeTextareaExpanding('#remark', { initHeight: 32, maxHeight: 160 })
 * // textarea 初始 32px，随输入增高，最高 160px，超过后出现纵向滚动条
 */
export function makeTextareaExpanding(el, opt) {
  var target = internalResolveElement(el);
  var option = opt || {};
  var initHeight = typeof option.initHeight === 'undefined' ? 28 : parseInt(option.initHeight, 10);
  var maxHeight = typeof option.maxHeight === 'undefined' ? 120 : parseInt(option.maxHeight, 10);
  var delayedResize;
  var setStyle;

  if (!target) {
    return;
  }
  if (isNaN(initHeight)) {
    initHeight = 28;
  }
  if (isNaN(maxHeight)) {
    maxHeight = 120;
  }
  setStyle = function () {
    var height = target.scrollHeight;
    if (height < initHeight) {
      height = initHeight;
    }
    if (maxHeight > 0 && height > maxHeight) {
      height = maxHeight;
      target.style.overflowY = 'auto';
    } else {
      target.style.overflowY = 'hidden';
    }
    target.style.height = height + 'px';
    target.style.maxHeight = maxHeight > 0 ? maxHeight + 'px' : 'none';
  };
  delayedResize = function () {
    window.setTimeout(setStyle, 0);
  };
  if (target.addEventListener) {
    target.addEventListener('input', setStyle, false);
  } else if (target.attachEvent) {
    target.attachEvent('onpropertychange', setStyle);
  }
  if (target.addEventListener) {
    target.addEventListener('keydown', function () {
      var key = window.event ? window.event.keyCode : 0;
      if (key === 8 || key === 46) {
        delayedResize();
      }
    }, false);
    target.addEventListener('cut', delayedResize, false);
  } else if (target.attachEvent) {
    target.attachEvent('onkeydown', function () {
      var key = window.event ? window.event.keyCode : 0;
      if (key === 8 || key === 46) {
        delayedResize();
      }
    });
    target.attachEvent('oncut', delayedResize);
  }
  setStyle();
}

/**
 * 阅读更多：先截断内容，点“阅读全文”后还原
 * 注意：只处理纯文本长度，不切断标签
 * @param {HTMLElement|String|NodeList} psSelector 容器
 * @param {Number} psLength 默认显示的字符数，默认 600
 * @param {String} psMoreText 按钮文字，默认“阅读全文”
 * @returns {void} 无返回值；找不到容器或内容长度未超过限制时不做任何事，否则改写容器内容并在其后插入按钮
 * @example
 * readMore('#article', 300, '展开全文')
 * // 正文只显示前 300 个可见字符并追加“ ......”，后面出现“展开全文”按钮；点击后恢复原文并移除按钮
 */
export function readMore(psSelector, psLength, psMoreText) {
  var node = internalResolveElement(psSelector);
  var limit = typeof psLength === 'undefined' ? 600 : parseInt(psLength, 10);
  var moreText = typeof psMoreText === 'undefined' ? '阅读全文' : psMoreText;
  var html;
  var inTag = false;
  var count = 0;
  var cut = 0;
  var i;
  var ch;
  var wrap;
  var btn;

  if (!node) {
    return;
  }
  html = node.innerHTML;
  if (typeof limit !== 'number' || isNaN(limit)) {
    limit = 600;
  }
  for (i = 0; i < html.length && count < limit; i++) {
    ch = html.charAt(i);
    if (ch === '<') {
      inTag = true;
    } else if (ch === '>' && inTag) {
      inTag = false;
    } else if (!inTag) {
      count++;
    }
    cut = i + 1;
  }
  if (html.length <= cut) {
    return;
  }
  node.innerHTML = html.substring(0, cut) + ' ......';

  wrap = document.createElement('div');
  wrap.className = 'bodymore';
  wrap.style.margin = '15px auto';
  wrap.style.textAlign = 'center';

  btn = document.createElement('span');
  btn.className = 'bodymore-btn';
  btn.style.display = 'inline-block';
  btn.style.padding = '10px 35px';
  btn.style.backgroundColor = '#ece7e7';
  btn.style.color = '#695e5e';
  btn.style.textAlign = 'center';
  btn.style.fontSize = '13px';
  btn.style.cursor = 'pointer';
  btn.innerHTML = moreText;
  wrap.appendChild(btn);
  insertAfter(wrap, node);

  addEventListener(btn, 'click', function () {
    node.innerHTML = html;
    removeNode(wrap);
  });
}

/**
 * 把选择器 / NodeList / 类数组集合统一成 DOM 元素
 * @param {HTMLElement|String|NodeList} o
 * @returns {HTMLElement|null} 解析到的第一个元素；传入 null、空集合或匹配不到时返回 null
 * @example
 * anyToDomObject('.item')
 * // 第一个 .item 元素
 * anyToDomObject(document.querySelectorAll('.item'))
 * // 第一个 .item 元素
 * anyToDomObject('#missing')
 * // null
 */
export function anyToDomObject(o) {
  return internalResolveElement(o);
}

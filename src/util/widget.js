/**
 * @File    widget.js
 * @Desc    MelUI Util 工具层：网页水印 / 返回顶部
 * @Version 0.1.2
 * @Date    2026-11-18
 * @PubDate 2026-11-20 15:42:00
 * @Author  ChenMufeng
 *
 * 【实现约定】goToTop 的必要样式内联，不依赖 core.css；
 *            重复调用复用已有节点，只绑定一次 scroll / click。
 * 【对外形态】melui.util.widget.waterMarker / melui.util.widget.goToTop
 * ──────────────────────────────────────────────────────
 */

import { mergeObj } from './base/object.js';

/**
 * 网页水印
 * @param {Object} options 可选
 * @param {Array} options.element 目标元素选择器数组，默认 ['body']
 * @param {String} options.word 水印文字，默认“水印”
 * @param {Number} options.width 画布宽，默认 250
 * @param {Number} options.height 画布高，默认 250
 * @param {Number} options.rotate 旋转角度，默认 -30
 * @param {String} options.font 字体，默认 16px Helvetica Neue
 * @param {String} options.fillStyle 文字颜色，默认 rgba(17,17,17,.5)
 * @param {String} options.textAlign 水平对齐，默认 left
 * @param {String} options.textBaseline 垂直基线，默认 middle
 * @returns {void} 无返回值；直接修改目标元素的 backgroundImage；canvas 不可用时直接返回
 * @example
 * waterMarker({ element: ['body'], word: '内部资料' })
 * // body 背景出现“内部资料”平铺水印
 * waterMarker({ element: ['.panel'], word: '仅限内部', rotate: -20 })
 * // .panel 背景出现旋转水印
 */
export function waterMarker(options) {
  var settings = mergeObj({
    element: ['body'],
    word: '水印',
    width: 250,
    height: 250,
    rotate: -30,
    font: '16px Helvetica Neue',
    fillStyle: 'rgba(17, 17, 17, .5)',
    textAlign: 'left',
    textBaseline: 'middle'
  }, options);
  var elemArr = settings.element;
  var can = document.createElement('canvas');
  var cans;
  var i;
  var ele;
  var dom;
  var url;

  can.style.display = 'none';
  can.width = settings.width;
  can.height = settings.height;
  cans = can.getContext('2d');
  if (!cans) {
    return;
  }
  cans.rotate(settings.rotate * Math.PI / 180);
  cans.font = settings.font;
  cans.fillStyle = settings.fillStyle;
  cans.textAlign = settings.textAlign;
  cans.textBaseline = settings.textBaseline;
  cans.fillText(settings.word, can.width / 3, can.height / 2);
  url = can.toDataURL('image/png');

  for (i = 0; i < elemArr.length; i++) {
    ele = elemArr[i];
    dom = null;
    if (ele === 'body') {
      dom = document.body;
    } else if (ele.charAt(0) === '#') {
      dom = document.getElementById(ele.substr(1));
    } else if (ele.charAt(0) === '.') {
      dom = document.getElementsByClassName
        ? document.getElementsByClassName(ele.substr(1))[0]
        : null;
    }
    if (dom) {
      dom.style.backgroundImage = 'url(' + url + ')';
    }
  }
}

/** 内部：把数值统一成 px 字符串 */
function internalToPx(val, fallback) {
  if (typeof val === 'number') {
    return val + 'px';
  }
  var str = val == null ? '' : val.toString().replace(/^\s+|\s+$/g, '');
  if (str === '') {
    return fallback;
  }
  if (/^\d+$/.test(str) || /^\d+px$/.test(str)) {
    return str.replace(/px$/, '') + 'px';
  }
  return str;
}

/** 内部：滚动到顶部（100ms 线性动画，兼容无 requestAnimationFrame 的环境） */
function internalScrollToTop(callback) {
  var start = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  var startTime = new Date().getTime();
  var duration = 100;
  function step() {
    var elapsed = new Date().getTime() - startTime;
    var progress = elapsed / duration;
    var top;
    if (progress >= 1) {
      window.scrollTo(0, 0);
      if (typeof callback === 'function') {
        callback();
      }
      return;
    }
    top = Math.floor(start * (1 - progress));
    window.scrollTo(0, top);
    window.setTimeout(step, 10);
  }
  step();
}

/**
 * 返回顶部控件
 * @param {Object} options 可选
 * @param {Boolean} options.enable 是否启用，默认 true
 * @param {Number} options.zIndex 层级，默认 2
 * @param {String} options.direction right（默认）/ left
 * @param {String} options.bottom 距底部距离，默认 5%
 * @param {Number} options.opacity 透明度 0~1，默认 0.6
 * @param {String} options.title 文字，默认 TOP
 * @param {Boolean} options.showTitle 是否显示文字，默认 true
 * @param {Number} options.distance 滚动多少距离后显示，默认 200
 * @param {Boolean} options.alwaysShow 是否常显，默认 false
 * @returns {HTMLElement|null} enable 为 false 时返回 null；已存在 .mel-goToTop 时返回已有节点；
 *          否则创建并返回新节点
 * @example
 * goToTop({ bottom: '20px', distance: 300 })
 * // 页面滚动超过 300px 后出现 TOP 按钮，点击回到顶部
 * goToTop({ enable: false })
 * // null（不会创建控件）
 * goToTop()
 * // 已存在控件时返回已有节点，不重复创建
 */
export function goToTop(options) {
  var settings = mergeObj({
    enable: true,
    zIndex: 2,
    direction: 'right',
    bottom: '5%',
    opacity: 0.6,
    title: 'TOP',
    showTitle: true,
    distance: 200,
    alwaysShow: false
  }, options);
  var existing;
  var div;
  var opacity;
  var bottom;
  var distance;
  var showTitle;
  var scrollHandler;

  if (settings.enable === false) {
    return null;
  }
  existing = document.getElementsByClassName('mel-goToTop')[0];
  if (existing) {
    return existing;
  }

  opacity = isNaN(parseFloat(settings.opacity)) ? 0.6 : parseFloat(settings.opacity);
  bottom = internalToPx(settings.bottom, '5%');
  distance = isNaN(parseFloat(String(settings.distance).replace(/px/g, '')))
    ? 200
    : parseFloat(String(settings.distance).replace(/px/g, ''));
  showTitle = settings.showTitle !== false && settings.title.toString().replace(/\s+/g, '') !== '';

  div = document.createElement('div');
  div.className = 'mel-goToTop' + (showTitle ? '' : ' has-no-text');
  div.style.position = 'fixed';
  div.style.zIndex = settings.zIndex;
  div.style.bottom = bottom;
  div.style.opacity = opacity;
  div.style.filter = 'alpha(opacity=' + (opacity * 100) + ')';
  div.style.cursor = 'pointer';
  div.style.padding = '10px 8px';
  div.style.fontSize = '12px';
  div.style.lineHeight = '1.2';
  div.style.textAlign = 'center';
  div.style.background = '#f2f2f2';
  div.style.color = '#333';
  div.style.border = '1px solid #d9d9d9';
  if (settings.direction === 'left') {
    div.style.left = '0';
    div.style.borderRadius = '0 4px 4px 0';
  } else {
    div.style.right = '0';
    div.style.borderRadius = '4px 0 0 4px';
  }
  div.style.display = settings.alwaysShow ? 'block' : 'none';
  div.innerHTML = showTitle ? '<span>' + settings.title + '</span>' : '↑';
  document.body.appendChild(div);

  if (settings.alwaysShow === false) {
    scrollHandler = function () {
      var top = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      div.style.display = top >= distance ? 'block' : 'none';
    };
    if (window.addEventListener) {
      window.addEventListener('scroll', scrollHandler, false);
    } else if (window.attachEvent) {
      window.attachEvent('onscroll', scrollHandler);
    }
    scrollHandler();
  }

  div.onclick = function () {
    internalScrollToTop();
  };
  return div;
}

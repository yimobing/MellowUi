import * as type from './base/type.js';
import * as object from './base/object.js';
import * as dom from './dom.js';
import * as string from './string.js';
import * as array from './array.js';
import * as date from './date.js';
import * as format from './format.js';
import * as validate from './validate.js';
import * as random from './random.js';
import * as biz from './biz.js';
import * as widget from './widget.js';

var utilAll = {};
var flatGroups = [type, object];
var moduleGroups = [
  ['dom', dom], ['string', string], ['array', array], ['date', date],
  ['format', format], ['validate', validate], ['random', random],
  ['biz', biz], ['widget', widget]
];
var group, key, i;

// base 保持扁平：melui.util.mergeObj()
for (i = 0; i < flatGroups.length; i++) {
  group = flatGroups[i];
  for (key in group) {
    if (Object.prototype.hasOwnProperty.call(group, key)) {
      utilAll[key] = group[key];
    }
  }
}

// 新模块按组挂载：melui.util.dom.addClass()
for (i = 0; i < moduleGroups.length; i++) {
  utilAll[moduleGroups[i][0]] = moduleGroups[i][1];
}

// IE 环境提示（只 warn，不阻断）
if (typeof window !== 'undefined' && (window.ActiveXObject || 'ActiveXObject' in window)) {
  if (!Array.prototype.forEach || !Function.prototype.bind) {
    if (window.console && console.warn) {
      console.warn('[mel-util warn] IE 浏览器缺少原型补丁，请确认已引入 melui.min.js，勿使用裁剪过的 core。');
    }
  }
}

// 以下沿用现有挂载逻辑：合并进已有 melui.util、兜底 window.MelUi、export default

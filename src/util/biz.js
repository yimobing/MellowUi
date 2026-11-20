/**
 * @File    biz.js
 * @Desc    MelUI Util 工具层：业务辅助（电话提取 / 省市区去重分组）
 * @Version 0.1.2
 * @Date    2026-11-18
 * @PubDate 2026-11-20 15:40:00
 * @Author  ChenMufeng
 *
 * 【提示约定】参数不合法时优先走 melui.alert，组件不存在时退回原生 alert。
 * 【对外形态】melui.util.biz.xxx
 * ──────────────────────────────────────────────────────
 */

import { mergeObj } from './base/object.js';

/**
 * 内部：提示信息
 * @param {String} tipText 纯文本提示
 */
function internalTip(tipText) {
  var meluiNs = typeof window !== 'undefined' ? window.melui : null;
  if (meluiNs && typeof meluiNs.alert === 'function') {
    try {
      meluiNs.alert({ message: tipText });
      return;
    } catch (e) {
      // 组件异常时退回原生提示
    }
  }
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(tipText);
  }
}

/**
 * 提取字符串中的电话号码（固话或手机号）
 * @param {String} psStr 待提取字符串
 * @param {Object} options 可选
 * @param {String} options.type first 只取第一处（默认）/ all 取全部
 * @returns {String|Array|null} first 返回号码字符串（去掉空格和横线），没有号码返回 ''；
 *          all 返回匹配到的原始号码数组，没有号码返回 null；type 不是 first/all 时返回 ''
 * @example
 * pickupTel('联系电话：010-12345678，手机 13800138000')
 * // '01012345678'
 * pickupTel('联系电话：010-12345678，手机 13800138000', { type: 'all' })
 * // ['010-12345678', '13800138000']
 * pickupTel('没有电话') // ''
 * pickupTel('没有电话', { type: 'all' }) // null
 */
export function pickupTel(psStr, options) {
  var settings = mergeObj({ type: 'first' }, options);
  var regFirst = /^(.*?)((((0|\+)?86(\s{1})?)?0?\d{2,3}([\-|\s]?))?[\d]{7,8})(.*)/gi;
  var regAll = /(((0|\+)?86(\s{1})?)?0?\d{2,3}([\-|\s]?))?[\d]{7,8}/gi;
  var str = '';
  var arr;
  if (psStr == null) {
    return settings.type === 'all' ? null : '';
  }
  if (regFirst.test(psStr)) {
    str = psStr.toString().replace(regFirst, '$2').replace(/([\-|\s]+)/g, '');
  }
  arr = psStr.match(regAll);
  if (settings.type === 'all') {
    return arr;
  }
  if (settings.type === 'first') {
    return str;
  }
  return '';
}

/**
 * 省市区数组去重并分组
 * 输入：[{province, city, county}, ...]
 * 输出：[{province, data:[{city, data:[{county}]}]}]
 * @param {Array} list 原始数组
 * @returns {Array} 按 province → city → county 去重后的分组数组；参数不是数组时提示并返回 []；
 *          空 county 会被忽略，重复 county 只保留一个
 * @example
 * getAreaDistinctGroup([
 *   { province: '广东', city: '广州', county: '天河' },
 *   { province: '广东', city: '广州', county: '天河' },
 *   { province: '广东', city: '深圳', county: '南山' }
 * ])
 * // [{ province:'广东', data:[
 * //   { city:'广州', data:[{ county:'天河' }] },
 * //   { city:'深圳', data:[{ county:'南山' }] }
 * // ]}]
 */
export function getAreaDistinctGroup(list) {
  var result = [];
  var provinceMap = {};
  var i;
  var m;
  var n;
  var item;
  var pName;
  var cName;
  var countyName;
  var provinceNode;
  var currProvince;
  var cityNode;
  var cityMap;
  var tempCity;
  var hasCounty;

  if (Object.prototype.toString.call(list) !== '[object Array]') {
    internalTip('函数：getAreaDistinctGroup() 传入的参数不是数组格式，请检查！');
    return result;
  }
  for (i = 0; i < list.length; i++) {
    item = list[i];
    pName = item.province;
    cName = item.city;
    countyName = item.county;

    if (!provinceMap[pName]) {
      provinceNode = { province: pName, data: [] };
      provinceMap[pName] = provinceNode;
      result.push(provinceNode);
    }
    currProvince = provinceMap[pName];

    cityNode = null;
    cityMap = {};
    for (m = 0; m < currProvince.data.length; m++) {
      tempCity = currProvince.data[m];
      cityMap[tempCity.city] = tempCity;
    }
    if (!cityMap[cName]) {
      cityNode = { city: cName, data: [] };
      currProvince.data.push(cityNode);
    } else {
      cityNode = cityMap[cName];
    }

    hasCounty = false;
    for (n = 0; n < cityNode.data.length; n++) {
      if (cityNode.data[n].county === countyName) {
        hasCounty = true;
        break;
      }
    }
    if (!hasCounty && countyName != null && countyName.toString().replace(/\s+/g, '') !== '') {
      cityNode.data.push({ county: countyName });
    }
  }
  return result;
}

/**
 * @File    array.js
 * @Desc    MelUI Util 工具层：数组去重 / 排序 / 重复检测 / 相邻分组
 * @Version 0.1.2
 * @Date    2026-11-17
 * @PubDate 2026-11-20 15:20:00
 * @Author  ChenMufeng
 *
 * 【实现约定】排序类函数在副本上执行，不修改调用方数组；
 *            不使用 IE 不支持的 Array.prototype.includes。
 * 【对外形态】melui.util.array.xxx
 * ──────────────────────────────────────────────────────
 */

import { isArray } from './base/type.js';
import { mergeObj } from './base/object.js';

/**
 * 数组去重（保持首次出现的顺序）
 * @param {Array} psArr 原数组
 * @returns {Array} 去重后的新数组；非数组返回 []；对象按引用比较，NaN 不会被去掉
 * @example
 * uniqueArray([1, 2, 2, 3, 1]) // [1, 2, 3]
 * uniqueArray(['a', 'a', 'b']) // ['a', 'b']
 * uniqueArray('abc')           // []
 */
export function uniqueArray(psArr) {
  if (!isArray(psArr)) {
    return [];
  }
  return psArr.filter(function (element, index, self) {
    return self.indexOf(element) === index;
  });
}

/**
 * 快速排序（升序），不修改入参数组
 * @param {Array} arr 原数组
 * @returns {Array} 排序后的新数组；非数组返回 []，空数组或单元素数组返回副本
 * @example
 * quickSort([3, 1, 2]) // [1, 2, 3]
 * quickSort([3, 1, 2]).length // 3
 * quickSort(null) // []
 */
export function quickSort(arr) {
  if (!isArray(arr) || arr.length <= 1) {
    return isArray(arr) ? arr.slice(0) : [];
  }
  var list = arr.slice(0);
  var index = Math.floor(list.length / 2);
  var pivot = list.splice(index, 1)[0];
  var left = [];
  var right = [];
  var i;
  for (i = 0; i < list.length; i++) {
    if (list[i] < pivot) {
      left.push(list[i]);
    } else {
      right.push(list[i]);
    }
  }
  return quickSort(left).concat(pivot, quickSort(right));
}

/**
 * 冒泡排序（升序），不修改入参数组
 * @param {Array} arr 原数组
 * @returns {Array} 排序后的新数组；非数组返回 []
 * @example
 * bubbleSort([3, 1, 2]) // [1, 2, 3]
 * bubbleSort('abc')     // []
 */
export function bubbleSort(arr) {
  var list = isArray(arr) ? arr.slice(0) : [];
  var len = list.length;
  var i;
  var j;
  var temp;
  for (i = 0; i < len - 1; i++) {
    for (j = 0; j < len - 1 - i; j++) {
      if (list[j] > list[j + 1]) {
        temp = list[j];
        list[j] = list[j + 1];
        list[j + 1] = temp;
      }
    }
  }
  return list;
}

/**
 * 数组排序
 * @param {Array} arr 原数组
 * @param {String} method asc 升序（默认）/ desc 降序
 * @returns {Array} 排序后的新数组；非数组返回 []；method 不是 desc 时按升序处理
 * @example
 * arraySort([3, 1, 2])          // [1, 2, 3]
 * arraySort([3, 1, 2], 'desc')  // [3, 2, 1]
 * arraySort(null)               // []
 */
export function arraySort(arr, method) {
  var sorted = quickSort(arr);
  if (method === 'desc') {
    return sorted.reverse();
  }
  return sorted;
}

/**
 * 自定义 key 集合，替代 Object.keys（IE9 无 Object.keys）
 * @param {Object} obj 目标对象
 * @returns {Array} 自有可枚举属性名组成的新数组；null、非对象、无属性时返回 []
 * @example
 * getOwnKeys({ a: 1, b: 2 }) // ['a', 'b']
 * getOwnKeys([10, 20])       // ['0', '1']（数组返回下标字符串）
 * getOwnKeys(null)           // []
 */
export function getOwnKeys(obj) {
  var keyList = [];
  var prop;
  if (!obj || typeof obj !== 'object') {
    return keyList;
  }
  for (prop in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, prop)) {
      keyList.push(prop);
    }
  }
  return keyList;
}

/**
 * 深度对比两个值是否相等
 * - 严格相等直接通过
 * - 数组逐项递归、普通对象逐键递归
 * - NaN 与 NaN 视为相等
 * @param {*} a 值 a
 * @param {*} b 值 b
 * @returns {Boolean} true 表示结构相等；日期、正则、函数等非普通对象只按引用比较；循环引用会递归溢出
 * @example
 * isValueEqual([1, { a: 2 }], [1, { a: 2 }]) // true
 * isValueEqual(NaN, NaN)                    // true
 * isValueEqual({ a: 1 }, { a: 2 })          // false
 * isValueEqual(new Date(0), new Date(0))    // false（不是普通对象分支）
 */
export function isValueEqual(a, b) {
  if (a === b) {
    return true;
  }
  var typeA = Object.prototype.toString.call(a);
  var typeB = Object.prototype.toString.call(b);
  var i;
  var keysA;
  var keysB;
  var key;
  if (typeA !== typeB) {
    return false;
  }
  if (typeA === '[object Number]' && isNaN(a) && isNaN(b)) {
    return true;
  }
  if (typeA === '[object Array]') {
    if (a.length !== b.length) {
      return false;
    }
    for (i = 0; i < a.length; i++) {
      if (!isValueEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  if (typeA === '[object Object]') {
    keysA = getOwnKeys(a);
    keysB = getOwnKeys(b);
    if (keysA.length !== keysB.length) {
      return false;
    }
    for (i = 0; i < keysA.length; i++) {
      key = keysA[i];
      if (!isValueEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
  return false;
}

/**
 * 检测数组中是否已存在某个元素
 * @param {Array} arr 目标数组
 * @param {Object} opts 配置
 * @param {String} opts.key 指定对象字段，非空时走字段匹配（严格相等）
 * @param {*} opts.value 字段对应的值
 * @param {*} opts.targetItem 整元素深度比对的内容
 * @returns {Boolean} true 表示找到重复；arr 不是数组、key 为 null 且 targetItem 为 null 时返回 false
 * @example
 * arrayHasDuplicate([{ id: 1 }, { id: 2 }], { key: 'id', value: 2 })
 * // true
 * arrayHasDuplicate([1, 2, 3], { targetItem: 2 })
 * // true
 * arrayHasDuplicate([1, 2], {})
 * // false
 */
export function arrayHasDuplicate(arr, opts) {
  var defaults = {
    key: null,
    value: null,
    targetItem: null
  };
  var finals = mergeObj(defaults, opts);
  var len;
  var i;
  var item;
  if (!isArray(arr)) {
    return false;
  }
  len = arr.length;
  if (finals.key !== null) {
    for (i = 0; i < len; i++) {
      item = arr[i];
      if (item && typeof item === 'object' && item[finals.key] === finals.value) {
        return true;
      }
    }
    return false;
  }
  if (finals.targetItem === null) {
    return false;
  }
  for (i = 0; i < len; i++) {
    if (isValueEqual(arr[i], finals.targetItem)) {
      return true;
    }
  }
  return false;
}

/**
 * 把一维数组里相邻元素按固定差值分组成二维数组
 * 例：[1,2,3,4, 9,13,16]（差值 1）→ [[1,2,3,4],[9],[13],[16]]
 * @param {Array} psArr 一维数组
 * @param {Number} psValue 指定的相邻差值，默认 1
 * @returns {Array} 分组后的二维数组；非数组返回 []；单元素数组返回 [[该元素]]
 * @example
 * combineNextElementToArray([1, 2, 3, 4, 9, 13, 16])
 * // [[1, 2, 3, 4], [9], [13], [16]]
 * combineNextElementToArray([1, 3, 5, 9], 2)
 * // [[1, 3, 5], [9]]
 * combineNextElementToArray(null)
 * // []
 */
export function combineNextElementToArray(psArr, psValue) {
  var subValue = typeof psValue === 'undefined' ? 1 : psValue;
  var tmpArr = [];
  var resultArr = [];
  var k = 0;
  var loops = 0;
  var i;
  var j;
  var value1;
  var value2;
  var row;
  if (!isArray(psArr)) {
    return [];
  }
  for (i = 0; i < psArr.length; i++) {
    value1 = psArr[i];
    tmpArr[k] = isArray(tmpArr[k]) ? tmpArr[k] : [];
    j = i + 1;
    if (psArr.length === 1) {
      tmpArr[k].push(value1);
      continue;
    }
    if (j < psArr.length) {
      value2 = psArr[j];
      if (loops === 0 && tmpArr[k].indexOf(value1) === -1) {
        tmpArr[k].push(value1);
      }
      if (value2 - value1 === subValue) {
        tmpArr[k].push(value2);
        loops++;
      } else {
        k++;
        tmpArr[k] = isArray(tmpArr[k]) ? tmpArr[k] : [];
        if (tmpArr[k].indexOf(value2) === -1) {
          tmpArr[k].push(value2);
        }
        loops = 0;
      }
    }
  }
  for (i = 0; i < tmpArr.length; i++) {
    row = tmpArr[i];
    if (row.length !== 0) {
      resultArr.push(row);
    }
  }
  return resultArr;
}

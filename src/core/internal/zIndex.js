/**
 * @File    zIndex.js
 * @Desc    MelUI Core 私有 zIndex 管理器：全局自增，避免浮层互相压盖
 * @Version 0.1.2
 * @Date    2026-11-13
 * @PubDate 2026-11-16 16:42:00
 * @Author  ChenMufeng
 *
 * ── 层级定位：core 私有实现层（internal）──────────────────
 * 这里的 internal 表达的是"私有"，不是"基础/共享"：
 *   internal = 只允许 src/core/ 目录内部 import
 *   base     = 允许多方 import 的公共基础函数（在 util/base）
 *
 * 【可见性】私有：仅 core 目录内的文件可 import。
 *           components、util、业务代码一律禁止引用。
 * 【重构风险】本文件不属于对外 API，函数签名与文件名随时可调整；
 *           一旦被外部引用，后续任何改名都会变成破坏性变更。
 * ──────────────────────────────────────────────────────
 */

// 起始层级：业务页面通常不会超过 2000
var currentZIndex = 2000;

/**
 * 取下一个 zIndex（每次调用自增 10，给同一层浮层的内部元素留空间）
 * @param {Number} base 可选，传了则把基数抬到该值
 * @return {Number}
 */
export function nextZIndex(base) {
  if (typeof base === 'number' && base > currentZIndex) {
    currentZIndex = base;
  }
  currentZIndex += 10;
  return currentZIndex;
}

/**
 * 当前 zIndex（不递增）
 * @return {Number}
 */
export function getZIndex() {
  return currentZIndex;
}

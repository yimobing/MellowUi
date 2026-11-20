
================================================
# MelUi util / third 迁移文件清单
================================================

## 一、总体状态

- **源码迁移：全部完成。** 9 个 util 模块、base 基础层、third 适配包都已落到 `src/util/`、`src/third/`。
- **旧依赖清理：完成。** 源码中不再有旧库、jQuery、旧类名、旧回调兼容、迁移来源说明。
- **注释补齐：完成。** util 全部公共函数都有 `@returns` 和 `@example`，写清正常返回、空值、非法参数、无匹配时的结果。
- **打包接入：未完成。** 这是接线和构建工作，不属于源码迁移，单独列在第四节。

## 二、util 模块（9 个文件，124 个函数）

| 文件 | 函数数 | 内容 |
| --- | --- | --- |
| random.js | 6 | 随机数、随机串、随机词、随机色（含 HSL 限亮度、WCAG 对比度） |
| array.js | 8 | 去重、快排、冒泡、按字段排序、键收集、深比较、重复判断、相邻分组 |
| string.js | 19 | URL 参数、HTML 编解码、特殊字符、数值/负数/浮点过滤、时分格式 |
| validate.js | 21 | 危险字符、JSON、手机/邮箱/座机、苹果/图片/数字、浏览器与 IE、网络状态 |
| date.js | 23 | 日期比较、间隔天数、月/季/年首末、上月上年初末、N 天/月/年、星期、格式化、时间戳互转、时长拆分 |
| format.js | 11 | 千分位、toFixed、百分比互转、元/万互转、零值互转、中文数字、科学计数、非标准对象转标准数组 |
| biz.js | 2 | 电话提取、省市区分组 |
| dom.js | 32 | dataset、class、子/孙/兄弟节点、HTML 读写、带表单当前值取 HTML、四种插入、位置尺寸、滚动条、滚动到指定位置、事件、textarea 自增高、阅读更多、选择器转 DOM |
| widget.js | 2 | 网页水印、返回顶部 |

### base 基础层（3 个文件，8 个函数）

`base/base.js`、`base/object.js`、`base/type.js`：`mergeObj`、`shallowCopy`、`isPlainObject`、`isArray`、`isFunction`、`isNumber`、`isString`、`isElement`。

统一约束：纯 ES5、不依赖第三方 DOM 库、无全局 `alert`（`melui.alert` 优先，缺失时退回原生 alert）、不依赖 core 组件、不污染原型。

## 三、third 适配包（1 个文件，2 个函数）

`third.js`：`export2Excel`、`exportWeb2Image`。

- 不内置第三方库，也不动态插 script 加载 CDN；业务自行引入 SheetJS（`XLSX`）与 `html2canvas`。
- Excel 使用 `XLSX.utils.table_to_sheet` + `writeFile`。
- 图片导出在移动端自建全屏预览层。
- 提示同样走 `melui.alert`，缺失时退回原生 alert。

## 四、剩下的是接入和验证，不是迁移

1. `src/util/util.js` 并联 9 个 util 模块和 base；主包 `src/index.js` 不引入 util 扩展包，保持 util 独立打包。
2. `rollup.config.js` 的 util 产物名保持 `melui-util.js` / `melui-util.min.js`，不需要改成 `mel-util`。
3. `rollup.config.js` 增加 third 入口，产物 `melui-third.js` / `melui-third.min.js`。
4. `package.json` 同步本地已有的构建依赖（`rollup-plugin-terser`、`rollup-plugin-copy`、`terser`），再跑生产 `.min.js` 构建。
5. 回归验证：IE9 真机、iOS Safari iframe、third 导出 Excel/图片、生产压缩产物。
6. 更新 `demo/util_工具库_使用手册.html` 到当前 132 个公共函数和新的 `melui-util` 引入口径。
7. 之前记录的几个边界行为（`decimal2Percent` 的 `floor/ceil`、`lastDotChar` 删全部点、`numericalOnBlur('0.5')`、`zeroString2Empty('--')`、`getRandomColor({count:4})`）统一检查后再决定是否修。

> （注：部分内容由豆包 AI 生成）






================================================
            未迁移的（neatui.min.js）
================================================
我核对了 `neatui.min.js` 的 21 个顶层 API 和 `neatui-functions.js` 的对象清单，结论如下：**util 和 third 基本迁完，缺的主要在 core 侧，遮罩确实没迁。**

## 一、`neatui.min.js`：21 个 API，还剩 10 个

**已迁移或已被替代（11 个）**

| 原 API | 现状 |
|---|---|
| showAnimate / destroyAnimate | core 的 showLoading / closeLoading |
| checkIsMobile | `util.validate.checkIsMobile` |
| openAside | 放弃，MelUi 已有 drawer |
| alertDialog | 放弃，dialog 的 `melui.alert` |
| export2Excel / exportWeb2Image | `melui.third` |
| waterMarker / goToTop | `util.widget` |
| installmentPayment | 放弃，归 demo / 业务组件 |
| generateRandChar | `util.random.getRandomString` 可替代（原只是生成随机 ID，无独立价值） |

**尚未迁移（10 个），按功能分四组**

1. **遮罩组（最该补）**
   `openMask`、`closeMask`，以及它们的内部依赖 `generateMaskNode`、`winScroll`。
   原实现只有 `openMask(Id)`：动态插 `.ne_mask`、锁 `html/body` 的 `height + overflow`、移动端在遮罩上监听 `touchmove` 阻止滚动、z-index 从 110 递增。
   两个原库缺陷迁移时要修：`closeMask` 只删 `#ne_mask`，自定义 Id 的遮罩会残留；关闭时用 `removeAttr('style')` 把 html/body 的内联样式全清了，会误伤页面原有样式。
   另外 core 的 loading 里只有一个私有的 `mel-loading-mask`，**不是可复用的遮罩能力**，两回事。

2. **iframe 弹窗组**
   `openIframe`、内部 `closeFrame`，以及 `isCurrentPageHttps`、`isUrlHttps`、`checkMixedContentRisk`。
   参数包含 `url / caption / top / width / titleHeight / buttons / btnCallBack / element / position` 等，还带 https 页面加载 http 地址的混合内容拦截。这块你之前定的是进 core。

3. **滚动锁组**
   `letWinRoll`、`preventLayerPutWinRoll`。
   前者解锁窗口滚动，后者处理移动端浮层滚动穿透（`touchstart/touchmove/touchend` + 边界判断）。core 的 loading 已有一套私有滚动锁，建议抽成 `internal/scrollLock.js` 共用，不要再写第三套。

4. **`doneAsyncEvent`**
   `getData + callBack` 的异步取数封装（Promise / 同步返回值统一回调）。它更像示例页辅助函数，不是基础能力，建议不迁。

## 二、`neatui-functions.js` 还差的零碎

- **原型 polyfill 整块未进 core**：`Function.prototype.bind`、`Array.prototype.filter/indexOf/forEach`、`Element.prototype.matches/closest`。按之前定的“单份 core 内置守卫 polyfill”还没落地。
- **`IEHacker.oninput`**：IE 输入事件兼容，未迁。
- **jQuery 小插件**：`$.fn.formatHtml`、`$.fn.html` 未迁；`$.fn.makeTextareaExpanding` 已用原生版替代，`$.getUrlParam` 由 `getUrlParams` 覆盖。
- **`utilities.isNaN`**：base 里没有，但原生 `isNaN` 可用，是否要保留这个语义化封装待定。
- 已明确放弃：`checkIsJqObject`、`Date.prototype.format`、改写 `Number.prototype.toFixed` 的原型污染写法。

## 三、工程侧还没接线

- `src/util/util.js` 入口没并联 9 个模块（现在 `melui.util.dom.xxx` 还调不到）。
- `rollup.config.js` 没有 third 入口，`melui-third.js` 还没产物。
- core 缺 `mask.js`、`iframe.js`、`polyfill.js`，滚动锁待抽公共模块。
- util 手册、third 文档未写；`package.json` 的 `name` 全小写、`main` 指向仍未确认。

## 建议顺序

1. `core/mask.js`（含滚动锁抽取）——表格、弹窗、抽屉都可能复用，优先级最高。
2. `core/polyfill.js` 守卫式补齐。
3. `core/iframe.js`（含 https 混合内容判断）。
4. `util.js` 接线 + rollup third 入口。
5. 文档。

需要你定的三个点：遮罩 API 是否改成对象参数（`openMask({ id, zIndex, opacity, clickClose, lockScroll })`）；`openIframe` 是否确认进 core；`$.fn.formatHtml / $.fn.html` 是丢弃还是补成 `util.dom` 函数。
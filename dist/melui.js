(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.MelUi = factory());
})(this, (function () { 'use strict';

    /**
     * MelUi 弹窗对话框组件
     * 版本：v1.2.3 beta 1.0.9
     * 创建日期：2026-08-10
     * 更新日期：2026-09-11
     * 兼容：IE9/10/11
     * 调用方式：
        构造创建：new MelUi.Dialog({配置参数})
        快捷调用：MelUi.alert() / MelUi.confirm() / MelUi.prompt()
     */
        (function (window) {
        
            var zIndexSeed = 2000;          // 弹窗 z-index 自增种子
            var dialogLockCount = 0;        // 弹窗实例计数，控制页面滚动锁
            var pageScrollState = null;     // 页面滚动原始状态
        
            //==================== 模态弹窗默认参数 ====================
            var defaults = {
                title: "", // 弹窗标题(可选)。空字符串不渲染标题栏。
                theme: "info", // 按钮主题(可选)。值：info/success/warning/danger/default。
                type: "", // 内容警示图标类型(可选)。值：success/warning/error/info。空不显示图标。
                showClose: true, // 是否显示右上角关闭叉号(可选)。值：true是,false否。
                mask: true, // 是否显示遮罩层(可选)。值：true是,false否。
                maskClosable: true, // 点击遮罩是否关闭弹窗(可选)。值：true是,false否。
                animate: false, // 打开弹窗前是否显示转圈(可选)。值：true无文字转圈，字符串作为转圈文字，false不显示。
                delay: "auto", // 转圈显示时长(可选)。值：auto自动(500ms)，或数字毫秒。
                btnDirection: "horizontal", // 按钮排布方向(可选)。值：horizontal横向,vert竖向。
                btnFullWidth: false, // 按钮是否通栏铺满整行(可选)。值：true是,false否。横向时按钮在一行内等分，竖向时才垂直排列。
                btnDisabled: false, // 是否一键禁用全部底部按钮(可选)。值：true是,false否。
                buttons: null, // 自定义按钮数组，优先级最高(可选)。数组项格式：{ text: "按钮文字", type: "按钮类型" }；type值：info/success/warning/danger/default/primary。
                message: "", // 普通文本内容(可选)。dangerouslyUseHTMLString=true时该字段无效。
                content: "", // HTML内容(可选)。仅dangerouslyUseHTMLString=true生效。
                dangerouslyUseHTMLString: false, // 是否开启HTML解析(可选)。值：true是,false否。开启后使用content字段。
                center: false, // 是否整体居中布局(可选)。值：true是,false否。true时header、body、footer全部内容水平居中。
                textCenter: false, // 是否仅正文文本居中(可选)。值：true是,false否。优先级高于center。
                fullScreen: false, // 是否全屏弹窗(可选)。值：true是,false否。
                width: "auto", // 弹窗宽度(可选)。auto使用组件默认，支持数字、px、百分比。
                height: "auto", // 弹窗整体高度(可选)。auto使用组件默认，支持数字、px、百分比。
                footerStickyBottom: true, // 设置height或fullScreen时，按钮是否固定在弹窗底部(可选)。值：true是,false否。
                contentMaxHeight: "", // 内容区域最大高度(可选)。height生效时本参数失效。
                fontSize: "", // 内容区文字大小(可选)。空则使用默认16px，支持数字、px。
                device: "", // 一键移动端模式(可选)。值："phone"开启，空不开启；不自动UA检测。
                prompt: { // prompt输入框专属配置(可选)。仅调用prompt()时生效
                    inputType: "input", // 输入框类型(可选)。值：input单行,textarea多行。
                    placeholder: "", // 输入框占位提示文字(可选)。
                    defaultValue: "", // 输入框默认值(可选)。
                    unit: "" // 输入框右侧单位文字，例：元、㎡(可选)。
                },
                onClick: null, // 按钮点击回调(可选)。ret为按钮序号从1开始；prompt会附带输入框value。
                onOpen: null, // 弹窗打开完成回调(可选)。DOM已挂载完成，入参为当前实例。
                onClose: null // 弹窗关闭回调(可选)。所有关闭方式均触发；return false可阻止关闭，入参为当前实例。
            };
        
            //==================== Tip 默认参数（独立组件） ====================
            var tipDefaults = {
                type: "info", // 提示类型(可选)。值：success/warning(warn别名)/error/info/plain。
                message: "", // 提示文本内容(可选)。
                duration: 3000, // 自动关闭延时(毫秒)(可选)。0=常驻不自动关闭。
                position: "top", // 弹出位置(可选)。值：top顶部,bottom底部。
                mask: false, // 是否开启遮罩(可选)。值：true是,false否。
                dangerouslyUseHTMLString: false, // 是否开启HTML解析(可选)。值：true是,false否。
                onClose: null // 关闭回调(可选)。Tip不支持拦截关闭。
            };
        
            //==================== Toast 默认参数（独立组件） ====================
            var toastDefaults = {
                type: "info", // 提示类型(可选)。值：success/warning(warn别名)/error/info/plain。
                message: "", // 提示文本内容(可选)。
                duration: 2000, // 自动关闭延时(毫秒)(可选)。0=常驻不自动关闭。
                position: "center", // 弹出位置(可选)。值：center居中,top顶部,bottom底部。
                mask: false, // 是否开启遮罩(可选)。值：true是,false否。
                dangerouslyUseHTMLString: false, // 是否开启HTML解析(可选)。值：true是,false否。
                onClose: null // 关闭回调(可选)。Toast不支持拦截关闭。
            };
        
            // 提示组件实例队列（按position分组，用于堆叠位移）
            var tipQueue = { top: [], bottom: [] };
            var toastQueue = { top: [], bottom: [], center: [] };
        
            // 提示图标字符
            var typeIconMap = {
                info: "ⓘ",
                success: "√",
                warning: "⚠",
                error: "ⓧ"
            };
        
            /**
             * 尺寸解析：数字自动补px，px/百分比字符串原样返回
             * @param {*} val
             * @returns {string}
             */
            function parseSize(val) {
                if (val === null || val === undefined || val === "") {
                    return "";
                }
                if (typeof val === "number") {
                    if (val <= 0) return "";
                    return val + "px";
                }
                var str = String(val);
                // auto 表示使用CSS默认尺寸，不写内联样式（否则会覆盖CSS的响应式宽度）
                if (str.toLowerCase() === "auto") {
                    return "";
                }
                if (/^\d+$/.test(str)) {
                    return str + "px";
                }
                return str;
            }
        
            /**
             * 对象浅拷贝合并
             * @returns {Object}
             */
            function extend() {
                var target = arguments[0] || {};
                var len = arguments.length;
                for (var i = 1; i < len; i++) {
                    var obj = arguments[i];
                    if (!obj) continue;
                    for (var key in obj) {
                        if (Object.prototype.hasOwnProperty.call(obj, key)) {
                            target[key] = obj[key];
                        }
                    }
                }
                return target;
            }
        
            /**
             * HTML转义防XSS
             * @param {string} str
             * @returns {string}
             */
            function escapeHtml(str) {
                if (!str) return "";
                return String(str)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }
        
            /**
             * 追加className（IE9不支持classList，统一用字符串操作）
             * @param {Element} el
             * @param {string} cls
             */
            function addClass(el, cls) {
                var cur = el.className || "";
                if ((" " + cur + " ").indexOf(" " + cls + " ") === -1) {
                    el.className = cur + (cur ? " " : "") + cls;
                }
            }
        
            //==================== 打开前转圈（animate参数，组件私有） ====================
            var spinnerEl = null;          // 转圈遮罩容器
            var spinnerTimer = null;       // 旋转定时器
            var spinnerDeg = 0;            // 当前旋转角度
        
            /**
             * 显示转圈：全屏半透明遮罩 + 居中圆环 + 可选文字
             * 旋转用JS定时器驱动，兼容IE9（IE9不支持CSS animation）
             * @param {string} text 转圈下方文字，可为空
             */
            function showSpinner(text) {
                destroySpinner();
                var mask = document.createElement("div");
                mask.className = "mel-animate-mask";
                var box = document.createElement("div");
                box.className = "mel-animate-box";
                var circle = document.createElement("div");
                circle.className = "mel-animate-circle";
                box.appendChild(circle);
                if (text) {
                    var textDom = document.createElement("div");
                    textDom.className = "mel-animate-text";
                    textDom.innerHTML = escapeHtml(text);
                    box.appendChild(textDom);
                }
                mask.appendChild(box);
                document.body.appendChild(mask);
                spinnerEl = mask;
                spinnerDeg = 0;
                spinnerTimer = setInterval(function () {
                    spinnerDeg = (spinnerDeg + 6) % 360;
                    if (circle.style) {
                        circle.style.msTransform = "rotate(" + spinnerDeg + "deg)";
                        circle.style.transform = "rotate(" + spinnerDeg + "deg)";
                    }
                }, 16);
            }
        
            /**
             * 销毁转圈
             */
            function destroySpinner() {
                if (spinnerTimer) {
                    clearInterval(spinnerTimer);
                    spinnerTimer = null;
                }
                if (spinnerEl && spinnerEl.parentNode) {
                    document.body.removeChild(spinnerEl);
                }
                spinnerEl = null;
            }
        
            /**
             * 锁定页面滚动（计数器：存在任意弹窗即锁定，全部关闭才恢复）
             */
            function lockPageScroll() {
                if (dialogLockCount === 0) {
                    pageScrollState = {
                        htmlOverflow: document.documentElement.style.overflow,
                        bodyOverflow: document.body.style.overflow
                    };
                    document.documentElement.style.overflow = "hidden";
                    document.body.style.overflow = "hidden";
                }
                dialogLockCount++;
            }
        
            /**
             * 解锁页面滚动
             */
            function unlockPageScroll() {
                if (dialogLockCount <= 0) return;
                dialogLockCount--;
                if (dialogLockCount === 0 && pageScrollState) {
                    document.documentElement.style.overflow = pageScrollState.htmlOverflow || "";
                    document.body.style.overflow = pageScrollState.bodyOverflow || "";
                    pageScrollState = null;
                }
            }
        
            //==================== 模态弹窗 ====================
            /**
             * @param {Object} opts
             */
            function Dialog(opts) {
                opts = opts || {};
                var opt = this.options = extend({}, defaults, opts);
        
                // 参数优先级：height 生效时 contentMaxHeight 失效
                if (opt.height !== "auto" && opt.height !== "" && opt.height != null && opt.contentMaxHeight) {
                    opt.contentMaxHeight = "";
                }
        
                // phone 模式默认值（用户显式传入优先）
                if (opt.device === "phone") {
                    if (opts.showClose === undefined) opt.showClose = false;
                    if (opts.btnFullWidth === undefined) opt.btnFullWidth = true;
                }
        
                this.zIndex = zIndexSeed++;
                this.mask = null;
                this.wrap = null;
                this.headerDom = null;
                this.bodyDom = null;
                this.footerDom = null;
                this.inputEl = null;
        
                // animate：打开前先显示转圈（纯反馈特效），delay后创建弹窗并自动关闭转圈
                if (opt.animate) {
                    var self = this;
                    var spinText = typeof opt.animate === "string" ? opt.animate : "";
                    showSpinner(spinText);
                    lockPageScroll(); // 转圈期间锁定页面滚动
                    var delayMs = parseInt(opt.delay, 10);
                    if (!delayMs || delayMs <= 0) {
                        delayMs = 500; // auto/0/空 → 自动时长500ms
                    }
                    setTimeout(function () {
                        self.create();
                        self.bindEvent();
                        lockPageScroll();   // 弹窗锁（spinner锁+弹窗锁）
                        destroySpinner();   // 弹窗出现，转圈自动关闭
                        unlockPageScroll(); // 释放spinner的锁，保留弹窗锁
                        self.layoutFixed();
                        if (typeof opt.onOpen === "function") {
                            opt.onOpen(self);
                        }
                    }, delayMs);
                    return;
                }
        
                this.create();
                this.bindEvent();
                lockPageScroll();
                this.layoutFixed();
                if (typeof opt.onOpen === "function") {
                    opt.onOpen(this);
                }
            }
        
            Dialog.prototype.create = function () {
                var opt = this.options;
                var self = this;
        
                // 遮罩
                this.mask = document.createElement("div");
                this.mask.className = "mel-dialog-mask";
                this.mask.style.zIndex = this.zIndex;
                if (!opt.mask) {
                    this.mask.style.display = "none";
                }
                this.mask.onclick = function () {
                    if (opt.maskClosable) self.close();
                };
        
                // 弹窗容器
                this.wrap = document.createElement("div");
                this.wrap.className = "mel-dialog-wrap";
                this.wrap.style.zIndex = this.zIndex + 1;
                addClass(this.wrap, "theme-" + (opt.theme || "info"));
                if (opt.fullScreen) addClass(this.wrap, "is-fullscreen");
                if (opt.center) addClass(this.wrap, "layout-center");
                if (opt.textCenter) addClass(this.wrap, "text-center");
                if (opt.device === "phone") addClass(this.wrap, "is-phone");
                if (opt.title) {
                    addClass(this.wrap, "has-header");
                } else {
                    addClass(this.wrap, "no-header");
                }
        
                // 尺寸（fullScreen 忽略 width/height）
                if (!opt.fullScreen) {
                    var w = parseSize(opt.width);
                    if (w) this.wrap.style.width = w;
                    var h = parseSize(opt.height);
                    if (h) this.wrap.style.height = h;
                }
        
                // 关闭按钮：独立于 header，title为空也渲染
                if (opt.showClose) {
                    var closeBtn = document.createElement("div");
                    closeBtn.className = "mel-dialog-close";
                    closeBtn.onclick = function () {
                        self.close();
                    };
                    this.wrap.appendChild(closeBtn);
                }
        
                // header（标题前不渲染type图标，图标统一在内容前）
                if (opt.title) {
                    this.headerDom = document.createElement("div");
                    this.headerDom.className = "mel-dialog-header";
                    if (opt.showClose) {
                        addClass(this.headerDom, "has-close");
                    }
                    var titleDom = document.createElement("div");
                    titleDom.className = "mel-dialog-title";
                    titleDom.innerHTML = escapeHtml(opt.title);
                    this.headerDom.appendChild(titleDom);
                    this.wrap.appendChild(this.headerDom);
                }
        
                // body（内容统一包裹在 inner 中，支持无标题/手机模式垂直居中）
                this.bodyDom = document.createElement("div");
                this.bodyDom.className = "mel-dialog-body";
                if (opt.contentMaxHeight) {
                    this.bodyDom.style.maxHeight = parseSize(opt.contentMaxHeight);
                    this.bodyDom.style.overflowY = "auto";
                }
                if (opt.fontSize) {
                    this.bodyDom.style.fontSize = parseSize(opt.fontSize);
                }
                var bodyHtml = "";
                if (opt.dangerouslyUseHTMLString) {
                    bodyHtml += opt.content || "";
                } else {
                    // type 警示图标与 message 同行（均为 inline 元素）
                    if (opt.type && typeIconMap[opt.type]) {
                        bodyHtml += '<span class="mel-dialog-body-icon mel-icon-' + opt.type + '">' + typeIconMap[opt.type] + '</span>';
                    }
                    bodyHtml += '<span class="mel-dialog-msg">' + escapeHtml(opt.message) + '</span>';
                }
                // prompt 输入区
                if (opt._isPrompt === true) {
                    var p = opt.prompt || {};
                    bodyHtml += '<div class="mel-dialog-input-wrap">';
                    if (p.inputType === "textarea") {
                        bodyHtml += '<textarea class="mel-dialog-textarea" placeholder="' + escapeHtml(p.placeholder || "") + '">' + escapeHtml(p.defaultValue || "") + '</textarea>';
                    } else {
                        bodyHtml += '<input class="mel-dialog-input" type="text" placeholder="' + escapeHtml(p.placeholder || "") + '" value="' + escapeHtml(p.defaultValue || "") + '">';
                    }
                    if (p.unit) {
                        bodyHtml += '<span class="mel-dialog-input-unit">' + escapeHtml(p.unit) + '</span>';
                    }
                    bodyHtml += '</div>';
                }
                var inner = document.createElement("div");
                inner.className = "mel-dialog-body-inner";
                inner.innerHTML = bodyHtml;
                this.bodyDom.appendChild(inner);
        
                // 无标题弹窗：内容垂直居中
                if (!opt.title) {
                    addClass(this.bodyDom, "vert-center");
                }
                // phone 模式纯文字（message）垂直居中
                if (opt.device === "phone" && !opt.dangerouslyUseHTMLString && opt._isPrompt !== true) {
                    addClass(this.bodyDom, "vert-center");
                }
                this.wrap.appendChild(this.bodyDom);
        
                // footer
                this.createFooter();
                this.wrap.appendChild(this.footerDom);
        
                document.body.appendChild(this.mask);
                document.body.appendChild(this.wrap);
        
                // prompt 输入框引用
                if (opt._isPrompt === true) {
                    if ((opt.prompt || {}).inputType === "textarea") {
                        this.inputEl = this.bodyDom.querySelector(".mel-dialog-textarea");
                    } else {
                        this.inputEl = this.bodyDom.querySelector(".mel-dialog-input");
                    }
                }
        
                // 无标题：body顶到弹窗顶部导致message视觉偏上，
                // 补偿 footer 一半高度，使 message 落在弹窗视觉平衡位置（略偏上）
                if (!opt.title) {
                    setTimeout(function () {
                        var footerH = self.footerDom ? self.footerDom.offsetHeight : 0;
                        if (footerH > 0) {
                            self.bodyDom.style.paddingTop = (20 + Math.floor(footerH / 2)) + "px";
                        }
                    }, 0);
                }
            };
        
            Dialog.prototype.createFooter = function () {
                var opt = this.options;
                var raw = opt.buttons || [];
                var btnArr = [];
                // 归一化：支持字符串快捷写法，如 ["取消","确定"]
                // 字符串项默认 default（灰）；数组最后一项若是字符串则用弹窗主题色
                for (var i = 0; i < raw.length; i++) {
                    var item = raw[i];
                    if (typeof item === "string") {
                        btnArr.push({
                            text: item,
                            type: (i === raw.length - 1) ? (opt.theme || "info") : "default"
                        });
                    } else {
                        btnArr.push(item);
                    }
                }
                this.footerDom = document.createElement("div");
                var footerClass = "mel-dialog-footer";
                if (opt.btnDirection === "vert") footerClass += " mel-dialog-footer-vert";
                if (opt.btnFullWidth) footerClass += " mel-dialog-footer-full";
                this.footerDom.className = footerClass;
                for (var j = 0; j < btnArr.length; j++) {
                    var item2 = btnArr[j];
                    var btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "mel-dialog-btn mel-btn-" + (item2.type || "default");
                    btn.setAttribute("data-index", j + 1);
                    if (opt.btnDisabled) {
                        btn.disabled = true;
                    }
                    btn.innerHTML = escapeHtml(item2.text);
                    this.footerDom.appendChild(btn);
                }
                // 通栏铺满（横向）：按按钮数量计算等分宽度，兼容IE9
                if (opt.btnFullWidth && opt.btnDirection !== "vert") {
                    var n = this.footerDom.children.length;
                    if (n > 0) {
                        var gap = opt.device === "phone" ? 0 : 2; // 按钮间距（百分比）；phone模式按钮紧贴，靠分隔线区分
                        var w = (100 - gap * (n - 1)) / n;
                        for (var k = 0; k < n; k++) {
                            var b = this.footerDom.children[k];
                            b.style.width = w + "%";
                            b.style.boxSizing = "border-box";
                            if (k < n - 1 && gap > 0) {
                                b.style.marginRight = gap + "%";
                            }
                        }
                    }
                }
            };
        
            Dialog.prototype.bindEvent = function () {
                var self = this;
                var opt = this.options;
        
                // 阻止弹窗内部点击冒泡到遮罩
                this.wrap.onclick = function (e) {
                    e = e || window.event;
                    if (e.stopPropagation) e.stopPropagation();
                };
        
                // footer 按钮事件委托
                this.footerDom.onclick = function (e) {
                    e = e || window.event;
                    var target = e.target || e.srcElement;
                    while (target && target !== self.footerDom && target.tagName !== "BUTTON") {
                        target = target.parentNode;
                    }
                    if (!target || target === self.footerDom) return;
                    var idx = parseInt(target.getAttribute("data-index"), 10);
                    if (opt.btnDisabled) return;
                    if (typeof opt.onClick === "function") {
                        if (self.inputEl) {
                            opt.onClick(idx, self.inputEl.value);
                        } else {
                            opt.onClick(idx);
                        }
                    }
                    self.close();
                };
            };
        
            /**
             * 固定高度布局：
             * 1. footerStickyBottom=true（默认）：内容区占满剩余高度并内部滚动，按钮钉在底部；
             *    prompt 且为 textarea 时，输入框自动占满内容区高度。
             * 2. footerStickyBottom=false：按钮跟随内容，弹窗整体内部滚动，避免内容被截断。
             * （IE9无flex，全部用JS计算高度）
             */
            Dialog.prototype.layoutFixed = function () {
                var opt = this.options;
                var hasFixedHeight = opt.fullScreen || (opt.height !== "auto" && opt.height !== "" && opt.height != null);
                if (!hasFixedHeight) return;
                var self = this;
                setTimeout(function () {
                    var headerH = self.headerDom ? self.headerDom.offsetHeight : 0;
                    var footerH = self.footerDom ? self.footerDom.offsetHeight : 0;
                    var wrapH = self.wrap ? self.wrap.offsetHeight : 0;
                    var remain = wrapH - headerH - footerH;
                    if (remain <= 20) return;
                    if (opt.footerStickyBottom) {
                        self.bodyDom.style.height = remain + "px";
                        self.bodyDom.style.overflowY = "auto";
                        // prompt textarea 占满内容区
                        if (opt._isPrompt === true && (opt.prompt || {}).inputType === "textarea") {
                            var ta = self.bodyDom.querySelector(".mel-dialog-textarea");
                            if (ta) {
                                var cs = self.bodyDom.currentStyle || window.getComputedStyle(self.bodyDom);
                                var padTop = parseFloat(cs.paddingTop) || 0;
                                var padBottom = parseFloat(cs.paddingBottom) || 0;
                                var taH = remain - padTop - padBottom - 14;
                                if (taH > 40) {
                                    ta.style.height = taH + "px";
                                    ta.style.overflowY = "auto";
                                }
                            }
                        }
                    } else {
                        // 按钮不贴底：弹窗整体滚动，按钮跟随内容可见
                        self.wrap.style.overflowY = "auto";
                    }
                }, 0);
            };
        
            Dialog.prototype.close = function () {
                var opt = this.options;
                if (typeof opt.onClose === "function") {
                    if (opt.onClose(this) === false) return;
                }
                unlockPageScroll();
                if (this.mask && this.mask.parentNode) {
                    document.body.removeChild(this.mask);
                }
                if (this.wrap && this.wrap.parentNode) {
                    document.body.removeChild(this.wrap);
                }
            };
        
            //===== 模态弹窗快捷方法（外部传入 buttons 时不被覆盖） =====
            Dialog.alert = function (options) {
                var opts = extend({}, options);
                if (!opts.buttons) {
                    opts.buttons = [{ text: "确定", type: opts.theme || "info" }];
                }
                opts._isPrompt = false;
                return new Dialog(opts);
            };
            Dialog.confirm = function (options) {
                var opts = extend({}, options);
                if (!opts.buttons) {
                    opts.buttons = [
                        { text: "取消", type: "default" },
                        { text: "确定", type: opts.theme || "info" }
                    ];
                }
                opts._isPrompt = false;
                return new Dialog(opts);
            };
            Dialog.prompt = function (options) {
                var opts = extend({}, options);
                // 默认只有一个"确定"按钮；需要取消/多个按钮时自行传入buttons
                if (!opts.buttons) {
                    opts.buttons = [{ text: "确定", type: opts.theme || "info" }];
                }
                opts._isPrompt = true;
                return new Dialog(opts);
            };
            Dialog.dialog = function (options) {
                var opts = extend({}, options);
                if (!opts.buttons) {
                    opts.buttons = [{ text: "确定", type: opts.theme || "info" }];
                }
                opts._isPrompt = false;
                return new Dialog(opts);
            };
        
            //==================== Tip 消息提示（独立组件） ====================
            function renderIcon(type) {
                return typeIconMap[type] || "";
            }
        
            function reCalcTipOffset(posKey) {
                var list = tipQueue[posKey];
                var offset = 20;
                for (var i = 0; i < list.length; i++) {
                    var item = list[i];
                    if (!item.dom) continue;
                    item.dom.style[posKey] = offset + "px";
                    offset += item.dom.offsetHeight + 10;
                }
            }
        
            function removeTipInstance(ins, posKey) {
                var list = tipQueue[posKey];
                var idx = list.indexOf(ins);
                if (idx > -1) list.splice(idx, 1);
                if (ins.maskDom && ins.maskDom.parentNode) {
                    document.body.removeChild(ins.maskDom);
                }
                if (ins.dom && ins.dom.parentNode) {
                    document.body.removeChild(ins.dom);
                }
                reCalcTipOffset(posKey);
                if (typeof ins._cfg.onClose === "function") {
                    ins._cfg.onClose();
                }
            }
        
            /**
             * Tip 消息提示
             * @param {string|Object} opts
             */
            function Tip(opts) {
                var cfg;
                if (typeof opts === "string") {
                    cfg = extend({}, tipDefaults, { message: opts });
                } else {
                    cfg = extend({}, tipDefaults, opts || {});
                }
                if (cfg.type === "warn") cfg.type = "warning";
                if (cfg.position !== "top" && cfg.position !== "bottom") cfg.position = "top";
                var posKey = cfg.position;
        
                var maskDom = null;
                if (cfg.mask) {
                    maskDom = document.createElement("div");
                    maskDom.className = "mel-tip-mask";
                    document.body.appendChild(maskDom);
                }
        
                var wrap = document.createElement("div");
                wrap.className = "mel-tip-wrap mel-pos-" + cfg.position;
                var inner = document.createElement("div");
                inner.className = "mel-tip-inner " + cfg.type;
                var html = "";
                if (cfg.type !== "plain") {
                    html += '<span class="mel-tip-icon">' + renderIcon(cfg.type) + '</span>';
                }
                html += cfg.dangerouslyUseHTMLString ? (cfg.message || "") : escapeHtml(cfg.message || "");
                html += '<span class="mel-tip-close">×</span>';
                inner.innerHTML = html;
                wrap.appendChild(inner);
                document.body.appendChild(wrap);
        
                var timerId = null;
                var paused = false;
                var ins = {
                    _cfg: cfg,
                    maskDom: maskDom,
                    dom: wrap,
                    close: function () {
                        if (timerId) clearTimeout(timerId);
                        removeTipInstance(ins, posKey);
                    }
                };
                tipQueue[posKey].push(ins);
                reCalcTipOffset(posKey);
        
                // hover 暂停倒计时
                if (cfg.duration > 0) {
                    var startTimer = null;
                    startTimer = function () {
                        if (timerId) clearTimeout(timerId);
                        timerId = setTimeout(function () {
                            ins.close();
                        }, cfg.duration);
                    };
                    startTimer();
                    wrap.onmouseenter = function () {
                        paused = true;
                        if (timerId) clearTimeout(timerId);
                    };
                    wrap.onmouseleave = function () {
                        if (paused) startTimer();
                    };
                }
        
                // 手动关闭
                var closeBtn = inner.querySelector(".mel-tip-close");
                if (closeBtn) {
                    closeBtn.onclick = function () {
                        ins.close();
                    };
                }
                return ins;
            }
            Tip.success = function (msg, opts) { return Tip(extend({ message: msg, type: "success" }, opts)); };
            Tip.warning = function (msg, opts) { return Tip(extend({ message: msg, type: "warning" }, opts)); };
            Tip.warn = function (msg, opts) { return Tip(extend({ message: msg, type: "warn" }, opts)); };
            Tip.error = function (msg, opts) { return Tip(extend({ message: msg, type: "error" }, opts)); };
            Tip.info = function (msg, opts) { return Tip(extend({ message: msg, type: "info" }, opts)); };
            Tip.plain = function (msg, opts) { return Tip(extend({ message: msg, type: "plain" }, opts)); };
        
            //==================== Toast 轻提示（独立组件） ====================
            function reCalcToastOffset(posKey) {
                var list = toastQueue[posKey];
                var offset = 20;
                for (var i = 0; i < list.length; i++) {
                    var item = list[i];
                    if (!item.dom) continue;
                    if (posKey === "center") {
                        item.dom.style.top = "50%";
                        item.dom.style.marginTop = (offset - 20) + "px";
                    } else {
                        item.dom.style[posKey] = offset + "px";
                    }
                    offset += item.dom.offsetHeight + 10;
                }
            }
        
            function removeToastInstance(ins, posKey) {
                var list = toastQueue[posKey];
                var idx = list.indexOf(ins);
                if (idx > -1) list.splice(idx, 1);
                if (ins.maskDom && ins.maskDom.parentNode) {
                    document.body.removeChild(ins.maskDom);
                }
                if (ins.dom && ins.dom.parentNode) {
                    document.body.removeChild(ins.dom);
                }
                reCalcToastOffset(posKey);
                if (typeof ins._cfg.onClose === "function") {
                    ins._cfg.onClose();
                }
            }
        
            /**
             * Toast 轻提示
             * @param {string|Object} opts
             */
            function Toast(opts) {
                var cfg;
                if (typeof opts === "string") {
                    cfg = extend({}, toastDefaults, { message: opts });
                } else {
                    cfg = extend({}, toastDefaults, opts || {});
                }
                if (cfg.type === "warn") cfg.type = "warning";
                var posKey = cfg.position;
                if (posKey !== "center" && posKey !== "top" && posKey !== "bottom") posKey = "center";
        
                var maskDom = null;
                if (cfg.mask) {
                    maskDom = document.createElement("div");
                    maskDom.className = "mel-tip-mask";
                    document.body.appendChild(maskDom);
                }
        
                var wrap = document.createElement("div");
                wrap.className = "mel-toast-wrap mel-pos-" + posKey;
                var inner = document.createElement("div");
                inner.className = "mel-toast-inner " + cfg.type;
                var html = "";
                if (cfg.type !== "plain") {
                    html += '<span class="mel-toast-icon">' + renderIcon(cfg.type) + '</span>';
                }
                html += cfg.dangerouslyUseHTMLString ? (cfg.message || "") : escapeHtml(cfg.message || "");
                inner.innerHTML = html;
                wrap.appendChild(inner);
                document.body.appendChild(wrap);
        
                var timerId = null;
                var ins = {
                    _cfg: cfg,
                    maskDom: maskDom,
                    dom: wrap,
                    close: function () {
                        if (timerId) clearTimeout(timerId);
                        removeToastInstance(ins, posKey);
                    }
                };
                toastQueue[posKey].push(ins);
                reCalcToastOffset(posKey);
        
                if (cfg.duration > 0) {
                    timerId = setTimeout(function () {
                        ins.close();
                    }, cfg.duration);
                }
                return ins;
            }
            Toast.success = function (msg, opts) { return Toast(extend({ message: msg, type: "success" }, opts)); };
            Toast.warning = function (msg, opts) { return Toast(extend({ message: msg, type: "warning" }, opts)); };
            Toast.warn = function (msg, opts) { return Toast(extend({ message: msg, type: "warn" }, opts)); };
            Toast.error = function (msg, opts) { return Toast(extend({ message: msg, type: "error" }, opts)); };
            Toast.info = function (msg, opts) { return Toast(extend({ message: msg, type: "info" }, opts)); };
            Toast.plain = function (msg, opts) { return Toast(extend({ message: msg, type: "plain" }, opts)); };
        
            //==================== 全局挂载 ====================
            window.MelUi = window.MelUi || {};
            window.MelUi.Dialog = Dialog;
            window.MelUi.alert = Dialog.alert;
            window.MelUi.confirm = Dialog.confirm;
            window.MelUi.prompt = Dialog.prompt;
            window.MelUi.dialog = Dialog.dialog;
            window.MelUi.Tip = Tip;
            window.MelUi.Toast = Toast;
            window.melui = window.MelUi;
        
        })(window);

    /**
     * ============================================================================
     * MelDatePicker - 兼容IE9+的原生日期选择器插件
     * ============================================================================
     * 
     * 【功能说明】
     * 轻量级原生JavaScript日期选择器插件，参考jeDate设计理念。
     * 无任何第三方依赖，支持多种触发方式，完美兼容IE9+及现代浏览器。
     * 
     * 【核心特性】
     * ✓ 兼容IE9、IE10、IE11、Edge、Chrome、Firefox、Safari等主流浏览器
     * ✓ 支持移动端和PC端，自适应响应式设计
     * ✓ 支持ID选择器、Class选择器、标签选择器等多种绑定方式
     * ✓ 支持通过按钮触发（data-trigger属性绑定）
     * ✓ 支持日期范围限制（minDate/maxDate）
     * ✓ 支持多种日期格式输出
     * ✓ 支持丰富的回调函数
     * ✓ 支持UMD模块化规范
     * 
     * 【调用方式】
     * // 方式1：构造函数调用
     * var picker = new MelDatePicker('#myInput', options);
     * 
     * // 方式2：普通函数调用（工厂模式）
     * var picker = MelDatePicker('#myInput', options);
     * 
     * // 方式3：按钮触发（在input上添加data-trigger属性）
     * <input type="text" id="myInput" data-trigger="myBtn" readonly>
     * <button id="myBtn">选择日期</button>
     * MelDatePicker('#myInput', { inputTrigger: false });
     * 
     * 【参数说明】
     * @param {String|Element|NodeList} selector - 目标元素选择器或DOM元素
     * @param {Object} options - 配置选项
     * 
     * 【配置选项】
     * @param {String} options.format - 日期格式，默认 'yyyy-MM-dd'
     * @param {String} options.minDate - 最小可选日期，默认 '1900-01-01'
     * @param {String} options.maxDate - 最大可选日期，默认 '2099-12-31'
     * @param {Date|String} options.initDate - 初始化显示日期，默认当前日期
     * @param {String} options.language - 语言，默认 'cn'
     * @param {Number} options.zIndex - 弹层层级，默认 9999
     * @param {String} options.position - 位置：auto/top/bottom，默认 'auto'
     * @param {Boolean} options.isShowClear - 是否显示清空按钮，默认 true
     * @param {Boolean} options.isShowToday - 是否显示今天按钮，默认 true
     * @param {Boolean} options.isShowOk - 是否显示确定按钮，默认 true
     * @param {Boolean} options.readOnly - 输入框只读，默认 true
     * @param {String} options.trigger - 触发方式：click/focus，默认 'click'
     * @param {Boolean} options.closeOnSelected - 选择后自动关闭，默认 true
     * @param {Boolean} options.confirmToClose - 选择日期后是否需要点击确定按钮才关闭，默认 false
     * @param {Boolean} options.alwaysShow - 始终显示，默认 false
     * @param {Boolean} options.inputTrigger - 按钮触发模式下输入框是否可触发，默认 false
     * 
     * 【回调函数】
     * @param {Function} options.onSelect - 选择日期回调，参数(date, dateStr)
     * @param {Function} options.onOk - 确定回调，参数(date, dateStr)
     * @param {Function} options.onClear - 清空回调
     * @param {Function} options.onClose - 关闭回调
     * 
     * 【实例方法】
     * picker.setDate(date)      - 设置日期
     * picker.getDate()          - 获取Date对象
     * picker.getValue()         - 获取格式化日期字符串
     * picker.setMinDate(date)   - 设置最小日期
     * picker.setMaxDate(date)   - 设置最大日期
     * picker.show()             - 显示选择器
     * picker.hide()             - 隐藏选择器
     * picker.destroy()          - 销毁实例
     * 
     * 【静态方法】
     * MelDatePicker.format(date, format)  - 格式化日期
     * MelDatePicker.parse(dateStr)        - 解析日期字符串
     * 
     * 【版本信息】
     * @version 1.1.0
     * @author MelDatePicker Team
     * @create 2024-01-01
     * @update 2025-03-12
     * @license MIT
     * ============================================================================
     */

     (function(global, factory) {
        
        // 兼容多种模块化规范 UMD
        if (typeof module === 'object' && typeof module.exports === 'object') {
            module.exports = factory(global);
        } else if (typeof define === 'function' && define.amd) {
            define(function() {
                return factory(global);
            });
        } else {
            global.MelDatePicker = factory(global);
        }
    })(typeof window !== 'undefined' ? window : undefined, function(window) {

        // ========== 工具函数 ==========
        
        /**
         * 兼容IE9+的事件绑定
         * @param {Element} element - 目标元素
         * @param {String} type - 事件类型
         * @param {Function} handler - 事件处理函数
         */
        function addEvent(element, type, handler) {
            if (element.addEventListener) {
                element.addEventListener(type, handler, false);
            } else if (element.attachEvent) {
                element.attachEvent('on' + type, handler);
            } else {
                element['on' + type] = handler;
            }
        }

        /**
         * 阻止事件冒泡（兼容IE）
         * @param {Event} e - 事件对象
         */
        function stopPropagation(e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            } else {
                e.cancelBubble = true;
            }
        }

        /**
         * 阻止默认行为（兼容IE）
         * @param {Event} e - 事件对象
         */
        function preventDefault(e) {
            if (e.preventDefault) {
                e.preventDefault();
            } else {
                e.returnValue = false;
            }
        }

        /**
         * 获取事件对象（兼容IE）
         * @param {Event} e - 事件对象
         * @returns {Event} 事件对象
         */
        function getEvent(e) {
            return e || window.event;
        }

        /**
         * 获取目标元素（兼容IE）
         * @param {Event} e - 事件对象
         * @returns {Element} 目标元素
         */
        function getTarget(e) {
            e = getEvent(e);
            return e.target || e.srcElement;
        }

        /**
         * 获取元素位置
         * @param {Element} element - 目标元素
         * @returns {Object} 位置对象 {top, left}
         */
        function getPosition(element) {
            var pos = {
                top: 0,
                left: 0
            };
            
            while (element) {
                pos.top += element.offsetTop - element.scrollTop;
                pos.left += element.offsetLeft - element.scrollLeft;
                element = element.offsetParent;
            }
            
            return pos;
        }

        /**
         * 检测是否为移动端
         * @returns {Boolean}
         */
        function isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        /**
         * 检测IE版本
         * @returns {Number|String} IE版本号，edge返回'edge'，非IE返回-1
         */
        function getIEVersion() {
            var userAgent = navigator.userAgent;
            var isIE = userAgent.indexOf('compatible') > -1 && userAgent.indexOf('MSIE') > -1;
            var isEdge = userAgent.indexOf('Edge') > -1;
            var isIE11 = userAgent.indexOf('Trident') > -1 && userAgent.indexOf('rv:11.0') > -1;
            
            if (isEdge) {
                return 'edge';
            }
            if (isIE11) {
                return 11;
            }
            if (isIE) {
                var reIE = new RegExp('MSIE (\\d+\\.\\d+);');
                reIE.test(userAgent);
                return parseFloat(RegExp['$1']);
            }
            return -1;
        }

        /**
         * 扩展对象
         * @param {Object} target - 目标对象
         * @param {Object} source - 源对象
         * @returns {Object} 扩展后的对象
         */
        function extend(target, source) {
            for (var key in source) {
                if (source.hasOwnProperty(key)) {
                    target[key] = source[key];
                }
            }
            return target;
        }

        /**
         * 类数组转数组（兼容IE）
         * @param {ArrayLike} list - 类数组对象
         * @returns {Array} 数组
         */
        function toArray(list) {
            try {
                return Array.prototype.slice.call(list);
            } catch (e) {
                var arr = [];
                for (var i = 0, len = list.length; i < len; i++) {
                    arr.push(list[i]);
                }
                return arr;
            }
        }

        // ========== 日期处理工具 ==========
        
        /**
         * 日期格式化
         * @param {Date} date - 日期对象
         * @param {String} format - 格式字符串
         * @returns {String} 格式化后的日期字符串
         */
        function formatDate(date, format) {
            if (!date) return '';
            
            var o = {
                'M+': date.getMonth() + 1,
                'd+': date.getDate(),
                'h+': date.getHours(),
                'm+': date.getMinutes(),
                's+': date.getSeconds(),
                'q+': Math.floor((date.getMonth() + 3) / 3),
                'S': date.getMilliseconds()
            };
            
            if (/(y+)/.test(format)) {
                format = format.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
            }
            
            for (var k in o) {
                if (new RegExp('(' + k + ')').test(format)) {
                    format = format.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length));
                }
            }
            
            return format;
        }

        /**
         * 解析日期字符串
         * @param {String} dateStr - 日期字符串
         * @param {String} format - 格式字符串
         * @returns {Date} 日期对象
         */
        function parseDate(dateStr, format) {
            if (!dateStr) return null;
            
            // 如果已经是 Date 对象，直接返回
            if (dateStr instanceof Date) {
                return dateStr;
            }
            
            // 如果不是字符串，尝试转换
            if (typeof dateStr !== 'string') {
                return new Date(dateStr);
            }
            
            // 简单解析 yyyy-MM-dd 格式
            var parts = dateStr.match(/\d+/g);
            if (parts && parts.length >= 3) {
                return new Date(parts[0], parts[1] - 1, parts[2]);
            }
            
            return new Date(dateStr);
        }

        /**
         * 判断是否为闰年
         * @param {Number} year - 年份
         * @returns {Boolean}
         */
        function isLeapYear(year) {
            return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        }

        /**
         * 获取月份天数
         * @param {Number} year - 年份
         * @param {Number} month - 月份（0-11）
         * @returns {Number} 天数
         */
        function getDaysInMonth(year, month) {
            return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
        }

        /**
         * 获取月份第一天是周几
         * @param {Number} year - 年份
         * @param {Number} month - 月份（0-11）
         * @returns {Number} 周几（0-6，0为周日）
         */
        function getFirstDayOfMonth(year, month) {
            return new Date(year, month, 1).getDay();
        }



        // ========== 默认配置 ==========
        
        var defaults = {
            format: 'yyyy-MM-dd',           // 日期格式
            minDate: '1900-01-01',          // 最小日期
            maxDate: '2099-12-31',          // 最大日期
            initDate: new Date(),           // 初始化日期
            defaultDate: null,              // 输入框默认日期
            language: 'cn',                 // 语言
            zIndex: 9999,                   // 弹层层级
            position: 'auto',               // 位置：auto/top/bottom
            isShowClear: true,              // 是否显示清除按钮
            isShowToday: true,              // 是否显示今天按钮
            isShowOk: true,                 // 是否显示确定按钮
            readOnly: true,                 // 输入框只读
            trigger: 'click',               // 触发方式：click/focus
            closeOnSelected: true,          // 选择后是否自动关闭
            confirmToClose: false,          // 选择日期后是否需要点击确定按钮才关闭，默认false直接关闭
            alwaysShow: false,              // 是否始终显示
            inputTrigger: false,            // 按钮触发模式下输入框是否可触发
            onClose: null,                  // 关闭回调
            onOk: null,                     // 确定回调
            onClear: null,                  // 清除回调
            onSelect: null,                 // 选择日期回调
            lang: {
                cn: {
                    name: 'cn',
                    months: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
                    weeks: ['日', '一', '二', '三', '四', '五', '六'],
                    times: ['小时', '分钟', '秒'],
                    timetxt: ['时间', '开始', '结束'],
                    backtxt: '返回',
                    clear: '清空',
                    today: '今天',
                    yes: '确定',
                    close: '关闭'
                }
            }
        };

        // ========== MelDatePicker 主类 ==========
        
        /**
         * MelDatePicker 构造函数
         * @param {String|Element|NodeList} selector - 选择器或元素
         * @param {Object} options - 配置选项
         */
        function MelDatePicker(selector, options) {
            // 工厂模式支持：允许不使用 new 关键字调用
            if (!(this instanceof MelDatePicker)) {
                return new MelDatePicker(selector, options);
            }
            
            this.options = extend({}, defaults);
            extend(this.options, options || {});
            
            this.selector = selector;
            this.elements = [];
            this.currentElement = null;
            this.currentDate = null;
            this.selectedDate = null;
            this.container = null;
            this.isShow = false;
            this.ieVersion = getIEVersion();
            this.isMobile = isMobile();
            
            this.init();
        }

        MelDatePicker.prototype = {
            constructor: MelDatePicker,
            
            /**
             * 初始化
             */
            init: function() {
                this.parseSelector();
                this.bindEvents();
                this.initDefaultDate();
                
                if (this.options.alwaysShow) {
                    this.show();
                }
            },

            /**
             * 解析选择器，支持class和id
             */
            parseSelector: function() {
                if (typeof this.selector === 'string') {
                    if (this.selector.charAt(0) === '#') {
                        var el = document.getElementById(this.selector.substring(1));
                        if (el) this.elements.push(el);
                    } else if (this.selector.charAt(0) === '.') {
                        var els = document.getElementsByClassName 
                            ? document.getElementsByClassName(this.selector.substring(1))
                            : this.getElementsByClassName(this.selector.substring(1));
                        this.elements = toArray(els);
                    } else {
                        try {
                            this.elements = toArray(document.querySelectorAll(this.selector));
                        } catch (e) {
                            console.error('选择器不支持:', this.selector);
                        }
                    }
                } else if (this.selector.nodeType) {
                    this.elements.push(this.selector);
                } else if (typeof this.selector === 'object' && this.selector.length) {
                    this.elements = toArray(this.selector);
                }
            },

            /**
             * 兼容IE8的getElementsByClassName
             */
            getElementsByClassName: function(className) {
                if (document.getElementsByClassName) {
                    return document.getElementsByClassName(className);
                }
                var elements = document.getElementsByTagName('*');
                var result = [];
                for (var i = 0, len = elements.length; i < len; i++) {
                    var el = elements[i];
                    var classNames = el.className.split(/\s+/);
                    for (var j = 0, jlen = classNames.length; j < jlen; j++) {
                        if (classNames[j] === className) {
                            result.push(el);
                            break;
                        }
                    }
                }
                return result;
            },

            /**
             * 初始化默认日期
             */
            initDefaultDate: function() {
                if (this.options.defaultDate) {
                    var defaultDate = parseDate(this.options.defaultDate);
                    if (defaultDate && !isNaN(defaultDate.getTime())) {
                        for (var i = 0, len = this.elements.length; i < len; i++) {
                            var el = this.elements[i];
                            if (!el.value) {
                                el.value = formatDate(defaultDate, this.options.format);
                            }
                        }
                    }
                }
            },

            /**
             * 绑定事件
             */
            bindEvents: function() {
                var self = this;
                var trigger = this.options.trigger;
                
                for (var i = 0, len = this.elements.length; i < len; i++) {
                    var el = this.elements[i];
                    
                    // 设置只读属性
                    if (this.options.readOnly && el.tagName.toLowerCase() === 'input') {
                        el.setAttribute('readonly', 'readonly');
                    }
                    
                    // 检查是否有 data-trigger 属性（按钮触发模式）
                    var triggerBtnId = el.getAttribute('data-trigger');
                    
                    (function(element, btnId) {
                        if (btnId) {
                            // 按钮触发模式
                            var btn = document.getElementById(btnId);
                            if (btn) {
                                addEvent(btn, 'click', function(e) {
                                    preventDefault(e);
                                    stopPropagation(e);
                                    self.currentElement = element;
                                    self.initCurrentValue();
                                    self.show();
                                });
                            }
                            
                            // inputTrigger 参数控制输入框是否也能触发
                            if (self.options.inputTrigger) {
                                addEvent(element, trigger, function(e) {
                                    preventDefault(e);
                                    stopPropagation(e);
                                    self.currentElement = element;
                                    self.initCurrentValue();
                                    self.show();
                                });
                            }
                        } else {
                            // 普通触发模式
                            addEvent(element, trigger, function(e) {
                                preventDefault(e);
                                stopPropagation(e);
                                self.currentElement = element;
                                self.initCurrentValue();
                                self.show();
                            });
                            
                            if (self.isMobile) {
                                addEvent(element, 'touchend', function(e) {
                                    preventDefault(e);
                                    self.currentElement = element;
                                    self.initCurrentValue();
                                    self.show();
                                });
                            }
                        }
                    })(el, triggerBtnId);
                }
                
                this.bindDocumentClick();
            },

            /**
             * 绑定文档点击事件
             */
            bindDocumentClick: function() {
                var self = this;
                addEvent(document, 'click', function(e) {
                    if (!self.isShow) return;
                    var target = getTarget(e);
                    var isInside = self.container && (self.container === target || self.isChildOf(target, self.container));
                    var isInput = false;
                    for (var i = 0, len = self.elements.length; i < len; i++) {
                        if (self.elements[i] === target || self.isChildOf(target, self.elements[i])) {
                            isInput = true;
                            break;
                        }
                    }
                    if (!isInside && !isInput && !self.options.alwaysShow) {
                        self.hide();
                    }
                });
            },

            /**
             * 判断是否为子元素
             */
            isChildOf: function(child, parent) {
                while (child && child !== document) {
                    if (child === parent) return true;
                    child = child.parentNode;
                }
                return false;
            },

            /**
             * 初始化当前值
             */
            initCurrentValue: function() {
                if (this.currentElement && this.currentElement.value) {
                    this.selectedDate = parseDate(this.currentElement.value, this.options.format);
                    if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
                        this.currentDate = new Date(this.selectedDate);
                    } else {
                        this.currentDate = new Date(this.options.initDate);
                        this.selectedDate = null;
                    }
                } else {
                    this.currentDate = new Date(this.options.initDate);
                }
            },

            /**
             * 显示日期选择器
             */
            show: function() {
                if (!this.container) {
                    this.createContainer();
                }
                this.updatePosition();
                this.render();
                this.container.style.display = 'block';
                
                var self = this;
                setTimeout(function() {
                    if (self.container) {
                        self.addClass(self.container, 'mel-dp-show');
                    }
                }, 10);
                
                this.isShow = true;
            },

            /**
             * 隐藏日期选择器
             */
            hide: function() {
                if (this.container) {
                    this.removeClass(this.container, 'mel-dp-show');
                    var self = this;
                    setTimeout(function() {
                        if (self.container) {
                            self.container.style.display = 'none';
                        }
                    }, 200);
                }
                this.isShow = false;
                if (typeof this.options.onClose === 'function') {
                    this.options.onClose();
                }
            },

            /**
             * 创建容器
             */
            createContainer: function() {
                this.container = document.createElement('div');
                this.container.className = 'mel-dp-container';
                this.container.style.cssText = 'position:absolute;z-index:' + this.options.zIndex + ';display:none;';
                
                if (this.ieVersion > 0 && this.ieVersion <= 9) {
                    this.container.style.background = '#fff';
                    this.container.style.border = '1px solid #e5e5e5';
                }
                
                document.body.appendChild(this.container);
                addEvent(this.container, 'click', function(e) {
                    stopPropagation(e);
                });
                
                if (this.isMobile) {
                    addEvent(this.container, 'touchend', function(e) {
                        stopPropagation(e);
                    });
                }
            },

            /**
             * 更新位置
             */
            updatePosition: function() {
                if (!this.currentElement || !this.container) return;
                
                var pos = getPosition(this.currentElement);
                var elHeight = this.currentElement.offsetHeight || 30;
                var elWidth = this.currentElement.offsetWidth || 200;
                var containerWidth = 280;
                var containerHeight = 320;
                
                var scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
                var scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;
                var winWidth = document.documentElement.clientWidth;
                var winHeight = document.documentElement.clientHeight;
                
                var left = pos.left;
                var top = pos.top + elHeight + 5;
                
                if (this.options.position === 'auto' || !this.options.position) {
                    if (top + containerHeight > scrollTop + winHeight) {
                        top = pos.top - containerHeight - 5;
                    }
                    if (left + containerWidth > scrollLeft + winWidth) {
                        left = pos.left + elWidth - containerWidth;
                    }
                } else if (this.options.position === 'top') {
                    top = pos.top - containerHeight - 5;
                } else if (this.options.position === 'bottom') {
                    top = pos.top + elHeight + 5;
                }
                
                if (left < scrollLeft) left = scrollLeft + 5;
                if (top < scrollTop) top = scrollTop + 5;
                
                this.container.style.left = left + 'px';
                this.container.style.top = top + 'px';
            },

            /**
             * 渲染日期选择器
             */
            render: function() {
                var lang = this.options.lang[this.options.language];
                var year = this.currentDate.getFullYear();
                var month = this.currentDate.getMonth();
                
                var html = '<div class="mel-dp-header">' +
                    '<div class="mel-dp-header-btn mel-dp-prev-year" title="上一年">«</div>' +
                    '<div class="mel-dp-header-btn mel-dp-prev-month" title="上一月">‹</div>' +
                    '<div class="mel-dp-header-title">' +
                    '<span class="mel-dp-year-btn">' + year + '年</span>' +
                    '<span class="mel-dp-month-btn">' + lang.months[month] + '</span>' +
                    '</div>' +
                    '<div class="mel-dp-header-btn mel-dp-next-month" title="下一月">›</div>' +
                    '<div class="mel-dp-header-btn mel-dp-next-year" title="下一年">»</div>' +
                    '</div>';
                
                html += '<div class="mel-dp-body">';
                html += '<div class="mel-dp-weeks">';
                for (var i = 0; i < 7; i++) {
                    html += '<span class="mel-dp-week' + (i === 0 || i === 6 ? ' mel-dp-weekend' : '') + '">' + lang.weeks[i] + '</span>';
                }
                html += '</div>';
                html += '<div class="mel-dp-days">' + this.renderDays(year, month) + '</div>';
                html += '</div>';
                
                html += '<div class="mel-dp-footer">';
                if (this.options.isShowClear) {
                    html += '<button type="button" class="mel-dp-btn mel-dp-btn-clear">' + lang.clear + '</button>';
                }
                if (this.options.isShowToday) {
                    html += '<button type="button" class="mel-dp-btn mel-dp-btn-today">' + lang.today + '</button>';
                }
                if (this.options.isShowOk) {
                    html += '<button type="button" class="mel-dp-btn mel-dp-btn-ok">' + lang.yes + '</button>';
                }
                html += '</div>';
                
                this.container.innerHTML = html;
                this.bindContainerEvents();
            },


            /**
             * 渲染日期格子
             */
            renderDays: function(year, month) {
                var html = '';
                var days = getDaysInMonth(year, month);
                var firstDay = getFirstDayOfMonth(year, month);
                var today = new Date();
                var todayStr = formatDate(today, 'yyyy-MM-dd');
                
                var prevMonth = month === 0 ? 11 : month - 1;
                var prevYear = month === 0 ? year - 1 : year;
                var prevDays = getDaysInMonth(prevYear, prevMonth);
                
                var nextMonth = month === 11 ? 0 : month + 1;
                var nextYear = month === 11 ? year + 1 : year;
                
                var minDate = parseDate(this.options.minDate);
                var maxDate = parseDate(this.options.maxDate);
                
                // 上月日期
                for (var i = firstDay - 1; i >= 0; i--) {
                    var day = prevDays - i;
                    var dateStr = formatDate(new Date(prevYear, prevMonth, day), 'yyyy-MM-dd');
                    html += '<span class="mel-dp-day mel-dp-other-month" data-date="' + dateStr + '">' + day + '</span>';
                }
                
                // 当月日期
                for (var i = 1; i <= days; i++) {
                    var date = new Date(year, month, i);
                    var dateStr = formatDate(date, 'yyyy-MM-dd');
                    var dayOfWeek = date.getDay();
                    
                    var classes = ['mel-dp-day'];
                    if (dayOfWeek === 0 || dayOfWeek === 6) classes.push('mel-dp-weekend');
                    if (dateStr === todayStr) classes.push('mel-dp-today');
                    if (this.selectedDate && formatDate(this.selectedDate, 'yyyy-MM-dd') === dateStr) classes.push('mel-dp-selected');
                    if ((minDate && date < minDate) || (maxDate && date > maxDate)) classes.push('mel-dp-disabled');
                    
                    html += '<span class="' + classes.join(' ') + '" data-date="' + dateStr + '">' + i + '</span>';
                }
                
                // 下月日期
                var totalCells = 42;
                var filledCells = firstDay + days;
                var remainingCells = totalCells - filledCells;
                
                for (var i = 1; i <= remainingCells; i++) {
                    var dateStr = formatDate(new Date(nextYear, nextMonth, i), 'yyyy-MM-dd');
                    html += '<span class="mel-dp-day mel-dp-other-month" data-date="' + dateStr + '">' + i + '</span>';
                }
                
                return html;
            },

            /**
             * 绑定容器内事件
             */
            bindContainerEvents: function() {
                var self = this;
                
                // 导航按钮
                var prevYearBtn = this.container.querySelector('.mel-dp-prev-year');
                if (prevYearBtn) {
                    addEvent(prevYearBtn, 'click', function() {
                        self.currentDate.setFullYear(self.currentDate.getFullYear() - 1);
                        self.render();
                    });
                }
                
                var prevMonthBtn = this.container.querySelector('.mel-dp-prev-month');
                if (prevMonthBtn) {
                    addEvent(prevMonthBtn, 'click', function() {
                        self.currentDate.setMonth(self.currentDate.getMonth() - 1);
                        self.render();
                    });
                }
                
                var nextMonthBtn = this.container.querySelector('.mel-dp-next-month');
                if (nextMonthBtn) {
                    addEvent(nextMonthBtn, 'click', function() {
                        self.currentDate.setMonth(self.currentDate.getMonth() + 1);
                        self.render();
                    });
                }
                
                var nextYearBtn = this.container.querySelector('.mel-dp-next-year');
                if (nextYearBtn) {
                    addEvent(nextYearBtn, 'click', function() {
                        self.currentDate.setFullYear(self.currentDate.getFullYear() + 1);
                        self.render();
                    });
                }
                
                // 年月选择
                var yearBtn = this.container.querySelector('.mel-dp-year-btn');
                if (yearBtn) {
                    addEvent(yearBtn, 'click', function() { self.showYearSelector(); });
                }
                
                var monthBtn = this.container.querySelector('.mel-dp-month-btn');
                if (monthBtn) {
                    addEvent(monthBtn, 'click', function() { self.showMonthSelector(); });
                }
                
                // 日期点击
                var days = this.container.querySelectorAll('.mel-dp-day');
                for (var i = 0, len = days.length; i < len; i++) {
                    addEvent(days[i], 'click', function() {
                        if (self.hasClass(this, 'mel-dp-disabled')) return;
                        self.selectDate(this.getAttribute('data-date'));
                    });
                    
                    if (self.isMobile) {
                        addEvent(days[i], 'touchstart', function() { self.addClass(this, 'mel-dp-hover'); });
                        addEvent(days[i], 'touchend', function() { self.removeClass(this, 'mel-dp-hover'); });
                    }
                }
                
                // 底部按钮
                var clearBtn = this.container.querySelector('.mel-dp-btn-clear');
                if (clearBtn) addEvent(clearBtn, 'click', function() { self.clear(); });
                
                var todayBtn = this.container.querySelector('.mel-dp-btn-today');
                if (todayBtn) addEvent(todayBtn, 'click', function() { self.selectToday(); });
                
                var okBtn = this.container.querySelector('.mel-dp-btn-ok');
                if (okBtn) addEvent(okBtn, 'click', function() { self.confirm(); });
            },

            /**
             * 选择日期
             */
            selectDate: function(dateStr) {
                this.selectedDate = parseDate(dateStr);
                this.currentDate = new Date(this.selectedDate);
                
                if (this.currentElement) {
                    this.currentElement.value = formatDate(this.selectedDate, this.options.format);
                    this.triggerChangeEvent();
                }
                
                if (typeof this.options.onSelect === 'function') {
                    this.options.onSelect(this.selectedDate, formatDate(this.selectedDate, this.options.format));
                }
                
                this.render();
                
                // confirmToClose 为 true 时，需要点击确定按钮才关闭；否则根据 closeOnSelected 决定
                if (!this.options.confirmToClose && this.options.closeOnSelected) {
                    this.hide();
                }
            },

            /**
             * 触发change事件
             */
            triggerChangeEvent: function() {
                if (!this.currentElement) return;
                var event;
                if (document.createEvent) {
                    event = document.createEvent('HTMLEvents');
                    event.initEvent('change', true, true);
                } else {
                    event = document.createEventObject();
                    event.eventType = 'change';
                }
                if (this.currentElement.dispatchEvent) {
                    this.currentElement.dispatchEvent(event);
                } else {
                    this.currentElement.fireEvent('onchange', event);
                }
            },

            /**
             * 选择今天
             */
            selectToday: function() {
                var today = new Date();
                this.selectedDate = today;
                this.currentDate = new Date(today);
                
                if (this.currentElement) {
                    this.currentElement.value = formatDate(today, this.options.format);
                }
                
                if (typeof this.options.onSelect === 'function') {
                    this.options.onSelect(today, formatDate(today, this.options.format));
                }
                
                this.render();
                
                // confirmToClose 为 true 时，需要点击确定按钮才关闭；否则根据 closeOnSelected 决定
                if (!this.options.confirmToClose && this.options.closeOnSelected) {
                    this.hide();
                }
            },

            /**
             * 确认选择
             */
            confirm: function() {
                if (this.selectedDate && typeof this.options.onOk === 'function') {
                    this.options.onOk(this.selectedDate, formatDate(this.selectedDate, this.options.format));
                }
                this.hide();
            },

            /**
             * 清空选择
             */
            clear: function() {
                this.selectedDate = null;
                if (this.currentElement) this.currentElement.value = '';
                if (typeof this.options.onClear === 'function') this.options.onClear();
                this.hide();
            },

            /**
             * 显示年份选择器
             */
            showYearSelector: function() {
                var self = this;
                var currentYear = this.currentDate.getFullYear();
                var startYear = Math.floor(currentYear / 10) * 10;
                
                var html = '<div class="mel-dp-selector mel-dp-year-selector">' +
                    '<div class="mel-dp-selector-header">' +
                    '<span class="mel-dp-selector-prev">«</span>' +
                    '<span class="mel-dp-selector-title">' + startYear + '-' + (startYear + 11) + '</span>' +
                    '<span class="mel-dp-selector-next">»</span>' +
                    '</div><div class="mel-dp-selector-body">';
                
                for (var i = 0; i < 12; i++) {
                    var year = startYear + i;
                    var classes = 'mel-dp-selector-item' + (year === currentYear ? ' mel-dp-selected' : '');
                    html += '<span class="' + classes + '" data-year="' + year + '">' + year + '</span>';
                }
                
                html += '</div></div>';
                this.container.innerHTML = html;
                
                var prevBtn = this.container.querySelector('.mel-dp-selector-prev');
                var nextBtn = this.container.querySelector('.mel-dp-selector-next');
                
                addEvent(prevBtn, 'click', function() {
                    self.currentDate.setFullYear(startYear - 12);
                    self.showYearSelector();
                });
                
                addEvent(nextBtn, 'click', function() {
                    self.currentDate.setFullYear(startYear + 12);
                    self.showYearSelector();
                });
                
                var items = this.container.querySelectorAll('.mel-dp-selector-item');
                for (var i = 0, len = items.length; i < len; i++) {
                    addEvent(items[i], 'click', function() {
                        self.currentDate.setFullYear(parseInt(this.getAttribute('data-year')));
                        self.render();
                    });
                }
            },

            /**
             * 显示月份选择器
             */
            showMonthSelector: function() {
                var self = this;
                var currentMonth = this.currentDate.getMonth();
                var lang = this.options.lang[this.options.language];
                
                var html = '<div class="mel-dp-selector mel-dp-month-selector">' +
                    '<div class="mel-dp-selector-header"><span class="mel-dp-selector-title">选择月份</span></div>' +
                    '<div class="mel-dp-selector-body">';
                
                for (var i = 0; i < 12; i++) {
                    var classes = 'mel-dp-selector-item' + (i === currentMonth ? ' mel-dp-selected' : '');
                    html += '<span class="' + classes + '" data-month="' + i + '">' + lang.months[i] + '</span>';
                }
                
                html += '</div></div>';
                this.container.innerHTML = html;
                
                var items = this.container.querySelectorAll('.mel-dp-selector-item');
                for (var i = 0, len = items.length; i < len; i++) {
                    addEvent(items[i], 'click', function() {
                        self.currentDate.setMonth(parseInt(this.getAttribute('data-month')));
                        self.render();
                    });
                }
            },


            // ========== DOM操作工具方法 ==========
            
            addClass: function(element, className) {
                if (!element) return;
                if (element.classList) {
                    element.classList.add(className);
                } else {
                    var classes = element.className.split(/\s+/);
                    if (classes.indexOf(className) === -1) {
                        classes.push(className);
                        element.className = classes.join(' ');
                    }
                }
            },

            removeClass: function(element, className) {
                if (!element) return;
                if (element.classList) {
                    element.classList.remove(className);
                } else {
                    var classes = element.className.split(/\s+/);
                    var index = classes.indexOf(className);
                    if (index > -1) {
                        classes.splice(index, 1);
                        element.className = classes.join(' ');
                    }
                }
            },

            hasClass: function(element, className) {
                if (!element) return false;
                if (element.classList) {
                    return element.classList.contains(className);
                }
                return element.className.split(/\s+/).indexOf(className) > -1;
            },

            // ========== 实例方法 ==========
            
            /**
             * 设置日期
             * @param {Date|String} date - 日期对象或字符串
             */
            setDate: function(date) {
                if (typeof date === 'string') {
                    this.selectedDate = parseDate(date);
                } else if (date instanceof Date) {
                    this.selectedDate = date;
                }
                if (this.selectedDate) {
                    this.currentDate = new Date(this.selectedDate);
                    if (this.currentElement) {
                        this.currentElement.value = formatDate(this.selectedDate, this.options.format);
                    }
                }
            },

            /**
             * 获取日期对象
             * @returns {Date}
             */
            getDate: function() {
                return this.selectedDate;
            },

            /**
             * 获取格式化日期字符串
             * @returns {String}
             */
            getValue: function() {
                return this.selectedDate ? formatDate(this.selectedDate, this.options.format) : '';
            },

            /**
             * 设置最小日期
             * @param {String} date - 日期字符串
             */
            setMinDate: function(date) {
                this.options.minDate = date;
                if (this.isShow) this.render();
            },

            /**
             * 设置最大日期
             * @param {String} date - 日期字符串
             */
            setMaxDate: function(date) {
                this.options.maxDate = date;
                if (this.isShow) this.render();
            },

            /**
             * 销毁实例
             */
            destroy: function() {
                if (this.container) {
                    this.container.parentNode.removeChild(this.container);
                    this.container = null;
                }
                this.elements = [];
                this.currentElement = null;
                this.selectedDate = null;
                this.isShow = false;
            }
        };

        // ========== 静态方法 - 日期快捷获取 ==========
        
        /**
         * 今天
         * @param {String} format - 格式，默认 'yyyy-MM-dd'
         * @returns {String|Date}
         */
        MelDatePicker.today = function(format) {
            var date = new Date();
            return format ? formatDate(date, format) : date;
        };

        /**
         * 明天
         */
        MelDatePicker.tomorrow = function(format) {
            var date = new Date();
            date.setDate(date.getDate() + 1);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 后天
         */
        MelDatePicker.afterTomorrow = function(format) {
            var date = new Date();
            date.setDate(date.getDate() + 2);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 昨天
         */
        MelDatePicker.yesterday = function(format) {
            var date = new Date();
            date.setDate(date.getDate() - 1);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 前天
         */
        MelDatePicker.dayBeforeYesterday = function(format) {
            var date = new Date();
            date.setDate(date.getDate() - 2);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 当前时间
         * @param {String} format - 格式，默认 'yyyy-MM-dd hh:mm:ss'
         */
        MelDatePicker.now = function(format) {
            var date = new Date();
            format = format || 'yyyy-MM-dd hh:mm:ss';
            return formatDate(date, format);
        };

        /**
         * 本月第一天
         */
        MelDatePicker.monthFirst = function(format) {
            var date = new Date();
            date.setDate(1);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 本月最后一天
         */
        MelDatePicker.monthLast = function(format) {
            var date = new Date();
            date.setMonth(date.getMonth() + 1);
            date.setDate(0);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 本季度第一天
         */
        MelDatePicker.quarterFirst = function(format) {
            var date = new Date();
            var quarter = Math.floor(date.getMonth() / 3);
            date.setMonth(quarter * 3);
            date.setDate(1);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 本季度最后一天
         */
        MelDatePicker.quarterLast = function(format) {
            var date = new Date();
            var quarter = Math.floor(date.getMonth() / 3);
            date.setMonth((quarter + 1) * 3);
            date.setDate(0);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 本年第一天
         */
        MelDatePicker.yearFirst = function(format) {
            var date = new Date();
            date.setMonth(0);
            date.setDate(1);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 本年最后一天
         */
        MelDatePicker.yearLast = function(format) {
            var date = new Date();
            date.setMonth(11);
            date.setDate(31);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 上月初（上月第一天）
         */
        MelDatePicker.lastMonthFirst = function(format) {
            var date = new Date();
            date.setDate(1);
            date.setMonth(date.getMonth() - 1);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 上月末（上月最后一天）
         */
        MelDatePicker.lastMonthLast = function(format) {
            var date = new Date();
            date.setDate(0);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 上年初（去年第一天）
         */
        MelDatePicker.lastYearFirst = function(format) {
            var date = new Date();
            date.setFullYear(date.getFullYear() - 1);
            date.setMonth(0);
            date.setDate(1);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 上年末（去年最后一天）
         */
        MelDatePicker.lastYearLast = function(format) {
            var date = new Date();
            date.setFullYear(date.getFullYear() - 1);
            date.setMonth(11);
            date.setDate(31);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 当前时间的N天前或N天后
         * @param {Number} n - 天数，正数为后，负数为前
         */
        MelDatePicker.addDays = function(n, format) {
            var date = new Date();
            date.setDate(date.getDate() + n);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 当前时间的N月前或N月后
         * @param {Number} n - 月数，正数为后，负数为前
         */
        MelDatePicker.addMonths = function(n, format) {
            var date = new Date();
            date.setMonth(date.getMonth() + n);
            return format ? formatDate(date, format) : date;
        };

        /**
         * 当前时间的N年前或N年后
         * @param {Number} n - 年数，正数为后，负数为前
         */
        MelDatePicker.addYears = function(n, format) {
            var date = new Date();
            date.setFullYear(date.getFullYear() + n);
            return format ? formatDate(date, format) : date;
        };

        // ========== 其他静态方法 ==========
        
        /**
         * 格式化日期
         */
        MelDatePicker.format = function(date, format) {
            return formatDate(date, format);
        };

        /**
         * 解析日期字符串
         */
        MelDatePicker.parse = function(dateStr) {
            return parseDate(dateStr);
        };

        // 返回MelDatePicker
        return MelDatePicker;
    });

    /**
     * MelUi Drawer 抽屉组件
     * 版本：v1.0.9
     * 创建时间：2026-08-12
     * 更新时间：2026-08-27
     * 兼容：IE9/IE10/IE11/Edge（拖拽resizable、position:sticky为先进功能，IE低版本自动降级）
     * 调用规则：
     *   构造调用：MelUi.Drawer({配置参数}) 【无需new，直接返回实例】
     *   new构造：new MelUi.Drawer({配置参数}) 兼容旧写法
     *   快捷方法：MelUi.drawer() / melui.drawer()
     *   el绑定：仅 destroyOnClose:false 场景生效
     * 注释规范：
     *   单行代码注释写在分号后空一格；段落注释另起一行、前面空一行
     */

    // 立即执行函数，隔离作用域，暴露 MelUi 到全局
    (function(window) {

        // ===== 工具函数 =====

        // 对象浅合并，后者覆盖前者
        function extend() {
            var target = arguments[0] || {};
            var len = arguments.length;
            for (var i = 1; i < len; i++) {
                var obj = arguments[i];
                if (!obj) continue;
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        target[key] = obj[key];
                    }
                }
            }
            return target;
        }

        // 尺寸值统一转成带px的字符串
        function parseSize(val) {
            if (typeof val === "number") {
                return val + "px";
            }
            if (typeof val === "string") {
                return val;
            }
            return val;
        }

        // 检测老IE（IE9/10/11存在ActiveXObject），用于拖拽等先进功能降级
        function isOldIE() {
            return !!window.ActiveXObject || "ActiveXObject" in window;
        }

        // 检测IE9（无flex、无classList、无transitionend），documentMode是IE8+最可靠版本标识
        function isIE9() {
            return document.documentMode === 9;
        }

        // 生成唯一ID
        function genUid() {
            var chars = "0123456789abcdefghijklmnopqrstuvwxyz";
            var id = "mel-drawer__";
            for (var i = 0; i < 10; i++) {
                id += chars[Math.floor(Math.random() * chars.length)];
            }
            return id;
        }

        // 兼容IE9：添加class（IE9无classList，用className字符串操作降级）
        function addClass(el, cls) {
            if (!el) return;
            if (el.classList) {
                el.classList.add(cls);
                return;
            }
            var arr = (el.className || "").split(/\s+/);
            if (arr.indexOf(cls) === -1) {
                arr.push(cls);
            }
            el.className = arr.join(" ").replace(/^\s+|\s+$/g, "");
        }

        // 兼容IE9：移除class
        function removeClass(el, cls) {
            if (!el) return;
            if (el.classList) {
                el.classList.remove(cls);
                return;
            }
            var arr = (el.className || "").split(/\s+/);
            var idx = arr.indexOf(cls);
            if (idx > -1) {
                arr.splice(idx, 1);
            }
            el.className = arr.join(" ").replace(/^\s+|\s+$/g, "");
        }

        // 按className取第一个元素（IE8无getElementsByClassName时降级遍历）
        function getFirstByClassName(className) {
            var els;
            if (document.getElementsByClassName) {
                els = document.getElementsByClassName(className);
                return els.length > 0 ? els[0] : null;
            }
            var all = document.getElementsByTagName("*");
            for (var i = 0; i < all.length; i++) {
                if ((" " + all[i].className + " ").indexOf(" " + className + " ") > -1) {
                    return all[i];
                }
            }
            return null;
        }

        // 统一解析触发元素el，兼容4种传法
        // 支持：DOM节点 / 'id' / '#id' / '.class' / class字符串 / jQuery对象 / HTMLCollection(NodeList)
        function resolveEl(input) {
            if (!input) return null;

            // 已经是 DOM 元素节点，直接返回
            if (input.nodeType === 1) {
                return input;
            }

            // jQuery 对象（特征判断，不强依赖jQuery是否引入）
            if (input.jquery || (typeof window.jQuery === "function" && input instanceof window.jQuery)) {
                return input.length > 0 ? input[0] : null;
            }

            // HTMLCollection / NodeList（getElementsByClassName、querySelectorAll等返回），取第一个
            // 注意先排除字符串，字符串也有length属性
            if (typeof input !== "string" &&
                typeof input.length === "number" &&
                input.length > 0 &&
                input[0] && input[0].nodeType === 1) {
                return input[0];
            }

            // 字符串分支：支持 'id' / '#id' / '.class'
            if (typeof input === "string") {
                var str = input.trim();
                if (!str) return null;

                // '#id' 形式，按id查找
                if (str.charAt(0) === "#") {
                    return document.getElementById(str.substring(1));
                }

                // '.classname' 形式，按class查找
                if (str.charAt(0) === ".") {
                    return getFirstByClassName(str.substring(1));
                }

                // 无前缀：优先按id找，找不到再按class找
                var elById = document.getElementById(str);
                if (elById) return elById;
                return getFirstByClassName(str);
            }

            return null;
        }

        // ===== 按钮绑定注册表（仅 destroyOnClose:false 场景使用） =====
        // 注册表元素：{ el: 真实DOM, ins: 抽屉实例 }
        var _registry = [];

        // 注册表：按真实DOM查找已绑定实例
        function _findByEl(el) {
            if (!el) return null;
            for (var i = 0; i < _registry.length; i++) {
                if (_registry[i].el === el) {
                    return _registry[i].ins;
                }
            }
            return null;
        }

        // 注册表：登记按钮与实例的绑定关系，已存在则不重复登记
        function _addToRegistry(el, ins) {
            if (!el) return;
            if (_findByEl(el)) return;
            _registry.push({ el: el, ins: ins });
        }

        // 注册表：移除按钮的绑定关系
        function _removeFromRegistry(el) {
            if (!el) return;
            for (var i = _registry.length - 1; i >= 0; i--) {
                if (_registry[i].el === el) {
                    _registry.splice(i, 1);
                }
            }
        }

        // ===== 默认配置参数（注释为参数文档基线，增删参数时保留注释） =====
        var defaults = {

            // 方向与位置尺寸
            direction: "right", // 弹出方向：right / left / top / bottom (可选)
            width: "auto", // 左右弹出方向抽屉基准宽度，"auto"=css自适应；支持数字px / 字符串百分比calc (可选)
            height: "auto", // 上下弹出方向抽屉基准高度，"auto"=css自适应；支持数字px / 字符串百分比calc (可选)
            top: 0, // 抽屉距离视口上边偏移，非0则覆盖方向默认定位 (可选)
            bottom: 0, // 抽屉距离视口下边偏移，非0则覆盖方向默认定位 (可选)
            left: 0, // 抽屉距离视口左边偏移，非0则覆盖方向默认定位 (可选)
            right: 0, // 抽屉距离视口右边偏移，非0则覆盖方向默认定位 (可选)
            minWidth: 320, // 抽屉最小宽度，左右方向生效，单位px，仅数字 (可选)
            minHeight: 280, // 抽屉最小高度，上下方向生效，单位px，仅数字 (可选)
            adaptive: false, // 是否居中对话框模式，true时direction、偏移、width、height、拖拽失效；IE9下自动用minWidth/minHeight兜底尺寸 (可选)
            resizable: false, // 是否开启拖拽调整大小；IE自动降级不生效，adaptive模式自动失效 (可选)

            // 遮罩层相关
            showMask: true, // 是否显示遮罩层 (可选)
            zIndex: 9999, // 抽屉容器层级；遮罩内部自动 zIndex-1，最小为1 (可选)
            animation: true, // 是否开启打开关闭动画；IE9无transition能力自动无动画但功能正常 (可选)
            maskClose: true, // 点击遮罩是否关闭抽屉 (可选)

            // 按钮行为控制
            closeOnBackClick: true, // 点击顶部返回按钮是否自动关闭抽屉 (可选)
            closeOnCrossClick: true, // 点击右上角叉号关闭按钮是否自动关闭抽屉 (可选)
            destroyOnClose: true, // DOM策略：false关闭仅隐藏保留dom；true关闭销毁dom (可选)
            el: null, // 绑定触发按钮；支持 DOM节点/'id'/'#id'或'.class'/jQuery集合/HTMLCollection；仅destroyOnClose:false生效；首次创建、关闭仅隐藏、再点复用不重建 (可选)

            // header顶部配置
            showHeader: true, // 是否显示顶部头部区域 (可选)
            headerSticky: true, // 头部是否悬浮固定；本布局header为结构固定（非滚动容器内），sticky仅装饰，IE自动按文档流定位不影响位置 (可选)
            headerHeight: 48, // 头部高度，单位px (可选)
            showBack: false, // 是否显示头部左侧返回区域，默认关闭 (可选)
            backShowIcon: false, // 返回按钮是否显示图标，默认关闭 (可选)
            backShowText: false, // 返回按钮是否显示文字，默认关闭 (可选)
            backText: "返回", // 返回按钮文字 (可选)
            backDisabled: false, // 返回按钮是否禁用点击 (可选)
            title: "", // 抽屉标题，超长自动省略 (可选)
            titleAlign: "center", // 标题文字对齐：left / center / right (可选)
            showClose: true, // 是否显示头部右侧关闭区域 (可选)
            closeShowIcon: true, // 关闭按钮是否显示叉号图标 (可选)
            closeShowText: false, // 关闭按钮是否显示文字 (可选)
            closeText: "关闭", // 关闭按钮文字 (可选)
            closeDisabled: false, // 关闭按钮是否禁用点击 (可选)

            // footer底部配置
            showFooter: true, // 是否显示底部区域 (可选)
            footerSticky: true, // 底部是否悬浮固定；本布局footer为结构固定（非滚动容器内），sticky仅装饰，IE自动按文档流定位不影响位置 (可选)
            footerHeight: 52, // 底部高度，单位px；flex下按钮用align-items:center垂直居中，不使用padding撑高 (可选)
            showDefaultFooterBtn: true, // 是否渲染底部默认关闭按钮 (可选)
            defaultFooterBtnText: "关闭", // 默认底部按钮文字 (可选)
            onDefaultFooterBtnClick: null, // 默认按钮回调，入参(instance, rootDom, contentDom)；return false阻止关闭 (可选)
            buttons: null, // 自定义按钮数组 [{text, theme, bgColor, fontColor}]，传入后覆盖默认按钮 (可选)
            onBtnClick: null, // 自定义按钮回调，入参(ret, instance, rootDom)，ret从1开始 (可选)

            // 内容
            content: "", // 抽屉主体HTML内容 (可选)

            // 回调事件
            onOpen: null, // 抽屉打开完成(动画结束)回调，入参：rootDom；IE9无transitionend由定时器兜底触发 (可选)
            onBack: null, // 顶部返回按钮点击回调，入参：rootDom (可选)
            onClose: null, // 点击右上角叉号瞬间回调，不等动画，入参：rootDom (可选)
            afterClose: null // 抽屉关闭动作完成(动画结束、DOM处理完毕)之后回调，入参：rootDom (可选)
        };

        // Drawer 构造函数
        // 兼容两种调用：MelUi.Drawer({...}) 无需new / new MelUi.Drawer({...})
        function Drawer(opts) {

            // 兼容不写 new：直接调用构造函数时返回新实例
            if (!(this instanceof Drawer)) {

                // 仅 destroyOnClose:false 且有 el 时走注册表复用逻辑
                if (opts && opts.el && opts.destroyOnClose === false) {
                    var realEl = resolveEl(opts.el); // 统一解析成真实DOM
                    var existed = _findByEl(realEl); // 按真实DOM查注册表
                    if (existed) {
                        existed.open(); // 已存在实例：复用并打开，不新建DOM
                        return existed;
                    }
                }
                return new Drawer(opts);
            }

            this.options = extend({}, defaults, opts);
            this.uid = genUid();
            this.mask = null;
            this.wrap = null;
            this.contentEl = null;
            this.isOpen = false;
            this.bodyScrollLock = false;

            // el绑定相关状态：仅 destroyOnClose:false 时启用
            this.el = null;
            this._elClickHandler = null;
            if (opts.el && this.options.destroyOnClose === false) {
                this.el = resolveEl(opts.el);
                if (!this.el) {
                    if (window.console && window.console.warn) {
                        window.console.warn("[MelUi.Drawer] el 未找到对应元素，绑定失效");
                    }
                }
            }

            // 动画相关状态（open/close定时器兜底，兼容IE9无transitionend）
            this._transitionLock = false;
            this._transitionTimer = null;
            this._openTimer = null;

            // resizable 拖拽状态
            this._dragHandle = null;
            this._dragStartX = 0;
            this._dragStartY = 0;
            this._dragStartSize = 0;
            this._dragTransitionBackup = "";
            this._isDragging = false;
            this._onDocumentMouseMove = null;
            this._onDocumentMouseUp = null;

            this.init();
        }

        // 初始化：创建遮罩、DOM、拖拽手柄，绑定事件并展示
        Drawer.prototype.init = function() {
            this.createMask();
            this.createDom();
            this.buildResizableHandle();
            this.bindEvent();
            this.bindTrigger(); // 绑定 el 按钮点击（仅 destroyOnClose:false 生效）

            if (this.options.showMask) {
                document.body.appendChild(this.mask);
            }
            document.body.appendChild(this.wrap);

            // IE9无flex：加降级类，手动把header/content/footer绝对定位撑满
            if (isIE9()) {
                addClass(this.wrap, "mel-drawer--no-flex");
                this._ie9Layout();
            }

            var self = this;
            var opt = this.options;

            // 有动画则下一帧加打开态类，并定时器兜底触发onOpen（IE9无transitionend）
            if (opt.animation) {
                setTimeout(function() {
                    addClass(self.wrap, "mel-drawer--open");
                }, 0);
                this._openTimer = setTimeout(function() {
                    if (!self._transitionLock) {
                        self._transitionLock = true;
                        self._afterTransitionOpen();
                    }
                }, 400);
            } else {
                addClass(this.wrap, "mel-drawer--open");
                if (typeof opt.onOpen === "function") {
                    opt.onOpen(self.wrap);
                }
            }

            this.lockBodyScroll();
            this.isOpen = true;
        };

        // IE9降级布局：无flex，header钉顶、footer钉底、content绝对定位撑满中间
        Drawer.prototype._ie9Layout = function() {
            var header = this.wrap.querySelector(".mel-drawer__header");
            var footer = this.wrap.querySelector(".mel-drawer__footer");
            var top = header ? header.offsetHeight : 0;
            var bottom = footer ? footer.offsetHeight : 0;

            // header 钉顶
            if (header) {
                header.style.position = "absolute";
                header.style.top = "0";
                header.style.left = "0";
                header.style.right = "0";
            }
            // footer 钉底
            if (footer) {
                footer.style.position = "absolute";
                footer.style.bottom = "0";
                footer.style.left = "0";
                footer.style.right = "0";
            }
            // content 撑满 header 与 footer 之间
            if (this.contentEl) {
                this.contentEl.style.position = "absolute";
                this.contentEl.style.left = "0";
                this.contentEl.style.right = "0";
                this.contentEl.style.top = top + "px";
                this.contentEl.style.bottom = bottom + "px";
            }
        };

        // 创建拖拽缩放手柄（老IE或自适应模式不创建）
        Drawer.prototype.buildResizableHandle = function() {
            var opt = this.options;
            if (isOldIE() || opt.adaptive || !opt.resizable) {
                return;
            }
            var handle = document.createElement("div");
            handle.className = "mel-drawer__resizable-handle";

            var dir = opt.direction;
            if (dir === "right") {
                addClass(handle, "mel-drawer__resizable--left");
            } else if (dir === "left") {
                addClass(handle, "mel-drawer__resizable--right");
            } else if (dir === "bottom") {
                addClass(handle, "mel-drawer__resizable--top");
            } else if (dir === "top") {
                addClass(handle, "mel-drawer__resizable--bottom");
            }
            this._dragHandle = handle;
            this.wrap.appendChild(handle);
        };

        // 创建遮罩层
        Drawer.prototype.createMask = function() {
            var opt = this.options;
            var maskZIndex = Math.max(opt.zIndex - 1, 1);
            this.mask = document.createElement("div");
            this.mask.className = "mel-drawer__mask";
            this.mask.style.zIndex = maskZIndex;
            if (!opt.showMask) {
                this.mask.style.display = "none";
            }
        };

        // 创建抽屉主体DOM
        Drawer.prototype.createDom = function() {
            var opt = this.options;
            this.wrap = document.createElement("div");
            this.wrap.id = this.uid;
            this.wrap.className = "mel-drawer";
            this.wrap.style.zIndex = opt.zIndex;

            // 动画类与方向类
            if (opt.animation) {
                addClass(this.wrap, "mel-drawer--animate");
            }
            if (opt.adaptive) {
                addClass(this.wrap, "mel-drawer--adaptive");
            } else {
                addClass(this.wrap, "mel-drawer--" + opt.direction);
            }

            this.setPosition();

            var html = "";

            // 头部
            if (opt.showHeader) {
                html += '<div class="mel-drawer__header ' + (opt.headerSticky ? "mel-drawer__header--sticky" : "") + '" style="height:' + opt.headerHeight + 'px">';

                // 返回按钮
                if (opt.showBack) {
                    html += '<div class="mel-drawer__back ' + (opt.backDisabled ? "is-disabled" : "") + '">';
                    if (opt.backShowIcon) {
                        html += '<span class="mel-drawer__back-icon">&lt;</span>';
                    }
                    if (opt.backShowText) {
                        html += '<span class="mel-drawer__back-text">' + opt.backText + "</span>";
                    }
                    html += "</div>";
                }

                // 标题
                html += '<div class="mel-drawer__title" style="text-align:' + opt.titleAlign + '">' + opt.title + "</div>";

                // 关闭按钮
                if (opt.showClose) {
                    html += '<div class="mel-drawer__close ' + (opt.closeDisabled ? "is-disabled" : "") + '">';
                    if (opt.closeShowIcon) {
                        html += '<span class="mel-drawer__close-icon">×</span>';
                    }
                    if (opt.closeShowText) {
                        html += '<span class="mel-drawer__close-text">' + opt.closeText + "</span>";
                    }
                    html += "</div>";
                }
                html += "</div>";
            }

            // 内容区
            html += '<div class="mel-drawer__content">' + opt.content + "</div>";

            // 底部按钮区（有按钮配置或显示默认按钮时渲染）
            var needRenderFooter = false;
            if (opt.showFooter) {
                if ((opt.buttons && Array.isArray(opt.buttons) && opt.buttons.length > 0) || opt.showDefaultFooterBtn) {
                    needRenderFooter = true;
                }
            }
            if (needRenderFooter) {
                html += this.buildFooterHtml();
            }

            this.wrap.innerHTML = html;
            this.contentEl = this.wrap.querySelector(".mel-drawer__content");
        };

        // 设置抽屉定位与尺寸
        Drawer.prototype.setPosition = function() {
            var opt = this.options;
            var wrap = this.wrap;

            // 自适应居中模式：清空方向定位（居中由CSS transform控制）
            // IE9无shrink-to-fit能力，fixed+auto尺寸会塌陷为0导致不显示，需显式默认宽高+最小尺寸兜底
            if (opt.adaptive) {
                wrap.style.top = "";
                wrap.style.bottom = "";
                wrap.style.left = "";
                wrap.style.right = "";
                wrap.style.width = "";
                wrap.style.height = "";
                wrap.style.minWidth = "";
                wrap.style.minHeight = "";

                // 仅IE9兜底：设置最小尺寸+默认宽高，保证控件可见；现代浏览器/IE10/11保持shrink-to-fit原行为
                if (isIE9()) {
                    wrap.style.minWidth = opt.minWidth + "px";
                    wrap.style.minHeight = opt.minHeight + "px";
                    if (!opt.width || opt.width === "auto") {
                        wrap.style.width = opt.minWidth + "px";
                    } else {
                        wrap.style.width = parseSize(opt.width);
                    }
                    if (!opt.height || opt.height === "auto") {
                        wrap.style.height = opt.minHeight + "px";
                    } else {
                        wrap.style.height = parseSize(opt.height);
                    }
                }
                return;
            }

            var dir = opt.direction;

            // 非0的偏移量才写入
            if (opt.top !== 0) wrap.style.top = parseSize(opt.top);
            if (opt.bottom !== 0) wrap.style.bottom = parseSize(opt.bottom);
            if (opt.left !== 0) wrap.style.left = parseSize(opt.left);
            if (opt.right !== 0) wrap.style.right = parseSize(opt.right);

            wrap.style.minWidth = opt.minWidth + "px";
            wrap.style.minHeight = opt.minHeight + "px";

            // 左右方向抽屉：撑满高度，宽度取配置
            if (dir === "right" || dir === "left") {
                if (opt.top === 0) wrap.style.top = "0px";
                if (opt.bottom === 0) wrap.style.bottom = "0px";
                if (dir === "right" && opt.right === 0) wrap.style.right = "0px";
                if (dir === "left" && opt.left === 0) wrap.style.left = "0px";

                if (opt.width !== "auto") {
                    wrap.style.width = parseSize(opt.width);
                } else {
                    wrap.style.width = "";
                }

            // 上下方向抽屉：撑满宽度，高度取配置
            } else if (dir === "bottom" || dir === "top") {
                if (opt.left === 0) wrap.style.left = "0px";
                if (opt.right === 0) wrap.style.right = "0px";
                if (dir === "bottom" && opt.bottom === 0) wrap.style.bottom = "0px";
                if (dir === "top" && opt.top === 0) wrap.style.top = "0px";

                if (opt.height !== "auto") {
                    wrap.style.height = parseSize(opt.height);
                } else {
                    wrap.style.height = "";
                }
            }
        };

        // 生成底部按钮区HTML
        Drawer.prototype.buildFooterHtml = function() {
            var opt = this.options;
            var html = '<div class="mel-drawer__footer ' + (opt.footerSticky ? "mel-drawer__footer--sticky" : "") + '" style="height:' + opt.footerHeight + 'px">';

            // 有自定义按钮则渲染自定义按钮，否则渲染默认按钮
            if (opt.buttons && Array.isArray(opt.buttons) && opt.buttons.length > 0) {
                for (var i = 0; i < opt.buttons.length; i++) {
                    var item = opt.buttons[i];
                    var theme = item.theme || "default";
                    html += '<button class="mel-drawer__btn mel-drawer__btn--' + theme + '" data-index="' + (i + 1) + '" ';

                    // 自定义颜色内联样式
                    if (item.bgColor || item.fontColor) {
                        var inlineStyle = "";
                        if (item.bgColor) inlineStyle += "background-color:" + item.bgColor + ";";
                        if (item.fontColor) inlineStyle += "color:" + item.fontColor + ";";
                        html += 'style="' + inlineStyle + '"';
                    }
                    html += ">" + (item.text || "") + "</button>";
                }
            } else {
                html += '<button class="mel-drawer__btn mel-drawer__btn--default" data-is-default="1">' + opt.defaultFooterBtnText + "</button>";
            }
            html += "</div>";
            return html;
        };

        // 绑定 el 按钮点击事件（仅 destroyOnClose:false 场景有 this.el）
        // 逻辑：隐藏时open复用，打开时忽略，避免重复创建
        Drawer.prototype.bindTrigger = function() {
            var self = this;
            if (!this.el) return;
            if (this._elClickHandler) return; // 防止重复绑定

            this._elClickHandler = function() {
                if (self.isOpen) return; // 已打开则忽略
                self.open(); // 隐藏状态重新显示
            };

            if (this.el.addEventListener) {
                this.el.addEventListener("click", this._elClickHandler, false);
            } else if (this.el.attachEvent) {
                this.el.attachEvent("onclick", this._elClickHandler);
            }
            _addToRegistry(this.el, this); // 登记注册表
        };

        // 关闭动画结束后的收尾
        Drawer.prototype._afterTransitionClose = function() {
            var self = this;
            var opt = this.options;
            this._transitionLock = false;
            if (this._transitionTimer) {
                clearTimeout(this._transitionTimer);
                this._transitionTimer = null;
            }

            // destroyOnClose:true 销毁，false 仅隐藏
            if (opt.destroyOnClose) {
                self.destroy();
            } else {
                if (self.mask) self.mask.style.display = "none";
                self.wrap.style.display = "none";
            }
            if (typeof opt.afterClose === "function") {
                opt.afterClose(self.wrap);
            }
        };

        // 打开动画结束后的回调触发
        Drawer.prototype._afterTransitionOpen = function() {
            var self = this;
            var opt = this.options;
            this._transitionLock = false;
            if (this._openTimer) {
                clearTimeout(this._openTimer);
                this._openTimer = null;
            }
            if (typeof opt.onOpen === "function") {
                opt.onOpen(self.wrap);
            }
        };

        // 绑定遮罩、头部、底部等内部事件
        Drawer.prototype.bindEvent = function() {
            var self = this;
            var opt = this.options;

            // 遮罩点击关闭
            if (this.mask && opt.maskClose) {
                this.mask.onclick = function() {
                    self.close();
                };
            }

            // 头部返回按钮
            var backDom = this.wrap.querySelector(".mel-drawer__back");
            if (backDom) {
                backDom.onclick = function() {
                    if (opt.backDisabled) return;
                    if (typeof opt.onBack === "function") {
                        opt.onBack(self.wrap);
                    }
                    if (opt.closeOnBackClick) {
                        self.close();
                    }
                };
            }

            // 头部关闭按钮
            var closeDom = this.wrap.querySelector(".mel-drawer__close");
            if (closeDom) {
                closeDom.onclick = function() {
                    if (opt.closeDisabled) return;
                    if (typeof opt.onClose === "function") {
                        opt.onClose(self.wrap);
                    }
                    if (opt.closeOnCrossClick) {
                        self.close();
                    }
                };
            }

            // 底部按钮区（事件委托）
            var footerDom = this.wrap.querySelector(".mel-drawer__footer");
            if (footerDom) {
                footerDom.onclick = function(e) {
                    var target = e.target || e.srcElement;
                    if (target.tagName !== "BUTTON") return;

                    // 默认按钮：可被 onDefaultFooterBtnClick 返回false阻止关闭
                    var isDefault = target.getAttribute("data-is-default") === "1";
                    if (isDefault) {
                        if (typeof opt.onDefaultFooterBtnClick === "function") {
                            var ret = opt.onDefaultFooterBtnClick(self, self.wrap, self.contentEl);
                            if (ret !== false) {
                                self.close();
                            }
                        } else {
                            self.close();
                        }

                    // 自定义按钮：走 onBtnClick 回调
                    } else {
                        var idx = Number(target.getAttribute("data-index"));
                        if (typeof opt.onBtnClick === "function") {
                            opt.onBtnClick(idx, self, self.wrap);
                        }
                    }
                };
            }

            // 拖拽手柄按下
            if (this._dragHandle) {
                this._dragHandle.onmousedown = function(e) {
                    e.preventDefault();
                    self._startDrag(e);
                };
            }

            // 过渡动画结束监听（打开/关闭完成各触发一次；IE9无此事件由定时器兜底）
            if (opt.animation) {
                this.wrap.addEventListener("transitionend", function(evt) {
                    if (self._transitionLock) return;
                    if (self.isOpen && (evt.propertyName === "transform" || evt.propertyName === "opacity")) {
                        self._transitionLock = true;
                        self._afterTransitionOpen();
                    }
                    if (!self.isOpen && (evt.propertyName === "transform" || evt.propertyName === "opacity")) {
                        self._transitionLock = true;
                        self._afterTransitionClose();
                    }
                });
            }
        };

        // 开始拖拽缩放
        Drawer.prototype._startDrag = function(e) {
            var opt = this.options;
            this._isDragging = true;
            this._dragStartX = e.clientX;
            this._dragStartY = e.clientY;

            var dir = opt.direction;
            var rect = this.wrap.getBoundingClientRect();
            if (dir === "right" || dir === "left") {
                this._dragStartSize = rect.width;
            } else {
                this._dragStartSize = rect.height;
            }

            // 拖拽过程中临时关闭过渡动画，保证跟手
            this._dragTransitionBackup = this.wrap.style.transition;
            this.wrap.style.transition = "none";

            var self = this;
            this._onDocumentMouseMove = function(ev) {
                self._onDragMove(ev);
            };
            this._onDocumentMouseUp = function() {
                self._stopDrag();
            };
            document.addEventListener("mousemove", this._onDocumentMouseMove);
            document.addEventListener("mouseup", this._onDocumentMouseUp);
        };

        // 拖拽中计算尺寸
        Drawer.prototype._onDragMove = function(e) {
            if (!this._isDragging) return;
            var opt = this.options;
            var dir = opt.direction;
            var delta;
            var newSize;

            // 右侧抽屉：左边缘拖拽
            if (dir === "right") {
                delta = this._dragStartX - e.clientX;
                newSize = this._dragStartSize + delta;
                newSize = Math.max(newSize, opt.minWidth);
                newSize = Math.min(newSize, window.innerWidth);
                this.wrap.style.width = newSize + "px";

            // 左侧抽屉：右边缘拖拽
            } else if (dir === "left") {
                delta = e.clientX - this._dragStartX;
                newSize = this._dragStartSize + delta;
                newSize = Math.max(newSize, opt.minWidth);
                newSize = Math.min(newSize, window.innerWidth);
                this.wrap.style.width = newSize + "px";

            // 底部抽屉：上边缘拖拽
            } else if (dir === "bottom") {
                delta = this._dragStartY - e.clientY;
                newSize = this._dragStartSize + delta;
                newSize = Math.max(newSize, opt.minHeight);
                newSize = Math.min(newSize, window.innerHeight);
                this.wrap.style.height = newSize + "px";

            // 顶部抽屉：下边缘拖拽
            } else if (dir === "top") {
                delta = e.clientY - this._dragStartY;
                newSize = this._dragStartSize + delta;
                newSize = Math.max(newSize, opt.minHeight);
                newSize = Math.min(newSize, window.innerHeight);
                this.wrap.style.height = newSize + "px";
            }
        };

        // 结束拖拽，恢复过渡，解绑document事件
        Drawer.prototype._stopDrag = function() {
            if (!this._isDragging) return;
            this._isDragging = false;
            this.wrap.style.transition = this._dragTransitionBackup;

            if (this._onDocumentMouseMove) {
                document.removeEventListener("mousemove", this._onDocumentMouseMove);
                this._onDocumentMouseMove = null;
            }
            if (this._onDocumentMouseUp) {
                document.removeEventListener("mouseup", this._onDocumentMouseUp);
                this._onDocumentMouseUp = null;
            }
        };

        // 锁定页面滚动（防止遮罩下层滚动穿透）
        Drawer.prototype.lockBodyScroll = function() {
            this.bodyScrollLock = true;
            document.body.style.overflow = "hidden";
        };

        // 解锁页面滚动
        Drawer.prototype.unlockBodyScroll = function() {
            if (this.bodyScrollLock) {
                document.body.style.overflow = "";
                this.bodyScrollLock = false;
            }
        };

        // 打开抽屉
        Drawer.prototype.open = function() {
            var self = this;
            var opt = this.options;
            if (this.isOpen) return;

            // 实例已被销毁时重新初始化
            if (!this.wrap) {
                this.init();
                return;
            }
            if (this.mask) this.mask.style.display = "block";
            this.wrap.style.display = "";

            // 有动画则下一帧加打开态类，并定时器兜底触发onOpen（IE9无transitionend）
            if (opt.animation) {
                setTimeout(function() {
                    addClass(self.wrap, "mel-drawer--open");
                }, 0);
                this._openTimer = setTimeout(function() {
                    if (!self._transitionLock) {
                        self._transitionLock = true;
                        self._afterTransitionOpen();
                    }
                }, 400);
            } else {
                addClass(this.wrap, "mel-drawer--open");
                if (typeof opt.onOpen === "function") {
                    opt.onOpen(self.wrap);
                }
            }

            this.lockBodyScroll();
            this.isOpen = true;
        };

        // 关闭抽屉
        Drawer.prototype.close = function() {
            var self = this;
            var opt = this.options;
            if (!this.isOpen) return;
            this.isOpen = false;
            this.unlockBodyScroll();
            this._stopDrag();

            // 有动画：等过渡结束再销毁或隐藏
            if (opt.animation) {
                removeClass(this.wrap, "mel-drawer--open");
                this._transitionTimer = setTimeout(function() {
                    if (!self._transitionLock) {
                        self._transitionLock = true;
                        self._afterTransitionClose();
                    }
                }, 400);

            // 无动画：直接销毁或隐藏
            } else {
                if (opt.destroyOnClose) {
                    self.destroy();
                } else {
                    if (self.mask) self.mask.style.display = "none";
                    self.wrap.style.display = "none";
                }
                if (typeof opt.afterClose === "function") {
                    opt.afterClose(self.wrap);
                }
            }
        };

        // 销毁抽屉：解绑按钮、清注册表、移除DOM
        Drawer.prototype.destroy = function() {

            // 解绑 el 按钮点击事件
            if (this.el && this._elClickHandler) {
                if (this.el.removeEventListener) {
                    this.el.removeEventListener("click", this._elClickHandler, false);
                } else if (this.el.detachEvent) {
                    this.el.detachEvent("onclick", this._elClickHandler);
                }
                this._elClickHandler = null;
            }
            // 移除注册表绑定关系
            _removeFromRegistry(this.el);

            this._stopDrag();
            if (this._transitionTimer) {
                clearTimeout(this._transitionTimer);
                this._transitionTimer = null;
            }
            if (this._openTimer) {
                clearTimeout(this._openTimer);
                this._openTimer = null;
            }
            if (this.mask && this.mask.parentNode) {
                this.mask.parentNode.removeChild(this.mask);
            }
            if (this.wrap && this.wrap.parentNode) {
                this.wrap.parentNode.removeChild(this.wrap);
            }
            this._dragHandle = null;
            this.mask = null;
            this.wrap = null;
            this.contentEl = null;
        };

        // 静态工厂方法：MelUi.drawer({...}) 返回新实例
        Drawer.drawer = function(options) {
            return new Drawer(options);
        };

        // 暴露到全局
        window.MelUi = window.MelUi || {};
        window.MelUi.Drawer = Drawer;
        window.MelUi.drawer = Drawer.drawer;
        window.melui = window.MelUi;

    })(window);

    // 基础UI样式优先导入，保证css输出顺序正确

    var index = window.MelUi;

    return index;

}));

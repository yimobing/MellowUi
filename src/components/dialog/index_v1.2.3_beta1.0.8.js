/**
 * MelUi 弹窗对话框组件
 * 版本：v1.2.3 beta 1.0.8
 * 创建日期：2026-08-10
 * 更新日期：2026-09-11
 * 兼容：IE9/10/11
 * 调用方式：
    构造创建：new MelUi.Dialog({配置参数})
    快捷调用：MelUi.alert() / MelUi.confirm() / MelUi.prompt()
 */
    (function (window) {
        "use strict";
    
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
    
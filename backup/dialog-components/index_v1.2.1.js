/**
 * MelUi Dialog v1.2.1
 * 兼容 IE9‑11
 * 模态弹窗：MelUi.alert / confirm / prompt / dialog
 * Tip消息提示：MelUi.Tip
 * Toast轻提示：MelUi.Toast
 * 小写别名 melui.xxx
 */
 (function(window) {
    "use strict";

    //==================== 模态弹窗默认参数 ====================
    var defaults = {
        title: "", // 弹窗标题。空字符串不渲染标题栏。(可选)
        theme: "info", // 按钮主题。值：info/success/warning/danger/default。(可选)
        showClose: true, // 是否显示右上角关闭叉号。值：true是,false否。(可选)
        mask: true, // 是否显示遮罩层。值：true是,false否。(可选)
        maskClosable: true, // 点击遮罩是否关闭弹窗。值：true是,false否。(可选)

        btnDirection: "horizontal", // 按钮排布方向。值：horizontal横向,vert竖向。(可选)
        btnFullWidth: false, // 按钮是否通栏铺满整行。值：true是,false否。(可选)
        btnDisabled: false, // 是否一键禁用全部底部按钮。值：true是,false否。(可选)
        buttons: null, // 自定义按钮数组，优先级最高。(可选)

        message: "", // 普通文本内容。dangerouslyUseHTMLString=true时该字段无效。(可选)
        content: "", // HTML内容。仅dangerouslyUseHTMLString=true生效。(可选)
        dangerouslyUseHTMLString: false, // 是否开启HTML解析。值：true是,false否。开启后使用content字段。(可选)

        center: false, // 是否整体居中布局。值：true是,false否。true时header、body、footer全部内容水平居中。(可选)
        textCenter: false, // 是否仅正文文本居中。值：true是,false否。优先级高于center。(可选)
        fullScreen: false, // 是否全屏弹窗。值：true是,false否。(可选)
        adaptive: true, // 是否自适应内容高度。值：true是,false否。(可选)
        width: "auto", // 弹窗宽度。auto使用组件默认，支持px、百分比。(可选)
        height: "auto", // 弹窗高度。auto使用组件默认，支持px、百分比。(可选)

        device: "", // 一键移动端模式。值："phone"开启，空不开启；不自动UA检测。(可选)

        prompt: { // prompt输入框专属配置；仅调用prompt()时生效(可选)
            inputType: "input", // 输入框类型。值：input单行,textarea多行。(可选)
            placeholder: "", // 输入框占位提示文字。(可选)
            defaultValue: "", // 输入框默认值。(可选)
            unit: "" // 输入框右侧单位文字，例：元、㎡。(可选)
        },

        onClick: null, // 按钮点击回调。ret为按钮序号从1开始；prompt会附带输入框value。(可选)
        onOpen: null, // 弹窗打开完成回调。DOM已挂载完成，入参为当前实例。(可选)
        onClose: null // 弹窗关闭回调。所有关闭方式均触发；return false可阻止关闭，入参为当前实例。(可选)
    };

    //==================== Tip 默认参数(独立非模态) ====================
    var tipDefaults = {
        type: "info", // 提示类型。值：success/warning(warn别名)/error/info。(可选)
        message: "", // 提示文本内容。(可选)
        duration: 3000, // 自动关闭延时(毫秒)。0=常驻不自动关闭。(可选)
        position: "top", // 弹出位置。值：top顶部,bottom底部。(可选)
        mask: false, // 是否开启遮罩。值：true是,false否。(可选)
        dangerouslyUseHTMLString: false, // 是否开启HTML解析。值：true是,false否。(可选)
        onClose: null // 关闭回调。Tip不支持拦截关闭。(可选)
    };

    //==================== Toast 默认参数(独立非模态) ====================
    var toastDefaults = {
        type: "info", // 提示类型。值：success/warning(warn别名)/error/info。(可选)
        message: "", // 提示文本内容。(可选)
        duration: 2000, // 自动关闭延时(毫秒)。0=常驻不自动关闭。(可选)
        position: "center", // 弹出位置。值：center居中,top顶部,bottom底部。(可选)
        mask: false, // 是否开启遮罩。值：true是,false否。(可选)
        dangerouslyUseHTMLString: false, // 是否开启HTML解析。值：true是,false否。(可选)
        onClose: null // 关闭回调。Toast不支持拦截关闭。(可选)
    };

    // Tip实例队列，按position分组，用于堆叠位移
    var tipQueue = {
        top: [],
        bottom: []
    };

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
                if (obj.hasOwnProperty(key)) {
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
     * 模态弹窗构造函数
     * @param {Object} opts
     */
    function Dialog(opts) {
        this.options = extend({}, defaults, opts);
        this.mask = null;
        this.wrap = null;
        this.box = null;
        this.inputEl = null;
        this.init();
    }

    Dialog.prototype.init = function() {
        var opt = this.options;
        // device phone模式：用户显式传入showClose优先
        if (opt.device === "phone") {
            if (!("showClose" in opt)) {
                opt.showClose = false;
            }
        }
        this.createMask();
        this.createDom();
        this.bindEvent();
        document.body.appendChild(this.mask);
        document.body.appendChild(this.wrap);
        if (typeof opt.onOpen === "function") {
            opt.onOpen(this);
        }
    };

    Dialog.prototype.createMask = function() {
        var opt = this.options;
        this.mask = document.createElement("div");
        this.mask.className = "mel-dialog-mask";
        if (!opt.mask) {
            this.mask.style.display = "none";
        }
    };

    Dialog.prototype.createDom = function() {
        var opt = this.options;
        this.wrap = document.createElement("div");
        this.wrap.className = "mel-dialog-wrap";
        if (opt.device === "phone") {
            this.wrap.classList.add("is-phone");
        }
        if (opt.center) {
            this.wrap.classList.add("layout-center");
        }
        if (opt.textCenter) {
            this.wrap.classList.add("text-center");
        }
        if (opt.fullScreen) {
            this.wrap.classList.add("is-fullscreen");
        }
        if (opt.width !== "auto") {
            this.wrap.style.width = opt.width;
        }
        if (opt.height !== "auto") {
            this.wrap.style.height = opt.height;
            if (!opt.adaptive) {
                this.wrap.style.overflow = "auto";
            }
        }
        this.box = document.createElement("div");
        var html = "";
        // header
        if (opt.title) {
            html += '<div class="mel-dialog-header">';
            html += '<div class="mel-dialog-title">' + escapeHtml(opt.title) + '</div>';
            if (opt.showClose) {
                html += '<div class="mel-dialog-close">×</div>';
            }
            html += '</div>';
        }
        // body
        html += '<div class="mel-dialog-body">';
        if (opt.dangerouslyUseHTMLString) {
            html += opt.content;
        } else {
            html += escapeHtml(opt.message);
        }
        if (opt._isPrompt === true) {
            var p = opt.prompt;
            html += '<div class="mel-dialog-input-wrap">';
            if (p.inputType === "textarea") {
                html += '<textarea class="mel-dialog-textarea" placeholder="' + escapeHtml(p.placeholder) + '">' + escapeHtml(p.defaultValue) + '</textarea>';
            } else {
                html += '<input class="mel-dialog-input" placeholder="' + escapeHtml(p.placeholder) + '" value="' + escapeHtml(p.defaultValue) + '">';
            }
            if (p.unit) {
                html += '<span class="mel-dialog-input-unit">' + escapeHtml(p.unit) + '</span>';
            }
            html += '</div>';
        }
        html += '</div>';
        html += this.buildFooterHtml();
        this.box.innerHTML = html;
        this.wrap.appendChild(this.box);
        if (opt._isPrompt) {
            if (opt.prompt.inputType === "textarea") {
                this.inputEl = this.box.querySelector(".mel-dialog-textarea");
            } else {
                this.inputEl = this.box.querySelector(".mel-dialog-input");
            }
        }
    };

    Dialog.prototype.buildFooterHtml = function() {
        var opt = this.options;
        var btnArr = opt.buttons || [];
        var footerClass = "mel-dialog-footer";
        if (opt.btnDirection === "vert") {
            footerClass += " mel-dialog-footer-vert";
        }
        if (opt.btnFullWidth) {
            footerClass += " mel-dialog-footer-full";
        }
        var btnHtml = '<div class="' + footerClass + '">';
        for (var i = 0; i < btnArr.length; i++) {
            var item = btnArr[i];
            var disAttr = opt.btnDisabled ? "disabled" : "";
            btnHtml += '<button class="mel-dialog-btn mel-btn-' + item.type + '" data-index="' + (i + 1) + '" ' + disAttr + '>';
            btnHtml += escapeHtml(item.text);
            btnHtml += '</button>';
        }
        btnHtml += '</div>';
        return btnHtml;
    };

    Dialog.prototype.bindEvent = function() {
        var self = this;
        var opt = this.options;
        var closeBtn = this.box.querySelector(".mel-dialog-close");
        if (closeBtn) {
            closeBtn.onclick = function() {
                self.close();
            };
        }
        this.mask.onclick = function() {
            if (opt.maskClosable) {
                self.close();
            }
        };
        this.wrap.onclick = function(e) {
            e.stopPropagation();
        };
        var btns = this.box.querySelectorAll(".mel-dialog-btn");
        for (var i = 0; i < btns.length; i++) {
            btns[i].onclick = function() {
                var idx = parseInt(this.getAttribute("data-index"), 10);
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
        }
    };

    Dialog.prototype.close = function() {
        var self = this;
        var opt = this.options;
        if (typeof opt.onClose === "function") {
            var ret = opt.onClose(self);
            if (ret === false) {
                return;
            }
        }
        if (this.mask && this.mask.parentNode) {
            document.body.removeChild(this.mask);
        }
        if (this.wrap && this.wrap.parentNode) {
            document.body.removeChild(this.wrap);
        }
    };

    //===== 模态弹窗快捷静态方法 fix: alert允许外部自定义buttons，存在就不覆盖 =====
    Dialog.alert = function(options) {
        var opts = extend({}, options);
        if(!opts.buttons){
            opts.buttons = [
                { text: "确定", type: opts.theme || "info" }
            ];
        }
        opts._isPrompt = false;
        return new Dialog(opts);
    };
    Dialog.confirm = function(options) {
        var opts = extend({}, options);
        if(!opts.buttons){
            opts.buttons = [
                { text: "取消", type: "default" },
                { text: "确定", type: opts.theme || "info" }
            ];
        }
        opts._isPrompt = false;
        return new Dialog(opts);
    };
    Dialog.prompt = function(options) {
        var opts = extend({}, options);
        if(!opts.buttons){
            opts.buttons = [
                { text: "取消", type: "default" },
                { text: "确定", type: opts.theme || "info" }
            ];
        }
        opts._isPrompt = true;
        return new Dialog(opts);
    };
    Dialog.dialog = function(options) {
        var opts = extend({}, options);
        if (!opts.buttons) {
            opts.buttons = [
                { text: "确定", type: opts.theme || "info" }
            ];
        }
        opts._isPrompt = false;
        return new Dialog(opts);
    };

    //===== Tip 消息提示独立实现 fix：补充mask遮罩DOM；增加warn别名兼容 =====
    function renderTipIcon(type) {
        var t = type === "warn" ? "warning" : type;
        var map = {
            info: "ⓘ",
            success: "√",
            warning: "⚠",
            error: "ⓧ"
        };
        return map[t] || "";
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
        if (idx > -1) {
            list.splice(idx, 1);
        }
        if(ins.maskDom && ins.maskDom.parentNode){
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

    function Tip(opts) {
        var cfg;
        if (typeof opts === "string") {
            cfg = extend({}, tipDefaults, { message: opts });
        } else {
            cfg = extend({}, tipDefaults, opts || {});
        }
        // 别名转换 warn=>warning
        if(cfg.type === "warn") cfg.type = "warning";
        var posKey = cfg.position === "bottom" ? "bottom" : "top";

        // fix Tip mask遮罩DOM
        var maskDom = null;
        if(cfg.mask){
            maskDom = document.createElement("div");
            maskDom.className = "mel-tip-mask";
            document.body.appendChild(maskDom);
        }

        var wrap = document.createElement("div");
        wrap.className = "mel-tip-wrap mel-pos-" + cfg.position;
        var inner = document.createElement("div");
        inner.className = "mel-tip-inner " + cfg.type;
        var iconHtml = '<span class="mel-tip-icon">' + renderTipIcon(cfg.type) + '</span>';
        var contentHtml;
        if (cfg.dangerouslyUseHTMLString) {
            contentHtml = cfg.message || "";
        } else {
            contentHtml = escapeHtml(cfg.message || "");
        }
        var closeHtml = '<span class="mel-tip-close">×</span>';
        inner.innerHTML = iconHtml + contentHtml + closeHtml;
        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var timerId = null;
        var paused = false;
        var ins = {
            _cfg: cfg,
            maskDom: maskDom,
            dom: wrap,
            close: function() {
                if (timerId) clearTimeout(timerId);
                removeTipInstance(ins, posKey);
            }
        };
        tipQueue[posKey].push(ins);
        reCalcTipOffset(posKey);

        // hover暂停计时
        if (cfg.duration > 0) {
            function startTimer() {
                if (timerId) clearTimeout(timerId);
                timerId = setTimeout(function() {
                    ins.close();
                }, cfg.duration);
            }
            startTimer();
            wrap.onmouseenter = function() {
                paused = true;
                if (timerId) clearTimeout(timerId);
            };
            wrap.onmouseleave = function() {
                if (paused) startTimer();
            };
        }
        // 手动关闭按钮
        var closeBtn = inner.querySelector(".mel-tip-close");
        if (closeBtn) {
            closeBtn.onclick = function() {
                ins.close();
            };
        }
        return ins;
    }
    Tip.success = function(msg, opts) { return Tip(extend({ message: msg, type: "success" }, opts)); };
    Tip.warning = function(msg, opts) { return Tip(extend({ message: msg, type: "warning" }, opts)); };
    Tip.warn = function(msg, opts) { return Tip(extend({ message: msg, type: "warn" }, opts)); };
    Tip.error = function(msg, opts) { return Tip(extend({ message: msg, type: "error" }, opts)); };
    Tip.info = function(msg, opts) { return Tip(extend({ message: msg, type: "info" }, opts)); };

    //===== Toast轻提示独立实现 =====
    function renderToastIcon(type) {
        var t = type === "warn" ? "warning" : type;
        var map = {
            info: "ℹ",
            success: "√",
            warning: "⚠",
            error: "×"
        };
        return map[t] || "";
    }
    function Toast(opts) {
        var cfg;
        if (typeof opts === "string") {
            cfg = extend({}, toastDefaults, { message: opts });
        } else {
            cfg = extend({}, toastDefaults, opts || {});
        }
        if(cfg.type === "warn") cfg.type = "warning";

        var maskDom = null;
        if(cfg.mask){
            maskDom = document.createElement("div");
            maskDom.className = "mel-tip-mask";
            document.body.appendChild(maskDom);
        }

        var wrap = document.createElement("div");
        wrap.className = "mel-toast-wrap mel-pos-" + cfg.position;
        var inner = document.createElement("div");
        inner.className = "mel-toast-inner " + cfg.type;
        var iconHtml = '<span class="mel-toast-icon">' + renderToastIcon(cfg.type) + '</span>';
        var contentHtml;
        if (cfg.dangerouslyUseHTMLString) {
            contentHtml = cfg.message || "";
        } else {
            contentHtml = escapeHtml(cfg.message || "");
        }
        inner.innerHTML = iconHtml + contentHtml;
        wrap.appendChild(inner);
        document.body.appendChild(wrap);

        var timerId = null;
        var ins = {
            _cfg: cfg,
            maskDom: maskDom,
            dom: wrap,
            close: function() {
                if (timerId) clearTimeout(timerId);
                if(maskDom && maskDom.parentNode) document.body.removeChild(maskDom);
                if (wrap.parentNode) document.body.removeChild(wrap);
                if (typeof cfg.onClose === "function") {
                    cfg.onClose();
                }
            }
        };
        if (cfg.duration > 0) {
            timerId = setTimeout(function() {
                ins.close();
            }, cfg.duration);
        }
        return ins;
    }
    Toast.success = function(msg, opts) { return Toast(extend({ message: msg, type: "success" }, opts)); };
    Toast.warning = function(msg, opts) { return Toast(extend({ message: msg, type: "warning" }, opts)); };
    Toast.warn = function(msg, opts) { return Toast(extend({ message: msg, type: "warn" }, opts)); };
    Toast.error = function(msg, opts) { return Toast(extend({ message: msg, type: "error" }, opts)); };
    Toast.info = function(msg, opts) { return Toast(extend({ message: msg, type: "info" }, opts)); };

    //===== 全局挂载 =====
    window.MelUi = window.MelUi || {};
    window.MelUi.alert = Dialog.alert;
    window.MelUi.confirm = Dialog.confirm;
    window.MelUi.prompt = Dialog.prompt;
    window.MelUi.dialog = Dialog.dialog;
    window.MelUi.Tip = Tip;
    window.MelUi.Toast = Toast;
    window.melui = window.MelUi;

})(window);

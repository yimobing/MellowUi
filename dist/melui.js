(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.MelUi = factory());
})(this, (function () { 'use strict';

    /**
     * MelUi Dialog 弹窗对话框组件
     * 版本：v1.0.6
     * 创建时间：2026-08-10
     * 更新时间：2026-08-10
     * 兼容：IE9/10/11
     * 调用规则：
        构造实例：new MelUi.Dialog({配置参数})
        快捷方法：MelUi.alert() / MelUi.confirm() / MelUi.prompt() / MelUi.dialog()
        小写兼容：melui.alert()、melui.confirm() 全小写均可调用
     * 交互边界硬性规定：
        alert：纯文字提示，无输入框
        confirm：确认选择弹窗，无输入框
        prompt：专属输入弹窗，唯一渲染输入框
        dialog：极简弹窗，默认单个确定按钮，无输入框
     */
        (function(window) {
        
            // 默认配置参数，逗号后固定1个半角空格 + //注释
            var defaults = {
                title: "", // 弹窗标题，空字符串不渲染标题栏
                content: "", // 弹窗正文内容
                theme: "info", // 按钮主题：info / success / warning / danger / default
                showClose: false, // 是否展示右上角关闭叉号
                btnDirection: "horizontal", // 按钮排布：horizontal横向、vert竖向
                btnFullWidth: false, // 按钮是否通栏铺满整行
                buttons: null, // 自定义按钮数组，优先级最高
                onClick: null, // 按钮点击回调，ret从1开始计数
                defaultValue: "" // prompt输入框默认内容，仅prompt生效
            };
        
            /**
             * 对象浅拷贝合并工具函数
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
             * Dialog 弹窗构造函数
             * @param {Object} opts 用户自定义配置
             */
            function Dialog(opts) {
                this.options = extend({}, defaults, opts);
                this.mask = null;
                this.wrap = null;
                this.box = null;
                this.inputEl = null;
                this.init();
            }
        
            /**
             * 初始化：创建DOM、渲染结构、绑定事件
             */
            Dialog.prototype.init = function() {
                this.createMask();
                this.createDom();
                this.bindEvent();
                document.body.appendChild(this.mask);
                document.body.appendChild(this.wrap);
            };
        
            /**
             * 创建遮罩层
             */
            Dialog.prototype.createMask = function() {
                this.mask = document.createElement("div");
                this.mask.className = "melui-dialog-mask";
            };
        
            /**
             * 构建弹窗整体DOM结构，严格贴合CSS层级
             */
            Dialog.prototype.createDom = function() {
                var opt = this.options;
                this.wrap = document.createElement("div");
                this.wrap.className = "melui-dialog-wrap";
        
                this.box = document.createElement("div");
                var html = "";
        
                // 标题区域
                if (opt.title) {
                    html += '<div class="melui-dialog-header">';
                    html += '<div class="melui-dialog-title">' + opt.title + '</div>';
                    if (opt.showClose) {
                        html += '<div class="melui-dialog-close">×</div>';
                    }
                    html += '</div>';
                }
        
                // 内容区域
                html += '<div class="melui-dialog-body">';
                html += opt.content;
        
                // 仅prompt模式渲染输入框，alert/confirm/dialog禁止出现输入框
                if (opt._isPrompt === true) {
                    html += '<div class="melui-dialog-input-box">';
                    html += '<input class="melui-dialog-input" value="' + opt.defaultValue + '">';
                    html += '</div>';
                }
                html += '</div>';
        
                // 底部按钮区域
                html += this.buildFooterHtml();
        
                this.box.innerHTML = html;
                this.wrap.appendChild(this.box);
        
                // 缓存输入框节点
                if (opt._isPrompt) {
                    this.inputEl = this.box.querySelector(".melui-dialog-input");
                }
            };
        
            /**
             * 拼接底部按钮容器class + 按钮HTML
             */
            Dialog.prototype.buildFooterHtml = function() {
                var opt = this.options;
                var btnArr = opt.buttons || [];
                var footerClass = "melui-dialog-footer";
        
                // 竖向排布追加vert类名（和CSS严格一致，不用vertical）
                if (opt.btnDirection === "vert") {
                    footerClass += " melui-dialog-footer-vert";
                }
                // 通栏铺满叠加full类
                if (opt.btnFullWidth) {
                    footerClass += " melui-dialog-footer-full";
                }
        
                var btnHtml = '<div class="' + footerClass + '">';
                for (var i = 0; i < btnArr.length; i++) {
                    var item = btnArr[i];
                    btnHtml += '<button class="melui-dialog-btn melui-btn-' + item.type + '" data-index="' + (i + 1) + '">';
                    btnHtml += item.text;
                    btnHtml += '</button>';
                }
                btnHtml += '</div>';
                return btnHtml;
            };
        
            /**
             * 绑定关闭、按钮点击事件
             */
            Dialog.prototype.bindEvent = function() {
                var self = this;
                var opt = this.options;
        
                // 右上角关闭按钮
                var closeBtn = this.box.querySelector(".melui-dialog-close");
                if (closeBtn) {
                    closeBtn.onclick = function() {
                        self.close();
                    };
                }
        
                // 按钮点击回调
                var btns = this.box.querySelectorAll(".melui-dialog-btn");
                for (var i = 0; i < btns.length; i++) {
                    btns[i].onclick = function() {
                        var idx = parseInt(this.getAttribute("data-index"), 10);
                        if (typeof opt.onClick === "function") {
                            // prompt携带输入值，其余只返回按钮序号
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
        
            /**
             * 关闭弹窗，移除DOM节点
             */
            Dialog.prototype.close = function() {
                if (this.mask && this.mask.parentNode) {
                    document.body.removeChild(this.mask);
                }
                if (this.wrap && this.wrap.parentNode) {
                    document.body.removeChild(this.wrap);
                }
            };
        
            // ==================== 静态快捷方法 ====================
            /**
             * alert 消息提示：仅确定按钮，无输入框
             */
            Dialog.alert = function(options) {
                var opts = extend({}, options);
                opts.buttons = [
                    { text: "确定", type: opts.theme || "info" }
                ];
                opts._isPrompt = false;
                return new Dialog(opts);
            };
        
            /**
             * confirm 确认弹窗：取消+确定双按钮，无输入框
             */
            Dialog.confirm = function(options) {
                var opts = extend({}, options);
                opts.buttons = [
                    { text: "取消", type: "default" },
                    { text: "确定", type: opts.theme || "info" }
                ];
                opts._isPrompt = false;
                return new Dialog(opts);
            };
        
            /**
             * prompt 输入弹窗：唯一带输入框
             */
            Dialog.prompt = function(options) {
                var opts = extend({}, options);
                opts.buttons = [
                    { text: "取消", type: "default" },
                    { text: "确定", type: opts.theme || "info" }
                ];
                opts._isPrompt = true;
                return new Dialog(opts);
            };
        
            /**
             * dialog 极简快捷弹窗：默认单个确定按钮，无输入框
             */
            Dialog.dialog = function(options) {
                var opts = extend({}, options);
                // 未自定义按钮则默认单确定
                if (!opts.buttons) {
                    opts.buttons = [
                        { text: "确定", type: opts.theme || "info" }
                    ];
                }
                opts._isPrompt = false;
                return new Dialog(opts);
            };
        
            // ==================== 全局挂载：大写主命名空间 + 小写别名 ====================
            window.MelUi = window.MelUi || {};
            window.MelUi.Dialog = Dialog;
            window.MelUi.alert = Dialog.alert;
            window.MelUi.confirm = Dialog.confirm;
            window.MelUi.prompt = Dialog.prompt;
            window.MelUi.dialog = Dialog.dialog;
        
            // 小写兼容调用
            window.melui = window.MelUi;
        
        })(window);

    var index = window.MelUi;

    return index;

}));

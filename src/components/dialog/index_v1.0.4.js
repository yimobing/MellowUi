/**
 * MelUi 弹窗对话框组件
 * 版本：v1.0.0 beta 1.0.4
 * 创建日期：2026-08-10
 * 更新日期：2026-08-10
 * 兼容：IE8+ / .NET4.0 环境适配
 * 排版规则：
    1. 数组内缩进严格对标HTML原生层级，子元素统一缩进4空格
    2. 引号紧贴标签，无多余无效空格
    3. title默认空字符串，空标题整体不渲染header区域
    4. 简单分支使用行内短小IIFE，无多余外层嵌套闭包
 * 调用方式：
    构造创建：new MelUi.Dialog({配置参数})
    快捷调用：MelUi.alert() / MelUi.confirm() / MelUi.prompt()
 */
    (function (global) {
        "use strict";
    
        // 基础工具方法（兼容低版本浏览器）
        var util = {
            scrollTop: 0,
            scrollLockCount: 0,
    
            // 记录页面滚动位置
            saveScroll: function () {
                util.scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            },
    
            // 锁定页面滚动
            lockScroll: function () {
                util.scrollLockCount++;
                if (util.scrollLockCount > 1) return;
                util.saveScroll();
                document.documentElement.style.overflow = "hidden";
                document.body.style.overflow = "hidden";
            },
    
            // 解锁页面滚动
            unlockScroll: function () {
                util.scrollLockCount--;
                if (util.scrollLockCount > 0) return;
                util.scrollTop = util.scrollTop || 0;
                document.documentElement.style.overflow = "";
                document.body.style.overflow = "";
                window.scrollTo(0, util.scrollTop);
            },
    
            // 添加class兼容IE8
            addClass: function (el, cls) {
                if (el.classList) {
                    el.classList.add(cls);
                } else {
                    if (!util.hasClass(el, cls)) {
                        el.className += " " + cls;
                    }
                }
            },
    
            // 移除class兼容IE8
            removeClass: function (el, cls) {
                if (el.classList) {
                    el.classList.remove(cls);
                } else {
                    var reg = new RegExp("(\\s|^)" + cls + "(\\s|$)");
                    el.className = el.className.replace(reg, " ");
                }
            },
    
            // 检测元素是否包含class
            hasClass: function (el, cls) {
                if (el.classList) {
                    return el.classList.contains(cls);
                }
                return new RegExp("(\\s|^)" + cls + "(\\s|$)").test(el.className);
            },
    
            // 批量添加class
            addClasses: function (el, str) {
                var arr = str.split(/\s+/);
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i]) util.addClass(el, arr[i]);
                }
            }
        };
    
        /**
         * Dialog 弹窗构造函数
         * @param {Object} opts 弹窗配置项
         */
        function Dialog(opts) {
            // 合并默认参数与自定义参数
            this.options = this.extend({}, this.defaultOpts, opts);
    
            // DOM节点缓存
            this.wrap = null;
            this.mask = null;
            this.box = null;
            this.header = null;
            this.contentWrap = null;
            this.footer = null;
            this.inputEl = null;
            this.escBind = false;
    
            this.init();
        }
    
        // 默认配置参数
        Dialog.prototype.defaultOpts = {
            title: "",
            content: "",
            width: "540px",
            maxContentHeight: "60vh",
            zIndex: 999,
            theme: "info",
            showClose: true,
            closeOnMask: true,
            lockScroll: true,
            escClose: true,
            showFooter: true,
    
            confirmText: "确定",
            cancelText: "取消",
            confirmLoading: false,
    
            onOpen: function () { },
            onClose: function () { },
            onConfirm: function () { },
            onCancel: function () { }
        };
    
        // 对象浅拷贝合并参数
        Dialog.prototype.extend = function (target) {
            var args = arguments;
            for (var i = 1; i < args.length; i++) {
                var obj = args[i];
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        target[key] = obj[key];
                    }
                }
            }
            return target;
        };
    
        // 初始化DOM结构
        Dialog.prototype.init = function () {
            var opt = this.options;
            var html = "";
    
            // 外层总容器、遮罩、弹窗主体盒子
            html += [
                '<div class="mel-dialog-wrap">',
                    '<div class="mel-dialog-mask"></div>',
                    '<div class="mel-dialog-box mel-theme-' + opt.theme + '">'
            ].join('\r\n');
    
            // 标题头部区域：title为空时整段不渲染
            html += [
                opt.title ? '<div class="mel-dialog-header">' : '',
                opt.title ? '    <div class="mel-dialog-title">' + opt.title + '</div>' : '',
                opt.title ? (function () {
                    return opt.showClose ? ' <span class="mel-dialog-close">×</span>' : '';
                })() : '',
                opt.title ? '</div>' : ''
            ].join('\r\n');
    
            // 内容区域
            html += [
                '    <div class="mel-dialog-content">',
                    opt.content,
                '    </div>'
            ].join('\r\n');
    
            // 底部按钮栏：关闭底部则不渲染
            html += [
                opt.showFooter ? '<div class="mel-dialog-footer">' : '',
                opt.showFooter ? (function () {
                    return opt.cancelText && opt.cancelText !== "" ? '    <button class="mel-btn mel-btn-cancel">' + opt.cancelText + '</button>' : '';
                })() : '',
                opt.showFooter ? '    <button class="mel-btn mel-btn-primary">' + opt.confirmText + '</button>' : '',
                opt.showFooter ? '</div>' : ''
            ].join('\r\n');
    
            // 闭合层级
            html += [
                    '</div>',
                '</div>'
            ].join('\r\n');
    
            // 插入页面DOM
            var tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;
            this.wrap = tempDiv.firstChild;
            document.body.appendChild(this.wrap);
    
            // 节点缓存
            this.mask = this.wrap.querySelector(".mel-dialog-mask");
            this.box = this.wrap.querySelector(".mel-dialog-box");
            this.header = this.wrap.querySelector(".mel-dialog-header");
            this.contentWrap = this.wrap.querySelector(".mel-dialog-content");
            this.footer = this.wrap.querySelector(".mel-dialog-footer");
            this.inputEl = this.contentWrap ? this.contentWrap.querySelector("input") : null;
    
            // 样式设置
            this.wrap.style.zIndex = opt.zIndex;
            this.box.style.width = opt.width;
            this.contentWrap.style.maxHeight = opt.maxContentHeight;
    
            // 锁定滚动
            if (opt.lockScroll) {
                util.lockScroll();
            }
    
            // 绑定交互事件
            this.bindEvent();
    
            // 打开回调执行
            opt.onOpen.call(this);
        };
    
        // 绑定所有交互事件
        Dialog.prototype.bindEvent = function () {
            var self = this;
            var opt = this.options;
    
            // 关闭按钮
            if (this.header) {
                var closeBtn = this.header.querySelector(".mel-dialog-close");
                if (closeBtn) {
                    closeBtn.onclick = function () {
                        self.close();
                    };
                }
            }
    
            // 点击遮罩关闭
            if (opt.closeOnMask) {
                this.mask.onclick = function (e) {
                    e = e || window.event;
                    if (e.target === self.mask) {
                        self.close();
                    }
                };
            }
    
            // 底部按钮事件
            if (this.footer) {
                var cancelBtn = this.footer.querySelector(".mel-btn-cancel");
                var confirmBtn = this.footer.querySelector(".mel-btn-primary");
    
                if (cancelBtn) {
                    cancelBtn.onclick = function () {
                        opt.onCancel.call(self);
                        self.close();
                    };
                }
    
                if (confirmBtn) {
                    confirmBtn.onclick = function () {
                        if (opt.confirmLoading) return;
                        var val = self.inputEl ? self.inputEl.value : "";
                        opt.onConfirm.call(self, val);
                        self.close();
                    };
                }
            }
    
            // ESC快捷键关闭
            if (opt.escClose && !this.escBind) {
                this.escBind = true;
                document.onkeydown = function (e) {
                    e = e || window.event;
                    if (e.keyCode === 27) {
                        self.close();
                    }
                };
            }
        };
    
        // 关闭弹窗、销毁DOM、恢复页面状态
        Dialog.prototype.close = function () {
            var self = this;
            var opt = this.options;
    
            // 取消键盘监听
            if (this.escBind) {
                document.onkeydown = null;
                this.escBind = false;
            }
    
            setTimeout(function () {
                if (self.wrap && self.wrap.parentNode) {
                    self.wrap.parentNode.removeChild(self.wrap);
                }
                // 解锁滚动
                if (opt.lockScroll) {
                    util.unlockScroll();
                }
                opt.onClose.call(self);
            }, 200);
        };
    
        // 静态快捷方法：消息提示框
        Dialog.alert = function (content, title, theme, callback) {
            return new Dialog({
                content: content,
                title: title || "",
                theme: theme || "info",
                showFooter: true,
                cancelText: "",
                showClose: false,
                closeOnMask: false,
                onConfirm: callback || function () { }
            });
        };
    
        // 静态快捷方法：确认弹窗
        Dialog.confirm = function (content, title, theme, okCb, cancelCb) {
            return new Dialog({
                content: content,
                title: title || "",
                theme: theme || "info",
                showFooter: true,
                cancelText: "取消",
                showClose: false,
                closeOnMask: false,
                onConfirm: okCb || function () { },
                onCancel: cancelCb || function () { }
            });
        };
    
        // 静态快捷方法：输入弹窗
        Dialog.prompt = function (tip, title, defaultValue, okCb, cancelCb) {
            var inputHtml = tip + '<div class="mel-prompt-input"><input type="text" value="' + (defaultValue || "") + '"></div>';
            return new Dialog({
                content: inputHtml,
                title: title || "",
                theme: "info",
                showFooter: true,
                cancelText: "取消",
                showClose: false,
                closeOnMask: false,
                onConfirm: okCb || function () { },
                onCancel: cancelCb || function () { }
            });
        };
    
        // 统一挂载至 MelUi 全局命名空间
        global.MelUi = global.MelUi || {};
        global.MelUi.Dialog = Dialog;
        global.MelUi.alert = Dialog.alert;
        global.MelUi.confirm = Dialog.confirm;
        global.MelUi.prompt = Dialog.prompt;
    
    })(window);
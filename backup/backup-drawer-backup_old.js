/**
 * MelUi Drawer 抽屉组件
 * 版本：v1.0.5
 * 创建时间：2026-08-12
 * 更新时间：2026-08-26
 * 兼容：IE9/10/11、iOS（处理滚动穿透、遮罩击穿）
 * 调用规则：
    构造调用：MelUi.Drawer({配置参数}) 【无需new，直接返回实例】
    new构造：new MelUi.Drawer({配置参数}) 兼容旧写法
    快捷方法：MelUi.drawer() / melui.drawer()
 */
    (function(window) {
        "use strict";
    
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
    
        function parseSize(val) {
            if (typeof val === "number") {
                return val + "px";
            }
            if (typeof val === "string") {
                return val;
            }
            return val;
        }
    
        function isOldIE() {
            return !!window.ActiveXObject || "ActiveXObject" in window;
        }
    
        function genUid() {
            var chars = "0123456789abcdefghijklmnopqrstuvwxyz";
            var id = "mel-drawer__";
            for (var i = 0; i < 10; i++) {
                id += chars[Math.floor(Math.random() * chars.length)];
            }
            return id;
        }
    
        var defaults = {
            direction: "right",
            width: "auto",
            height: "auto",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            minWidth: 320,
            minHeight: 280,
            adaptive: false,
            resizable: false,
    
            showMask: true,
            zIndex: 9999,
            animation: true,
            maskClose: true,
    
            closeOnBackClick: true,
            closeOnCrossClick: true,
            destroyOnClose: true,
    
            showHeader: true,
            headerSticky: true,
            headerHeight: 48,
            showBack: false,
            backShowIcon: false,
            backShowText: false,
            backText: "返回",
            backDisabled: false,
            title: "",
            titleAlign: "center",
            showClose: true,
            closeShowIcon: true,
            closeShowText: false,
            closeText: "关闭",
            closeDisabled: false,
    
            showFooter: true,
            footerSticky: true,
            footerHeight: 52,
            showDefaultFooterBtn: true,
            defaultFooterBtnText: "关闭",
            onDefaultFooterBtnClick: null,
            buttons: null,
            onBtnClick: null,
    
            content: "",
    
            onOpen: null,
            onBack: null,
            onClose: null,
            afterClose: null
        };
    
        function Drawer(opts) {
            // 支持不写 new：MelUi.Drawer({...}) 直接返回实例，IE9‑11兼容
            if (!(this instanceof Drawer)) {
                return new Drawer(opts);
            }
    
            this.options = extend({}, defaults, opts);
            this.uid = genUid();
            this.mask = null;
            this.wrap = null;
            this.contentEl = null;
            this.isOpen = false;
            this.bodyScrollLock = false;
    
            this._transitionLock = false;
            this._transitionTimer = null;
    
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
    
        Drawer.prototype.init = function() {
            this.createMask();
            this.createDom();
            this.buildResizableHandle();
            this.bindEvent();
            if (this.options.showMask) {
                document.body.appendChild(this.mask);
            }
            document.body.appendChild(this.wrap);
    
            var self = this;
            var opt = this.options;
    
            if (opt.animation) {
                setTimeout(function() {
                    self.wrap.classList.add("mel-drawer--open");
                }, 0);
            } else {
                this.wrap.classList.add("mel-drawer--open");
            }
    
            this.lockBodyScroll();
            this.isOpen = true;
    
            if (!opt.animation) {
                if (typeof opt.onOpen === "function") {
                    opt.onOpen(self.wrap);
                }
            }
        };
    
        Drawer.prototype.buildResizableHandle = function() {
            var opt = this.options;
            if (isOldIE() || opt.adaptive || !opt.resizable) {
                return;
            }
            var handle = document.createElement("div");
            handle.className = "mel-drawer__resizable-handle";
    
            var dir = opt.direction;
            if (dir === "right") {
                handle.classList.add("mel-drawer__resizable--left");
            } else if (dir === "left") {
                handle.classList.add("mel-drawer__resizable--right");
            } else if (dir === "bottom") {
                handle.classList.add("mel-drawer__resizable--top");
            } else if (dir === "top") {
                handle.classList.add("mel-drawer__resizable--bottom");
            }
            this._dragHandle = handle;
            this.wrap.appendChild(handle);
        };
    
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
    
        Drawer.prototype.createDom = function() {
            var opt = this.options;
            this.wrap = document.createElement("div");
            this.wrap.id = this.uid;
            this.wrap.className = "mel-drawer";
            this.wrap.style.zIndex = opt.zIndex;
    
            if (opt.animation) {
                this.wrap.classList.add("mel-drawer--animate");
            }
            if (opt.adaptive) {
                this.wrap.classList.add("mel-drawer--adaptive");
            } else {
                this.wrap.classList.add("mel-drawer--" + opt.direction);
            }
    
            this.setPosition();
    
            var html = "";
            if (opt.showHeader) {
                html += '<div class="mel-drawer__header ' + (opt.headerSticky ? "mel-drawer__header--sticky" : "") + '" style="height:' + opt.headerHeight + 'px">';
                if (opt.showBack) {
                    html += '<div class="mel-drawer__back ' + (opt.backDisabled ? "is-disabled" : "") + '">';
                    if (opt.backShowIcon) {
                        html += '<span class="mel-drawer__back-icon">&lt;</span>';
                    }
                    if (opt.backShowText) {
                        html += '<span class="mel-drawer__back-text">' + opt.backText + '</span>';
                    }
                    html += '</div>';
                }
                html += '<div class="mel-drawer__title" style="text-align:' + opt.titleAlign + '">' + opt.title + '</div>';
                if (opt.showClose) {
                    html += '<div class="mel-drawer__close ' + (opt.closeDisabled ? "is-disabled" : "") + '">';
                    if (opt.closeShowIcon) {
                        html += '<span class="mel-drawer__close-icon">×</span>';
                    }
                    if (opt.closeShowText) {
                        html += '<span class="mel-drawer__close-text">' + opt.closeText + '</span>';
                    }
                    html += '</div>';
                }
                html += '</div>';
            }
    
            html += '<div class="mel-drawer__content">' + opt.content + '</div>';
    
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
    
        Drawer.prototype.setPosition = function() {
            var opt = this.options;
            var wrap = this.wrap;
    
            if (opt.adaptive) {
                wrap.style.top = "";
                wrap.style.bottom = "";
                wrap.style.left = "";
                wrap.style.right = "";
                wrap.style.width = "";
                wrap.style.height = "";
                wrap.style.minWidth = "";
                wrap.style.minHeight = "";
                return;
            }
    
            var dir = opt.direction;
    
            if (opt.top !== 0) wrap.style.top = parseSize(opt.top);
            if (opt.bottom !== 0) wrap.style.bottom = parseSize(opt.bottom);
            if (opt.left !== 0) wrap.style.left = parseSize(opt.left);
            if (opt.right !== 0) wrap.style.right = parseSize(opt.right);
    
            wrap.style.minWidth = opt.minWidth + "px";
            wrap.style.minHeight = opt.minHeight + "px";
    
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
    
        Drawer.prototype.buildFooterHtml = function() {
            var opt = this.options;
            var html = '<div class="mel-drawer__footer ' + (opt.footerSticky ? "mel-drawer__footer--sticky" : "") + '" style="height:' + opt.footerHeight + 'px">';
            if (opt.buttons && Array.isArray(opt.buttons) && opt.buttons.length > 0) {
                for (var i = 0; i < opt.buttons.length; i++) {
                    var item = opt.buttons[i];
                    var theme = item.theme || "default";
                    html += '<button class="mel-drawer__btn mel-drawer__btn--' + theme + '" data-index="' + (i + 1) + '" ';
                    if (item.bgColor || item.fontColor) {
                        var inlineStyle = "";
                        if (item.bgColor) inlineStyle += "background-color:" + item.bgColor + ";";
                        if (item.fontColor) inlineStyle += "color:" + item.fontColor + ";";
                        html += 'style="' + inlineStyle + '"';
                    }
                    html += '>' + (item.text || "") + '</button>';
                }
            } else {
                html += '<button class="mel-drawer__btn mel-drawer__btn--default" data-is-default="1">' + opt.defaultFooterBtnText + '</button>';
            }
            html += '</div>';
            return html;
        };
    
        Drawer.prototype._afterTransitionClose = function() {
            var self = this;
            var opt = this.options;
            this._transitionLock = false;
            if (this._transitionTimer) {
                clearTimeout(this._transitionTimer);
                this._transitionTimer = null;
            }
    
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
    
        Drawer.prototype._afterTransitionOpen = function() {
            var self = this;
            var opt = this.options;
            this._transitionLock = false;
            if (this._transitionTimer) {
                clearTimeout(this._transitionTimer);
                this._transitionTimer = null;
            }
            if (typeof opt.onOpen === "function") {
                opt.onOpen(self.wrap);
            }
        };
    
        Drawer.prototype.bindEvent = function() {
            var self = this;
            var opt = this.options;
    
            if (this.mask && opt.maskClose) {
                this.mask.onclick = function() {
                    self.close();
                };
            }
    
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
    
            var footerDom = this.wrap.querySelector(".mel-drawer__footer");
            if (footerDom) {
                footerDom.onclick = function(e) {
                    var target = e.target || e.srcElement;
                    if (target.tagName !== "BUTTON") return;
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
                    } else {
                        var idx = Number(target.getAttribute("data-index"));
                        if (typeof opt.onBtnClick === "function") {
                            opt.onBtnClick(idx, self, self.wrap);
                        }
                    }
                };
            }
    
            if (this._dragHandle) {
                this._dragHandle.onmousedown = function(e) {
                    e.preventDefault();
                    self._startDrag(e);
                };
            }
    
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
    
        Drawer.prototype._onDragMove = function(e) {
            if (!this._isDragging) return;
            var opt = this.options;
            var dir = opt.direction;
            var delta;
            var newSize;
    
            if (dir === "right") {
                delta = this._dragStartX - e.clientX;
                newSize = this._dragStartSize + delta;
                newSize = Math.max(newSize, opt.minWidth);
                newSize = Math.min(newSize, window.innerWidth);
                this.wrap.style.width = newSize + "px";
            } else if (dir === "left") {
                delta = e.clientX - this._dragStartX;
                newSize = this._dragStartSize + delta;
                newSize = Math.max(newSize, opt.minWidth);
                newSize = Math.min(newSize, window.innerWidth);
                this.wrap.style.width = newSize + "px";
            } else if (dir === "bottom") {
                delta = this._dragStartY - e.clientY;
                newSize = this._dragStartSize + delta;
                newSize = Math.max(newSize, opt.minHeight);
                newSize = Math.min(newSize, window.innerHeight);
                this.wrap.style.height = newSize + "px";
            } else if (dir === "top") {
                delta = e.clientY - this._dragStartY;
                newSize = this._dragStartSize + delta;
                newSize = Math.max(newSize, opt.minHeight);
                newSize = Math.min(newSize, window.innerHeight);
                this.wrap.style.height = newSize + "px";
            }
        };
    
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
    
        Drawer.prototype.lockBodyScroll = function() {
            this.bodyScrollLock = true;
            document.body.style.overflow = "hidden";
        };
        Drawer.prototype.unlockBodyScroll = function() {
            if (this.bodyScrollLock) {
                document.body.style.overflow = "";
                this.bodyScrollLock = false;
            }
        };
    
        Drawer.prototype.open = function() {
            var self = this;
            var opt = this.options;
            if (this.isOpen) return;
            if (!this.wrap) {
                this.init();
                return;
            }
            if (this.mask) this.mask.style.display = "block";
            this.wrap.style.display = "";
    
            if (opt.animation) {
                setTimeout(function() {
                    self.wrap.classList.add("mel-drawer--open");
                }, 0);
            } else {
                this.wrap.classList.add("mel-drawer--open");
                if (typeof opt.onOpen === "function") {
                    opt.onOpen(self.wrap);
                }
            }
    
            this.lockBodyScroll();
            this.isOpen = true;
        };
    
        Drawer.prototype.close = function() {
            var self = this;
            var opt = this.options;
            if (!this.isOpen) return;
            this.isOpen = false;
            this.unlockBodyScroll();
            this._stopDrag();
    
            if (opt.animation) {
                this.wrap.classList.remove("mel-drawer--open");
                this._transitionTimer = setTimeout(function() {
                    if (!self._transitionLock) {
                        self._transitionLock = true;
                        self._afterTransitionClose();
                    }
                }, 400);
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
    
        Drawer.prototype.destroy = function() {
            this._stopDrag();
            if (this._transitionTimer) {
                clearTimeout(this._transitionTimer);
                this._transitionTimer = null;
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
    
        Drawer.drawer = function(options) {
            return new Drawer(options);
        };
    
        window.MelUi = window.MelUi || {};
        window.MelUi.Drawer = Drawer;
        window.MelUi.drawer = Drawer.drawer;
        window.melui = window.MelUi;
    
    })(window);
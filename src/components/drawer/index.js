/**
 * MelUi Drawer 抽屉组件
 * 版本：v1.0.8
 * 创建时间：2026-08-12
 * 更新时间：2026-08-26
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
    "use strict";

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
        adaptive: false, // 是否居中对话框模式，true时direction、偏移、width、height、拖拽失效 (可选)
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

        // 自适应居中模式：清空所有定位
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

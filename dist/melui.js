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

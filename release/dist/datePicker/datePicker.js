(function (factory) {
    typeof define === 'function' && define.amd ? define(factory) :
    factory();
})((function () { 'use strict';

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

}));

(function (factory) {
    typeof define === 'function' && define.amd ? define(factory) :
    factory();
})((function () { 'use strict';

    /**
     * MelUi 独立分页组件
     * 通用分页UI组件：负责渲染分页条、捕获交互、抛出变更事件；不处理数据请求、不做数据切片，
     * 数据加载与渲染由业务自己控制。
     * 分页UI样式统一放在 index.css（.mel-paging-* 系列），本组件不写内联样式
     * 兼容性：IE9 / IE10 / IE11 / Edge
     * @Version：v1.0.2
     * @Date：2026-11-06
     * @PubDate：2026-11-06 18:17:54
     */

     (function(MelUi) {

        /**
         * 默认配置
         */
        var DEFAULTS = {
            el: null, // 挂载容器(必填)。默认null，不渲染。支持选择器字符串'#id'或DOM元素。
            enable: true, // 是否启用交互(可选)。false时所有按钮置灰禁用，DOM保留
            total: 0, // 总条数(可选)。小于0时全部交互控件置灰。
            pageSize: 20, // 每页条数(可选)。小于1自动修正为20
            pageNo: 1, // 当前页码(可选)
            pageListSize: 5, // 数字页码区域最多展示连续页码数量(可选)。最小值为3
            showTotal: true, // 是否显示总条数文本(可选)
            showListSize: true, // 是否展示中间连续数字页码(可选)。比如（1 2 3 4 5）这种
            showJumpDrop: true, // 是否显示页码下拉选择器(可选)
            showJumpInput: true, // 是否显示手动输入页码跳转框(可选)
            showPageSize: true, // 是否显示每页条数下拉(可选)
            pageSizeOptions: [10, 20, 50, 100], // 自定义每页条数下拉选项(可选)

            // 事件
            onChange: null // 用户点击页码 / 切换每页条数 / 下拉选页码 / 输入框跳转 都会触发；function({pageNo, pageSize, oldPageNo, oldPageSize})
        };

        /**
         * Pagination 构造函数
         * 支持两种调用方式：
         *   var pager = new MelUi.Pagination({...});
         *   var pager = MelUi.Pagination({...});   // 省略new，内部自动处理
         * @param {Object} options 配置项，见 DEFAULTS
         */
        function Pagination(options) {
            // 支持无 new 调用：MelUi.Pagination({...}) 等价于 new MelUi.Pagination({...})
            if (!(this instanceof Pagination)) {
                return new Pagination(options);
            }

            this.options = this._extend({}, DEFAULTS, options || {});

            // 销毁标记
            this._isDestroyed = false;

            // 解析挂载容器
            var el = this.options.el;
            this.el = typeof el === 'string' ? document.querySelector(el) : el;
            if (!this.el) {
                if (window.console && console.warn) {
                    console.warn('[MelUi.Pagination] el 未找到，组件不渲染');
                }
                this._ready = false;
                return;
            }
            this._ready = true;

            // 归一化参数（pageSize/pageListSize 兜底、maxPage计算、pageNo钳位）
            this._norm();

            // 渲染 + 绑定事件委托
            this._render();
            this._bindEvents();
        }

        /**
         * 只读属性：当前页码 / 每页条数 / 总条数 / 是否启用 / 是否已销毁
         * 只暴露 getter，业务只能读不能改
         */
        Object.defineProperty(Pagination.prototype, 'pageNo', {
            get: function() { return this.options.pageNo; },
            enumerable: true
        });
        Object.defineProperty(Pagination.prototype, 'pageSize', {
            get: function() { return this.options.pageSize; },
            enumerable: true
        });
        Object.defineProperty(Pagination.prototype, 'total', {
            get: function() { return this.options.total; },
            enumerable: true
        });
        Object.defineProperty(Pagination.prototype, 'enable', {
            get: function() { return !!this.options.enable; },
            enumerable: true
        });
        Object.defineProperty(Pagination.prototype, 'isDestroyed', {
            get: function() { return this._isDestroyed; },
            enumerable: true
        });

        /**
         * 简单第一层合并
         */
        Pagination.prototype._extend = function(target) {
            var sources = Array.prototype.slice.call(arguments, 1);
            for (var i = 0; i < sources.length; i++) {
                var src = sources[i];
                if (!src) continue;
                for (var key in src) {
                    if (src.hasOwnProperty(key)) {
                        target[key] = src[key];
                    }
                }
            }
            return target;
        };

        /**
         * 参数归一化 + 派生值计算
         * 规则：
         *   pageSize < 1            → 修正为 20
         *   pageListSize < 3        → 修正为 3
         *   pageSizeOptions 非空数组才允许显示每页条数下拉
         *   当前 pageSize 不在 pageSizeOptions 中 → 自动追加进去，保证下拉有选中项
         *   maxPage = Math.max(1, Math.ceil(total / pageSize))
         *   pageNo 钳位到 [1, maxPage]
         *   total<=0 或 enable=false → _allDisabled=true，全部交互控件置灰
         */
        Pagination.prototype._norm = function() {
            var o = this.options;

            // pageSize 兜底
            if (typeof o.pageSize !== 'number' || o.pageSize < 1) {
                o.pageSize = 20;
            }

            // pageListSize 兜底（最小3）
            if (typeof o.pageListSize !== 'number' || isNaN(o.pageListSize)) {
                o.pageListSize = 5;
            }
            if (o.pageListSize < 3) {
                o.pageListSize = 3;
            }

            // pageSizeOptions 校验：必须是非空数组，否则自动关闭每页条数下拉
            if (!o.pageSizeOptions || !o.pageSizeOptions.length) {
                o.showPageSize = false;
            } else {
                // 当前 pageSize 不在下拉选项中 → 自动追加，保证 select 能选中当前页大小
                var _has = false;
                for (var _pi = 0; _pi < o.pageSizeOptions.length; _pi++) {
                    if (o.pageSizeOptions[_pi] === o.pageSize) { _has = true; break; }
                }
                if (!_has) {
                    o.pageSizeOptions.push(o.pageSize);
                }
            }

            // 最大合法页码：total<=0 时保底为1，避免出现 0 页 / NaN
            this.maxPage = Math.max(1, Math.ceil((o.total || 0) / o.pageSize));

            // 当前页码钳位到 [1, maxPage]
            var pn = parseInt(o.pageNo, 10);
            if (isNaN(pn) || pn < 1) pn = 1;
            if (pn > this.maxPage) pn = this.maxPage;
            o.pageNo = pn;

            // 全部置灰条件：未启用 / total<=0
            this._allDisabled = (!o.enable) || (o.total <= 0);
        };

        /**
         * 计算数字页码窗口 [start, end]
         */
        Pagination.prototype._getPageWindow = function() {
            var size = this.options.pageListSize;
            var mp = this.maxPage;
            var pn = this.options.pageNo;
            var start, end;

            if (mp <= size) {
                start = 1;
                end = mp;
            } else {
                var half = Math.floor(size / 2);
                start = pn - half;
                if (start < 1) start = 1;
                end = start + size - 1;
                if (end > mp) {
                    end = mp;
                    start = end - size + 1;
                }
            }
            return { start: start, end: end };
        };

        /**
         * 渲染整个分页条
         */
        Pagination.prototype._render = function() {
            if (!this._ready || this._isDestroyed) return;

            var o = this.options;
            var pn = o.pageNo;
            var mp = this.maxPage;
            var dis = this._allDisabled;

            // 首页/上一页 置灰条件：当前在第1页 或 整体禁用
            var prevDis = dis || pn <= 1;
            // 下一页/尾页 置灰条件：当前已是最后一页 或 整体禁用
            var nextDis = dis || pn >= mp;

            var html = '<div class="mel-paging">';

            // 1. 总条数文本
            if (o.showTotal) {
                var showTotal = o.total < 0 ? 0 : o.total;
                html += '<span class="mel-paging-total">共 ' + showTotal + ' 条</span>';
            }

            // 2. 基础按钮：首页 / 上一页
            html += '<button type="button" class="mel-paging-btn" data-act="first"' + (prevDis ? ' disabled' : '') + '>首页</button>';
            html += '<button type="button" class="mel-paging-btn" data-act="prev"' + (prevDis ? ' disabled' : '') + '>上一页</button>';

            // 3. 连续数字页码
            if (o.showListSize) {
                var win = this._getPageWindow();
                html += '<span class="mel-paging-nums">';
                for (var i = win.start; i <= win.end; i++) {
                    html += '<button type="button" class="mel-paging-num' + (i === pn ? ' active' : '') + '" data-page="' + i + '"' + (dis ? ' disabled' : '') + '>' + i + '</button>';
                }
                html += '</span>';
            }

            // 4. 下一页 / 尾页
            html += '<button type="button" class="mel-paging-btn" data-act="next"' + (nextDis ? ' disabled' : '') + '>下一页</button>';
            html += '<button type="button" class="mel-paging-btn" data-act="last"' + (nextDis ? ' disabled' : '') + '>尾页</button>';

            // 5. 页码下拉选择器（showJumpDrop）
            if (o.showJumpDrop) {
                var dropHtml = '';
                for (var d = 1; d <= mp; d++) {
                    dropHtml += '<option value="' + d + '"' + (d === pn ? ' selected' : '') + '>' + d + '</option>';
                }
                html += '<span class="mel-paging-jump">前往'
                     +  '<select class="mel-paging-jump-select"' + (dis ? ' disabled' : '') + '>' + dropHtml + '</select>'
                     +  '页</span>';
            }

            // 6. 手动输入页码跳转框（showJumpInput）
            if (o.showJumpInput) {
                html += '<span class="mel-paging-jumpinput">前往'
                     +  '<input type="text" class="mel-paging-jump-input-box" value="' + pn + '"' + (dis ? ' disabled' : '') + ' />'
                     +  '页</span>';
            }

            // 7. 每页条数下拉（showPageSize）
            if (o.showPageSize) {
                var sizeHtml = '';
                for (var s = 0; s < o.pageSizeOptions.length; s++) {
                    var sv = o.pageSizeOptions[s];
                    sizeHtml += '<option value="' + sv + '"' + (sv === o.pageSize ? ' selected' : '') + '>' + sv + '</option>';
                }
                html += '<span class="mel-paging-size">每页'
                     +  '<select class="mel-paging-size-select"' + (dis ? ' disabled' : '') + '>' + sizeHtml + '</select>'
                     +  '条</span>';
            }

            html += '</div>';

            this.el.innerHTML = html;
        };

        /**
         * 事件委托绑定（click 委托按钮、change 委托下拉、键盘/失焦委托输入框）
         * 委托挂在容器上，_render 重建 innerHTML 后无需重新绑定
         */
        Pagination.prototype._bindEvents = function() {
            if (!this.el) return;
            var self = this;

            var onClick = function(e) {
                if (self._isDestroyed) return;
                e = e || window.event;
                var target = e.target || e.srcElement;

                // 向上找到最近的按钮
                var node = target;
                while (node && node !== self.el) {
                    if (node.tagName === 'BUTTON') {
                        if (node.disabled) return;
                        var act = node.getAttribute('data-act');
                        if (act === 'first') { self._go(1); return; }
                        if (act === 'prev')  { self._go(self.options.pageNo - 1); return; }
                        if (act === 'next')  { self._go(self.options.pageNo + 1); return; }
                        if (act === 'last')  { self._go(self.maxPage); return; }
                        var page = node.getAttribute('data-page');
                        if (page !== null) { self._go(page); return; }
                        return;
                    }
                    node = node.parentNode;
                }
            };

            var onChange = function(e) {
                if (self._isDestroyed) return;
                e = e || window.event;
                var target = e.target || e.srcElement;
                if (target.tagName !== 'SELECT') return;
                if (target.disabled) return;

                if (target.className === 'mel-paging-size-select') {
                    self._changePageSize(target.value);
                } else if (target.className === 'mel-paging-jump-select') {
                    self._go(target.value);
                }
            };

            // 输入框：回车跳转；失焦也跳转（两次都走同一个校验，值没变则不重复触发）
            var onInputKeydown = function(e) {
                if (self._isDestroyed) return;
                e = e || window.event;
                var target = e.target || e.srcElement;
                if (target.className !== 'mel-paging-jump-input-box') return;
                var key = e.keyCode || e.which;
                if (key === 13) {
                    self._jumpInput(target);
                    // IE9 回车在表单内可能触发表单提交，阻止默认
                    if (e.preventDefault) { e.preventDefault(); } else { e.returnValue = false; }
                }
            };
            var onInputBlur = function(e) {
                if (self._isDestroyed) return;
                e = e || window.event;
                var target = e.target || e.srcElement;
                if (target.className !== 'mel-paging-jump-input-box') return;
                self._jumpInput(target);
            };

            // 保存handler引用，destroy时移除
            this._handlers = {
                click: onClick,
                change: onChange,
                keydown: onInputKeydown,
                blur: onInputBlur
            };

            if (this.el.addEventListener) {
                this.el.addEventListener('click', onClick, false);
                this.el.addEventListener('change', onChange, false);
                this.el.addEventListener('keydown', onInputKeydown, false);
                this.el.addEventListener('blur', onInputBlur, true); // 捕获阶段，兼容IE9 blur冒泡问题
            } else if (this.el.attachEvent) {
                this.el.attachEvent('onclick', onClick);
                this.el.attachEvent('onchange', onChange);
                this.el.attachEvent('onkeydown', onInputKeydown);
                this.el.attachEvent('onblur', onInputBlur);
            }
        };

        /**
         * 跳转到指定页码（内部统一入口）
         * 自动钳位到 [1, maxPage]；目标页与当前页相同则忽略；
         * 先乐观刷新视图，再抛出 onChange。
         * @param {Number|String} page 目标页码
         */
        Pagination.prototype._go = function(page) {
            if (this._isDestroyed) return;
            if (this._allDisabled) return;

            var target = parseInt(page, 10);
            if (isNaN(target)) return;

            // 交互前快照旧值（页码变化时，pageSize 不变）
            var oldPageNo = this.options.pageNo;
            var oldPageSize = this.options.pageSize;

            // 钳位
            if (target < 1) target = 1;
            if (target > this.maxPage) target = this.maxPage;

            // 与当前页相同：不重复触发
            if (target === oldPageNo) return;

            this.options.pageNo = target;
            this._render();
            this._emitChange(oldPageNo, oldPageSize);
        };

        /**
         * 切换每页条数
         * 组件不自动把 pageNo 重置为1：切完后重新计算 maxPage 并把 pageNo 钳位到合法范围，
         * 把钳位结果连同 pageSize 一起抛给业务。是否强制回到第1页由业务自己决定（文档给标准写法）。
         * @param {Number|String} size 新每页条数
         */
        Pagination.prototype._changePageSize = function(size) {
            if (this._isDestroyed) return;
            if (this._allDisabled) return;

            var target = parseInt(size, 10);
            if (isNaN(target) || target < 1) return;

            // 交互前快照旧值（切条数会引起 maxPage 重算、pageNo 被钳位，必须先存）
            var oldPageNo = this.options.pageNo;
            var oldPageSize = this.options.pageSize;

            this.options.pageSize = target;
            // 重算 maxPage + 钳位 pageNo
            this._norm();

            // 新旧完全一致：不触发（例如切的条数和当前相同，或钳位后页码/条数都没变）
            if (this.options.pageNo === oldPageNo && this.options.pageSize === oldPageSize) return;

            this._render();
            this._emitChange(oldPageNo, oldPageSize);
        };

        /**
         * 输入框跳转校验
         * 规则：
         *   非数字 / 空值        → 回退为当前页码，不触发事件
         *   < 1                  → 钳位为1
         *   > maxPage            → 钳位为 maxPage
         *   与当前页相同         → 回退输入值，不重复触发
         * @param {HTMLElement} inputEl 输入框元素
         */
        Pagination.prototype._jumpInput = function(inputEl) {
            if (this._isDestroyed) return;
            if (!inputEl || inputEl.disabled) return;

            var raw = (inputEl.value || '').replace(/[^\d]/g, '');
            var target = parseInt(raw, 10);

            if (isNaN(target)) {
                inputEl.value = this.options.pageNo; // 非法输入回退，不触发
                return;
            }
            if (target < 1) target = 1;
            if (target > this.maxPage) target = this.maxPage;
            if (target === this.options.pageNo) {
                inputEl.value = this.options.pageNo; // 相同页回退，不重复触发
                return;
            }
            // 合法跳转：_go 内部会重绘并 emit
            this._go(target);
        };

        /**
         * 抛出 onChange
         * 只在用户交互（点页码/切条数/选下拉/输入跳转）时调用；
         * setOption 不触发本方法，避免"业务setOption → onChange → 业务再setOption"死循环。
         * @param {Number} oldPageNo 交互前的页码
         * @param {Number} oldPageSize 交互前的每页条数
         */
        Pagination.prototype._emitChange = function(oldPageNo, oldPageSize) {
            if (typeof this.options.onChange === 'function') {
                this.options.onChange({
                    pageNo: this.options.pageNo,
                    pageSize: this.options.pageSize,
                    oldPageNo: oldPageNo,
                    oldPageSize: oldPageSize
                });
            }
        };

        /**
         * 更新状态（业务主动驱动视图）
         * 支持局部更新：传哪些字段就更新哪些，不需要每次全量传入。
         * 可更新字段：enable / total / pageSize / pageNo / pageListSize /
         *            showTotal / showListSize / showJumpDrop / showJumpInput /
         *            showPageSize / pageSizeOptions
         * 调用后重新归一化并刷新UI；【不会触发 onChange】。
         * @param {Object} patch 状态补丁
         */
        Pagination.prototype.setOption = function(patch) {
            if (this._isDestroyed || !this._ready) return;
            if (!patch) return;

            this._extend(this.options, patch);
            this._norm();
            this._render();
        };

        /**
         * 销毁组件
         * 移除容器上的事件委托监听、清空容器DOM、标记销毁状态；
         * 销毁后再调用 setOption / 交互均被忽略，重复调用不报错。
         */
        Pagination.prototype.destroy = function() {
            if (this._isDestroyed) return;
            this._isDestroyed = true;

            if (this.el && this._handlers) {
                var h = this._handlers;
                if (this.el.removeEventListener) {
                    this.el.removeEventListener('click', h.click, false);
                    this.el.removeEventListener('change', h.change, false);
                    this.el.removeEventListener('keydown', h.keydown, false);
                    this.el.removeEventListener('blur', h.blur, true);
                } else if (this.el.detachEvent) {
                    this.el.detachEvent('onclick', h.click);
                    this.el.detachEvent('onchange', h.change);
                    this.el.detachEvent('onkeydown', h.keydown);
                    this.el.detachEvent('onblur', h.blur);
                }
                this._handlers = null;
            }

            if (this.el) {
                this.el.innerHTML = '';
            }
        };

        // 暴露到命名空间
        MelUi.Pagination = Pagination;

     })(window.MelUi = window.MelUi || {});

}));

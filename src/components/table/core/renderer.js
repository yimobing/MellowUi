/**
 * MelUi Table 表格组件 - 核心渲染器
 * 负责根据 DataStore 数据渲染表头和表身 DOM，所有 DOM 操作统一在此
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.7.3
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

 (function(MelUi) {

    /**
     * Renderer 构造函数
     * @param {Object} options 配置项
     * @param {Object} dataStore DataStore 实例
     * @param {Object} eventBus EventBus 实例
     */
    function Renderer(options, dataStore, eventBus) {
        this.options = options;
        this.dataStore = dataStore;
        this.eventBus = eventBus;
        this.el = typeof options.el === 'string' ? document.querySelector(options.el) : options.el;
        this.isRenderComplete = false;

        this._renderers = MelUi.Table.cellRenderers || {};

        this._bindInternalEvents();
    }

    /**
     * 监听内部事件
     */
    Renderer.prototype._bindInternalEvents = function() {
        var self = this;

        this.eventBus.on('sortChange', function() {
            if (!self.isRenderComplete) return;
            self._renderHeader();
            self._renderBody();
        });

        this.eventBus.on('summaryChange', function(data) {
            self._renderSummaryRow(data.sums);
        });

        this.eventBus.on('selectChange', function() {
            if (!self.isRenderComplete) return;
            self._refreshSelectedStates();
        });

        this.eventBus.on('rowAdd', function() {
            if (!self.isRenderComplete) return;
            self._renderBody();
        });

        this.eventBus.on('rowDelete', function() {
            if (!self.isRenderComplete) return;
            self._renderBody();
        });

        this.eventBus.on('pageChange', function() {
            if (!self.isRenderComplete) return;
            self._renderBody();
        });
    };

    /**
     * 渲染整个表格
     */
    Renderer.prototype.render = function() {
        this._renderContainer();
        this._renderHeader();
        this._renderBody();
        this._bindEvents();
        this._initLayout();

        var self = this;
        // 延迟等浏览器完成布局，再调整宽度和高度
        setTimeout(function() {
            self._adjustWrapperWidth(self._getTotalWidth());

            // 统一绑定窗口resize（所有模式都刷新水平宽度；fitViewport额外刷新垂直高度）
            self._bindResize();

            // fitViewport=true：自动适配视口，占满页面剩余高度
            if (self.options.fitViewport) {
                self._fitViewport();
            } else {
                self._adjustBodyHeight();
            }
        }, 0);

        this.isRenderComplete = true;
        this.eventBus.emit('rendered');
    };

    /**
     * 获取列宽总和
     */
    Renderer.prototype._getTotalWidth = function() {
        var totalWidth = 0;
        for (var i = 0; i < this.dataStore.columns.length; i++) {
            totalWidth += this.dataStore.columns[i].width || 100;
        }
        return totalWidth;
    };

    /**
     * 渲染外层容器结构
     */
    Renderer.prototype._renderContainer = function() {
        var html = [
            '<div class="mel-table-container">',
            '  <div class="mel-table-header-wrapper">',
            '    <table class="mel-table-header">',
            '      <colgroup></colgroup>',
            '      <thead><tr></tr></thead>',
            '    </table>',
            '  </div>',
            '  <div class="mel-table-body-wrapper">',
            '    <table class="mel-table-body">',
            '      <colgroup></colgroup>',
            '      <tbody></tbody>',
            '    </table>',
            '  </div>',
            '</div>'
        ].join('\r\n');

        this.el.innerHTML = html;

        this.container = this.el.querySelector('.mel-table-container');
        this.headerWrapper = this.el.querySelector('.mel-table-header-wrapper');
        this.headerTable = this.el.querySelector('.mel-table-header');
        this.bodyWrapper = this.el.querySelector('.mel-table-body-wrapper');
        this.bodyTable = this.el.querySelector('.mel-table-body');
        this.theadTr = this.headerTable ? this.headerTable.querySelector('thead tr') : null;
        this.tbody = this.bodyTable ? this.bodyTable.querySelector('tbody') : null;

        this._renderColgroup();
        this._applyAppearance();
    };

    /**
     * 渲染 colgroup（列宽控制），手动创建 col 元素兼容 IE9
     * 同时根据列宽总和动态调整 wrapper 宽度
     */
    Renderer.prototype._renderColgroup = function() {
        var columns = this.dataStore.columns;
        var totalWidth = 0;

        for (var i = 0; i < columns.length; i++) {
            totalWidth += columns[i].width || 100;
        }

        // 处理表头 table
        if (this.headerTable !== null && typeof this.headerTable !== 'undefined') {
            var hcg = this.headerTable.querySelector('colgroup');
            if (hcg === null || typeof hcg === 'undefined') {
                hcg = document.createElement('colgroup');
                this.headerTable.insertBefore(hcg, this.headerTable.firstChild);
            }
            this._fillColgroup(hcg, columns);
            this.headerTable.style.width = totalWidth + 'px';
        }

        // 处理表身 table
        if (this.bodyTable !== null && typeof this.bodyTable !== 'undefined') {
            var bcg = this.bodyTable.querySelector('colgroup');
            if (bcg === null || typeof bcg === 'undefined') {
                bcg = document.createElement('colgroup');
                this.bodyTable.insertBefore(bcg, this.bodyTable.firstChild);
            }
            this._fillColgroup(bcg, columns);
            this.bodyTable.style.width = totalWidth + 'px';
        }

        // 动态调整 wrapper 宽度：列宽总和小于容器时，wrapper=table宽度，滚动条紧贴表格
        this._adjustWrapperWidth(totalWidth);
    };

    /**
     * 手动填充 colgroup（不用 innerHTML，兼容 IE9）
     */
    Renderer.prototype._fillColgroup = function(colgroup, columns) {
        // 清空旧 col
        while (colgroup.firstChild) {
            colgroup.removeChild(colgroup.firstChild);
        }
        // 手动创建 col 元素
        for (var i = 0; i < columns.length; i++) {
            var col = document.createElement('col');
            col.style.width = (columns[i].width || 100) + 'px';
            colgroup.appendChild(col);
        }
    };

    /**
     * 动态调整 wrapper 宽度（接入 fitWidth 参数）
     * fitWidth=false：固定列宽模式，使用columns配置的固定px列宽
     * fitWidth=true ：弹性自适应模式，以各列width为权重，按容器宽度分配百分比填满容器
     */
    Renderer.prototype._adjustWrapperWidth = function(totalWidth) {
        if (!this.el) return;

        var opts = this.options;

        // fitWidth=true：弹性自适应，始终填满容器（不看列总宽与容器的比较）
        if (opts.fitWidth) {
            if (this.headerWrapper) this.headerWrapper.style.width = '100%';
            if (this.bodyWrapper) this.bodyWrapper.style.width = '100%';
            if (this.headerTable) this.headerTable.style.width = '100%';
            if (this.bodyTable) this.bodyTable.style.width = '100%';
            // 各列按原列宽比例分配百分比，填满容器
            this._applyFitWidthCols(totalWidth);
            return;
        }

        // fitWidth=false：固定列宽模式，使用columns配置的固定px列宽
        // 用content区域宽度（减去padding）
        var containerWidth = this._getContentWidth(this.el);
        var scrollbarWidth = this._getScrollbarWidth();

        if (totalWidth + scrollbarWidth <= containerWidth) {
            // 列总宽不足容器宽度：wrapper=列总宽+滚动条宽+2px安全余量，表格右侧留白，不出水平滚动条
            var wrapperWidth = totalWidth + scrollbarWidth + 2;
            if (this.headerWrapper) this.headerWrapper.style.width = wrapperWidth + 'px';
            if (this.bodyWrapper) this.bodyWrapper.style.width = wrapperWidth + 'px';
            if (this.headerTable) this.headerTable.style.width = totalWidth + 'px';
            if (this.bodyTable) this.bodyTable.style.width = totalWidth + 'px';
        } else {
            // 列总宽超过容器宽度：wrapper撑满容器，表格保持列总宽，出现水平滚动
            if (this.headerWrapper) this.headerWrapper.style.width = '100%';
            if (this.bodyWrapper) this.bodyWrapper.style.width = '100%';
            if (this.headerTable) this.headerTable.style.width = totalWidth + 'px';
            if (this.bodyTable) this.bodyTable.style.width = totalWidth + 'px';
        }
    };

    /**
     * fitWidth=true 时，把每列宽度改为按原列宽比例分配百分比，填满容器
     */
    Renderer.prototype._applyFitWidthCols = function(totalWidth) {
        if (totalWidth <= 0) return;

        var columns = this.dataStore.columns;
        var percents = [];
        for (var i = 0; i < columns.length; i++) {
            var w = columns[i].width || 100;
            percents.push((w / totalWidth * 100) + '%');
        }

        // 表头 colgroup
        if (this.headerTable) {
            var hcg = this.headerTable.querySelector('colgroup');
            if (hcg) {
                var cols = hcg.children;
                for (var j = 0; j < cols.length && j < percents.length; j++) {
                    cols[j].style.width = percents[j];
                }
            }
        }

        // 表身 colgroup
        if (this.bodyTable) {
            var bcg = this.bodyTable.querySelector('colgroup');
            if (bcg) {
                var cols2 = bcg.children;
                for (var k = 0; k < cols2.length && k < percents.length; k++) {
                    cols2[k].style.width = percents[k];
                }
            }
        }
    };

    /**
     * 获取垂直滚动条宽度（动态创建隐藏div计算，兼容各种浏览器）
     */
    Renderer.prototype._getScrollbarWidth = function() {
        var div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '-9999px';
        div.style.width = '100px';
        div.style.height = '100px';
        div.style.overflow = 'scroll';
        document.body.appendChild(div);
        var width = div.offsetWidth - div.clientWidth;
        document.body.removeChild(div);
        return width;
    };

    /**
     * 获取水平滚动条高度（动态创建隐藏div计算）
     */
    Renderer.prototype._getScrollbarHeight = function() {
        var div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '-9999px';
        div.style.width = '100px';
        div.style.height = '100px';
        div.style.overflow = 'scroll';
        document.body.appendChild(div);
        var height = div.offsetHeight - div.clientHeight;
        document.body.removeChild(div);
        return height;
    };

    /**
     * 应用外观配置
     */
    Renderer.prototype._applyAppearance = function() {
        var opts = this.options;

        if (opts.bordered !== false && this.container) {
            this.container.className += ' mel-table-bordered';
        }
        if (opts.stripe && this.container) {
            this.container.className += ' mel-table-stripe';
        }
        if (opts.hoverHighlight !== false && this.container) {
            this.container.className += ' mel-table-hover';
        }
    };

    /**
     * 获取元素content区域高度（减去padding，兼容IE9）
     */
    Renderer.prototype._getContentHeight = function(el) {
        if (!el) return 0;
        var clientHeight = el.clientHeight;

        // 获取padding
        var paddingTop = 0;
        var paddingBottom = 0;
        if (window.getComputedStyle) {
            var style = window.getComputedStyle(el);
            paddingTop = parseInt(style.paddingTop, 10) || 0;
            paddingBottom = parseInt(style.paddingBottom, 10) || 0;
        } else if (el.currentStyle) {
            paddingTop = parseInt(el.currentStyle.paddingTop, 10) || 0;
            paddingBottom = parseInt(el.currentStyle.paddingBottom, 10) || 0;
        }

        return clientHeight - paddingTop - paddingBottom;
    };

    /**
     * 获取元素content区域宽度（减去padding，兼容IE9）
     */
    Renderer.prototype._getContentWidth = function(el) {
        if (!el) return 0;
        var clientWidth = el.clientWidth;

        var paddingLeft = 0;
        var paddingRight = 0;
        if (window.getComputedStyle) {
            var style = window.getComputedStyle(el);
            paddingLeft = parseInt(style.paddingLeft, 10) || 0;
            paddingRight = parseInt(style.paddingRight, 10) || 0;
        } else if (el.currentStyle) {
            paddingLeft = parseInt(el.currentStyle.paddingLeft, 10) || 0;
            paddingRight = parseInt(el.currentStyle.paddingRight, 10) || 0;
        }

        return clientWidth - paddingLeft - paddingRight;
    };

    /**
     * 强制 el 高度为 auto!important（兼容IE9）
     * 场景：fitViewport=true 或 (fitViewport=false && bodyHeight>0)
     * 作用：忽略外部CSS给el写死的固定高度，让el由内部内容(表头+表身+分页)自然撑开
     */
    Renderer.prototype._forceElAutoHeight = function() {
        if (!this.el) return;

        var css = this.el.style.cssText;
        if (css && css.indexOf('height') === -1) {
            // 用 cssText 拼上 auto!important，兼容IE9（IE9 不认 style.height='auto!important'）
            this.el.style.cssText = css + ';height:auto!important';
        } else if (!css) {
            this.el.style.height = 'auto';
        }
    };

    /**
     * 适配视口：接管body垂直滚动，自动计算el高度并占满视口剩余空间
     */
    Renderer.prototype._fitViewport = function() {
        var self = this;

        // 接管body垂直滚动：保存原始值，强制hidden，保证页面不出现垂直滚动条、表格在一屏内展示
        if (this._bodyOverflow === undefined) {
            this._bodyOverflow = document.body.style.overflowY || document.body.style.overflow || '';
            document.body.style.overflowY = 'hidden';
        }

        // 先计算一次
        this._doFitViewport();
    };

    /**
     * 统一绑定窗口resize（节流）
     * 所有模式都刷新水平宽度(_adjustWrapperWidth)；fitViewport=true时额外刷新垂直高度(_doFitViewport)
     */
    Renderer.prototype._bindResize = function() {
        if (this._resizeBound) return;
        this._resizeBound = true;

        var self = this;
        var timer = null;

        var handler = function() {
            if (timer) return;
            timer = setTimeout(function() {
                timer = null;
                self._handleResize();
            }, 60);
        };

        this._resizeHandler = handler;

        if (window.addEventListener) {
            window.addEventListener('resize', handler, false);
        } else if (window.attachEvent) {
            window.attachEvent('onresize', handler);
        }
    };

    /**
     * 窗口resize实际刷新
     */
    Renderer.prototype._handleResize = function() {
        if (!this.el || !this.bodyWrapper) return;

        // 水平布局刷新（所有模式都需要）
        this._adjustWrapperWidth(this._getTotalWidth());

        // 垂直高度刷新：仅fitViewport=true需要重新按视口计算
        if (this.options.fitViewport) {
            this._doFitViewport();
        }
    };

    /**
     * 实际执行视口适配
     * el目标高度 = 视口高度 - 顶部内容高度(el到视口顶) - 底部预留间隙(viewportBottomGap)
     * 【关键】fitViewport只负责把整套表格组件(表头+表身+组件内分页)放进视口；
     * el后续的外部兄弟元素(result等)不属于表格，不参与高度扣除，由页面正常滚动访问。
     * 同时强制el高度auto!important，忽略外部CSS固定高度，由内容自然撑开。
     */
    Renderer.prototype._doFitViewport = function() {
        if (!this.el) return;

        // 强制 el 高度 auto!important，忽略外部CSS固定高度（如 el{height:300px}）
        this._forceElAutoHeight();

        // 视口高度
        var winHeight = window.innerHeight || document.documentElement.clientHeight;

        // 顶部内容高度 = el到视口顶部的距离
        var top = this.el.getBoundingClientRect().top;

        // 底部预留间隙 = viewportBottomGap（fitViewport模式下el与视口底边之间的空隙，露出body背景色）
        var gap = this.options.viewportBottomGap || 0;

        // el目标border-box总高度 = 视口高度 - 顶部内容高度 - 底部预留间隙
        // 说明：只把"el顶部到视口底部"这段空间分给表格整套组件；el后续外部元素不在视口配额内扣除
        var elTargetBox = winHeight - top - gap;

        this._applyLayout(elTargetBox);
    };

    /**
     * 统一布局推算（唯一一套推算逻辑，不重复）
     * 传入el目标border-box高度，依次推算container和bodyWrapper高度
     * el高度保持auto，由container和分页栏自然撑开
     * @param {Number} elTargetBox el目标border-box总高度
     * 分页扣除逻辑：只要分页不是fixed定位(在普通文档流、与container同级)，都要在el可用高度里预留分页位置；
     * 只有分页fixed(脱离文档流)才不扣除分页高度。
     */
    Renderer.prototype._applyLayout = function(elTargetBox) {
        if (!this.el || !this.container || !this.bodyWrapper) return;
        if (elTargetBox <= 0) return;

        // 读取el的padding和border
        var es = this._getBoxInfo(this.el);

        // el的content区域高度
        var elContent = elTargetBox - es.paddingTop - es.paddingBottom - es.borderTop - es.borderBottom;

        // 分页扣除逻辑：
        // fitViewport=true：无论分页top/bottom/fixed，一律扣除分页高度。
        //   - top/bottom：分页在视口内普通文档流，需要预留位置占位；
        //   - fixed：分页悬浮覆盖视口底部，需为表身底部预留避让高度，否则表身底部行会被fixed分页遮挡。
        // fitViewport=false：仅非fixed分页(top/bottom，与container同级普通流)才扣高度预留位置；fixed脱离文档流不扣。
        // 分页位置由Pagination插件的position参数控制，插件init时已回填到 options._paginationPos
        var fitViewport = this.options.fitViewport;
        var paginationPos = this.options._paginationPos || 'bottom';
        var needSubPagination = fitViewport ? true : (paginationPos !== 'fixed');

        var paginationHeight = 0;
        if (needSubPagination) {
            var paginationDom = this.el.querySelector('.mel-pagination');
            paginationHeight = paginationDom ? paginationDom.offsetHeight : 0;
        }

        // container目标border-box高度 = el content高度 - 分页栏高度
        var containerTargetBox = elContent - paginationHeight;
        if (containerTargetBox <= 0) return;

        this.container.style.boxSizing = 'border-box';
        this.container.style.height = containerTargetBox + 'px';

        // 读取container自己的border
        var cs = this._getBoxInfo(this.container);

        // 表头实际高度：读配置(headerHeight)，不写死数字；配置来自defaults合并结果
        var headerHeight = this.options.headerHeight || 0;

        // bodyWrapper目标border-box高度 = container高度 - container border上下 - 表头高度
        var bodyHeight = containerTargetBox - cs.borderTop - cs.borderBottom - headerHeight;
        if (bodyHeight > 0) {
            this.bodyWrapper.style.height = bodyHeight + 'px';
            this.bodyWrapper.style.overflow = 'auto';
        }
    };

    /**
     * 获取元素的padding和border尺寸（兼容IE9，用currentStyle）
     */
    Renderer.prototype._getBoxInfo = function(el) {
        var info = {
            paddingTop: 0, paddingBottom: 0, borderTop: 0, borderBottom: 0,
            paddingLeft: 0, paddingRight: 0, borderLeft: 0, borderRight: 0
        };

        var s = null;
        if (window.getComputedStyle) {
            s = window.getComputedStyle(el);
        } else if (el.currentStyle) {
            s = el.currentStyle;
        }
        if (!s) return info;

        info.paddingTop = parseInt(s.paddingTop, 10) || 0;
        info.paddingBottom = parseInt(s.paddingBottom, 10) || 0;
        info.borderTop = parseInt(s.borderTopWidth, 10) || 0;
        info.borderBottom = parseInt(s.borderBottomWidth, 10) || 0;
        info.paddingLeft = parseInt(s.paddingLeft, 10) || 0;
        info.paddingRight = parseInt(s.paddingRight, 10) || 0;
        info.borderLeft = parseInt(s.borderLeftWidth, 10) || 0;
        info.borderRight = parseInt(s.borderRightWidth, 10) || 0;

        return info;
    };

    /**
     * 判断元素有没有明确设置高度（不是auto）
     */
    Renderer.prototype._hasExplicitHeight = function(el) {
        if (!el) return false;

        if (el.style.height && el.style.height !== 'auto') return true;

        var height = '';
        if (window.getComputedStyle) {
            height = window.getComputedStyle(el).height;
        } else if (el.currentStyle) {
            height = el.currentStyle.height;
        }

        return height && height !== 'auto' && height !== '';
    };

    /**
     * 调整表身高度入口
     * 优先级：bodyHeight配置 > el明确高度 > 自然展开
     */
    Renderer.prototype._adjustBodyHeight = function() {
        var opts = this.options;

        // bodyHeight传了就固定高度
        if (opts.bodyHeight && opts.bodyHeight > 0) {
            // bodyHeight固定表身时，el高度由表头+表身+分页撑开，强制auto!important，忽略外部固定高度
            this._forceElAutoHeight();
            if (this.bodyWrapper) {
                this.bodyWrapper.style.height = opts.bodyHeight + 'px';
                this.bodyWrapper.style.overflow = 'auto';
            }
            return;
        }

        // el有明确高度：el目标高度=el实际border-box高度，交给统一方法推算
        if (this._hasExplicitHeight(this.el)) {
            this._applyLayout(this.el.offsetHeight);
            return;
        }

        // el高度auto：不设置固定高度，自然展开
    };

    /**
     * 初始化布局（固定列、滚动同步）
     * 无条件绑定表身滚动事件：表身横向滚动时同步表头scrollLeft；
     * fixedLeft>0时额外平移固定列。用事件监听注册，避免onscroll直接赋值被覆盖。
     */
    Renderer.prototype._initLayout = function() {
        if (!this.bodyWrapper) return;

        var self = this;
        var fixedLeft = this.options.fixedLeftColumns || 0;

        var onScroll = function() {
            // 同步表头横向滚动
            if (self.headerWrapper) {
                self.headerWrapper.scrollLeft = this.scrollLeft;
            }

            // 固定列平移（左侧连续N列）
            if (fixedLeft > 0) {
                var offset = -this.scrollLeft;
                var trs = self.tbody ? self.tbody.children : [];
                for (var r = 0; r < trs.length; r++) {
                    var tds = trs[r].children;
                    for (var c = 0; c < fixedLeft && c < tds.length; c++) {
                        tds[c].style.position = 'relative';
                        tds[c].style.left = offset + 'px';
                        tds[c].style.zIndex = '1';
                    }
                }

                var ths = self.theadTr ? self.theadTr.children : [];
                for (var i = 0; i < fixedLeft && i < ths.length; i++) {
                    ths[i].style.position = 'relative';
                    ths[i].style.left = offset + 'px';
                    ths[i].style.zIndex = '2';
                }
            }
        };

        // 保存handler引用，destroy时移除
        this._bodyScrollHandler = onScroll;

        if (this.bodyWrapper.addEventListener) {
            this.bodyWrapper.addEventListener('scroll', onScroll, false);
        } else if (this.bodyWrapper.attachEvent) {
            this.bodyWrapper.attachEvent('onscroll', onScroll);
        }
    };

    /**
     * 渲染表头
     */
    Renderer.prototype._renderHeader = function() {
        if (!this.theadTr) return;

        var html = '';
        var columns = this.dataStore.columns;
        var sortField = this.dataStore.sortField;
        var sortOrder = this.dataStore.sortOrder;

        for (var i = 0; i < columns.length; i++) {
            var col = columns[i];
            var title = col.title || '';
            var subtitle = col.subtitle || '';
            var align = col.align || 'center';
            var alignClass = 'mel-align-' + align;

            var arrow = '';
            if (col.field === sortField && sortOrder) {
                arrow = '<span class="mel-sort-arrow" style="margin-left:4px;font-size:10px;color:#409eff;">' + (sortOrder === 'asc' ? '▲' : '▼') + '</span>';
            }

            // 多选列表头全选 checkbox
            var thContent = '';
            if (col.field === '_checkbox' && this.options.showSelectAll !== false) {
                thContent = '<input type="checkbox" class="mel-header-checkbox">';
            } else {
                thContent = '<div class="mel-th-inner">';
                thContent += '<span class="mel-th-title">' + title + '</span>';
                if (subtitle) {
                    thContent += '<em class="mel-th-subtitle">' + subtitle + '</em>';
                }
                thContent += arrow;
                thContent += '</div>';
            }

            html += '<th class="' + alignClass + '" data-field="' + (col.field || '') + '">';
            html += thContent;
            html += '</th>';
        }

        this.theadTr.innerHTML = html;

        // 表头高度由配置 headerHeight 控制（不写死数字，读defaults合并后的配置）
        if (this.headerWrapper) {
            var headerH = this.options.headerHeight || 0;
            this.headerWrapper.style.height = headerH + 'px';
            this.headerWrapper.style.boxSizing = 'border-box';
        }

        // 绑定表头全选 checkbox 事件
        var headerCheckbox = this.theadTr.querySelector('.mel-header-checkbox');
        if (headerCheckbox) {
            var self = this;
            headerCheckbox.onclick = function(e) {
                var event = e || window.event;
                event.cancelBubble = true;
                var checked = this.checked;
                self.dataStore.selectAll(checked);
                self.eventBus.emit('selectChange', {
                    selectedRows: self.dataStore.getSelectedRows()
                });
            };
        }
    };

    /**
     * 渲染表身（只渲染当前页的数据）
     */
    Renderer.prototype._renderBody = function() {
        if (!this.tbody) return;

        var rows = this.dataStore.getVisibleRows();
        var html = '';

        for (var i = 0; i < rows.length; i++) {
            html += this._renderRowHtml(rows[i]);
        }

        this.tbody.innerHTML = html;
        this._cacheRowNodes();

        this.eventBus.emit('summaryRequest');
    };

    /**
     * 渲染单行 HTML
     */
    Renderer.prototype._renderRowHtml = function(rowData) {
        var columns = this.dataStore.columns;
        // 行高由配置 rowHeight 控制（不写死数字，读defaults合并后的配置）
        var rowH = this.options.rowHeight || 0;
        var html = '<tr data-row-index="' + rowData._rowIndex + '" style="height:' + rowH + 'px;">';

        for (var i = 0; i < columns.length; i++) {
            var col = columns[i];
            var value = rowData[col.field] !== undefined ? rowData[col.field] : '';
            var align = col.align || 'center';
            var alignClass = 'mel-align-' + align;

            var renderer = this._renderers[col.renderer] || this._renderers.text;
            var cellContent = renderer(value, col, rowData);

            html += '<td class="' + alignClass + '" data-field="' + (col.field || '') + '" data-row-index="' + rowData._rowIndex + '" style="height:' + rowH + 'px;">';
            html += cellContent;
            html += '</td>';
        }

        html += '</tr>';
        return html;
    };

    /**
     * 缓存每行 DOM 节点引用
     */
    Renderer.prototype._cacheRowNodes = function() {
        if (!this.tbody) return;

        var trs = this.tbody.children;
        var visibleRows = this.dataStore.getVisibleRows();
        for (var i = 0; i < trs.length; i++) {
            if (visibleRows[i]) {
                visibleRows[i]._node = trs[i];
            }
        }
    };

    /**
     * 画合计行
     */
    Renderer.prototype._renderSummaryRow = function(sums) {
        if (!this.tbody) return;

        var oldRows = this.tbody.querySelectorAll('.mel-summary-row');
        for (var i = 0; i < oldRows.length; i++) {
            if (oldRows[i].parentNode) {
                oldRows[i].parentNode.removeChild(oldRows[i]);
            }
        }

        if (!sums) return;

        var columns = this.dataStore.columns;
        var html = '<tr class="mel-summary-row">';

        for (var c = 0; c < columns.length; c++) {
            var col = columns[c];
            var cellHtml = '';

            if (sums.titleColumn === c) {
                cellHtml = '<strong>' + (sums.title || '合计') + '</strong>';
            } else if (sums.data[col.field] !== undefined && !isNaN(sums.data[col.field])) {
                cellHtml = '<strong>' + sums.data[col.field].toFixed(2) + '</strong>';
            }

            html += '<td>' + cellHtml + '</td>';
        }

        html += '</tr>';

        if (this.tbody.insertAdjacentHTML) {
            this.tbody.insertAdjacentHTML('beforeend', html);
        } else {
            var tempTable = document.createElement('table');
            tempTable.innerHTML = '<tbody>' + html + '</tbody>';
            var tr = tempTable.getElementsByTagName('tr')[0];
            if (tr) this.tbody.appendChild(tr);
        }
    };

    /**
     * 刷新选中行的勾选状态
     */
    Renderer.prototype._refreshSelectedStates = function() {
        var rows = this.dataStore.rows;
        for (var i = 0; i < rows.length; i++) {
            if (rows[i]._node) {
                var checkbox = rows[i]._node.querySelector('.mel-cell-checkbox');
                if (checkbox) {
                    checkbox.checked = rows[i]._selected;
                }
            }
        }
    };

    /**
     * 只重绘某行
     */
    Renderer.prototype.renderRow = function(rowIndex) {
        var row = this.dataStore.getRow(rowIndex);
        if (!row || !this.tbody) return;

        var html = this._renderRowHtml(row);
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        var newTr = tempDiv.firstChild;

        if (row._node && row._node.parentNode) {
            this.tbody.replaceChild(newTr, row._node);
            row._node = newTr;
        } else {
            this.tbody.appendChild(newTr);
            row._node = newTr;
        }
    };

    /**
     * 只重绘某格
     */
    Renderer.prototype.renderCell = function(rowIndex, field) {
        var row = this.dataStore.getRow(rowIndex);
        if (!row || !row._node) return;

        var columns = this.dataStore.columns;
        var td = row._node.querySelector('td[data-field="' + field + '"]');
        if (!td) return;

        var col = null;
        for (var i = 0; i < columns.length; i++) {
            if (columns[i].field === field) {
                col = columns[i];
                break;
            }
        }
        if (!col) return;

        var value = row[field] !== undefined ? row[field] : '';
        var renderer = this._renderers[col.renderer] || this._renderers.text;
        td.innerHTML = renderer(value, col, row);
    };

    /**
     * 绑定事件（事件委托）
     */
    Renderer.prototype._bindEvents = function() {
        if (!this.tbody || !this.theadTr) return;

        var self = this;

        this.tbody.onclick = function(e) {
            var event = e || window.event;
            var target = event.target || event.srcElement;

            var td = self._findParent(target, 'TD');
            if (!td) return;

            var rowIndex = parseInt(td.getAttribute('data-row-index'));
            var field = td.getAttribute('data-field');
            var rowData = self.dataStore.getRow(rowIndex);

            if (!rowData) return;

            self.eventBus.emit('cellClick', {
                rowData: rowData,
                cell: {rowIndex: rowIndex, field: field, element: td}
            });
            self.eventBus.emit('rowClick', {rowData: rowData, rowIndex: rowIndex});
        };

        // 输入变化（带类型过滤）
        this.tbody.oninput = function(e) {
            var event = e || window.event;
            var target = event.target || event.srcElement;

            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;

            var td = self._findParent(target, 'TD');
            if (!td) return;

            var rowIndex = parseInt(td.getAttribute('data-row-index'));
            var field = td.getAttribute('data-field');

            var columns = self.dataStore.columns;
            var col = null;
            for (var i = 0; i < columns.length; i++) {
                if (columns[i].field === field) {
                    col = columns[i];
                    break;
                }
            }

            var newValue = target.value;
            if (col && col.type) {
                newValue = self._filterInputValue(newValue, col.type);
                if (target.value !== newValue) {
                    target.value = newValue;
                }
            }

            var oldValue = self.dataStore.getCell(rowIndex, field);

            self.dataStore.setCell(rowIndex, field, newValue);
            self.eventBus.emit('cellChange', {
                rowIndex: rowIndex, field: field,
                newValue: newValue, oldValue: oldValue
            });
        };

        // IE9 propertychange 兼容
        if (window.attachEvent) {
            this.tbody.attachEvent('onpropertychange', function(e) {
                var event = e || window.event;
                var target = event.target || event.srcElement;

                if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
                if (event.propertyName !== 'value') return;

                var td = self._findParent(target, 'TD');
                if (!td) return;

                var rowIndex = parseInt(td.getAttribute('data-row-index'));
                var field = td.getAttribute('data-field');

                var columns = self.dataStore.columns;
                var col = null;
                for (var i = 0; i < columns.length; i++) {
                    if (columns[i].field === field) {
                        col = columns[i];
                        break;
                    }
                }

                var newValue = target.value;
                if (col && col.type) {
                    newValue = self._filterInputValue(newValue, col.type);
                    if (target.value !== newValue) {
                        target.value = newValue;
                    }
                }

                var oldValue = self.dataStore.getCell(rowIndex, field);

                self.dataStore.setCell(rowIndex, field, newValue);
                self.eventBus.emit('cellChange', {
                    rowIndex: rowIndex, field: field,
                    newValue: newValue, oldValue: oldValue
                });
            });
        }

        this.theadTr.onclick = function(e) {
            var event = e || window.event;
            var target = event.target || event.srcElement;

            var th = self._findParent(target, 'TH');
            if (!th) return;

            var field = th.getAttribute('data-field');
            if (!field) return;

            self.eventBus.emit('headerClick', {field: field});
        };
    };

    /**
     * 过滤输入值（根据类型）
     */
    Renderer.prototype._filterInputValue = function(value, type) {
        if (type === 'int') {
            value = value.replace(/[^\d-]/g, '');
            var minusIdx = value.indexOf('-');
            if (minusIdx > 0) value = value.replace(/-/g, '');
        } else if (type === 'float') {
            value = value.replace(/[^\d.-]/g, '');
            var minusIdx = value.indexOf('-');
            if (minusIdx > 0) value = value.replace(/-/g, '');
            var dotCount = value.split('.').length - 1;
            if (dotCount > 1) {
                var firstDot = value.indexOf('.');
                value = value.substring(0, firstDot + 1) + value.substring(firstDot + 1).replace(/\./g, '');
            }
        }
        return value;
    };

    /**
     * 销毁清理：移除window.resize、表身scroll监听，恢复body overflow-y，清空容器DOM
     */
    Renderer.prototype._destroy = function() {
        // 移除window.resize监听
        if (this._resizeBound && this._resizeHandler) {
            if (window.removeEventListener) {
                window.removeEventListener('resize', this._resizeHandler);
            } else if (window.detachEvent) {
                window.detachEvent('onresize', this._resizeHandler);
            }
            this._resizeBound = false;
            this._resizeHandler = null;
        }

        // 移除表身scroll监听
        if (this.bodyWrapper && this._bodyScrollHandler) {
            if (this.bodyWrapper.removeEventListener) {
                this.bodyWrapper.removeEventListener('scroll', this._bodyScrollHandler);
            } else if (this.bodyWrapper.detachEvent) {
                this.bodyWrapper.detachEvent('onscroll', this._bodyScrollHandler);
            }
            this._bodyScrollHandler = null;
        }

        // 恢复body原始overflow-y（fitViewport=true接管过才需要恢复）
        if (this._bodyOverflow !== undefined) {
            document.body.style.overflowY = this._bodyOverflow;
            this._bodyOverflow = undefined;
        }

        // 清空容器DOM
        if (this.el) {
            this.el.innerHTML = '';
        }
    };

    /**
     * 向上查找父元素
     */
    Renderer.prototype._findParent = function(node, tagName) {
        while (node && node.tagName !== tagName) {
            node = node.parentNode;
        }
        return node;
    };

    MelUi.Table = MelUi.Table || {};
    MelUi.Table.Renderer = Renderer;

})(window.MelUi = window.MelUi || {});

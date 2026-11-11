/**
 * MelUi Table 表格组件 - 核心渲染器
 * 负责根据 DataStore 数据渲染表头和表身 DOM，所有 DOM 操作统一在此
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.8.15
 * @Date：2026-10-10
 * @PubDate：2026-11-11 17:18:38
 */

 (function(MelUi) {

    /**
     * Renderer 构造函数
     * @param {Object} options 配置项
     * @param {Object} dataStore DataStore 实例
     * @param {Object} eventBus EventBus 实例
     * @param {Object} table TableCore 实例（可选）。供 extraBefore/extraAfter 的函数形态取用表格状态
     */
    function Renderer(options, dataStore, eventBus, table) {
        this.options = options;
        this.dataStore = dataStore;
        this.eventBus = eventBus;
        this.table = table || null;
        this.el = typeof options.el === 'string' ? document.querySelector(options.el) : options.el;
        this.isRenderComplete = false;

        // extraBefore / extraAfter 渲染出的区块节点引用（未配置时为空）
        this.extraBeforeWrap = null;
        this.extraAfterWrap = null;

        // 表头固定列缓存（合并表头时是「覆盖前N列的th列表」，滚动同步复用）
        this._headerFixedCells = [];

        // 是否启用排序能力：由 Sort 插件 init 时置 true。
        // 未启用时表头不显示可排序光标（pointer），避免“点了没反应”的误导。
        this.sortEnabled = false;

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
            self._applyFixedColumns();
        });

        this.eventBus.on('rowDelete', function() {
            if (!self.isRenderComplete) return;
            self._renderBody();
            self._applyFixedColumns();
        });

        this.eventBus.on('pageChange', function() {
            if (!self.isRenderComplete) return;
            self._renderBody();
            self._applyFixedColumns();
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
            // 初始应用固定列样式（固定列走 renderer 内置，Layout 插件未启用时此方法生效）
            self._applyFixedColumns();

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

        // rendered 事件载荷：只对外给只读快照，不暴露 DataStore 实例，
        // 避免业务拿到ds后绕开表格对外API直接改数据源，破坏封装。
        // 字段口径：
        //   rows     = 本次实际渲染的行（即 getVisibleRows 结果，含当前页临时追加的新增行）
        //   total    = 统一走 getEffectiveTotal()，与分页栏展示总数同口径
        //              （remotePaging + enableRemotePagingFallback 的矫正规则都在该方法内，此处不重复推导）
        //   pageNo   = 当前页码，内部字段是 currentPage，对外统一叫 pageNo，与 pageChange 事件命名对应
        //   pageSize = 每页条数
        // 注意：rows 里每一项都是【纯业务字段副本】（已剥离 _rowIndex/_rowId/_status/_node 等内部字段），
        // 修改副本不会影响表格数据源；需要按 rowId 定位原始行请用 table.getRowById()。
        var ds = this.dataStore;
        var visibleRows = ds.getVisibleRows();
        var renderInfo = {
            rows: ds.getPlainRows(visibleRows),
            total: ds.getEffectiveTotal(),
            pageNo: ds.currentPage,
            pageSize: ds.pageSize
        };
        this.eventBus.emit('rendered', renderInfo);
    };

    /**
     * 判断某列是否被隐藏（列配置 visible:false）
     * 隐藏列只是界面上不显示：th / td 照常渲染进 DOM（F12 可见），
     * 靠 mel-col-hidden 类 display:none + colgroup 列宽置 0 让它不占可见宽度，
     * 这样列数据、列配置、导出能力全部保留，可随时用 setColumnVisible 切回来。
     * @param {Object} col 列配置
     * @return {Boolean}
     */
    Renderer.prototype._isColHidden = function(col) {
        return !!(col && col.visible === false);
    };

    /**
     * 获取列宽总和（隐藏列按 0 参与，避免表格右侧多出空白）
     */
    Renderer.prototype._getTotalWidth = function() {
        var totalWidth = 0;
        for (var i = 0; i < this.dataStore.columns.length; i++) {
            var col = this.dataStore.columns[i];
            if (this._isColHidden(col)) continue;
            totalWidth += col.width || 100;
        }
        return totalWidth;
    };

    /**
     * 解析 extraBefore / extraAfter 配置，得到待渲染的 html 字符串
     * 支持两种形态：
     *   String  ：直接作为 html 使用；
     *   Function：以表格实例为参数调用，取其返回值作为 html。
     * 返回 '' / null / undefined 均视为“不渲染该区块”，不会输出空容器。
     * 注意：函数形态每次 render 都会重新执行，函数内如有重计算或高频渲染，性能由业务自行控制。
     * @param {String|Function} extra 配置值
     * @return {String} 待渲染 html，空字符串表示不渲染
     */
    Renderer.prototype._resolveExtraHtml = function(extra) {
        if (!extra) return '';

        if (typeof extra === 'function') {
            var ret = extra(this.table);
            if (ret === null || ret === undefined) return '';
            return String(ret);
        }

        return String(extra);
    };

    /**
     * 构建额外区块 html（带包裹容器）
     * @param {String|Function} extra 配置值
     * @param {String} className 包裹容器的样式类
     * @return {String} 完整区块 html，无内容时返回空字符串
     */
    Renderer.prototype._buildExtraBlock = function(extra, className) {
        var content = this._resolveExtraHtml(extra);
        if (!content) return '';
        return '<div class="' + className + '">' + content + '</div>';
    };

    /**
     * 渲染外层容器结构
     * extraBefore / extraAfter 与表头、表身同处 mel-table-container 内部（before → 表头 → 表身 → after）：
     *   - 同属一个父容器的普通文档流，宽度天然跟随表格，无需额外同步；
     *   - 不属于表头、表体，不参与列对齐、固定列、排序、选中、合并表头等任何表格逻辑；
     *   - 区块内如果放了按钮等交互 DOM，事件由业务自行绑定，组件不做代理。
     */
    Renderer.prototype._renderContainer = function() {
        var beforeHtml = this._buildExtraBlock(this.options.extraBefore, 'mel-table-extra-wrapper mel-table-extra-before-wrapper');
        var afterHtml = this._buildExtraBlock(this.options.extraAfter, 'mel-table-extra-wrapper mel-table-extra-after-wrapper');

        var lines = ['<div class="mel-table-container">'];

        // 无内容时不输出该行，不产生多余的空白区块
        if (beforeHtml) lines.push('  ' + beforeHtml);

        lines.push('  <div class="mel-table-header-wrapper">');
        lines.push('    <table class="mel-table-header">');
        lines.push('      <colgroup></colgroup>');
        lines.push('      <thead><tr></tr></thead>');
        lines.push('    </table>');
        lines.push('  </div>');
        lines.push('  <div class="mel-table-body-wrapper">');
        lines.push('    <table class="mel-table-body">');
        lines.push('      <colgroup></colgroup>');
        lines.push('      <tbody></tbody>');
        lines.push('    </table>');
        lines.push('  </div>');

        if (afterHtml) lines.push('  ' + afterHtml);

        lines.push('</div>');

        this.el.innerHTML = lines.join('\r\n');

        this.container = this.el.querySelector('.mel-table-container');
        this.headerWrapper = this.el.querySelector('.mel-table-header-wrapper');
        this.headerTable = this.el.querySelector('.mel-table-header');
        this.bodyWrapper = this.el.querySelector('.mel-table-body-wrapper');
        this.bodyTable = this.el.querySelector('.mel-table-body');
        this.theadTr = this.headerTable ? this.headerTable.querySelector('thead tr') : null;
        // thead 是整个表头行容器：多级表头时有多行，表头点击统一绑在它上面（它本身不随表头重绘被替换）
        this.thead = this.headerTable ? this.headerTable.querySelector('thead') : null;
        this.tbody = this.bodyTable ? this.bodyTable.querySelector('tbody') : null;
        this.extraBeforeWrap = this.container ? this.container.querySelector('.mel-table-extra-before-wrapper') : null;
        this.extraAfterWrap = this.container ? this.container.querySelector('.mel-table-extra-after-wrapper') : null;

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
            if (this._isColHidden(columns[i])) continue;
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
            // 隐藏列宽置 0：col 个数与单元格个数保持一一对应（表头 colspan / 表身对齐不乱），
            // 但该列不占可见宽度，视觉上等于消失
            col.style.width = this._isColHidden(columns[i]) ? '0px' : (columns[i].width || 100) + 'px';
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

        // 第一步：先确定 bodyWrapper（滚动容器）的宽度作为基准
        if (opts.fitWidth) {
            // fitWidth=true：列宽自适应。先判断列宽总和与容器宽度：
            //  - 列宽总和 <= 容器宽度：按权重弹性拉伸填满容器
            //  - 列宽总和 > 容器宽度：不拉伸，使用各列原始width，出现横向滚动条
            var fwContainer = this._getContentWidth(this.el);
            if (totalWidth <= fwContainer) {
                if (this.bodyWrapper) this.bodyWrapper.style.width = '100%';
            } else {
                // 列总宽超过容器：与固定列宽模式一致，wrapper撑满容器，出现水平滚动
                if (this.bodyWrapper) this.bodyWrapper.style.width = '100%';
            }
        } else {
            // 固定列宽模式
            var containerWidth = this._getContentWidth(this.el);
            var scrollbarWidth = this._getScrollbarWidth();
            if (totalWidth + scrollbarWidth <= containerWidth) {
                // 列总宽不足容器宽度：wrapper=列总宽+滚动条宽+2px安全余量，右侧留白，不出水平滚动条
                var wrapperWidth = totalWidth + scrollbarWidth + 2;
                if (this.bodyWrapper) this.bodyWrapper.style.width = wrapperWidth + 'px';
            } else {
                // 列总宽超过容器宽度：wrapper撑满容器，出现水平滚动
                if (this.bodyWrapper) this.bodyWrapper.style.width = '100%';
            }
        }

        // 第二步：以 bodyWrapper 的实际可视宽度(clientWidth，已扣除垂直滚动条)为对齐基准。
        // 表头 wrapper 与表头 table 均与表身可视宽度一致，保证两 table 列宽基准相同，杜绝错行。
        var bodyClientWidth = this.bodyWrapper ? this.bodyWrapper.clientWidth : 0;

        if (this.headerWrapper) {
            this.headerWrapper.style.width = (bodyClientWidth > 0 ? bodyClientWidth + 'px' : '100%');
        }

        // 表头宽度定下来后立刻同步 extra 区块宽度（fitWidth 分支会在下面提前 return，这里不能漏）
        this._syncExtraWidth();

        if (opts.fitWidth) {
            // 判断列宽总和是否 <= 容器宽度，决定是否弹性拉伸
            var fitContainer = this._getContentWidth(this.el);
            if (totalWidth <= fitContainer) {
                // 拉伸填满容器：表头表身 table 都以 bodyClientWidth 为基准，百分比列宽基准一致
                if (this.headerTable) this.headerTable.style.width = (bodyClientWidth > 0 ? bodyClientWidth + 'px' : '100%');
                if (this.bodyTable) this.bodyTable.style.width = (bodyClientWidth > 0 ? bodyClientWidth + 'px' : '100%');
                // 各列按原列宽比例分配百分比，填满容器
                this._applyFitWidthCols(totalWidth);
            } else {
                // 列宽总和大于容器：不拉伸，使用各列原始width，保持列总宽并出现横向滚动
                if (this.headerTable) this.headerTable.style.width = totalWidth + 'px';
                if (this.bodyTable) this.bodyTable.style.width = totalWidth + 'px';
                // 恢复 colgroup 为固定 px 列宽（避免残留拉伸时的百分比）
                this._resetColgroupPx();
            }
            return;
        }

        // 固定列宽：表头表身 table 都保持列总宽 totalWidth
        if (this.headerTable) this.headerTable.style.width = totalWidth + 'px';
        if (this.bodyTable) this.bodyTable.style.width = totalWidth + 'px';
    };

    /**
     * fitWidth=true 时，把每列宽度改为按原列宽比例分配百分比，填满容器
     */
    Renderer.prototype._applyFitWidthCols = function(totalWidth) {
        if (totalWidth <= 0) return;

        var columns = this.dataStore.columns;
        var percents = [];
        for (var i = 0; i < columns.length; i++) {
            // 隐藏列不参与弹性分配，宽度固定为 0
            if (this._isColHidden(columns[i])) {
                percents.push('0px');
                continue;
            }
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
     * 重置表头表身 colgroup 各列为固定 px 列宽（fitWidth 不拉伸时调用）
     * 防止残留 fitWidth 拉伸时设置的百分比宽度。
     */
    Renderer.prototype._resetColgroupPx = function() {
        var columns = this.dataStore.columns;
        var i, j;

        if (this.headerTable) {
            var hcg = this.headerTable.querySelector('colgroup');
            if (hcg) {
                var hcols = hcg.children;
                for (i = 0; i < hcols.length && i < columns.length; i++) {
                    hcols[i].style.width = this._isColHidden(columns[i]) ? '0px' : (columns[i].width || 100) + 'px';
                }
            }
        }

        if (this.bodyTable) {
            var bcg = this.bodyTable.querySelector('colgroup');
            if (bcg) {
                var bcols = bcg.children;
                for (j = 0; j < bcols.length && j < columns.length; j++) {
                    bcols[j].style.width = this._isColHidden(columns[j]) ? '0px' : (columns[j].width || 100) + 'px';
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
            paginationHeight = this._getOuterHeight(paginationDom);
        }

        // extraBefore / extraAfter 现在位于 mel-table-container 内部（el content = container + 分页），
        // 因此这里只扣分页栏高度；上下额外区块的高度由 _applyContainerHeight 在 container 内部扣给表身。
        var containerTargetBox = elContent - paginationHeight;
        if (containerTargetBox <= 0) return;

        this._applyContainerHeight(containerTargetBox);

        // 实测校正：上面的高度是推算值，margin折叠、字体度量、滚动条出现与否都可能让
        // el实际总高度与目标差几个像素。应用后实测一次，超出就把差值回收到 container 上。
        // 只校正一轮：校正后再测通常已落回目标，重复校正反而会抖动。
        if (!this._layoutCorrecting) {
            var actualHeight = this.el.offsetHeight;
            var overflow = actualHeight - elTargetBox;
            if (overflow > 0) {
                this._layoutCorrecting = true;
                this._applyContainerHeight(containerTargetBox - overflow);
                this._layoutCorrecting = false;
            }
        }
    };

    /**
     * 按目标高度设置 container / bodyWrapper 高度（_applyLayout 唯一落地点）
     * @param {Number} containerTargetBox container目标border-box高度
     */
    Renderer.prototype._applyContainerHeight = function(containerTargetBox) {
        if (!this.container || !this.bodyWrapper) return;
        if (containerTargetBox <= 0) return;

        this.container.style.boxSizing = 'border-box';
        this.container.style.height = containerTargetBox + 'px';

        // 读取container自己的border
        var cs = this._getBoxInfo(this.container);

        // 表头实际高度：headerHeight 为'auto'时读表头实际渲染高度；为数值时用指定值
        // 配置来自defaults合并结果，不写死数字
        var headerHeight = this.options.headerHeight;
        if (!(typeof headerHeight === 'number' && !isNaN(headerHeight))) {
            headerHeight = this.headerWrapper ? this.headerWrapper.offsetHeight : 0;
        }

        // extraBefore / extraAfter 在 container 内部，占地必须先从 container 高度里扣掉。
        // 【关键】用 _getOuterHeight（offsetHeight + 上下 margin）：offsetHeight 不含外边距，
        // 而 .mel-table-extra-before-wrapper / .mel-table-extra-after-wrapper 各带 8px margin，只减 offsetHeight 会稳定溢出 16px。
        var extraHeight = this._getOuterHeight(this.extraBeforeWrap) + this._getOuterHeight(this.extraAfterWrap);

        // bodyWrapper目标border-box高度 = container高度 - container border上下 - 表头高度 - 上下额外区块高度
        var bodyHeight = containerTargetBox - cs.borderTop - cs.borderBottom - headerHeight - extraHeight;
        if (bodyHeight > 0) {
            this.bodyWrapper.style.height = bodyHeight + 'px';
            this.bodyWrapper.style.overflow = 'auto';
        }

        // 表身高变化后，垂直滚动条可能出现/消失，导致 bodyClientWidth 变化；
        // 重新对齐表头 wrapper 宽度到 bodyWrapper.clientWidth，保证表头表身不错行
        this._syncHeaderWidth();
    };

    /**
     * 取元素「外框高度」：offsetHeight + 上下外边距
     * 用途：高度扣减必须包含 margin，否则带 margin 的区块会稳定溢出。
     * 兼容IE9：无 getComputedStyle 时退化用 currentStyle
     * @param {Element} el 目标元素
     * @return {Number} 元素占据的垂直高度（含 margin），元素不存在返回 0
     */
    Renderer.prototype._getOuterHeight = function(el) {
        if (!el) return 0;

        var h = el.offsetHeight || 0;
        var marginTop = 0;
        var marginBottom = 0;

        if (window.getComputedStyle) {
            var style = window.getComputedStyle(el);
            marginTop = parseInt(style.marginTop, 10) || 0;
            marginBottom = parseInt(style.marginBottom, 10) || 0;
        } else if (el.currentStyle) {
            marginTop = parseInt(el.currentStyle.marginTop, 10) || 0;
            marginBottom = parseInt(el.currentStyle.marginBottom, 10) || 0;
        }

        return h + marginTop + marginBottom;
    };

    /**
     * 给表头 table 打/去「多行表头」标记（mel-header-multi）
     * @param {Boolean} isMulti 是否多行表头
     */
    Renderer.prototype._setMultiHeaderFlag = function(isMulti) {
        if (!this.headerTable) return;

        var cls = ' ' + this.headerTable.className + ' ';
        var has = cls.indexOf(' mel-header-multi ') > -1;

        if (isMulti && !has) {
            this.headerTable.className += ' mel-header-multi';
        } else if (!isMulti && has) {
            this.headerTable.className = cls.replace(' mel-header-multi ', ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
        }
    };

    /**
     * 同步表头 wrapper 宽度与表身可视宽度一致（已扣除垂直滚动条）
     * 表头表身是两个独立 table，靠列宽基准一致对齐；表身有垂直滚动条会吃掉右侧可视宽度，
     * 表头必须跟随 bodyWrapper.clientWidth，否则水平滚动/自适应时错行。
     */
    Renderer.prototype._syncHeaderWidth = function() {
        if (!this.headerWrapper || !this.bodyWrapper) return;
        var cw = this.bodyWrapper.clientWidth;
        if (cw > 0) {
            // 表头 wrapper 与表身可视宽度对齐
            this.headerWrapper.style.width = cw + 'px';
            // fitWidth=true 时，表头表身 table 也以当前 bodyClientWidth 为基准重设，
            // 使垂直滚动条出现/消失导致的基准变化同步到两 table，杜绝错行
            if (this.options.fitWidth) {
                if (this.headerTable) this.headerTable.style.width = cw + 'px';
                if (this.bodyTable) this.bodyTable.style.width = cw + 'px';
            }
        }
        // extra 区块跟着表头宽度走，保证右边界与表头齐平
        this._syncExtraWidth();
    };

    /**
     * 同步 extraBefore / extraAfter 的宽度 = 表头 wrapper 可视宽度
     * 原因：extra 区块是 el 的直接子元素，默认撑满 el；而表头 wrapper 宽度是
     * bodyWrapper.clientWidth（已扣除垂直滚动条、且固定列宽模式下还可能比 el 窄），
     * 两者不等宽时 extra 内容会越过表头右边界，视觉割裂。
     * 这里统一以表头 wrapper 可视宽度为准（表头 wrapper 有背景与下边框，是最直观的右边界）。
     */
    Renderer.prototype._syncExtraWidth = function() {
        if (!this.headerWrapper) return;

        var w = this.headerWrapper.clientWidth;
        if (w <= 0) return;

        if (this.extraBeforeWrap) {
            this.extraBeforeWrap.style.width = w + 'px';
        }
        if (this.extraAfterWrap) {
            this.extraAfterWrap.style.width = w + 'px';
        }
    };

    /**
     * 应用固定列样式到当前表头/表身的固定列 td/th
     * 仅设置样式(相对定位、z-index、背景、当前left)，不重复绑定滚动事件。
     * 在 render 初始、翻页、增删行(_renderBody)后调用，保证重建后的固定列样式不丢失。
     * 【背景色关键】冻结 td 不能写死固定色，必须实时取所属行 tr 的实际渲染背景色
     * (含斑马纹、hover)，否则下层滚动内容会穿透，且行间颜色不一致。
     */
    /**
     * 取出表头中「覆盖前 count 列」的全部 th
     * 合并表头有多行，且有 colspan（分组）、rowspan（浅层列/非分组列），
     * 所以要按网格推演每个 th 的实际起始列，再挑出起始列 < count 的那些。
     * 单级表头时等价于「该行前 count 个 th」，行为与改造前完全一致。
     * @param {Number} count 固定列数量（从第1列开始连续 count 列）
     * @return {Array} th 列表
     */
    Renderer.prototype._getFixedHeaderCells = function(count) {
        var result = [];
        var rows = this.theadTrs;

        // 固定列数量按「可见列」计：隐藏列已不占可见宽度，不能吃掉固定列的坑位。
        // 用列配置的前缀可见列计数，把网格原始列号换算成可见列号。
        var colsCfg = (this.dataStore && this.dataStore.columns) || [];
        var pre = [];
        var vis = 0;
        for (var n = 0; n <= colsCfg.length; n++) {
            pre[n] = vis;
            if (n < colsCfg.length && !this._isColHidden(colsCfg[n])) vis++;
        }

        if (!rows || !rows.length) {
            // 兜底：没有多行引用时退化为单行前 count 个可见列（如插件在表头未渲染时调用）
            if (this.theadTr) {
                var single = this.theadTr.children;
                var picked = 0;
                for (var k = 0; k < single.length && picked < count; k++) {
                    if (this._isHiddenCell(single[k])) continue;
                    result.push(single[k]);
                    picked++;
                }
            }
            return result;
        }

        // 网格推演：逐行逐格计算起始列，被上方 rowspan 占用的列跳过
        var placed = [];
        for (var r = 0; r < rows.length; r++) {
            var cells = rows[r].children;
            var col = 0;
            for (var c = 0; c < cells.length; c++) {
                var th = cells[c];
                var colspan = parseInt(th.getAttribute('colspan'), 10) || 1;
                var rowspan = parseInt(th.getAttribute('rowspan'), 10) || 1;

                while (this._isColumnOccupied(placed, r, col)) {
                    col++;
                }

                placed.push({row: r, col: col, colspan: colspan, rowspan: rowspan, th: th});
                col += colspan;
            }
        }

        for (var i = 0; i < placed.length; i++) {
            // 单元格起始列的「可见列序号」小于 count 才算固定列；隐藏单元格本身不参与固定
            var visibleStart = pre[placed[i].col] === undefined ? placed[i].col : pre[placed[i].col];
            if (visibleStart < count && !this._isHiddenCell(placed[i].th)) {
                result.push(placed[i].th);
            }
        }
        return result;
    };

    /**
     * 取某一行需要冻结的单元格
     * 固定列数量一律按「可见列」计：隐藏列已不占可见宽度，跳过它继续数，
     * 否则隐藏列会白吃一个固定坑位，导致后面的列没被固定、滚动时压住固定内容。
     * 首次渲染、滚动同步、hover 换背景三处必须共用这一个口径，不能各写一套。
     * @param {Element} tr 行节点
     * @param {Number} count 需要冻结的可见列数
     * @return {Array} td 列表
     */
    Renderer.prototype._getFixedBodyCells = function(tr, count) {
        var result = [];
        if (!tr || !tr.children) return result;
        var tds = tr.children;
        for (var i = 0; i < tds.length && result.length < count; i++) {
            if (this._isHiddenCell(tds[i])) continue;
            result.push(tds[i]);
        }
        return result;
    };

    /**
     * 判断某个 th / td 是否为隐藏列单元格（靠渲染时打的 mel-col-hidden 类）
     * @param {Element} cell 单元格节点
     * @return {Boolean}
     */
    Renderer.prototype._isHiddenCell = function(cell) {
        if (!cell || !cell.className) return false;
        return (' ' + cell.className + ' ').indexOf(' mel-col-hidden ') >= 0;
    };

    /**
     * 判断某行某列是否已被上方（rowspan）单元格占用
     * @param {Array} placed 已排布单元格记录
     * @param {Number} row 行号
     * @param {Number} col 列号
     * @return {Boolean}
     */
    Renderer.prototype._isColumnOccupied = function(placed, row, col) {
        for (var i = 0; i < placed.length; i++) {
            var p = placed[i];
            if (p.row < row && row < p.row + p.rowspan && p.col <= col && col < p.col + p.colspan) {
                return true;
            }
        }
        return false;
    };

    Renderer.prototype._applyFixedColumns = function() {
        var fixedLeft = this.options.fixedLeftColumns || 0;
        if (fixedLeft <= 0) return;
        if (!this.theadTr || !this.tbody) return;

        var scrollLeft = this.bodyWrapper ? this.bodyWrapper.scrollLeft : 0;

        // 表头固定列（表头背景固定 #f5f7fa）
        // 注意：合并表头时不能简单取叶子行前 N 个 th——分组 th 有 colspan、浅层列有 rowspan，
        // 叶子行的第 1 个 th 未必是第 1 列。这里按网格推演出的「列偏移」挑选覆盖前 N 列的 th。
        var headerCells = this._getFixedHeaderCells(fixedLeft);
        this._headerFixedCells = headerCells;
        for (var h = 0; h < headerCells.length; h++) {
            var th = headerCells[h];
            th.style.position = 'relative';
            th.style.left = scrollLeft + 'px';
            th.style.zIndex = '2';
            th.style.backgroundColor = '#f5f7fa';
            this._setFixedShadow(th);
        }

        // 表身固定列：背景取所属行 tr 的实际渲染色
        // 固定列数量按「可见列」计：隐藏列不占可见宽度，跳过它继续数，避免它白占一个固定坑位
        var trs = this.tbody.children;
        for (var r = 0; r < trs.length; r++) {
            // 展开详情行整行跨列，不属于数据行，不参与冻结列平移
            if (this._isExpandRowTr(trs[r])) continue;
            var rowBg = this._getRowBackground(trs[r]);
            var cells = this._getFixedBodyCells(trs[r], fixedLeft);
            for (var c = 0; c < cells.length; c++) {
                cells[c].style.position = 'relative';
                cells[c].style.left = scrollLeft + 'px';
                cells[c].style.zIndex = '1';
                cells[c].style.backgroundColor = rowBg;
                this._setFixedShadow(cells[c]);
            }
        }
    };

    /**
     * 获取行的实际渲染背景色（兼容IE9：getComputedStyle 或 currentStyle）
     * 优先取 tr 自身的背景色；若透明/未设置，则回退到表格容器背景或 #fff
     */
    Renderer.prototype._getRowBackground = function(tr) {
        var bg = '';
        if (window.getComputedStyle) {
            bg = window.getComputedStyle(tr).backgroundColor;
        } else if (tr.currentStyle) {
            bg = tr.currentStyle.backgroundColor;
        }

        // 透明/未设置：向上找容器背景，否则默认白
        if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' || bg === 'rgba(0,0,0,0)') {
            if (this.container) {
                var cb = '';
                if (window.getComputedStyle) {
                    cb = window.getComputedStyle(this.container).backgroundColor;
                } else if (this.container.currentStyle) {
                    cb = this.container.currentStyle.backgroundColor;
                }
                if (cb && cb !== 'transparent' && cb !== 'rgba(0, 0, 0, 0)' && cb !== 'rgba(0,0,0,0)') {
                    return cb;
                }
            }
            return '#ffffff';
        }
        return bg;
    };

    /**
     * 给冻结单元格右侧加内阴影，视觉分隔冻结区与滚动区
     */
    Renderer.prototype._setFixedShadow = function(cell) {
        var shadow = '2px 0 6px -2px rgba(0,0,0,0.15)';
        cell.style.boxShadow = shadow;
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
            // 高度定下来后垂直滚动条可能才出现/消失，bodyWrapper可视宽度随之变化，
            // 必须重算表头与 extra 宽度，否则表头比表身宽一个滚动条、extra 跟着错位
            this._syncHeaderWidth();
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
            // 注意：left 取 +scrollLeft，因为滚动容器内容向左移动了 scrollLeft，
            // 固定列需向右补偿相同距离才能保持视觉原位（方案X position:relative+left 平移）
            if (fixedLeft > 0) {
                var offset = this.scrollLeft;
                var trs = self.tbody ? self.tbody.children : [];
                for (var r = 0; r < trs.length; r++) {
                    // 展开详情行整行跨列，不参与冻结列平移
                    if (self._isExpandRowTr(trs[r])) continue;
                    var cells = self._getFixedBodyCells(trs[r], fixedLeft);
                    for (var c = 0; c < cells.length; c++) {
                        cells[c].style.position = 'relative';
                        cells[c].style.left = offset + 'px';
                        cells[c].style.zIndex = '1';
                    }
                }

                // 表头固定列：多行表头时是「覆盖前 N 列的 th 列表」，不是某一行的前 N 个（由 _applyFixedColumns 缓存）
                var ths = self._headerFixedCells || [];
                for (var i = 0; i < ths.length; i++) {
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

        // 初始应用固定列样式（含背景色），滚动事件只负责平移 left
        this._applyFixedColumns();
    };

    /**
     * 设置表头行 HTML（兼容IE9）
     * IE9 不允许直接给 <tr> 赋值 innerHTML（报错"该操作的目标元件无效"），
     * 且游离的 table/tbody 元素直接赋值 innerHTML，IE9 不会正确解析 <tr>/<td> 结构，
     * 会出现 th/tr/td 标签丢失、排版错乱。
     * 正确做法：用普通 div 容器赋完整 <table><tbody>...</tbody></table> 结构，
     * 再从中取出解析好的 <tr> 节点迁移到真实 theadTr，彻底规避 IE9 对 table 系元素赋 innerHTML 的限制。
     * @param {String} html 表头行的 th HTML 字符串
     */
    Renderer.prototype._setTheadHtml = function(rowsHtml) {
        if (!this.thead) return;

        // IE9 兼容【彻底方案】：table / tbody / tr 系列元素直接赋 innerHTML（内容含表格内部标签）
        // 会抛"该操作的目标元件无效"(Invalid target element for this operation)，这是 IE9 的硬性限制，
        // 无论该 table 是否已挂到文档。因此不再用 table 元素做解析容器，
        // 改用普通 div 容器：div 是通用容器，IE9 允许对 div 赋含 <table> 结构的 innerHTML，
        // 再从中取出解析好的 <tr> 节点迁移到真实 thead，彻底规避该限制。
        // 参数为完整的行 html（可多行 <tr>...</tr>，合并表头时即多行）。
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = '<table><tbody>' + rowsHtml + '</tbody></table>';
        var tempTbody = tempDiv.getElementsByTagName('tbody')[0];
        if (!tempTbody) return;

        // 原地替换：先清空旧 thead，再把解析出的每一行 tr 依次迁移进去。
        // 保留 this.thead 引用不变：表头点击事件绑在 thead 上，换行不会丢事件。
        while (this.thead.firstChild) {
            this.thead.removeChild(this.thead.firstChild);
        }

        var tr;
        while ((tr = tempTbody.firstChild)) {
            this.thead.appendChild(tr);
        }

        // 维护行引用：
        //   theadTrs：全部表头行（合并表头时多行）
        //   theadTr ：叶子行（最后一行），其 th 数量与表身列数一致，
        //             固定列定位、滚动同步都以它为准；单级表头时它就是唯一一行，行为与改造前一致。
        this.theadTrs = this.thead.getElementsByTagName('tr');
        this.theadTr = this.theadTrs.length ? this.theadTrs[this.theadTrs.length - 1] : null;

        // 多行（合并）表头标记：css 靠它区分「单级表头收边」与「多行表头保留最后一列右边框」。
        // 表头会随排序等重绘，所以两种状态都要显式切换，不能只加不减。
        this._setMultiHeaderFlag(this.theadTrs.length > 1);
    };

    /**
     * 渲染表头
     */
    /**
     * 生成单个叶子列的 th html（排序箭头、全选 checkbox、副标题等列级细节都在这里，唯一出口）
     * 合并表头插件渲染叶子单元格时也走此方法，避免两处各写一套导致行为不一致
     * @param {Object} col 列配置
     * @param {String} extraClass 额外追加的样式类（可选）
     * @param {Number} rowspan 纵向跨行数（可选，默认1）。多级表头里浅层列/非分组列需要纵向跨行才能与表身对齐
     * @return {String} th html
     */
    /**
     * 判断某列是否可点击表头排序（决定是否显示 pointer 光标）
     * 规则：
     *   1. 未启用 Sort 插件 → 一律不可排序（避免光标 pointer 却点了没反应）；
     *   2. 分组表头（无 field）与内部列（field 以 _ 开头）不参与排序；
     *   3. 列配置 sortable:false → 该列不可排序；不写该项默认可排序。
     * @param {Object} col 列配置
     * @return {Boolean}
     */
    Renderer.prototype._isColSortable = function(col) {
        if (!this.sortEnabled) return false;
        if (!col || !col.field) return false;
        if (col.field.charAt(0) === '_') return false;
        return col.sortable !== false;
    };

    Renderer.prototype._buildThHtml = function(col, extraClass, rowspan) {
        var title = col.title || '';
        var subtitle = col.subtitle || '';
        var align = col.align || 'center';
        var alignClass = 'mel-align-' + align;
        if (extraClass) alignClass += ' ' + extraClass;

        // 隐藏列：th 照常渲染（DOM 保留），只挂隐藏类，CSS display:none
        if (this._isColHidden(col)) alignClass += ' mel-col-hidden';

        // 可排序列：追加标记类，CSS 只负责 cursor:pointer
        if (this._isColSortable(col)) alignClass += ' mel-th-sortable';

        var sortField = this.dataStore.sortField;
        var sortOrder = this.dataStore.sortOrder;

        var arrow = '';
        if (col.field === sortField && sortOrder) {
            arrow = '<span class="mel-sort-arrow" style="margin-left:4px;font-size:10px;color:#409eff;">' + (sortOrder === 'asc' ? '▲' : '▼') + '</span>';
        }

        // 多选列表头全选 checkbox（单选模式单选列不渲染全选，且强制忽略showSelectAll）
        var thContent = '';
        if (col.field === '_checkbox' && this.options.showSelectAll !== false && col.mode !== 'single') {
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

        var spanAttr = (rowspan && rowspan > 1) ? (' rowspan="' + rowspan + '"') : '';
        return '<th class="' + alignClass + '" data-field="' + (col.field || '') + '"' + spanAttr + '>' + thContent + '</th>';
    };

    /**
     * 生成默认单行表头 html（无合并表头时使用）
     * @return {String} 单行 <tr>...</tr>
     */
    Renderer.prototype._buildHeaderRowsHtml = function() {
        var columns = this.dataStore.columns;
        var html = '';
        for (var i = 0; i < columns.length; i++) {
            html += this._buildThHtml(columns[i]);
        }
        return '<tr>' + html + '</tr>';
    };

    /**
     * 渲染表头
     * 表头行 html 的生成分两条路：
     *   1. 默认：单行平铺（_buildHeaderRowsHtml）；
     *   2. 启用 HeaderMerge 插件：由插件提供的 headerMergeBuilder 返回多行 <tr> 结构。
     * 核心只负责把 html 落到 thead、处理表头高度、绑定全选 checkbox，合并逻辑由插件独占。
     */
    Renderer.prototype._renderHeader = function() {
        if (!this.thead) return;

        var rowsHtml;
        if (typeof this.headerMergeBuilder === 'function') {
            rowsHtml = this.headerMergeBuilder();
        } else {
            rowsHtml = this._buildHeaderRowsHtml();
        }

        this._setTheadHtml(rowsHtml);

        // 表头高度由配置 headerHeight 控制：
        // 默认'auto'不设固定高度，由内容自动撑开；仅当传入数值时才设置固定高度
        if (this.headerWrapper) {
            var headerH = this.options.headerHeight;
            if (typeof headerH === 'number' && !isNaN(headerH)) {
                this.headerWrapper.style.height = headerH + 'px';
            } else {
                this.headerWrapper.style.height = '';
            }
            this.headerWrapper.style.boxSizing = 'border-box';
        }

        // 绑定表头全选 checkbox 事件
        var headerCheckbox = this.thead.querySelector('.mel-header-checkbox');
        if (headerCheckbox) {
            var self = this;
            headerCheckbox.onclick = function(e) {
                var event = e || window.event;
                event.cancelBubble = true;
                var checked = this.checked;
                self.dataStore.selectAll(checked);
                self.eventBus.emit('selectChange', {
                    selectedRows: self.dataStore.getPlainRows(self.dataStore.getSelectedRows())
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

        // 时序关键：先 emit('renderBody')，让依赖渲染的插件（如SerialNo序号）在生成HTML之前
        // 更新行内字段（_serialNo 等），再读取生成 HTML。若放在渲染之后 emit，
        // 序号等字段已在渲染时被取为旧值/空值，DOM 不会重画，导致序号列为空。
        this.eventBus.emit('renderBody');

        var html = '';
        for (var i = 0; i < rows.length; i++) {
            html += this._renderRowHtml(rows[i]);
        }

        // IE9 兼容：不直接给 tbody 赋大段 innerHTML（IE9 对超长/含特殊字符的
        // innerHTML 解析不稳定，容易出现行丢失/空白）。改用临时 tbody 容器解析，
        // 再把解析出的 tr 节点批量迁移到真实 tbody。
        this._setTbodyHtmlSafe(html);
        this._cacheRowNodes();

        // 行数变化会改变垂直滚动条的有无，bodyWrapper 可视宽度随之变化：
        // 重算表头与 extra 宽度，保证表头表身不错行、extra 不越过表头右边界
        this._syncHeaderWidth();

        this.eventBus.emit('summaryRequest');
    };

    /**
     * 安全设置 tbody 内容（兼容IE9）
     * 用普通 div 容器解析完整 <table><tbody>...</tbody></table> 结构，
     * 再把解析出的 tr 节点迁移到真实 tbody，
     * 规避 IE9 直接给 tbody 赋 innerHTML 抛"该操作的目标元件无效"以及 tr/td 标签丢失的问题。
     * @param {String} html 表身行 html（多个<tr>...</tr>拼接）
     */
    Renderer.prototype._setTbodyHtmlSafe = function(html) {
        // IE9 兼容【彻底方案】：同 _setTheadHtml，改用普通 div 容器解析含 <table> 结构的 html，
        // 再取出解析好的 <tr> 节点迁移到真实 tbody，彻底规避
        // IE9 对 table/tbody 元素赋 innerHTML 写表格内部标签抛"该操作的目标元件无效"的硬性限制。
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = '<table><tbody>' + html + '</tbody></table>';
        var tempTbody = tempDiv.getElementsByTagName('tbody')[0];

        // 清空真实 tbody
        while (this.tbody.firstChild) {
            this.tbody.removeChild(this.tbody.firstChild);
        }

        // 迁移解析出的 tr 节点到真实 tbody
        var tr;
        if (tempTbody) {
            while ((tr = tempTbody.firstChild)) {
                this.tbody.appendChild(tr);
            }
        }
    };

    /**
     * 全量重绘表身（addRow/deleteRow 等数据变动后调用）
     * 同时刷新冻结列样式与表头宽度，保证增删行后冻结列不丢失、不错行。
     */
    Renderer.prototype.renderBodyAll = function() {
        if (!this.tbody) return;
        this._renderBody();
        this._applyFixedColumns();
        this._syncHeaderWidth();
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
            // 隐藏列：td 照常渲染（DOM 保留），只挂隐藏类，不占可见宽度
            if (this._isColHidden(col)) alignClass += ' mel-col-hidden';

            var renderer = this._renderers[col.renderer] || this._renderers.text;
            var cellContent = renderer(value, col, rowData);

            html += '<td class="' + alignClass + '" data-field="' + (col.field || '') + '" data-row-index="' + rowData._rowIndex + '" style="height:' + rowH + 'px;">';
            html += cellContent;
            html += '</td>';
        }

        html += '</tr>';

        // 展开行插件钩子：在数据行后面追加一条跨列详情行（RowExpand 插件接管）
        // 插件未启用时 rowExpandBuilder 为 undefined，不产生任何额外 HTML
        if (typeof this.rowExpandBuilder === 'function') {
            var expandHtml = this.rowExpandBuilder(rowData);
            if (expandHtml) html += expandHtml;
        }

        return html;
    };

    /**
     * 判断是否为展开行插件插入的详情行（不是数据行）
     * 详情行带 data-row-expand="1"，不参与行节点缓存、冻结列平移等按「行」处理的逻辑
     * @param {Element} tr 行节点
     * @return {Boolean}
     */
    Renderer.prototype._isExpandRowTr = function(tr) {
        if (!tr || !tr.getAttribute) return false;
        return tr.getAttribute('data-row-expand') === '1';
    };

    /**
     * 缓存每行 DOM 节点引用
     */
    Renderer.prototype._cacheRowNodes = function() {
        if (!this.tbody) return;

        var trs = this.tbody.children;
        var visibleRows = this.dataStore.getVisibleRows();
        // 展开行插件会在数据行后插入详情行，导致 trs 下标与 visibleRows 不再一一对应，
        // 因此按 data-row-index 反查行对象，不能按数组下标硬配。
        // 注意：展开行的单元格里没有 data-row-index，按 index 找不到行，直接跳过。
        for (var i = 0; i < trs.length; i++) {
            if (this._isExpandRowTr(trs[i])) continue;
            var rowIndex = parseInt(trs[i].getAttribute('data-row-index'));
            if (isNaN(rowIndex)) continue;
            var nodeRow = this.dataStore.getRow(rowIndex);
            if (nodeRow) nodeRow._node = trs[i];
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
            } else if (sums.blank && sums.data[col.field] !== undefined) {
                // blank=true：合计无数据可算（远程分页 scope='all' 但没给 externalData），直接显示占位符，别渲染成 0 误导使用者
                cellHtml = '<strong>' + sums.data[col.field] + '</strong>';
            } else if (sums.data[col.field] !== undefined && !isNaN(sums.data[col.field])) {
                cellHtml = '<strong>' + sums.data[col.field].toFixed(2) + '</strong>';
            }

            // 隐藏列的合计单元格同样挂隐藏类，列宽与表身保持一致，不额外占位
            var tdClass = this._isColHidden(col) ? ' class="mel-col-hidden"' : '';
            html += '<td' + tdClass + '>' + cellHtml + '</td>';
        }

        html += '</tr>';

        if (this.tbody.insertAdjacentHTML) {
            this.tbody.insertAdjacentHTML('beforeend', html);
        } else {
            // IE9 兜底【彻底方案】：改用普通 div 容器解析含 <table> 结构的 html，
            // 再取出 <tr> 迁移到 tbody，规避 IE9 对 table/tbody 赋 innerHTML 写表格内部标签的限制。
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = '<table><tbody>' + html + '</tbody></table>';
            var tempTbody = tempDiv.getElementsByTagName('tbody')[0];
            var tr = tempTbody ? tempTbody.getElementsByTagName('tr')[0] : null;
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
        if (!this.tbody || !this.thead) return;

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

            // 单行事件：rowId 独立作为顶层参数，rowData 为纯业务字段副本（不含内部字段）
            var rowId = rowData._rowId;
            var plainRow = self.dataStore.getPlainRow(rowData);

            self.eventBus.emit('cellClick', {
                rowId: rowId,
                rowData: plainRow,
                cell: {rowIndex: rowIndex, field: field, element: td}
            });
            // 插件可提供 rowClickFilter(field)：命中返回 true 的列，点击后不抛 rowClick
            // （展开行插件用它挡住箭头列，避免点箭头时同时触发业务「点整行」逻辑）
            if (typeof self.rowClickFilter === 'function' && self.rowClickFilter(field)) return;

            self.eventBus.emit('rowClick', {
                rowId: rowId,
                rowData: plainRow,
                rowIndex: rowIndex
            });
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
            var changedRow = self.dataStore.getRow(rowIndex);
            self.eventBus.emit('cellChange', {
                rowId: changedRow ? changedRow._rowId : '',
                rowData: self.dataStore.getPlainRow(changedRow),
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
                var changedRow = self.dataStore.getRow(rowIndex);
                self.eventBus.emit('cellChange', {
                    rowId: changedRow ? changedRow._rowId : '',
                    rowData: self.dataStore.getPlainRow(changedRow),
                    rowIndex: rowIndex, field: field,
                    newValue: newValue, oldValue: oldValue
                });
            });
        }

        this.thead.onclick = function(e) {
            var event = e || window.event;
            var target = event.target || event.srcElement;

            var th = self._findParent(target, 'TH');
            if (!th) return;

            var field = th.getAttribute('data-field');

            // 分组表头（合并表头的父级 th）：没有 field，不参与排序，也不抛 headerClick，
            // 单独抛 groupHeaderClick，由分组列解析器还原出对应的列配置对象。
            if (!field) {
                var groupPath = th.getAttribute('data-group-path');
                if (groupPath && typeof self.groupColumnResolver === 'function') {
                    self.eventBus.emit('groupHeaderClick', {
                        column: self.groupColumnResolver(groupPath),
                        element: th,
                        event: event
                    });
                }
                return;
            }

            self.eventBus.emit('headerClick', {field: field});
        };

        // 冻结列 hover 联动：tr:hover 会改变行背景色(#f5f7fa)，冻结 td 内联背景需同步刷新，
        // 否则冻结列颜色与整行不一致，且下层内容穿透。事件委托到 tbody，减少监听个数。
        var fixedLeft = this.options.fixedLeftColumns || 0;
        if (fixedLeft > 0) {
            var refreshRowBg = function(e) {
                var event = e || window.event;
                var target = event.target || event.srcElement;
                var tr = self._findParent(target, 'TR');
                if (!tr) return;
                if (tr.parentNode !== self.tbody) return;
                // 重取该行背景（hover 后浏览器已应用 tr:hover 样式）
                var rowBg = self._getRowBackground(tr);
                var cells = self._getFixedBodyCells(tr, fixedLeft);
                for (var c = 0; c < cells.length; c++) {
                    cells[c].style.backgroundColor = rowBg;
                }
            };

            this._fixedHoverOverHandler = refreshRowBg;
            this._fixedHoverOutHandler = refreshRowBg;

            if (this.tbody.addEventListener) {
                this.tbody.addEventListener('mouseover', refreshRowBg, false);
                this.tbody.addEventListener('mouseout', refreshRowBg, false);
            } else if (this.tbody.attachEvent) {
                this.tbody.attachEvent('onmouseover', refreshRowBg);
                this.tbody.attachEvent('onmouseout', refreshRowBg);
            }
        }
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
    /**
     * 聚焦单元格：滚动到可见 + 聚焦输入元素 + 可选临时高亮
     * 供 TableCore.focusCell 调用（校验不通过时把用户直接带到出错的格子）
     * @param {Number} rowIndex 行索引（0-based）
     * @param {String} field 列字段名
     * @param {Object} options highlight：是否临时高亮，默认 true
     * @return {Boolean} 是否定位成功
     */
    Renderer.prototype.focusCell = function(rowIndex, field, options) {
        var ds = this.dataStore;
        var row = ds ? ds.getRow(rowIndex) : null;
        if (!row || !row._node || !row._node.parentNode) return false;

        var td = row._node.querySelector('td[data-field="' + field + '"]');
        if (!td) return false;

        // 1. 滚动到可见区域（滚动容器是表身，不是 window）
        if (this.bodyWrapper) {
            this._scrollCellIntoView(td, this.bodyWrapper);
            // 程序化改 scrollLeft / scrollTop 部分环境不派发 scroll 事件，
            // 这里主动同步表头横向位置与固定列 left 平移，避免固定列压盖
            if (this.headerWrapper) this.headerWrapper.scrollLeft = this.bodyWrapper.scrollLeft;
            if (typeof this._bodyScrollHandler === 'function') {
                this._bodyScrollHandler.call(this.bodyWrapper);
            }
        }

        // 2. 聚焦可输入元素（纯展示列没有输入元素，只做高亮）
        var input = null;
        var tags = ['input', 'textarea', 'select'];
        for (var i = 0; i < tags.length; i++) {
            input = td.querySelector(tags[i]);
            if (input) break;
        }
        if (input && input.focus) {
            try {
                input.focus();
            } catch (e) {
                // 只读 / 禁用元素聚焦失败无需处理
            }
        }

        // 3. 临时高亮
        if (!options || options.highlight !== false) {
            this._flashCell(td);
        }
        return true;
    };

    /**
     * 把单元格滚动到表身容器的可见范围内
     * 用 rect 差量计算，天然兼容固定列的 position:relative + left 平移
     * @param {Element} cell 单元格
     * @param {Element} wrapper 表身滚动容器
     */
    Renderer.prototype._scrollCellIntoView = function(cell, wrapper) {
        if (!cell || !wrapper || !cell.getBoundingClientRect) return;

        var cr = cell.getBoundingClientRect();
        var wr = wrapper.getBoundingClientRect();
        var pad = 8;
        var lead = 40; // 横向多留一点，避免单元格贴着边缘难以看清

        var dl = cr.left - wr.left;
        var dr = cr.right - (wr.left + wrapper.clientWidth);
        if (dl < pad) {
            wrapper.scrollLeft += (dl - lead);
        } else if (dr > -pad) {
            wrapper.scrollLeft += (dr + lead);
        }

        var dt = cr.top - wr.top;
        var db = cr.bottom - (wr.top + wrapper.clientHeight);
        if (dt < pad) {
            wrapper.scrollTop += (dt - pad);
        } else if (db > -pad) {
            wrapper.scrollTop += (db + pad);
        }
    };

    /**
     * 单元格临时高亮（1.2 秒后自动恢复）
     * 同时只亮一格，避免用户看花
     * @param {Element} cell 单元格
     */
    Renderer.prototype._flashCell = function(cell) {
        if (!cell || !cell.style) return;

        // 先恢复上一格
        if (this._flashCellEl && this._flashCellEl.style) {
            this._flashCellEl.style.boxShadow = this._flashCellShadow || '';
            this._flashCellEl.style.backgroundColor = this._flashCellBg || '';
        }
        if (this._flashTimer) {
            clearTimeout(this._flashTimer);
            this._flashTimer = null;
        }

        this._flashCellEl = cell;
        this._flashCellShadow = cell.style.boxShadow || '';
        this._flashCellBg = cell.style.backgroundColor || '';

        cell.style.boxShadow = 'inset 0 0 0 2px #e53935';
        cell.style.backgroundColor = '#fff1f0';

        var self = this;
        this._flashTimer = setTimeout(function() {
            if (self._flashCellEl && self._flashCellEl.style) {
                self._flashCellEl.style.boxShadow = self._flashCellShadow || '';
                self._flashCellEl.style.backgroundColor = self._flashCellBg || '';
            }
            self._flashCellEl = null;
            self._flashTimer = null;
        }, 1200);
    };

    Renderer.prototype._destroy = function() {
        // 清理单元格高亮定时器
        if (this._flashTimer) {
            clearTimeout(this._flashTimer);
            this._flashTimer = null;
        }
        this._flashCellEl = null;

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

        // 移除冻结列hover监听
        if (this.tbody && this._fixedHoverOverHandler) {
            if (this.tbody.removeEventListener) {
                this.tbody.removeEventListener('mouseover', this._fixedHoverOverHandler);
                this.tbody.removeEventListener('mouseout', this._fixedHoverOutHandler);
            } else if (this.tbody.detachEvent) {
                this.tbody.detachEvent('onmouseover', this._fixedHoverOverHandler);
                this.tbody.detachEvent('onmouseout', this._fixedHoverOutHandler);
            }
            this._fixedHoverOverHandler = null;
            this._fixedHoverOutHandler = null;
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

/**
 * MelUi Table 表格组件 - 核心渲染器
 * 负责根据 DataStore 数据渲染表头和表身 DOM，所有 DOM 操作统一在此
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.5.2
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
     * 动态调整 wrapper 宽度
     */
    Renderer.prototype._adjustWrapperWidth = function(totalWidth) {
        if (!this.el) return;

        // 用content区域宽度（减去padding）
        var containerWidth = this._getContentWidth(this.el);
        var scrollbarWidth = this._getScrollbarWidth();

        if (totalWidth + scrollbarWidth <= containerWidth) {
            // 加2px安全余量，防止边框/padding/滚动条误差导致出现水平滚动条
            var wrapperWidth = totalWidth + scrollbarWidth + 2;
            if (this.headerWrapper) this.headerWrapper.style.width = wrapperWidth + 'px';
            if (this.bodyWrapper) this.bodyWrapper.style.width = wrapperWidth + 'px';
        } else {
            if (this.headerWrapper) this.headerWrapper.style.width = '100%';
            if (this.bodyWrapper) this.bodyWrapper.style.width = '100%';
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
     * 适配视口：自动计算el高度并占满视口剩余空间，监听窗口大小变化实时重新计算
     */
    Renderer.prototype._fitViewport = function() {
        var self = this;

        // 先计算一次
        this._doFitViewport();

        // 监听窗口大小变化（只绑定一次）
        if (!this._resizeBound) {
            this._resizeBound = true;
            if (window.addEventListener) {
                window.addEventListener('resize', function() {
                    self._doFitViewport();
                }, false);
            } else if (window.attachEvent) {
                window.attachEvent('onresize', function() {
                    self._doFitViewport();
                });
            }
        }
    };

    /**
     * 实际执行视口适配
     * el目标高度 = 视口高度 - 顶部内容高度(el到视口顶) - 底部内容高度(el后续兄弟元素)
     * 全程不读取el现有高度，同步计算准确
     */
    Renderer.prototype._doFitViewport = function() {
        if (!this.el) return;

        // 视口高度
        var winHeight = window.innerHeight || document.documentElement.clientHeight;

        // 顶部内容高度 = el到视口顶部的距离
        var top = this.el.getBoundingClientRect().top;

        // 底部内容高度 = el后面所有兄弟元素的高度(含margin)
        var bottom = 0;
        var sib = this.el.nextSibling;
        while (sib) {
            if (sib.nodeType === 1) {
                bottom += sib.offsetHeight;
                var s = window.getComputedStyle ? window.getComputedStyle(sib) : sib.currentStyle;
                if (s) {
                    bottom += parseInt(s.marginTop, 10) || 0;
                    bottom += parseInt(s.marginBottom, 10) || 0;
                }
            }
            sib = sib.nextSibling;
        }

        // el目标border-box总高度 = 视口高度 - 顶部 - 底部
        var elTargetBox = winHeight - top - bottom;

        this._applyLayout(elTargetBox);
    };

    /**
     * 统一布局推算（唯一一套推算逻辑，不重复）
     * 传入el目标border-box高度，依次推算container和bodyWrapper高度
     * el高度保持auto，由container和分页栏自然撑开
     */
    Renderer.prototype._applyLayout = function(elTargetBox) {
        if (!this.el || !this.container || !this.bodyWrapper) return;
        if (elTargetBox <= 0) return;

        // 读取el的padding和border
        var es = this._getBoxInfo(this.el);

        // el的content区域高度
        var elContent = elTargetBox - es.paddingTop - es.paddingBottom - es.borderTop - es.borderBottom;

        // 读取分页栏高度（已渲染好）
        var paginationDom = this.el.querySelector('.mel-pagination');
        var paginationHeight = paginationDom ? paginationDom.offsetHeight : 0;

        // container目标border-box高度 = el content高度 - 分页栏高度
        var containerTargetBox = elContent - paginationHeight;
        if (containerTargetBox <= 0) return;

        this.container.style.boxSizing = 'border-box';
        this.container.style.height = containerTargetBox + 'px';

        // 读取container自己的border
        var cs = this._getBoxInfo(this.container);

        // 表头实际高度
        var headerHeight = this.headerWrapper ? this.headerWrapper.offsetHeight : 40;

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
     */
    Renderer.prototype._initLayout = function() {
        var fixedLeft = this.options.fixedLeftColumns || 0;
        if (fixedLeft <= 0 || !this.bodyWrapper) return;

        var self = this;

        this.bodyWrapper.onscroll = function() {
            if (self.headerWrapper) {
                self.headerWrapper.scrollLeft = this.scrollLeft;
            }

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
        var html = '<tr data-row-index="' + rowData._rowIndex + '">';

        for (var i = 0; i < columns.length; i++) {
            var col = columns[i];
            var value = rowData[col.field] !== undefined ? rowData[col.field] : '';
            var align = col.align || 'center';
            var alignClass = 'mel-align-' + align;

            var renderer = this._renderers[col.renderer] || this._renderers.text;
            var cellContent = renderer(value, col, rowData);

            html += '<td class="' + alignClass + '" data-field="' + (col.field || '') + '" data-row-index="' + rowData._rowIndex + '">';
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

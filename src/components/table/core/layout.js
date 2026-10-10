/**
 * MelUi Table 表格组件 - 布局管理
 * 负责固定表头、固定列、滚动同步
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.0
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * Layout 构造函数
     * @param {Object} options 配置项
     * @param {Object} renderer Renderer 实例
     */
    function Layout(options, renderer) {
        this.options = options;
        this.renderer = renderer;

        this.fixedLeftColumns = options.fixedLeftColumns || 0;
        this.headerHeight = options.headerHeight || 40;
    }

    /**
     * 初始化布局
     */
    Layout.prototype.init = function() {
        this._syncScroll();
        this._applyFixedColumns();
    };

    /**
     * 同步表头和表身的横向滚动
     * 表头 wrapper overflow:hidden，表身 wrapper overflow:auto
     * 表身滚动时，表头跟着同步 scrollLeft
     */
    Layout.prototype._syncScroll = function() {
        var self = this;
        var bodyWrapper = this.renderer.bodyWrapper;
        var headerWrapper = this.renderer.headerWrapper;

        if (!bodyWrapper || !headerWrapper) return;

        // 表身横向滚动时，同步表头
        bodyWrapper.onscroll = function() {
            headerWrapper.scrollLeft = bodyWrapper.scrollLeft;
        };
    };

    /**
     * 应用固定列（左侧连续N列固定）
     * 方案：固定列的 td/th 设置 position:relative + left偏移 + z-index
     * 横向滚动时，固定列保持视觉上不动
     */
    Layout.prototype._applyFixedColumns = function() {
        if (this.fixedLeftColumns <= 0) return;

        var columns = this.renderer.dataStore.columns;
        var fixedCount = Math.min(this.fixedLeftColumns, columns.length);

        // 计算每列的宽度，累加得到固定列总宽度
        var fixedWidth = 0;
        for (var i = 0; i < fixedCount; i++) {
            fixedWidth += columns[i].width || 100;
        }

        // 给表头固定列加样式
        var headerThs = this.renderer.theadTr.children;
        for (var i = 0; i < fixedCount && i < headerThs.length; i++) {
            var th = headerThs[i];
            th.style.position = 'relative';
            th.style.zIndex = '2';
            th.style.backgroundColor = '#f5f7fa';
        }

        // 给表身固定列加样式
        var bodyTrs = this.renderer.tbody.children;
        for (var rowIdx = 0; rowIdx < bodyTrs.length; rowIdx++) {
            var tds = bodyTrs[rowIdx].children;
            for (var colIdx = 0; colIdx < fixedCount && colIdx < tds.length; colIdx++) {
                var td = tds[colIdx];
                td.style.position = 'relative';
                td.style.zIndex = '1';
                td.style.backgroundColor = '#fff';
            }
        }

        // 监听表身滚动，平移固定列
        var self = this;
        this.renderer.bodyWrapper.onscroll = function() {
            var scrollLeft = this.scrollLeft;

            // 同步表头滚动
            self.renderer.headerWrapper.scrollLeft = scrollLeft;

            // 平移固定列，视觉上钉住
            var offset = -scrollLeft;
            for (var rowIdx = 0; rowIdx < bodyTrs.length; rowIdx++) {
                var tds = bodyTrs[rowIdx].children;
                for (var colIdx = 0; colIdx < fixedCount && colIdx < tds.length; colIdx++) {
                    tds[colIdx].style.left = offset + 'px';
                }
            }

            // 表头固定列也要平移
            for (var i = 0; i < fixedCount && i < headerThs.length; i++) {
                headerThs[i].style.left = offset + 'px';
            }
        };
    };

    /**
     * 行渲染后重新应用固定列样式（新增/删除行后调用）
     */
    Layout.prototype.refreshFixedColumns = function() {
        if (this.fixedLeftColumns <= 0) return;
        this._applyFixedColumns();
    };

    MelUi.Table = MelUi.Table || {};
    MelUi.Table.Layout = Layout;

})(window.MelUi = window.MelUi || {});

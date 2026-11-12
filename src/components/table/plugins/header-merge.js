/**
 * MelUi Table 表格组件 - 合并表头插件
 * 依据 columns 的 children 树渲染多级表头：
 *   分组表头横向合并（colspan）；
 *   不在分组里的列（复选框、序号、状态列等插件注入列）与不等深结构中的浅层列纵向跨行（rowspan），
 *   保证表头每行覆盖的列数与表身完全一致，不会留空洞或错位。
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.3
 * @Date：2026-11-09
 * @PubDate：2026-11-12 16:50:19
 */

 (function(MelUi) {

    /**
     * HeaderMerge 合并表头插件
     * @param {Object} options 配置
     *   groupHeaderClass: 分组表头(父级th)追加的样式类(可选)。用于业务统一改分组的背景、字体等
     *   leafHeaderClass : 叶子表头追加的样式类(可选)
     *   borderPatch     : 是否开启合并单元格边框修复样式(可选)，默认true。
     *                     IE9 下 colspan 单元格与下方叶子单元格的边线容易缺失，开启后给表头 table 挂修复类，
     *                     由 css 统一给每行补底边；业务若已自行重置表头边框，可传 false 关闭
     */
    function HeaderMerge(options) {
        this.options = this._extend({
            groupHeaderClass: '',
            leafHeaderClass: '',
            borderPatch: true
        }, options || {});
    }

    HeaderMerge.prototype = new MelUi.Table.PluginBase();
    HeaderMerge.prototype.constructor = HeaderMerge;

    /**
     * 初始化：只接管「表头行 html 的生成」，不改数据、不改表身、不加配置参数
     * @param {Object} table 表格实例
     */
    HeaderMerge.prototype.init = function(table) {
        this.table = table;

        var renderer = table.renderer;
        if (!renderer) return;

        var self = this;

        // Renderer._renderHeader 走这条分支生成多行表头 html
        renderer.headerMergeBuilder = function() {
            return self._buildRowsHtml();
        };

        // Renderer 点击分组表头时，用它把 data-group-path 还原成对应的列配置对象
        renderer.groupColumnResolver = function(path) {
            return self._findByPath(path);
        };
    };

    /**
     * 浅合并配置（插件自带，内核 PluginBase 不提供此方法，与 sort/checkbox 等插件保持同一写法）
     * @param {Object} target 目标对象
     * @return {Object}
     */
    HeaderMerge.prototype._extend = function(target) {
        var sources = Array.prototype.slice.call(arguments, 1);
        for (var i = 0; i < sources.length; i++) {
            for (var key in sources[i]) {
                if (sources[i].hasOwnProperty(key)) {
                    target[key] = sources[i][key];
                }
            }
        }
        return target;
    };

    /**
     * 销毁：解除对 Renderer 的两处接管
     */
    HeaderMerge.prototype.destroy = function() {
        var renderer = this.table ? this.table.renderer : null;
        if (renderer) {
            renderer.headerMergeBuilder = null;
            renderer.groupColumnResolver = null;

            // 去掉容器标记，恢复单级表头的收边表现
            if (renderer.container) {
                renderer.container.className = (' ' + renderer.container.className + ' ')
                    .replace(' mel-table-merge-head ', ' ')
                    .replace(/^\s+|\s+$/g, '');
            }
        }
        this.table = null;
    };

    /**
     * 生成多级表头 html（多行 <tr> 拼接，每行的列覆盖总和都等于 dataStore.columns 的列数）
     *
     * 关键：列的实际顺序与数量一律以 dataStore.columns 为准，columns 树只提供「分组结构」。
     * 原因：复选框列、序号列、状态列等是插件在 init 阶段 unshift/push 进 dataStore.columns 的，
     * 它们不在 columns 树里；若表头只按树遍历，这些列会整列从表头消失（表头列数少于表身，右侧全部左移）。
     *
     * 布局规则：
     *   - 树里的叶子列：按所在深度输出；深度之上逐层输出分组 th（colspan=该分组的叶子总数）；
     *     若表头比它更深（各分支不等深），该叶子纵向跨满剩余行，避免留空位；
     *   - 不在树里的列（插件注入列）：不属于任何分组，纵向跨满整个表头，横向占 1 列。
     * @return {String}
     */
    HeaderMerge.prototype._buildRowsHtml = function() {
        if (!this.table) return '';

        var tree = this.table._columnTree || [];
        var cols = this.table.dataStore.columns || [];
        if (!cols.length) return '';

        var maxDepth = this._getMaxDepth(tree);
        if (maxDepth < 1) maxDepth = 1;

        // 边框修复类在渲染时补挂（插件 init 早于首次渲染，那一刻 headerTable 还不存在）
        this._applyBorderPatch();

        // 容器打上「合并表头」标记：表身最后一列的收边由 css 借助它跟表头保持一致
        this._markMergeContainer();

        // 给树里的每一片叶子建立索引：所在的分组栈与分组路径
        var index = [];
        this._indexTree(tree, '', [], [], index);

        // 按层收集单元格：rows[0] 是最外层分组行，rows[maxDepth-1] 是叶子行
        var rows = [];
        for (var d = 0; d < maxDepth; d++) {
            rows.push([]);
        }

        // 同一分组在同一层只出现一次（colspan 已覆盖其全部叶子）：
        // 用对象引用比对连续出现的叶子是否属于同一分组
        var lastGroupAtLevel = [];

        for (var i = 0; i < cols.length; i++) {
            var col = cols[i];
            var meta = this._findMeta(index, col);

            if (meta) {
                for (var g = 0; g < meta.groups.length; g++) {
                    if (lastGroupAtLevel[g] === meta.groups[g]) continue;
                    rows[g].push(this._buildGroupThHtml(meta.groups[g], this._countLeaf(meta.groups[g]), meta.paths[g]));
                    lastGroupAtLevel[g] = meta.groups[g];
                }

                var leafRow = meta.groups.length;
                var rowspan = maxDepth - leafRow;
                rows[leafRow].push(this._buildLeafThHtml(col, rowspan));
            } else {
                // 插件注入列（复选框 / 序号 / 状态列等）
                rows[0].push(this._buildLeafThHtml(col, maxDepth));
            }
        }

        var html = '';
        for (var r = 0; r < rows.length; r++) {
            // 每一行的逻辑最后一列打上标记：CSS 靠这个类覆盖 th:last-child{border-right:0}，
            // 让多级表头每一行都保留右侧竖线（DOM 的 :last-child 在多行里会逐行命中，逐行抹边）
            if (rows[r].length) {
                rows[r][rows[r].length - 1] = this._markLastCol(rows[r][rows[r].length - 1]);
            }
            html += '<tr>' + rows[r].join('') + '</tr>';
        }
        return html;
    };

    /**
     * 给 th 的 class 加上“本行最后一列”标记
     * @param {String} thHtml 单个 th 的 html 片段
     * @return {String} 打上标记后的 html 片段
     */
    HeaderMerge.prototype._markLastCol = function(thHtml) {
        if (!thHtml) return thHtml;

        var at = thHtml.indexOf('class="');
        if (at < 0) return thHtml;

        return thHtml.substring(0, at + 7) + 'mel-th-merge-lastcol ' + thHtml.substring(at + 7);
    };

    /**
     * 递归给树里的叶子列建立索引（记录其所属分组栈与路径）
     * @param {Array} list 当前层列数组
     * @param {String} path 当前节点路径
     * @param {Array} groups 祖先分组列栈
     * @param {Array} paths 祖先分组路径栈（与 groups 一一对应）
     * @param {Array} out 输出：{col, groups, paths}
     */
    HeaderMerge.prototype._indexTree = function(list, path, groups, paths, out) {
        for (var i = 0; i < list.length; i++) {
            var col = list[i];
            if (!col) continue;

            var nodePath = path ? (path + '-' + i) : String(i);

            if (col.children && col.children.length) {
                this._indexTree(col.children, nodePath, groups.concat([col]), paths.concat([nodePath]), out);
            } else {
                out.push({col: col, groups: groups, paths: paths});
            }
        }
    };

    /**
     * 在叶子索引里按对象引用查某列的树信息（插件注入列查不到，返回 null）
     * @param {Array} index 叶子索引
     * @param {Object} col 列配置
     * @return {Object|null}
     */
    HeaderMerge.prototype._findMeta = function(index, col) {
        for (var i = 0; i < index.length; i++) {
            if (index[i].col === col) return index[i];
        }
        return null;
    };

    /**
     * 统计某分组下的叶子列总数（即该分组的 colspan）
     * @param {Object} col 列配置
     * @return {Number}
     */
    /**
     * 统计某分组下的叶子列总数（即该分组的 colspan）
     * @param {Object} col 列配置
     * @return {Number}
     */
    HeaderMerge.prototype._countLeaf = function(col) {
        if (!col.children || !col.children.length) return 1;
        var total = 0;
        for (var i = 0; i < col.children.length; i++) {
            total += this._countLeaf(col.children[i]);
        }
        return total;
    };

    /**
     * 计算表头最大层级（无 children 时为 1 级）
     * @param {Array} list 列数组
     * @return {Number}
     */
    HeaderMerge.prototype._getMaxDepth = function(list) {
        var max = 1;
        if (!list || !list.length) return max;

        for (var i = 0; i < list.length; i++) {
            var col = list[i];
            if (!col) continue;

            var depth = 1;
            if (col.children && col.children.length) {
                depth = 1 + this._getMaxDepth(col.children);
            }
            if (depth > max) max = depth;
        }
        return max;
    };

    /**
     * 生成分组表头 th（带 colspan 与路径标识，不带 field，因此不参与排序）
     * @param {Object} col 分组列配置
     * @param {Number} colspan 跨列数
     * @param {String} path 节点路径
     * @return {String}
     */
    HeaderMerge.prototype._buildGroupThHtml = function(col, colspan, path) {
        var align = col.align || 'center';
        var cls = 'mel-align-' + align + ' mel-th-group';
        if (this.options.groupHeaderClass) {
            cls += ' ' + this.options.groupHeaderClass;
        }

        var inner = '<div class="mel-th-inner">';
        inner += '<span class="mel-th-title">' + (col.title || '') + '</span>';
        // 与叶子表头保持同一顺序：标题 → (无箭头) → 副标题
        if (col.subtitle) {
            inner += '<em class="mel-th-subtitle">' + col.subtitle + '</em>';
        }
        inner += '</div>';

        // 分组表头同样支持列级/全局表头背景：取分组列自身的 headBgColor，未配置则走全局
        var renderer = this.table ? this.table.renderer : null;
        var styleAttr = (renderer && typeof renderer._getThStyleAttr === 'function') ? renderer._getThStyleAttr(col) : '';

        return '<th class="' + cls + '" colspan="' + colspan + '" data-group-path="' + path + '"' + styleAttr + '>' + inner + '</th>';
    };

    /**
     * 生成叶子表头 th：复用 Renderer 的列级渲染，只额外追加叶子样式类
     * @param {Object} col 列配置
     * @return {String}
     */
    HeaderMerge.prototype._buildLeafThHtml = function(col, rowspan) {
        var renderer = this.table ? this.table.renderer : null;
        if (!renderer || typeof renderer._buildThHtml !== 'function') return '';
        return renderer._buildThHtml(col, this.options.leafHeaderClass, rowspan);
    };

    /**
     * 按路径回查分组列配置（点击分组表头时用）
     * @param {String} path 形如 "0-1" 的下标串
     * @return {Object|null}
     */
    HeaderMerge.prototype._findByPath = function(path) {
        if (!path || !this.table) return null;

        var list = this.table._columnTree || [];
        var segs = String(path).split('-');
        var node = null;

        for (var i = 0; i < segs.length; i++) {
            var idx = parseInt(segs[i], 10);
            if (isNaN(idx) || !list || !list[idx]) return null;
            node = list[idx];
            list = node.children || null;
        }
        return node;
    };

    /**
     * 给表头 table 挂边框修复类（幂等，重复渲染不会重复追加）
     */
    /**
     * 给表格容器打上合并表头标记（mel-table-merge-head）
     * 表头是独立 table、表身是另一张 table，css 无法从表头 table 选中表身，
     * 所以标记挂在二者共同的父容器上。
     */
    HeaderMerge.prototype._markMergeContainer = function() {
        var renderer = this.table ? this.table.renderer : null;
        var container = renderer ? renderer.container : null;
        if (!container) return;

        if ((' ' + container.className + ' ').indexOf(' mel-table-merge-head ') > -1) return;
        container.className += ' mel-table-merge-head';
    };

    HeaderMerge.prototype._applyBorderPatch = function() {
        if (!this.options.borderPatch) return;

        var renderer = this.table ? this.table.renderer : null;
        var headerTable = renderer ? renderer.headerTable : null;
        if (!headerTable) return;

        if ((' ' + headerTable.className + ' ').indexOf(' mel-header-merge-fix ') > -1) return;
        headerTable.className += ' mel-header-merge-fix';
    };

    MelUi.Table = MelUi.Table || {};
    MelUi.Table.plugins = MelUi.Table.plugins || {};
    MelUi.Table.plugins.HeaderMerge = HeaderMerge;

})(window.MelUi = window.MelUi || {});

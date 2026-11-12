/**
 * MelUi Table 表格组件 - 合计行插件
 * 只负责计算合计数据，DOM 渲染由 Renderer 统一处理
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.1.1
 * @Date：2026-10-10
 * @Pubdate：2026-11-12 17:59:30
 */

 (function(MelUi) {

    /**
     * Summary 合计行插件
     * @param {Object} options 配置
     *   columns: 需要合计的字段名数组，如 ['mj', 'scjj']
     *   title: 合计行标题，默认 '合计'
     *   titleColumn: 标题放在第几列（索引），默认0
     *   scope: 合计统计范围，默认 'currentPage'
     *          'currentPage' —— 无论本地分页还是远程分页，只统计当前页可见行（含本页新增草稿行）
     *          'all'         —— 统计全部数据：
     *                           本地分页：前端对全量数据源自动聚合；
     *                           远程分页：前端拿不到全量数据，不自动计算，只渲染 externalData，未配置则显示 "—"
     *   externalData: 外部合计对象，仅 scope='all' 且远程分页时生效，key 与 columns 字段一一对应；scope='currentPage' 时忽略
     *   fixedFooter: 是否把合计行渲染到纵向固定表尾，默认 true。
     *          true  —— 合计行渲染到独立固定层，贴在表格可视区底部，垂直滚动不动、横向滚动跟随表身（默认）
     *          false —— 旧行为：合计行是表身末尾的普通行，跟随垂直滚动
     *          仅对单条全局合计行生效；可用高度不足时渲染层会自动降级回表身末尾并 warn
     */
    function Summary(options) {
        this.options = this._extend({
            columns: [],
            title: '合计',
            titleColumn: 0,
            scope: 'currentPage',
            externalData: {},
            fixedFooter: true
        }, options || {});
    }

    Summary.prototype = new MelUi.Table.PluginBase();
    Summary.prototype.constructor = Summary;

    /**
     * 初始化：只监听事件、算数据，不碰 DOM
     */
    Summary.prototype.init = function(table) {
        this.table = table;
        this._warned = false;
        var self = this;

        // 监听 Renderer 请求合计数据（每次重绘表身后触发）
        table.eventBus.on('summaryRequest', function() {
            self._emitSums(self._calcSums());
        });

        // 单元格变化时重新计算
        table.eventBus.on('cellChange', function() {
            self._emitSums(self._calcSums());
        });
    };

    /**
     * 发出合计数据
     * 渲染层只认载荷里的 fixed 标记决定渲染目标（表身末尾 / 固定表尾），
     * 这样插件不需要去读 renderer 内部结构，耦合点只有这一个布尔值
     * @param {Object} sums 合计数据
     */
    Summary.prototype._emitSums = function(sums) {
        this.table.eventBus.emit('summaryChange', {
            sums: sums,
            fixed: this.options.fixedFooter === true
        });
    };

    /**
     * 计算各列合计值
     * @return {Object} {data, title, titleColumn, blank}
     */
    Summary.prototype._calcSums = function() {
        var opts = this.options;
        var ds = this.table.dataStore;
        var isAll = String(opts.scope).toLowerCase() === 'all';

        // 默认 currentPage：本地 / 远程一律只统计当前页可见行，externalData 不参与
        if (!isAll) {
            return this._build(this._sumRows(this._getPageRows()), false);
        }

        // scope = 'all' + 远程分页：前端无全量数据，只渲染外部传入的合计
        if (ds.remotePaging) {
            if (this._hasExternalData()) {
                return this._build(this._pickExternal(), false);
            }
            // 未配置 externalData：控制台告警 + 合计行显示 "—"（让使用者一眼看出没配/配错）
            this._warnMissingExternal();
            return this._build(this._dashSums(), true);
        }

        // scope = 'all' + 本地分页：对全量数据源聚合
        return this._build(this._sumRows(ds.rows || []), false);
    };

    /**
     * 取当前页可见行：dataStore.getVisibleRows 已处理本地切片 / 远程 / 兜底降级 / 新增草稿行
     */
    Summary.prototype._getPageRows = function() {
        var ds = this.table.dataStore;
        if (typeof ds.getVisibleRows === 'function') {
            return ds.getVisibleRows() || [];
        }
        return ds.rows || [];
    };

    /**
     * 按行数组聚合各列合计
     * @return {Object} {字段: 合计值}
     */
    Summary.prototype._sumRows = function(rows) {
        var sums = {};
        var columns = this.options.columns;

        for (var i = 0; i < columns.length; i++) {
            var field = columns[i];
            sums[field] = 0;

            for (var j = 0; j < rows.length; j++) {
                var val = parseFloat(rows[j][field]);
                if (!isNaN(val)) {
                    sums[field] += val;
                }
            }
        }

        return sums;
    };

    /**
     * 组装给 Renderer 的合计结构
     * @param {Object} sums 各列合计值
     * @param {Boolean} blank 是否无数据可算（true 时合计单元格渲染为占位符 "—"）
     */
    Summary.prototype._build = function(sums, blank) {
        return {
            data: sums,
            title: this.options.title,
            titleColumn: this.options.titleColumn,
            blank: !!blank
        };
    };

    /**
     * 合计行整行显示 "—"（远程分页 scope='all' 但没给 externalData）
     */
    Summary.prototype._dashSums = function() {
        var sums = {};
        var columns = this.options.columns;

        for (var i = 0; i < columns.length; i++) {
            sums[columns[i]] = '—';
        }

        return sums;
    };

    /**
     * 是否配置了有效的外部合计数据（对象且至少一个合计字段有值）
     */
    Summary.prototype._hasExternalData = function() {
        var ext = this.options.externalData;
        if (!ext || typeof ext !== 'object') return false;

        var columns = this.options.columns;
        for (var i = 0; i < columns.length; i++) {
            var v = ext[columns[i]];
            if (v !== undefined && v !== null && v !== '') return true;
        }
        return false;
    };

    /**
     * 取外部合计值，统一转成数字，缺失字段按 0（避免出现 NaN / 字符串 toFixed 报错）
     */
    Summary.prototype._pickExternal = function() {
        var ext = this.options.externalData || {};
        var sums = {};
        var columns = this.options.columns;

        for (var i = 0; i < columns.length; i++) {
            var field = columns[i];
            var num = parseFloat(ext[field]);
            sums[field] = isNaN(num) ? 0 : num;
        }
        return sums;
    };

    /**
     * 远程分页 + scope='all' 未配置 externalData：只告警一次
     */
    Summary.prototype._warnMissingExternal = function() {
        if (this._warned) return;
        this._warned = true;

        if (window.console && window.console.warn) {
            window.console.warn(
                '[MelUi Table / Summary] 远程分页模式下前端无法计算全量合计。'
                + '如需展示全部数据总合计，请配置 externalData（后端返回的合计对象）；'
                + '如需统计当前页合计，请把 scope 改为 "currentPage"。合计行已显示为 "—"。'
            );
        }
    };

    Summary.prototype._extend = function(target) {
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

    MelUi.Table = MelUi.Table || {};
    MelUi.Table.plugins = MelUi.Table.plugins || {};
    MelUi.Table.plugins.Summary = Summary;

})(window.MelUi = window.MelUi || {});

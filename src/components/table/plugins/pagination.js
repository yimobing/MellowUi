/**
 * MelUi Table 表格组件 - 分页插件
 * 底部分页栏，支持自定义位置和对齐方式
 * 样式统一放在 index.css（.mel-pagination 系列），本插件不再写内联样式
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.3.0
 * @Date：2026-10-10
 * @PubDate：2026-11-02
 */

 (function(MelUi) {

    /**
     * Pagination 分页插件
     * @param {Object} options 配置
     *   pageSize: 每页条数，默认10
     *   pageMode: 分页模式 'list' 数字列表 / 'select' 下拉选择，默认'list'
     *   pageListSize: 数字列表模式显示几个页码，默认5
     *   position: 分页栏位置 'bottom'=表格下方 / 'top'=表格上方 / 'fixed'=固定页面底部，默认'bottom'
     *   align: 分页内容对齐 'left'=居左 / 'center'=居中 / 'right'=居右，默认'right'
     */
    function Pagination(options) {
        this.options = this._extend({
            pageSize: 10,
            pageMode: 'list',
            pageListSize: 5,
            position: 'bottom',
            align: 'right'
        }, options || {});
    }

    Pagination.prototype = new MelUi.Table.PluginBase();
    Pagination.prototype.constructor = Pagination;

    /**
     * 初始化
     */
    Pagination.prototype.init = function(table) {
        this.table = table;
        var self = this;

        // 把分页位置回填到表格options，供renderer _applyLayout判断是否扣除分页高度
        // position !== 'fixed' 时分页在普通文档流，需要预留分页位置；fixed脱离文档流不需要预留
        table.options._paginationPos = this.options.position || 'bottom';

        table.dataStore.setPageSize(this.options.pageSize);

        table.eventBus.on('rendered', function() {
            self._renderBar();
        });

        table.eventBus.on('rowAdd', function() {
            self._updateTotal();
        });
        table.eventBus.on('rowDelete', function() {
            self._updateTotal();
        });
    };

    /**
     * 渲染分页栏
     */
    Pagination.prototype._renderBar = function() {
        var total = this.table.dataStore.rows.length;
        var totalPages = this.table.dataStore.getTotalPages();
        var curpage = this.table.dataStore.currentPage;

        if (this.barDom && this.barDom.parentNode) {
            this.barDom.parentNode.removeChild(this.barDom);
        }

        // 位置class：fixed脱离文档流
        var posCls = '';
        if (this.options.position === 'fixed') {
            posCls = ' mel-pagination-fixed';
        }

        // 对齐class
        var alignMap = {left: 'left', center: 'center', right: 'right'};
        var alignCls = ' mel-pagination-align-' + (alignMap[this.options.align] || 'right');

        var html = '<div class="mel-pagination' + posCls + alignCls + '">';
        html += '<span class="mel-pagination-total">共 ' + total + ' 条</span>';

        if (this.options.pageMode === 'select') {
            html += '<select class="mel-page-select">';
            for (var i = 1; i <= totalPages; i++) {
                html += '<option value="' + i + '"' + (i === curpage ? ' selected' : '') + '>第 ' + i + ' 页</option>';
            }
            html += '</select>';
        } else {
            html += '<span class="mel-page-btn" data-action="first">首页</span>';
            html += '<span class="mel-page-btn" data-action="prev">上一页</span>';

            var start = Math.max(1, curpage - Math.floor(this.options.pageListSize / 2));
            var end = Math.min(totalPages, start + this.options.pageListSize - 1);
            start = Math.max(1, end - this.options.pageListSize + 1);

            for (var i = start; i <= end; i++) {
                var activeCls = i === curpage ? ' active' : '';
                html += '<span class="mel-page-num' + activeCls + '" data-page="' + i + '">' + i + '</span>';
            }

            html += '<span class="mel-page-btn" data-action="next">下一页</span>';
            html += '<span class="mel-page-btn" data-action="last">尾页</span>';
        }

        html += '</div>';

        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        this.barDom = tempDiv.firstChild;

        // 根据 position 决定插入位置
        if (this.options.position === 'top') {
            this.table.renderer.el.insertBefore(this.barDom, this.table.renderer.el.firstChild);
        } else {
            this.table.renderer.el.appendChild(this.barDom);
        }

        this._bindEvents();
    };

    /**
     * 绑定分页事件
     */
    Pagination.prototype._bindEvents = function() {
        var self = this;

        this.barDom.onclick = function(e) {
            var event = e || window.event;
            var target = event.target || event.srcElement;

            if (target.getAttribute && target.getAttribute('data-page')) {
                var page = parseInt(target.getAttribute('data-page'));
                self.goToPage(page);
                return;
            }

            if (target.getAttribute && target.getAttribute('data-action')) {
                var action = target.getAttribute('data-action');
                var totalPages = self.table.dataStore.getTotalPages();
                var curpage = self.table.dataStore.currentPage;

                if (action === 'first') self.goToPage(1);
                if (action === 'prev') self.goToPage(curpage - 1);
                if (action === 'next') self.goToPage(curpage + 1);
                if (action === 'last') self.goToPage(totalPages);
            }
        };

        var select = this.barDom.querySelector('.mel-page-select');
        if (select) {
            select.onchange = function() {
                self.goToPage(parseInt(this.value));
            };
        }
    };

    /**
     * 跳转到指定页
     */
    Pagination.prototype.goToPage = function(page) {
        var totalPages = this.table.dataStore.getTotalPages();
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        this.table.dataStore.currentPage = page;

        this._renderBar();

        this.table.eventBus.emit('pageChange', {
            curpage: page,
            pagesize: this.options.pageSize
        });
    };

    /**
     * 更新总记录数
     */
    Pagination.prototype._updateTotal = function() {
        var totalPages = this.table.dataStore.getTotalPages();
        if (this.table.dataStore.currentPage > totalPages) {
            this.table.dataStore.currentPage = totalPages;
        }
        this._renderBar();
    };

    /**
     * 简单对象合并
     */
    Pagination.prototype._extend = function(target) {
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
    MelUi.Table.plugins.Pagination = Pagination;

})(window.MelUi = window.MelUi || {});

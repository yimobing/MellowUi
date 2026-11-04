/**
 * MelUi Table 表格组件 - 分页插件
 * 底部分页栏，支持自定义位置和对齐方式
 * 样式统一放在 index.css（.mel-pagination 系列），本插件不再写内联样式
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.7.1
 * @Date：2026-10-10
 * @Pubdate：2026-11-04
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
     *   showQuickJumper: 是否显示页码快速跳转下拉(可选)，默认true。true显示"跳至__页"下拉，可选中某页直接跳转
     *   showSizeChanger: 是否显示每页条数切换下拉(可选)，默认true。true显示"每页__条"下拉，可选候选列表中的条数
     */
    function Pagination(options) {
        this.options = this._extend({
            pageSize: 10,
            pageMode: 'list',
            pageListSize: 5,
            position: 'bottom',
            align: 'right',
            showQuickJumper: true,
            showSizeChanger: true
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

        // 分页插件用默认 pageSize 覆盖后，需再触发一次降级对齐：
        // remotePaging=true 且 enableRemotePagingFallback=true 且后端 total 不可信时，
        // 让 pageSize 对齐为当前数据长度，保证初始化铺满一页；用户手动切换下拉后以用户选择为准。
        if (table.dataStore._alignFallbackPageSize) {
            table.dataStore._alignFallbackPageSize();
        }

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
     * 获取每页条数下拉候选列表
     * 固定候选值，若当前 pageSize 不在候选内则追加进去（并保持升序），确保下拉默认选中当前 pageSize
     * @param {Number} currentSize 当前每页条数
     * @return {Array}
     */
    Pagination.prototype._getPageSizeOptions = function(currentSize) {
        var defaults = [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 100, 150, 200, 300, 400, 500, 1000, 2000, 5000];
        var options = [];
        var hasCurrent = false;

        for (var i = 0; i < defaults.length; i++) {
            options.push(defaults[i]);
            if (defaults[i] === currentSize) {
                hasCurrent = true;
            }
        }

        // 当前 pageSize 不在候选列表内时，追加并升序排列
        if (!hasCurrent && currentSize && currentSize > 0) {
            options.push(currentSize);
            options.sort(function(a, b) {
                return a - b;
            });
        }

        return options;
    };

    /**
     * 渲染分页栏
     */
    Pagination.prototype._renderBar = function() {
        var ds = this.table.dataStore;
        // 总记录数取值（统一由 DataStore 矫正，保证与总页数、每页条数下拉口径一致）：
        //   - remotePaging=true：后端 total>0 且 >= 返回列表长度 → 采用后端 total；
        //     后端 total=0 或 < 返回列表长度（数据自相矛盾）→ 降级采用本次返回实际行数 rows.length。
        //   - remotePaging=false：取本地数据行数 rows.length。
        var total = ds.getEffectiveTotal();
        if (isNaN(total)) total = 0;
        var totalPages = ds.getTotalPages();
        var curpage = ds.currentPage;

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
            // 翻页按钮禁用规则：
            //   - 总页数 <=0（如 remotePaging 且 total=0）时，四个翻页按钮全部禁用
            //   - 首页/上一页：curpage<=1 时禁用
            //   - 下一页/尾页：curpage>=totalPages 时禁用
            var disableAll = (totalPages <= 0);
            var disablePrev = disableAll || (curpage <= 1);
            var disableNext = disableAll || (curpage >= totalPages);

            var disabledAttr = function(isDisabled) {
                return isDisabled ? ' disabled' : '';
            };

            html += '<button type="button" class="mel-page-btn" data-action="first"' + disabledAttr(disablePrev) + '>首页</button>';
            html += '<button type="button" class="mel-page-btn" data-action="prev"' + disabledAttr(disablePrev) + '>上一页</button>';

            if (totalPages > 0) {
                var start = Math.max(1, curpage - Math.floor(this.options.pageListSize / 2));
                var end = Math.min(totalPages, start + this.options.pageListSize - 1);
                start = Math.max(1, end - this.options.pageListSize + 1);

                for (var i = start; i <= end; i++) {
                    var activeCls = i === curpage ? ' active' : '';
                    html += '<button type="button" class="mel-page-num' + activeCls + '" data-page="' + i + '">' + i + '</button>';
                }
            }

            html += '<button type="button" class="mel-page-btn" data-action="next"' + disabledAttr(disableNext) + '>下一页</button>';
            html += '<button type="button" class="mel-page-btn" data-action="last"' + disabledAttr(disableNext) + '>尾页</button>';
        }

        // 每页条数切换下拉（showSizeChanger）
        if (this.options.showSizeChanger) {
            // 选中项匹配值（统一走 DataStore 矫正）：
            //   - remotePaging=true 且 total 可信 → 对齐配置的 pageSize；
            //   - remotePaging=true 且 total 降级（=0 或 < 返回列表长度）→ 对齐返回列表长度 rows.length，
            //     若该值不在候选列表则自动追加进去，且此时强制单页（下拉只有这一页可选）。
            //   - remotePaging=false → 对齐配置的 pageSize（pageSize 不在候选时同样自动追加，见 _getPageSizeOptions）。
            var sizeMatch = ds.getEffectivePageSize();
            var sizeOptions = this._getPageSizeOptions(sizeMatch);
            html += '<span class="mel-pagination-size">每页';
            html += '<select class="mel-page-size-select">';
            for (var s = 0; s < sizeOptions.length; s++) {
                var sizeVal = sizeOptions[s];
                html += '<option value="' + sizeVal + '"' + (sizeVal === sizeMatch ? ' selected' : '') + '>' + sizeVal + ' 条</option>';
            }
            html += '</select>';
            html += '</span>';
        }

        // 页码快速跳转下拉（showQuickJumper）
        if (this.options.showQuickJumper) {
            html += '<span class="mel-pagination-jumper">跳至';
            html += '<select class="mel-page-jumper-select">';
            if (totalPages > 0) {
                for (var j = 1; j <= totalPages; j++) {
                    html += '<option value="' + j + '"' + (j === curpage ? ' selected' : '') + '>第 ' + j + ' 页</option>';
                }
            } else {
                html += '<option value="1">第 1 页</option>';
            }
            html += '</select>';
            html += '</span>';
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

        // 每页条数切换下拉（showSizeChanger）：改 pageSize，重置页码到第1页，触发 pageChange 让外部/本地重新分页
        var sizeSelect = this.barDom.querySelector('.mel-page-size-select');
        if (sizeSelect) {
            sizeSelect.onchange = function() {
                var newSize = parseInt(this.value);
                var ds = self.table.dataStore;
                ds.setPageSize(newSize);
                self.table.eventBus.emit('pageChange', {
                    curpage: ds.currentPage,
                    pagesize: newSize
                });
                self._renderBar();
            };
        }

        // 页码快速跳转下拉（showQuickJumper）：直接跳转到选中页
        var jumperSelect = this.barDom.querySelector('.mel-page-jumper-select');
        if (jumperSelect) {
            jumperSelect.onchange = function() {
                self.goToPage(parseInt(this.value));
            };
        }
    };

    /**
     * 跳转到指定页
     * 边界防护：
     *   - 总页数 <=0（如 remotePaging 且 total=0）时，直接返回，不允许切换页码，避免非法页码导致切片/序号负数；
     *   - 页码越界时 clamp 到合法范围。
     */
    Pagination.prototype.goToPage = function(page) {
        var ds = this.table.dataStore;
        var totalPages = ds.getTotalPages();

        // total=0 无数据可翻页：直接拒绝，不触发分页事件
        if (totalPages <= 0) {
            return;
        }

        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        // 切换页码：清空当前页插队集合(addRowMode='currentPage'新增行标记)，新增行回归普通分页
        ds.clearTempAppend();

        ds.currentPage = page;

        this._renderBar();

        this.table.eventBus.emit('pageChange', {
            curpage: page,
            pagesize: this.options.pageSize
        });
    };

    /**
     * 更新总记录数
     * 远程分页(remotePaging=true)：total 由外部传入控制，新增/删除行不改变总条数，不重算；
     * 本地分页：重算 rows.length，并修正越界页码。
     */
    Pagination.prototype._updateTotal = function() {
        var ds = this.table.dataStore;
        if (ds.remotePaging) {
            this._renderBar();
            return;
        }
        var totalPages = ds.getTotalPages();
        if (ds.currentPage > totalPages) {
            ds.currentPage = totalPages;
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

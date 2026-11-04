/**
 * MelUi Table 表格组件 - 序号列插件
 * 在表格最前面插入一列序号
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.4.0
 * @Date：2026-10-10
 * @Pubdate：2026-11-04
 */

 (function(MelUi) {

    /**
     * SerialNo 序号列插件
     * @param {Object} options 配置
     *   width: 列宽，默认50
     *   showNewRowSerialNumber: 新增行是否显示序号，默认false(可选)。false 新增行序号为空（便于一眼识别是新增行）；true 正常展示序号
     */
    function SerialNo(options) {
        this.options = this._extend({
            width: 50,
            showNewRowSerialNumber: false
        }, options || {});
    }

    SerialNo.prototype = new MelUi.Table.PluginBase();
    SerialNo.prototype.constructor = SerialNo;

    /**
     * 初始化
     */
    SerialNo.prototype.init = function(table) {
        this.table = table;

        // 在列配置最前面插入序号列
        table.dataStore.columns.unshift({
            field: '_serialNo',
            title: '序号',
            width: this.options.width,
            renderer: 'text',
            align: 'center'
        });

        // 监听行数据变化，更新序号
        var self = this;
        table.eventBus.on('renderBody', function() {
            self._updateSerialNumbers();
        });

        // 初始化后更新一次
        this._updateSerialNumbers();
    };

    /**
     * 更新序号列
     * 基于当前页可见行(getVisibleRows)计算：
     * 远程分页(remotePaging=true)：组件只有当前页数据，序号按
     *   (currentPage-1)*pageSize + 当前页内相对下标 + 1 计算，保证跨页连续；
     * 本地分页/不分页：序号为行在全局数组中的下标 + 1。
     * 新增行(_isTempAdd)默认不显示序号(showNewRowSerialNumber=false)，序号置空，便于一眼识别；设为true则正常展示。
     */
    SerialNo.prototype._updateSerialNumbers = function() {
        var ds = this.table.dataStore;
        var visibleRows = ds.getVisibleRows();
        var showNewNo = !!this.options.showNewRowSerialNumber;

        if (ds.remotePaging && ds.pageSize > 0) {
            // 远程分页：基于页码与页容量计算全局序号
            var base = (ds.currentPage - 1) * ds.pageSize;
            // 独立计数器：只对【非新增行】递增序号，
            // 新增行(_isTempAdd)在 showNewRowSerialNumber=false 时序号置空且【不占位】，
            // 因此即使新增行 unshift 到最前面，原有行序号仍保持 1,2,3,4 不偏移。
            var counter = 0;
            for (var i = 0; i < visibleRows.length; i++) {
                if (!showNewNo && visibleRows[i]._isTempAdd) {
                    visibleRows[i]._serialNo = '';
                } else {
                    counter++;
                    visibleRows[i]._serialNo = (base + counter).toString();
                }
            }
        } else {
            for (var j = 0; j < visibleRows.length; j++) {
                if (!showNewNo && visibleRows[j]._isTempAdd) {
                    visibleRows[j]._serialNo = '';
                } else {
                    visibleRows[j]._serialNo = (visibleRows[j]._rowIndex + 1).toString();
                }
            }
        }
    };

    /**
     * 简单对象合并
     */
    SerialNo.prototype._extend = function(target) {
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
    MelUi.Table.plugins.SerialNo = SerialNo;

})(window.MelUi = window.MelUi || {});

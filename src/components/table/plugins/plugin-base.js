/**
 * MelUi Table 表格组件 - 插件基类
 * 所有插件继承此基类，实现统一接口
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.0
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * PluginBase 插件基类构造函数
     * @param {Object} options 插件配置
     */
    function PluginBase(options) {
        this.options = options || {};
        this.table = null;
    }

    /**
     * 初始化插件（由表格主类调用）
     * @param {Object} table 表格实例
     */
    PluginBase.prototype.init = function(table) {
        this.table = table;
    };

    /**
     * 销毁插件
     */
    PluginBase.prototype.destroy = function() {
        this.table = null;
    };

    MelUi.Table = MelUi.Table || {};
    MelUi.Table.PluginBase = PluginBase;

})(window.MelUi = window.MelUi || {});

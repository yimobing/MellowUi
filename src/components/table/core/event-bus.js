/**
 * MelUi Table 表格组件 - 事件总线
 * 负责表格内部事件的发布与订阅，解耦核心层与插件层
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.3
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    /**
     * EventBus 构造函数
     */
    function EventBus() {
        this._listeners = {};
    }

    /**
     * 订阅事件
     * @param {String} eventName 事件名
     * @param {Function} handler 回调函数
     */
    EventBus.prototype.on = function(eventName, handler) {
        if (!this._listeners[eventName]) {
            this._listeners[eventName] = [];
        }
        this._listeners[eventName].push(handler);
    };

    /**
     * 取消订阅
     * @param {String} eventName 事件名
     * @param {Function} handler 回调函数
     */
    EventBus.prototype.off = function(eventName, handler) {
        if (!this._listeners[eventName]) return;

        var arr = this._listeners[eventName];
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === handler) {
                arr.splice(i, 1);
                break;
            }
        }
    };

    /**
     * 发布事件
     * @param {String} eventName 事件名
     * @param {*} data 传递的数据
     */
    EventBus.prototype.emit = function(eventName, data) {
        if (!this._listeners[eventName]) return;

        var arr = this._listeners[eventName];
        for (var i = 0; i < arr.length; i++) {
            try {
                arr[i](data);
            } catch (e) {
                // 单个监听器出错不影响其他监听器
            }
        }
    };

    // 暴露到命名空间
    MelUi.Table = MelUi.Table || {};
    MelUi.Table.EventBus = EventBus;

})(window.MelUi = window.MelUi || {});

/**
 * MelUi Table 表格组件 - 入口文件
 * 负责挂载构造函数到全局命名空间
 * 兼容性：IE9 / IE10 / IE11 / Edge
 * @Version：v1.0.1
 * @Date：2026-10-10
 * @Pubdate：2026-10-10
 */

(function(MelUi) {

    // 先把已有的 MelUi.Table 对象（Core/Renderer/DataStore 等）保存下来
    var oldTable = MelUi.Table || {};

    // 定义对外调用的函数
    function Table(options) {
        return new Table.Core(options);
    }

    // 把旧对象上的所有属性（Core、Renderer、DataStore、plugins 等）合并到新函数上
    for (var key in oldTable) {
        if (oldTable.hasOwnProperty(key)) {
            Table[key] = oldTable[key];
        }
    }

    // 确保 plugins 命名空间存在
    Table.plugins = Table.plugins || {};

    MelUi.Table = Table;

})(window.MelUi = window.MelUi || {});

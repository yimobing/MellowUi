// ===== table打包专用入口【仅供rollup编译，演示页面HTML请勿引入本文件】 =====
// 1.优先引入table基础入口，初始化 MelUi.Table 命名空间，必须放在最前面！
import './index.js';

// 2.core核心模块
import './core/data-store.js';
import './core/event-bus.js';
import './core/renderer.js';
import './core/layout.js';
import './core/table.js';

// 3.plugins插件模块
import './plugins/plugin-base.js';
import './plugins/serial-no.js';
import './plugins/checkbox.js';
import './plugins/state-column.js';
import './plugins/sort.js';
import './plugins/pagination.js';
import './plugins/summary.js';
import './plugins/export.js';

// 4.cell-renderers单元格渲染器
import './cell-renderers/text.js';
import './cell-renderers/input.js';
import './cell-renderers/textarea.js';
import './cell-renderers/radio.js';
import './cell-renderers/checkbox-cell.js';
import './cell-renderers/button.js';

// 5.table组件样式
import './index.css';

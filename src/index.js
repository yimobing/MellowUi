
//----------------------------------------
// CSS打包处理：把各个组件的CSS + 公用CSS 合并打包成一个CSS
// 将以下css会被`rollup‑plugin‑postcss`提取，合并输出到：`dist/melui.css` / `dist/melui.min.css`
//----------------------------------------

// · 基础UI样式优先导入，保证css输出顺序正确
import './components/layout/index.css';
import './components/button/index.css';

// · 各个组件
// layout 组件
import './components/layout/index.js';

// dialog 组件
import './components/dialog/index.js';
import './components/dialog/index.css';

// datePicker 组件
import './components/datePicker/index.js';
import './components/datePicker/index.css';

// drawer 组件
import './components/drawer/index.js';
import './components/drawer/index.css';

// pagination 组件
import './components/pagination/index.js';
import './components/pagination/index.css';

// table 组件
import './components/table/build-entry.js';
import './components/table/index.css';


// 
export default window.MelUi;
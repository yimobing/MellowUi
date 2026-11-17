
//----------------------------------------
// JS打包处理：
// 只处理 JS，顺带提取组件内 import 进来的 css（如果组件js没有import css，则css不会被处理）
// `terser`做 JS 压缩，`ecma:5`，保证兼容 IE9，去掉注释。
//----------------------------------------

// rollup.config.js
import fs from 'fs';
import path from 'path';
import { terser } from 'rollup-plugin-terser';
import postcss from 'rollup-plugin-postcss';
import cssnano from 'cssnano';
import autoprefixer from 'autoprefixer';
import copy from 'rollup-plugin-copy';


// ===================== 标记解封插件（每个 bundle 都必须放第一位） ======================
/**
 * activateRollupOnly()
 *
 * 解决什么问题：
 * 源码里 CSS 通过 import './xxx.css' 引入，postcss 插件能处理，但浏览器原生 ESM 不能处理，
 * 直接用 type="module" 跑源码会请求 css 并报 MIME 错误。
 *
 * 做法：
 * 源码把 css import 包进 __ROLLUP_ONLY__ 块注释，
 * 浏览器看到的是纯注释（不请求 css），构建时本插件把注释解开成真正的 import，
 * 再交给 postcss 收集合并。
 *
 * ⚠️ 顺序要求：必须排在 createCssDev() / createCssProd() 之前，
 *    否则 postcss 看不到 css import，css 不会被抽取，melui.css 会是空的。
 */
function activateRollupOnly() {
  return {
    name: 'melui-activate-rollup-only',
    transform(code, id) {
      // 第三方依赖不动，只处理项目源码
      if (id.indexOf('node_modules') !== -1) return null;
      return code.replace(/\/\*#__ROLLUP_ONLY__([\s\S]*?)\*\//g, '$1');
    }
  };
}



// ===================== 清理 UMD 临时全局（util 扩展包专用） =====================
/**
 * dropTempGlobal(name)
 *
 * 背景：UMD 包装的执行顺序是「先跑工厂函数，再把返回值赋给 global.xxx」。
 * 所以想在模块代码里 delete 临时全局是无效的，赋值发生在它之后。
 * 这里改为在产物末尾追加一段删除代码，执行时机在全局赋值之后。
 *
 * util 扩展包的真实入口是 melui.util，占位名只是 UMD 语法的妥协，不能让用户看到。
 */
function dropTempGlobal(name) {
  return {
    name: 'melui-drop-temp-global',
    writeBundle: function (options) {
      if (!options.file) return;
      fs.appendFileSync(
        options.file,
        '\n;(function () { try { delete window.' + name + '; } catch (e) { window.' + name + ' = undefined; } }());\n'
      );
    }
  };
}


// ===================== Terser JS压缩混淆配置（用于生产.min.js） =====================
// 通用JS压缩配置
const terserConfig = {
  /**
   * ecma：指定输出JS语法版本
   * 可选值：5 / 2015 / 2016 ...
   * 👉 这里固定 5，强制输出 ES5，保证 IE9 可以正常解析，绝对不能改成更高版本！
   * 如果改成 2015，会保留箭头函数、const等，IE9直接报错
   */
  ecma: 5,

  /**
   * mangle：局部变量/局部函数名混淆开关
   * 可选值：true | false | 对象{}
   * true ：开启混淆，函数内部临时变量、局部函数缩短成 a,b,c 这类短名（推荐）
   * false：关闭混淆，变量名全部保留，min文件只是去掉空格，可读性极强
   * 对象模式进阶：可以配置 mangle.properties 混淆对象key，⚠️【千万不要开！会毁掉MelUi对外API】
   * 注意：terser 默认**不会混淆挂载到 MelUi 上的属性名**（addRow、DataStore这种对外API），这是正常的
   */
  mangle: true,

  /**
   * compress：代码压缩优化开关
   * 可选值：true | false | 对象{}
   * true：开启全部优化：删除空格、删除死代码、常量折叠、if判断简化、移除无用变量等
   * false：只做名字混淆，不做代码逻辑精简
   * 对象模式：可以精细关闭某些优化项，比如 compress: { drop_console: true } 自动删掉console.log
   */
  compress: true,

  /**
   * output：输出格式配置
   */
  output: {
    /**
     * comments：注释处理
     * 可选值：
     * false       → 删除所有注释（你现在用的）
     * "all"       → 保留全部注释
     * "some"      → 只保留 /*! 开头的版权注释（开源库常用，保留许可证）
     * /@license/  → 正则匹配，只保留匹配的注释
     */
    comments: false
  }
};



// ===================== PostCSS 封装：每次调用生成全新postcss实例，避免样式互相污染 =====================
/**
 * createCssDev()
 * 开发环境CSS（开发版 xxx.css），给非min的开发版产物使用
 * 只做autoprefixer自动补浏览器前缀，**不压缩css，保留换行注释**，方便调试样式
 */
function createCssDev() {
  return postcss({
    /**
     * extract：是否把css抽离成独立css文件
     * true ：单独输出 .css 文件（和js同名同目录，就是你现在的效果）
     * false：css内联进JS里面，运行时动态创建style标签注入（不适合你的组件库）
     */
    extract: true,

    /**
     * verbose：是否打印详细处理日志到控制台
     * true：输出日志，看到哪些css被处理，开发排错好用
     * false：静默执行，控制台干净
     */
    verbose: true,

    plugins: [
      /**
       * autoprefixer：自动添加浏览器css前缀 -webkit- / -ms-
       * overrideBrowserslist：覆盖browserslist配置，指定要兼容的浏览器
       * 可选浏览器标识：IE 9, IE10, IE11, chrome 58, last 2 versions（最近2个版本）
       * 👉 这里固定写死，保证所有css都带IE9需要的-ms-前缀，不要随便删减
       */
      autoprefixer({
        overrideBrowserslist: ['IE 9', 'IE 10', 'IE 11', 'last 2 versions']
      })
    ]
  });
}


/**
 * createCssProd() 
 * 生产环境CSS（压缩版 xxx.min.css），给 .min.css 压缩版本使用
 * autoprefixer补前缀 + cssnano压缩、删除注释、合并空白
 */
function createCssProd() {
  return postcss({
    extract: true,
    verbose: true,
    plugins: [
      autoprefixer({
        overrideBrowserslist: ['IE 9', 'IE 10', 'IE 11', 'last 2 versions']
      }),
      /**
       * cssnano：css压缩工具，删除空白、注释、合并属性、精简颜色值 #fff
       * preset: 压缩预设方案
       * 可选预设：
       * 'default'：默认均衡方案（兼容性优先，适合你，不会搞崩IE9样式）
       * 'advanced'：激进高级压缩，会做选择器合并、重写样式，容易产生IE兼容bug，不要用！
       */
      cssnano({
        preset: [
          'default',
          {
            /** discardComments：注释删除规则 */
            discardComments: {
              removeAll: true // true=删除全部注释；false=保留/*!版权注释
            },
            /** normalizeWhitespace：删除多余换行、空格、制表符 */
            normalizeWhitespace: true
          }
        ]
      })
    ]
  });
}




// =====================【新增】copyDemoPlugin：复制&处理demo示例文件 =====================
const copyDemoPlugin = copy({
  verbose: true,
  targets: [
    {
      src: 'demo/**/*.html',
      dest: 'release/test',
      transform(contents) {
        let html = contents.toString('utf8');

        // 删除所有含有 src="../src/components/*.js 的script标签，兼容带type/id等任意属性
        html = html.replace(/<script\b[^>]*src="\.\.\/src\/components[^"]+\.js"[^>]*><\/script>/gi, '');
        // 删除所有含有 href="../src/components/*.css 的link标签，兼容任意属性、兼容自闭合 <link ... />
        html = html.replace(/<link\b[^>]*href="\.\.\/src\/components[^"]+\.css"[^>]*\/?>/gi, '');

        // 删除源码调试用的 type="module" 脚本块（里面 import 的是 ../src/index.js，
        // 发布产物里已由下面注入的 melui.min.js 代替，保留会导致 404）
        html = html.replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/gi, '');

        // 删除源码调试用的 core.css / util 等 ../src 下的样式 link（发布产物用 melui.min.css）
        html = html.replace(/<link\b[^>]*href="\.\.\/src\/[^"]+\.css"[^>]*\/?>/gi, '');

        // polyfill 脚本路径替换
        html = html.replace(
          /<script\b[^>]*src="\.\.\/src\/polyfill\/([^"]+\.js)"[^>]*><\/script>/gi,
          '<script src="./polyfill/$1"></script>'
        );

        // 页面自己写了 ../release/dist/xxx 的引入：复制到 release/test 后改指 ../dist/xxx
        html = html.replace(
          /<script\b[^>]*src="\.\.\/release\/dist\/([^"]+\.js)"[^>]*><\/script>/gi,
          '<script src="../dist/$1"><\/script>'
        );
        html = html.replace(
          /<link\b[^>]*href="\.\.\/release\/dist\/([^"]+\.css)"[^>]*\/?>/gi,
          '<link rel="stylesheet" href="../dist/$1" />'
        );

        // 在 </head> 之前注入打包后的css、js
        // 说明：页面 head 里写了 <!-- @skipAutoInject --> 的，说明它自己已经引入了产物（比如 util 手册），则不再自动注入 melui.min.css / melui.min.js，避免重复加载
        if (html.indexOf('@skipAutoInject') === -1) {
          const injectCss = '<link rel="stylesheet" href="../dist/melui.min.css">';
          const injectJs = '<script src="../dist/melui.min.js"><\/script>';
          html = html.replace(/<\/head>/i, `${injectCss}\n${injectJs}\n</head>`);
        }

        return html;
      }
    },
    {
      // demo 目录自身静态资源原样复制：css
      src: ['demo/**/*.css'],
      dest: 'release/test/css'
    },
    {
      // demo 目录自身静态资源原样复制：图片
      src: ['demo/**/*.png', 'demo/**/*.jpg', 'demo/**/*.gif'],
      dest: 'release/test/img'
    },
    {
      // polyfill 目录自身静态资源原样复制
      src: ['demo/**/*.js'],
      dest: 'release/test/polyfill'
    }
  ]
});




export default [

    //======================== 一. 独立组件打包 ========================
    //--------------------------------
    //    · layout 布局组件
    //--------------------------------
    // layout 开发版
    {
      input: 'src/components/layout/index.js',
        output: {
            file: 'release/dist/layout/layout.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [activateRollupOnly(), createCssDev()]
    },
    // layout 压缩版
    {
        input: 'src/components/layout/index.js',
        output: {
            file: 'release/dist/layout/layout.min.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [activateRollupOnly(), createCssProd(), terser(terserConfig)]
    },


    //--------------------------------
    //    · dialog 组件
    //--------------------------------
    // dialog 开发版
    {
        input: 'src/components/dialog/index.js',
        output: {
            file: 'release/dist/dialog/dialog.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [activateRollupOnly(), createCssDev()]
    },
    // dialog 压缩版
    {
        input: 'src/components/dialog/index.js',
        output: {
            file: 'release/dist/dialog/dialog.min.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [activateRollupOnly(), createCssProd(), terser(terserConfig)]
    },


    //--------------------------------
    //    · datePicker 组件
    //--------------------------------
    // datePicker 开发版
    {
        input: 'src/components/datePicker/index.js',
        output: {
            file: 'release/dist/datePicker/datePicker.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [activateRollupOnly(), createCssDev()]
    },
    // datePicker 压缩版
    {
        input: 'src/components/datePicker/index.js',
        output: {
            file: 'release/dist/datePicker/datePicker.min.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [activateRollupOnly(), createCssProd(), terser(terserConfig)]
    },


    //--------------------------------
    //    · drawer 组件
    //--------------------------------
    // drawer 开发版
    {
      input: 'src/components/drawer/index.js',
        output: {
            file: 'release/dist/drawer/drawer.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [activateRollupOnly(), createCssDev()]
    },
    // drawer 压缩版
    {
        input: 'src/components/drawer/index.js',
        output: {
            file: 'release/dist/drawer/drawer.min.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [activateRollupOnly(), createCssProd(), terser(terserConfig)]
    },  


    //--------------------------------
    //    · pagination 组件
    //--------------------------------
    // pagination 开发版
    {
      input: 'src/components/pagination/index.js',
        output: {
            file: 'release/dist/pagination/pagination.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [activateRollupOnly(), createCssDev()]
    },
    // pagination 压缩版
    {
        input: 'src/components/pagination/index.js',
        output: {
            file: 'release/dist/pagination/pagination.min.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [activateRollupOnly(), createCssProd(), terser(terserConfig)]
    },



    //--------------------------------
    //    · table 组件
    //--------------------------------
    // table 开发版
    {
      input: 'src/components/table/build-entry.js',
        output: {
            file: 'release/dist/table/table.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [activateRollupOnly(), createCssDev()]
    },
    // table 压缩版
    {
        input: 'src/components/table/build-entry.js',
        output: {
            file: 'release/dist/table/table.min.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [activateRollupOnly(), createCssProd(), terser(terserConfig)]
    },


    //======================== 二. 工具扩展包打包 ========================
    // 全量工具（可单独使用，不依赖 melui 主包）
    // ⚠️ name 只写临时占位 _MelUiUtilTemp：UMD 的 name 不支持 melui.util 这种点语法，
    //    真正的挂载在 src/util/util.js 里完成，产物末尾由 dropTempGlobal 删掉占位名
    // 开发版
    {
        input: 'src/util/util.js',
        output: {
            file: 'release/dist/melui-util.js',
            format: 'umd',
            name: '_MelUiUtilTemp',
            exports: 'default'
        },
        plugins: [activateRollupOnly(), createCssDev(), dropTempGlobal('_MelUiUtilTemp')]
    },
    // 压缩版
    {
        input: 'src/util/util.js',
        output: {
            file: 'release/dist/melui-util.min.js',
            format: 'umd',
            name: '_MelUiUtilTemp',
            exports: 'default'
        },
        plugins: [activateRollupOnly(), createCssProd(), terser(terserConfig), dropTempGlobal('_MelUiUtilTemp')]
    },


    //======================== 三. 全局完整库打包 ======================== 
    // 即：将各个组件的JS合并打包成一个JS
    // 全量开发版
    {
        input: 'src/index.js',
        output: {
            file: 'release/dist/melui.js',
            format: 'umd',
            name: 'MelUi',
            exports: 'default'
        },
        plugins: [activateRollupOnly(), createCssDev()]
    },
    // 全量压缩版【❗唯一在这里加入 copyDemoPlugin，其他bundle不要加】
    {
        input: 'src/index.js',
        output: {
            file: 'release/dist/melui.min.js',
            format: 'umd',
            name: 'MelUi',
            exports: 'default'
        },
        plugins: [
          activateRollupOnly(),
          createCssProd(), 
          terser(terserConfig),
          copyDemoPlugin
        ]
    }
];

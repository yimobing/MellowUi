
//----------------------------------------
// CSS打包处理：打包各个组件的CSS + 公用CSS
// 将以下css会被`独立 node 脚本`build‑css.js`处理并生成“开发版 + 版本min版”两个版本的CSS文件到指定目录dist
//----------------------------------------


const fs = require('fs-extra');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

// --------------------------
// 公共基础样式数组，可以多个，后续扩展直接往数组追加
// --------------------------
const baseStyles = [
  { name: 'layout', src: 'src/styles/layout.css', outDir: 'dist/common' },
  { name: 'button', src: 'src/styles/button.css', outDir: 'dist/common' }
];

// --------------------------
// 业务组件数组
// --------------------------
const components = [
  { name: 'dialog', src: 'src/components/dialog/index.css', outDir: 'dist/dialog' },
  { name: 'datePicker', src: 'src/components/datePicker/index.css', outDir: 'dist/datePicker' },
  { name: 'drawer', src: 'src/components/drawer/index.css', outDir: 'dist/drawer' },
  { name: 'pagination', src: 'src/components/pagination/index.css', outDir: 'dist/pagination' },
  { name: 'table', src: 'src/components/table/index.css', outDir: 'dist/table' }
];

/**
 * 编译单个css资源，输出开发版 + 压缩min版
 * @param {Object} item {name,src,outDir}
 */
async function compileCssItem(item) {
  await fs.ensureDir(item.outDir);
  const sourceCss = await fs.readFile(item.src, 'utf8');

  // 开发版：仅加浏览器前缀
  const devResult = await postcss([
    autoprefixer({ overrideBrowserslist: ['IE 9', 'IE 10', 'IE 11', 'last 2 versions'] })
  ]).process(sourceCss, { from: item.src });
  await fs.writeFile(`${item.outDir}/${item.name}.css`, devResult.css);

  // 压缩min版：前缀 + cssnano压缩
  const minResult = await postcss([
    autoprefixer({ overrideBrowserslist: ['IE 9', 'IE 10', 'IE 11', 'last 2 versions'] }),
    cssnano({
      preset: ['default', {
        discardComments: { removeAll: true },
        normalizeWhitespace: true
      }]
    })
  ]).process(sourceCss, { from: item.src });
  await fs.writeFile(`${item.outDir}/${item.name}.min.css`, minResult.css);

  console.log(`✅ ${item.name} css 编译完成`);
}

async function buildAllCss() {
  // 1、编译全部基础公共样式
  for (const item of baseStyles) {
    await compileCssItem(item);
  }
  // 2、编译各个业务组件
  for (const item of components) {
    await compileCssItem(item);
  }
}

buildAllCss().catch(err => {
  console.error('❌ CSS编译异常：', err);
  process.exit(1);
});

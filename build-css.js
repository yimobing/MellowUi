const fs = require('fs-extra');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

// 新增组件在这里添加
const components = [
  { name: 'dialog', src: 'src/components/dialog/index.css', outDir: 'dist/dialog' },
  { name: 'datePicker', src: 'src/components/datePicker/index.css', outDir: 'dist/datePicker' },
  { name: 'drawer', src: 'src/components/drawer/index.css', outDir: 'dist/drawer' }
];

async function buildAllCss() {
  for (const item of components) {
    await fs.ensureDir(item.outDir);
    const sourceCss = await fs.readFile(item.src, 'utf8');

    // 开发版css：仅autoprefixer加浏览器前缀
    const devResult = await postcss([
      autoprefixer({ overrideBrowserslist: ['IE 9', 'IE 10', 'IE 11', 'last 2 versions'] })
    ]).process(sourceCss, { from: item.src });
    await fs.writeFile(`${item.outDir}/${item.name}.css`, devResult.css);

    // 压缩min版css：前缀 + cssnano压缩
    const minResult = await postcss([
      autoprefixer({ overrideBrowserslist: ['IE 9', 'IE 10', 'IE 11', 'last 2 versions'] }),
      cssnano({ preset: ['default', { discardComments: { removeAll: true }, normalizeWhitespace: true }] })
    ]).process(sourceCss, { from: item.src });
    await fs.writeFile(`${item.outDir}/${item.name}.min.css`, minResult.css);

    console.log(`✅ ${item.name} css 编译完成`);
  }
}

buildAllCss().catch(err => {
  console.error('❌ CSS编译异常：', err);
  process.exit(1);
});

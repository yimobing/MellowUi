import fs from 'node:fs';
import path from 'node:path';

/**
 * 把 core.css 拷成 dist/melui.css
 * 不用 shell cp，避免 Windows / Linux 命令差异；组件 css 多起来后再换 postcss 抽取
 */
function copyCss(srcFile, destFile) {
  return {
    name: 'melui-copy-css',
    writeBundle: function () {
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(srcFile, destFile);
    }
  };
}

export default [
  {
    // 主包：core + 组件 + util/base
    input: 'src/index.js',
    output: {
      file: 'dist/melui.js',
      format: 'umd',
      name: 'MelUi',
      exports: 'default',
      strict: false
    },
    plugins: [copyCss('src/core/core.css', 'dist/melui.css')]
  },
  {
    // 工具扩展包：可脱离 MelUI 单独使用
    input: 'src/util/index.js',
    output: {
      file: 'dist/melui-util.js',
      format: 'umd',
      name: 'meluiUtil',
      exports: 'default',
      strict: false
    }
  }
];

// rollup.config.js
import { terser } from 'rollup-plugin-terser';
import postcss from 'rollup-plugin-postcss';
import cssnano from 'cssnano';
import autoprefixer from 'autoprefixer';

// 通用JS压缩配置
const terserConfig = {
  ecma: 5,
  mangle: true,
  compress: true,
  output: {
    comments: false
    // 备用参数：comments: "some" 只删除普通注释，保留/*!开头版权注释
  }
};

// 封装函数：每次调用生成全新postcss实例，避免样式互相污染
function createCssDev() {
  return postcss({
    extract: true,
    plugins: [
      autoprefixer({
        overrideBrowserslist: ['IE 9', 'IE 10', 'IE 11', 'last 2 versions']
      })
    ]
  });
}

function createCssProd() {
  return postcss({
    extract: true,
    plugins: [
      autoprefixer({
        overrideBrowserslist: ['IE 9', 'IE 10', 'IE 11', 'last 2 versions']
      }),
      cssnano({
        preset: [
          'default',
          {
            discardComments: { removeAll: true },
            normalizeWhitespace: true
          }
        ]
      })
    ]
  });
}

export default [
    //======================== 一. 独立组件打包 ======================== 
    // dialog 开发版
    {
        input: 'src/components/dialog/index.js',
        output: {
            file: 'dist/dialog/dialog.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [createCssDev()]
    },
    // dialog 压缩版
    {
        input: 'src/components/dialog/index.js',
        output: {
            file: 'dist/dialog/dialog.min.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [createCssProd(), terser(terserConfig)]
    },

    // datePicker 开发版
    {
        input: 'src/components/datePicker/index.js',
        output: {
            file: 'dist/datePicker/datePicker.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [createCssDev()]
    },
    // datePicker 压缩版
    {
        input: 'src/components/datePicker/index.js',
        output: {
            file: 'dist/datePicker/datePicker.min.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [createCssProd(), terser(terserConfig)]
    },

    //======================== 二. 全局完整库打包 ======================== 
    // 全量开发版
    {
        input: 'src/index.js',
        output: {
            file: 'dist/melui.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [createCssDev()]
    },
    // 全量压缩版
    {
        input: 'src/index.js',
        output: {
            file: 'dist/melui.min.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [createCssProd(), terser(terserConfig)]
    }
];
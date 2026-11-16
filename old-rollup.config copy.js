// rollup.config.js
import { terser } from 'rollup-plugin-terser';
import css from 'rollup-plugin-css-only';

// 通用压缩配置抽离，统一复用
const terserConfig = {
  ecma: 5,
  mangle: true,
  compress: true
};

export default [
    // 1.dialog 未压缩开发版
    {
        input: 'src/components/dialog/index.js',
        output: {
            file: 'dist/dialog/dialog.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [
            // 每次全新实例
            css({ output: 'dist/dialog/dialog.css' })
        ]
    },
    // 2.dialog 压缩生产版
    {
        input: 'src/components/dialog/index.js',
        output: {
            file: 'dist/dialog/dialog.min.js',
            format: 'umd',
            name: 'MelUi'
        },
        // 使用 css-only 压缩（无效，不起作用）
        plugins: [
            css({ output: 'dist/dialog/dialog.min.css' }),
            terser(terserConfig)
        ]
    },
    // 3.全量未压缩合集
    {
        input: 'src/index.js',
        output: {
            file: 'dist/melui.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [
            css({ output: 'dist/melui.css' })
        ]
    },
    // 4.全量压缩生产合集
    {
        input: 'src/index.js',
        output: {
            file: 'dist/melui.min.js',
            format: 'umd',
            name: 'MelUi'
        },
        plugins: [
            css({ output: 'dist/melui.min.css' }),
            terser(terserConfig)
        ]
    }
];
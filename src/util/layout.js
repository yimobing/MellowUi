/**
 * MelUi mel-layout.js  Layout 布局可选增强脚本
 * 版本：v1.3.0
 * 创建时间：2026-08-31
 * 兼容：IE9/IE10/IE11/Edge
 *
 * 功能：
 *   针对 .mel-form-item--search 查询表单项，基于元素自身容器宽度智能切换布局：
 *   - 容器宽度 >= 阈值：hd 与 bd 同行（默认）
 *   - 容器宽度 <  阈值：自动追加 .mel-form-item--stack，hd/bd 上下堆叠
 *
 * 为什么需要这个脚本：
 *   CSS 的 @media 只能判断浏览器视口宽度，无法判断某个 form-item 自身容器有多宽。
 *   例如：1920px 大屏下，某个 col 分配的空间很窄（如 mel-span-4），
 *   此时 input 会被挤压，但 CSS 媒体查询不会触发。
 *   本脚本通过 JS 检测元素自身宽度，解决这个问题。
 *
 * 兼容说明：
 *   - 现代浏览器：使用 ResizeObserver（如果可用）
 *   - IE9/IE10/IE11：无 ResizeObserver，降级为 window.resize + 节流轮询
 *   - 不引入本脚本：search 表单项回退到 CSS @media(max-width:768px) 视口响应式
 *
 * 使用方式：
 *   <script src="dist/mel-layout.js"></script>
 *   引入后自动初始化，无需手动调用。
 *
 * 自定义阈值（可选）：
 *   在引入脚本前设置全局变量：
 *   window.MEL_LAYOUT_STACK_THRESHOLD = 200; // 单位px，默认220
 */

 (function (window, document) {
    'use strict';

    // ##A-B 智能堆叠阈值常量 ##
    // 容器宽度小于此值时，自动追加 mel-form-item--stack，hd/bd 上下堆叠
    var STACK_THRESHOLD = 220;

    // 允许外部通过全局变量自定义阈值
    if (typeof window.MEL_LAYOUT_STACK_THRESHOLD === 'number') {
        STACK_THRESHOLD = window.MEL_LAYOUT_STACK_THRESHOLD;
    }

    // 轮询间隔（ms），IE9降级时使用
    var POLL_INTERVAL = 300;

    // 节流定时器标识
    var resizeTimer = null;

    // 轮询定时器标识（IE9降级）
    var pollTimer = null;

    // 上一次检测的宽度缓存，避免重复操作DOM
    var lastWidthMap = {};

    /**
     * ##A-B 获取元素实际宽度（兼容IE9）##
     * @param {HTMLElement} el
     * @returns {number} 宽度（px）
     */
    function getElementWidth(el) {
        if (el.getBoundingClientRect) {
            return el.getBoundingClientRect().width || el.offsetWidth;
        }
        return el.offsetWidth;
    }

    /**
     * ##A-B 检查单个 search 表单项，根据容器宽度决定是否追加 stack 类 ##
     * @param {HTMLElement} item
     * @param {number} index
     */
    function checkItem(item, index) {
        var width = getElementWidth(item);
        var cacheKey = 'mel_item_' + index;
        var lastWidth = lastWidthMap[cacheKey];

        // 宽度未变化，跳过，避免重复操作DOM
        if (lastWidth === width) {
            return;
        }
        lastWidthMap[cacheKey] = width;

        var hasStack = item.className.indexOf('mel-form-item--stack') !== -1;

        if (width < STACK_THRESHOLD && !hasStack) {
            // 容器过窄，追加 stack 类，hd/bd 上下堆叠
            item.className = item.className + ' mel-form-item--stack';
        } else if (width >= STACK_THRESHOLD && hasStack) {
            // 容器变宽，移除 stack 类，恢复同行
            item.className = item.className.replace(/\s*mel-form-item--stack/g, '');
        }
    }

    /**
     * ##A-B 遍历所有 search 表单项，批量检测 ##
     */
    function checkAll() {
        var items = document.querySelectorAll('.mel-form-item--search');
        for (var i = 0; i < items.length; i++) {
            checkItem(items[i], i);
        }
    }

    /**
     * ##A-B 节流处理 window.resize ##
     */
    function onResize() {
        if (resizeTimer) {
            clearTimeout(resizeTimer);
        }
        resizeTimer = setTimeout(function () {
            checkAll();
        }, 100);
    }

    /**
     * ##A-B 初始化 ##
     *  - 绑定 window.resize
     *  - 现代浏览器优先使用 ResizeObserver
     *  - IE9/IE10/IE11 降级为 setInterval 轮询
     */
    function init() {
        // 首次检测
        checkAll();

        // 绑定窗口 resize
        if (window.addEventListener) {
            window.addEventListener('resize', onResize, false);
        } else if (window.attachEvent) {
            // IE9 兼容
            window.attachEvent('onresize', onResize);
        }

        // 检测是否支持 ResizeObserver
        if (typeof window.ResizeObserver !== 'undefined') {
            // 现代浏览器：使用 ResizeObserver 监听每个 search 项的尺寸变化
            var items = document.querySelectorAll('.mel-form-item--search');
            var observer = new window.ResizeObserver(function () {
                checkAll();
            });
            for (var i = 0; i < items.length; i++) {
                observer.observe(items[i]);
            }
        } else {
            // IE9/IE10/IE11 降级：定时轮询检测尺寸变化
            pollTimer = setInterval(function () {
                checkAll();
            }, POLL_INTERVAL);
        }
    }

    // ##A-B DOM 就绪后初始化 ##
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // IE9 下 DOMContentLoaded 可能已触发，延迟一帧执行
        setTimeout(init, 0);
    } else if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', init, false);
    } else if (document.attachEvent) {
        document.attachEvent('onreadystatechange', function () {
            if (document.readyState === 'complete') {
                init();
            }
        });
    }

    // 暴露全局对象，供业务手动触发检测
    window.MelLayout = {
        checkAll: checkAll,
        setThreshold: function (px) {
            STACK_THRESHOLD = px;
            checkAll();
        }
    };

})(window, document);

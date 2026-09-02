// src/util/layout.js
(function () {
    var melui = window.melui || {};

    /**
     * melui.formItemAutoStack
     * 监听 mel‑form‑item‑‑search 容器宽度，自动增删 mel‑form‑item‑‑stack 类
     * @param {Object} options 配置项
     * @param {HTMLElement} [options.root] 根容器，限定扫描范围；不传默认 document
     * @param {Number} [options.threshold] 堆叠判定阈值px，默认220
     * @returns {Object} instance {destroy:function} 销毁实例方法
     */
    melui.formItemAutoStack = function (options) {
        var defaults = {
            threshold: 220,
            root: document
        };
        var opt = {};
        var key;
        for (key in defaults) {
            if (defaults.hasOwnProperty(key)) {
                opt[key] = defaults[key];
            }
        }
        if (options && typeof options === 'object') {
            for (key in options) {
                if (options.hasOwnProperty(key)) {
                    opt[key] = options[key];
                }
            }
        }

        var rootEl = opt.root;
        var threshold = Number(opt.threshold) || 220;

        if (rootEl.__melAutoStackInstance) {
            return rootEl.__melAutoStackInstance;
        }

        var throttleTimer = null;
        var resizeObserver = null;

        function updateStackState() {
            var itemList = rootEl.querySelectorAll('.mel-form-item--search');
            var i;
            var item;
            var itemWidth;
            for (i = 0; i < itemList.length; i++) {
                item = itemList[i];
                itemWidth = item.offsetWidth;
                if (itemWidth < threshold) {
                    item.classList.add('mel-form-item--stack');
                } else {
                    item.classList.remove('mel-form-item--stack');
                }
            }
        }

        function throttleUpdate() {
            if (throttleTimer) {
                clearTimeout(throttleTimer);
            }
            throttleTimer = setTimeout(function () {
                updateStackState();
            }, 100);
        }

        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(throttleUpdate);
            resizeObserver.observe(rootEl);
        } else {
            window.addEventListener('resize', throttleUpdate);
        }
        updateStackState();

        function destroy() {
            var itemList;
            var i;
            var item;
            if (throttleTimer) {
                clearTimeout(throttleTimer);
                throttleTimer = null;
            }
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            } else {
                window.removeEventListener('resize', throttleUpdate);
            }
            // 销毁时清除root范围内所有stack类，还原同行布局
            itemList = rootEl.querySelectorAll('.mel-form-item--search');
            for (i = 0; i < itemList.length; i++) {
                item = itemList[i];
                item.classList.remove('mel-form-item--stack');
            }
            rootEl.__melAutoStackInstance = null;
        }

        var instance = {
            destroy: destroy,
            // 供demo外部更新阈值
            setThreshold: function (val) {
                threshold = Number(val) || 220;
                updateStackState();
            }
        };
        rootEl.__melAutoStackInstance = instance;
        return instance;
    };

    window.melui = melui;
})();

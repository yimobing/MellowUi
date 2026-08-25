/**
 * MelUi 抽屉组件
 * 版本：v1.0.0
 * 创建日期：2026-08-12
 * 更新日期：2026-08-25
 * 兼容：IE9/10/11、iOS（处理滚动穿透、遮罩击穿）
 * 调用方式：
 *    构造创建：new MelUi.Drawer({配置参数})
 *    快捷调用：MelUi.drawer({配置参数})
 */
 (function(global) {
    "use strict";

    // 生成实例唯一随机ID mel‑drawer__xxxxxx
    function genUid() {
        var chars = "0123456789abcdefghijklmnopqrstuvwxyz";
        var id = "mel-drawer__";
        for (var i = 0; i < 10; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }

    var Drawer = function(options) {
        this.options = {};
        // 默认参数
        var defaults = {
            // 方向与位置尺寸
            direction: "right", // 弹出方向：right / left / top / bottom (可选)
            width: 380, // 左右弹出方向抽屉基准宽度，单位px (可选)
            height: 320, // 上下弹出方向抽屉基准高度，单位px (可选)
            top: 0, // 抽屉距离视口上边偏移，非0则覆盖方向默认定位 (可选)
            bottom: 0, // 抽屉距离视口下边偏移，非0则覆盖方向默认定位 (可选)
            left: 0, // 抽屉距离视口左边偏移，非0则覆盖方向默认定位 (可选)
            right: 0, // 抽屉距离视口右边偏移，非0则覆盖方向默认定位 (可选)
            minWidth: 320, // 抽屉最小宽度，左右方向生效，防止宽度设置过小，单位px (可选)
            minHeight: 280, // 抽屉最小高度，上下方向生效，防止高度设置过小，单位px (可选)
            adaptive: false, // 是否居中对话框模式，true时direction、偏移、width、height、拖拽失效 (可选)
            resizable: false, // 是否开启拖拽调整大小，仅现代浏览器，IE静默忽略不报错 (可选)

            // 遮罩层相关
            showMask: true, // 是否显示遮罩层 (可选)
            maskZIndex: 9999, // 遮罩层级 (可选)
            animation: true, // 是否开启打开关闭动画 (可选)
            maskClose: true, // 点击遮罩是否关闭抽屉 (可选)

            // 按钮行为控制
            closeOnBackClick: true, // 点击顶部返回按钮是否自动关闭抽屉 (可选)
            closeOnCrossClick: true, // 点击右上角叉号关闭按钮是否自动关闭抽屉 (可选)
            destroyOnClose: true, // DOM策略：false关闭仅隐藏保留dom；true关闭销毁dom (可选)，如需保留表单搜索状态，请设置 destroyOnClose: false

            // header顶部配置
            showHeader: true, // 是否显示顶部头部区域 (可选)
            headerSticky: true, // 头部是否悬浮固定 (可选)
            headerHeight: 48, // 头部高度，单位px (可选)
            showBack: true, // 是否展示返回按钮 (可选)
            backShowIcon: true, // 返回是否显示图标 (可选)
            title: "", // 抽屉标题，超长自动省略 (可选)
            titleAlign: "center", // 标题对齐 left / center / right (可选)
            showClose: true, // 是否展示右上角关闭叉号 (可选)

            // footer底部配置
            showFooter: true, // 是否显示底部区域 (可选)
            footerSticky: true, // 底部是否悬浮固定 (可选)
            footerHeight: 52, // 底部高度，单位px (可选)
            buttons: null, // 自定义按钮数组，格式同Dialog，(可选)

            // 内容
            content: "", // 抽屉主体HTML内容 (可选)

            // 回调事件
            onOpen: null, // 抽屉打开后回调 (可选)
            onClose: null, // 抽屉关闭后回调 (可选)
            onClick: null // 底部按钮点击回调 ret从1开始 (可选)
        };

        // 简单合并参数（兼容IE）
        this.options = {};
        for(var key in defaults){
            if(defaults.hasOwnProperty(key)){
                this.options[key] = defaults[key];
            }
        }
        for(var key in options){
            if(options.hasOwnProperty(key) && options[key] !== undefined){
                this.options[key] = options[key];
            }
        }

        this.uid = genUid();
        this.maskEl = null;
        this.wrapEl = null;
        this.isOpen = false;
        this.bodyScrollLock = false;
    };

    // 打开抽屉
    Drawer.prototype.open = function() {
        var opt = this.options;
        // DOM已经存在直接显示
        if(this.wrapEl && !opt.destroyOnClose){
            this._showDom();
            return;
        }
        this._renderDom();
        this._bindEvent();
        this._lockBodyScroll();
        this.isOpen = true;
        // 动画延时触发open回调
        var self = this;
        setTimeout(function(){
            if(typeof opt.onOpen === "function"){
                opt.onOpen();
            }
        }, opt.animation ? 300 : 0);
    };

    // 关闭抽屉
    Drawer.prototype.close = function() {
        var self = this;
        var opt = this.options;
        this._unlockBodyScroll();
        this.isOpen = false;
        if(opt.destroyOnClose){
            if(this.wrapEl && this.wrapEl.parentNode){
                if(this.maskEl && this.maskEl.parentNode){
                    this.maskEl.parentNode.removeChild(this.maskEl);
                }
                this.wrapEl.parentNode.removeChild(this.wrapEl);
            }
            this.maskEl = null;
            this.wrapEl = null;
        }else{
            this._hideDom();
        }
        setTimeout(function(){
            if(typeof opt.onClose === "function"){
                opt.onClose();
            }
        }, opt.animation ? 300 : 0);
    };

    Drawer.prototype._renderDom = function(){
        var opt = this.options;
        // mask
        this.maskEl = document.createElement("div");
        this.maskEl.className = "mel-drawer__mask";
        this.maskEl.style.zIndex = opt.maskZIndex;
        if(!opt.showMask){
            this.maskEl.style.display = "none";
        }

        // wrap根容器
        this.wrapEl = document.createElement("div");
        this.wrapEl.id = this.uid;
        this.wrapEl.className = "mel-drawer";
        if(opt.animation){
            this.wrapEl.classList.add("mel-drawer--animate");
        }
        if(opt.adaptive){
            this.wrapEl.classList.add("mel-drawer--adaptive");
        }else{
            this.wrapEl.classList.add("mel-drawer--"+opt.direction);
        }
        this.wrapEl.classList.add("mel-drawer--open");

        // 定位尺寸计算
        this._setPosition();

        var htmlStr = "";
        // header
        if(opt.showHeader){
            htmlStr += '<div class="mel-drawer__header '+(opt.headerSticky?"mel-drawer__header--sticky":"")+'" style="height:'+opt.headerHeight+'px">';
            if(opt.showBack){
                htmlStr += '<div class="mel-drawer__back">';
                if(opt.backShowIcon){
                    htmlStr += '<span class="mel-drawer__back-icon">&lt;</span>';
                }
                htmlStr += '<span class="mel-drawer__back-text">返回</span>';
                htmlStr += '</div>';
            }
            htmlStr += '<div class="mel-drawer__title" style="text-align:'+opt.titleAlign+'">'+opt.title+'</div>';
            if(opt.showClose){
                htmlStr += '<div class="mel-drawer__close">×</div>';
            }
            htmlStr += '</div>';
        }
        // content
        htmlStr += '<div class="mel-drawer__content">'+opt.content+'</div>';
        // footer
        if(opt.showFooter){
            htmlStr += '<div class="mel-drawer__footer '+(opt.footerSticky?"mel-drawer__footer--sticky":"")+'" style="height:'+opt.footerHeight+'px">';
            if(opt.buttons && opt.buttons.length >0){
                for(var i=0;i<opt.buttons.length;i++){
                    var btn = opt.buttons[i];
                    var text = btn.text || "";
                    htmlStr += '<button class="mel-drawer__btn" data-index="'+(i+1)+'">'+text+'</button>';
                }
            }
            htmlStr += '</div>';
        }
        this.wrapEl.innerHTML = htmlStr;

        document.body.appendChild(this.maskEl);
        document.body.appendChild(this.wrapEl);
    };

    // 设置定位与尺寸
    Drawer.prototype._setPosition = function(){
        var opt = this.options;
        var wrap = this.wrapEl;
        if(opt.adaptive){
            return;
        }
        var dir = opt.direction;
        // 最小尺寸保护
        var realWidth = Math.max(opt.width, opt.minWidth);
        var realHeight = Math.max(opt.height, opt.minHeight);

        // 优先使用用户传入偏移
        if(opt.top !==0) wrap.style.top = opt.top +"px";
        if(opt.bottom !==0) wrap.style.bottom = opt.bottom +"px";
        if(opt.left !==0) wrap.style.left = opt.left +"px";
        if(opt.right !==0) wrap.style.right = opt.right +"px";

        if(dir === "right"){
            if(opt.top ===0) wrap.style.top = "0px";
            if(opt.bottom ===0) wrap.style.bottom = "0px";
            if(opt.right ===0) wrap.style.right = "0px";
            wrap.style.width = realWidth +"px";
        }else if(dir === "left"){
            if(opt.top ===0) wrap.style.top = "0px";
            if(opt.bottom ===0) wrap.style.bottom = "0px";
            if(opt.left ===0) wrap.style.left = "0px";
            wrap.style.width = realWidth +"px";
        }else if(dir === "bottom"){
            if(opt.left ===0) wrap.style.left = "0px";
            if(opt.right ===0) wrap.style.right = "0px";
            if(opt.bottom ===0) wrap.style.bottom = "0px";
            wrap.style.height = realHeight +"px";
        }else if(dir === "top"){
            if(opt.left ===0) wrap.style.left = "0px";
            if(opt.right ===0) wrap.style.right = "0px";
            if(opt.top ===0) wrap.style.top = "0px";
            wrap.style.height = realHeight +"px";
        }
    };

    Drawer.prototype._bindEvent = function(){
        var self = this;
        var opt = this.options;
        // mask点击关闭
        if(opt.maskClose && this.maskEl){
            this.maskEl.onclick = function(){
                self.close();
            };
        }
        // 返回按钮
        var backDom = this.wrapEl.querySelector(".mel-drawer__back");
        if(backDom){
            backDom.onclick = function(){
                if(opt.closeOnBackClick){
                    self.close();
                }
            };
        }
        // 关闭叉号
        var closeDom = this.wrapEl.querySelector(".mel-drawer__close");
        if(closeDom){
            closeDom.onclick = function(){
                if(opt.closeOnCrossClick){
                    self.close();
                }
            };
        }
        // 底部按钮，规避循环闭包
        var btnList = this.wrapEl.querySelectorAll(".mel-drawer__btn");
        for(var i=0;i<btnList.length;i++){
            (function(btn){
                btn.onclick = function(){
                    var idx = Number(this.getAttribute("data-index"));
                    if(typeof opt.onClick === "function"){
                        opt.onClick(idx);
                    }
                };
            })(btnList[i]);
        }
    };

    // 仅隐藏DOM，不删除
    Drawer.prototype._hideDom = function(){
        if(this.maskEl) this.maskEl.style.display = "none";
        if(this.wrapEl){
            this.wrapEl.classList.remove("mel-drawer--open");
        }
    };
    Drawer.prototype._showDom = function(){
        if(this.maskEl) this.maskEl.style.display = "block";
        if(this.wrapEl){
            this.wrapEl.classList.add("mel-drawer--open");
        }
    };

    // iOS滚动穿透锁定body滚动
    Drawer.prototype._lockBodyScroll = function(){
        this.bodyScrollLock = true;
        document.body.style.overflow = "hidden";
    };
    Drawer.prototype._unlockBodyScroll = function(){
        if(this.bodyScrollLock){
            document.body.style.overflow = "";
            this.bodyScrollLock = false;
        }
    };

    // 快捷静态方法
    Drawer.drawer = function(opts){
        var ins = new Drawer(opts);
        ins.open();
        return ins;
    };

    // 全局挂载
    global.MelUi = global.MelUi || {};
    global.MelUi.Drawer = Drawer;
    global.MelUi.drawer = Drawer.drawer;

})(window);

// export default window.MelUi;

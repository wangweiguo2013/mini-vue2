function __isNaN(a, b) {
    return Number.isNaN(a) && Number.isNaN(b);
}


class Dep {
    constructor() {
        this.subs = []
    }
    addSub(sub) {
        this.subs.push(sub)
    }
    depend() {
        if (Dep.target) {
            Dep.target.addDep(this);
        }
    }
    notify() {
        this.subs.forEach(sub => sub.update())
    }
}
// target全局只有一个，因为一次只会执行一个watcher的生成
Dep.target = null;

class Watcher {
    constructor(vm, key, cb) {
        this.vm = vm;
        this.key = key;
        this.cb = cb;
        //依赖类
        Dep.target = this;
        // 我们用一个变量来存储旧值，也就是未变更之前的值
        this.__old = vm[key];
    }
    addDep(dep) {
        // 把watcher塞到Dep里去 TODO:去重
        dep.addSub(this);
    }
    update() {
        //获取新的值
        let newValue = this.vm[this.key];
        //与旧值做比较，如果没有改变就无需执行下一步
        if (newValue === this.__old || __isNaN(newValue, this.__old)) return;
        //把新的值回调出去
        this.cb(newValue);
        //执行完之后，需要更新一下旧值的存储
        this.__old = newValue;
    }
}

class Compiler {
    constructor(vm) {
        this.vm = vm
        this.compile(vm.$el)
    }
    compile(el) {
        //拿到所有子节点（包含文本节点）
        let childNodes = el.childNodes;
        Array.from(childNodes).forEach(node => {
            //判断是文本节点还是元素节点分别执行不同的编译方法
            if (this.isTextNode(node)) {
                this.compileText(node);
            } else if (this.isElementNode(node)) {
                this.compileElement(node);
            }
            //递归判断node下是否还含有子节点，如果有的话继续编译
            if (node.childNodes && node.childNodes.length) this.compile(node);
        })
    }
    compileText(node) {
        //定义正则，匹配{{}}中的变量
        let reg = /\{\{(.+?)\}\}/g;
        let value = node.textContent;
        //判断是否含有{{}}
        if (reg.test(value)) {
            //拿到{{}}中的count,由于我们是匹配一个捕获组，所以我们可以根据RegExp类的$1属性来获取这个count
            let key = RegExp.$1.trim(); // count
            node.textContent = value.replace(reg, this.vm[key]);
            new Watcher(this.vm, key, newValue => {
                node.textContent = newValue;
            })
        }
    }
    compileElement(node) {
        const attrs = node.attributes;
        if (attrs.length) {
            Array.from(attrs).forEach(attr => {
                if (this.isDirective(attr)) {
                    //根据v-来截取一下后缀属性名,例如v-on:click,subStr(5)即可截取到click,v-text与v-model则subStr(2)截取到text和model即可
                    let attrName = attr.name.indexOf(':') > -1 ? attr.name.slice(5) : attr.name.slice(2);
                    let key = attr.value;
                    //单独定义一个update方法来区分这些
                    this.update(node, attrName, key, this.vm[key]);
                }
            })
        }
    }
    isTextNode(node) {
        return node.nodeType === 3;
    }
    isElementNode(node) {
        return node.nodeType === 1;
    }
    isDirective(attr) {
        return attr.name.startsWith('v-');
    }
    update(node, attrName, key, value) {
        //update函数内部
        if (attrName === 'text') {
            node.textContent = value;
            new Watcher(this.vm, key, newValue => {
                node.textContent = newValue;
            })

        } else if (attrName === 'model') {
            node.value = value;
            new Watcher(this.vm, key, newValue => {
                node.value = newValue;
            });
            node.addEventListener('input', (e) => {
                this.vm[key] = node.value;
            })
        } else if (attrName === 'click') {
            node.addEventListener(attrName, this.vm.$methods[key].bind(this.vm));
        }
    }
}

class Observer {
    constructor(data) {
        this.walk(data)
        this.dep = new Dep()
    }
    walk(data) {
        if (typeof data !== 'object' || !data) return;
        // 数据的每一个属性都调用定义响应式对象的方法
        Object.keys(data).forEach(key => this.defineReactive(data, key, data[key]));
    }
    defineReactive(data, key, value) {
        // 获取当前this，以避免后续用vm的时候，this指向不对
        const vm = this;
        // 递归调· 用walk方法，因为对象里面还有可能是对象
        this.walk(value);
        //实例化收集依赖的类
        const dep = new Dep();

        Object.defineProperty(data, key, {
            enumerable: true,
            configurable: true,
            get() {
                // 收集依赖,依赖存在Dep类上
                if (Dep.target) {
                    dep.depend();
                }
                return value;
            },
            set(newValue) {
                if (newValue === value || __isNaN(value, newValue)) return;
                value = newValue;
                vm.walk(newValue);
                // 通知Dep类
                dep.notify();
            }
        })
    }
}

class miniVue {
    constructor(options = {}) {
        //保存根元素,能简便就尽量简便，不考虑数组情况
        this.$el = typeof options.el === 'string' ? document.querySelector(options.el) : options.el;
        this.$methods = options.methods;
        this.$data = options.data;
        this.$options = options;

        this.proxy(this.$data);
        new Observer(this.$data);
        new Compiler(this);
    }
    // 把data代理到this上
    proxy(data) {
        Object.keys(data).forEach(key => {
            Object.defineProperty(this, key, {
                enumerable: true,
                configurable: true,
                get: () => {
                    return data[key];
                },
                set: (newValue) => {
                    //这里我们需要判断一下如果值没有做改变就不用赋值，需要排除NaN的情况
                    if (newValue === data[key] || __isNaN(newValue, data[key])) return;
                    data[key] = newValue;
                }
            })
        })
    }

}



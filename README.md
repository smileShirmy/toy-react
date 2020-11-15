# webpack 基础配置

```js
let a = <div />

// 经过 '@babel/plugin-transform-react-jsx' 后
var a = /*#__PURE__*/React.createElement("div", null) 

// 使用 pragma 参数编译后
var a = createElement("div", null);
```

```js
let a = <div id="a" class="c" />

// 转换后
var a = createElement("div", {
  id: "a",
  "class": "c"
});
```

```js
let a = <div id="a" class="c">
  <div></div>
</div>

// 转换后
var a = createElement("div", {
  id: "a",
  "class": "c"
}, createElement("div", null));
```

```js
let a = <div id="a" class="c">
  <div></div>
  <div></div>
  <div></div>
</div>

// 转换后
var a = createElement("div", {
  id: "a",
  "class": "c"
}, createElement("div", null), createElement("div", null), createElement("div", null));
```

因此通过下面的 createElement 可以得到 html

```js
function createElement(tagName, attributes, ...children) {
  let e = document.createElement(tagName)
  for (let p in attributes) {
    e.setAttribute(p, attributes[p])
  }
  for (let child of children) {
    if (typeof child === 'string') {
      child = document.createTextNode(child)
    }
    e.appendChild(child)
  }
  return e
}

document.body.appendChild(<div id="a" class="c">
  <div>abc</div>
  <div></div>
  <div></div>
</div>)
```

如果改成大写开头

```javascript
document.body.appendChild(<MyComponent id="a" class="c">
  <div>abc</div>
  <div></div>
  <div></div>
</MyComponent>)

// 转换后
document.body.appendChild(createElement(MyComponent, {
  id: "a",
  "class": "c"
}, createElement("div", null, "abc"), createElement("div", null), createElement("div", null)));
```

# 关键实现

```js
// main.js
import { createElement, Component, render } from './toy-react.js'

class MyComponent extends Component {
  render() {
    return <div>
      <h1>my component</h1>
      {this.children}
    </div>
  }
}

render(<MyComponent id="a" class="c">
  <div>abc</div>
  <div></div>
  <div></div>
</MyComponent>, document.body)
```

```js
// toy-react.js
class ElementWrapper {
  constructor(type) {
    this.root = document.createElement(type)
  }

  setAttribute(name, value) {
    this.root.setAttribute(name, value)
  }

  appendChild(component) {
    this.root.appendChild(component.root)
  }
}

class TextWrapper {
  constructor(content) {
    this.root = document.createTextNode(content)
  }
}

export class Component {
  constructor() {
    this.props = Object.create(null)
    this.children = []
    this._root = null
  }

  setAttribute(name, value) {
    this.props[name] = value
  }

  appendChild(component) {
    this.children.push(component)
  }

  get root() {
    if (!this._root) {
      this._root = this.render().root
    }
    return this._root
  }
}

export function createElement(type, attributes, ...children) {
  let e
  if (typeof type === 'string') {
    e = new ElementWrapper(type)
  } else {
    e = new type
  }

  for (let p in attributes) {
    e.setAttribute(p, attributes[p])
  }
  let insertChildren = (children) => {
    for (let child of children) {
      if (typeof child === 'string') {
        child = new TextWrapper(child)
      }
      if (typeof child === 'object' && child instanceof Array) {
        insertChildren(child)
      } else {
        e.appendChild(child)
      }
    }
  }
  insertChildren(children)
  return e
}

export function render(component, parentElement) {
  parentElement.appendChild(component.root)
}
```

# 使用 range 改造

```js
// main.js
import { createElement, Component, render } from './toy-react.js'

class MyComponent extends Component {
  constructor() {
    super()
    this.state = {
      a: 1,
      b: 2
    }
  }

  render() {
    return <div>
      <h1>my component</h1>
      <span>{this.state.a.toString()}</span>
      {this.children}
    </div>
  }
}

render(<MyComponent id="a" class="c">
  <div>abc</div>
  <div></div>
  <div></div>
</MyComponent>, document.body)
```

```js
// toy-react.js
const RENDER_TO_DOM = Symbol("render to dom")

class ElementWrapper {
  constructor(type) {
    this.root = document.createElement(type)
  }

  setAttribute(name, value) {
    this.root.setAttribute(name, value)
  }

  appendChild(component) {
    let range = document.createRange()
    range.setStart(this.root, this.root.childNodes.length)
    range.setEnd(this.root, this.root.childNodes.length)
    component[RENDER_TO_DOM](range)
  }

  [RENDER_TO_DOM](range) {
    range.deleteContents()
    range.insertNode(this.root)
  }
}

class TextWrapper {
  constructor(content) {
    this.root = document.createTextNode(content)
  }

  [RENDER_TO_DOM](range) {
    range.deleteContents()
    range.insertNode(this.root)
  }
}

export class Component {
  constructor() {
    this.props = Object.create(null)
    this.children = []
    this._root = null
  }

  setAttribute(name, value) {
    this.props[name] = value
  }

  appendChild(component) {
    this.children.push(component)
  }

  [RENDER_TO_DOM](range) {
    this.render()[RENDER_TO_DOM](range)
  }
}

export function createElement(type, attributes, ...children) {
  let e
  if (typeof type === 'string') {
    e = new ElementWrapper(type)
  } else {
    e = new type
  }

  for (let p in attributes) {
    e.setAttribute(p, attributes[p])
  }
  let insertChildren = (children) => {
    for (let child of children) {
      if (typeof child === 'string') {
        child = new TextWrapper(child)
      }
      if (typeof child === 'object' && child instanceof Array) {
        insertChildren(child)
      } else {
        e.appendChild(child)
      }
    }
  }
  insertChildren(children)
  return e
}

export function render(component, parentElement) {
  let range = document.createRange()
  range.setStart(parentElement, 0)
  range.setEnd(parentElement, parentElement.childNodes.length)
  range.deleteContents()
  component[RENDER_TO_DOM](range)
}
```

# 增加重新绘制的能力

```js
// main.js
import { createElement, Component, render } from './toy-react.js'

class MyComponent extends Component {
  constructor() {
    super()
    this.state = {
      a: 1,
      b: 2
    }
  }

  render() {
    return <div>
      <h1>my component</h1>
      <button onclick={() => { this.setState({ a: this.state.a + 1 }) }}>add</button>
      <span>{this.state.a.toString()}</span>
      <span>{this.state.b.toString()}</span>
    </div>
  }
}

render(<MyComponent id="a" class="c">
  <div>abc</div>
  <div></div>
  <div></div>
</MyComponent>, document.body)
```

```js
// toy-react
const RENDER_TO_DOM = Symbol("render to dom")

class ElementWrapper {
  constructor(type) {
    this.root = document.createElement(type)
  }

  setAttribute(name, value) {
    if (name.match(/^on([\s\S]+)$/)) {
      // 确保以小写字母开头
      this.root.addEventListener(RegExp.$1.replace(/^[\s\S]/, c => c.toLowerCase()), value)
    } else {
      this.root.setAttribute(name, value)
    }
  }

  appendChild(component) {
    let range = document.createRange()
    range.setStart(this.root, this.root.childNodes.length)
    range.setEnd(this.root, this.root.childNodes.length)
    component[RENDER_TO_DOM](range)
  }

  [RENDER_TO_DOM](range) {
    range.deleteContents()
    range.insertNode(this.root)
  }
}

class TextWrapper {
  constructor(content) {
    this.root = document.createTextNode(content)
  }

  [RENDER_TO_DOM](range) {
    range.deleteContents()
    range.insertNode(this.root)
  }
}

export class Component {
  constructor() {
    this.props = Object.create(null)
    this.children = []
    this._root = null
    this._range = null
  }

  setAttribute(name, value) {
    this.props[name] = value
  }

  appendChild(component) {
    this.children.push(component)
  }

  [RENDER_TO_DOM](range) {
    this._range = range
    this.render()[RENDER_TO_DOM](range)
  }

  reRender() {
    this._range.deleteContents()
    this[RENDER_TO_DOM](this._range)
  }

  setState(newState) {
    if (this.state === null || typeof this.state !== 'object') {
      this.state = newState
      this.reRender()
      return
    }

    let merge = (oldState, newState) => {
      for (let p in newState) {
        if (oldState[p] === null || typeof oldState[p] !== 'object') {
          oldState[p] = newState[p]
        } else {
          merge(oldState[p], newState[p])
        }
      }
    }
    merge(this.state, newState)
    this.reRender()
  }
}

export function createElement(type, attributes, ...children) {
  let e
  if (typeof type === 'string') {
    e = new ElementWrapper(type)
  } else {
    e = new type
  }

  for (let p in attributes) {
    e.setAttribute(p, attributes[p])
  }
  let insertChildren = (children) => {
    for (let child of children) {
      if (typeof child === 'string') {
        child = new TextWrapper(child)
      }
      if (typeof child === 'object' && child instanceof Array) {
        insertChildren(child)
      } else {
        e.appendChild(child)
      }
    }
  }
  insertChildren(children)
  return e
}

export function render(component, parentElement) {
  let range = document.createRange()
  range.setStart(parentElement, 0)
  range.setEnd(parentElement, parentElement.childNodes.length)
  range.deleteContents()
  component[RENDER_TO_DOM](range)
}
```

# 实现示例


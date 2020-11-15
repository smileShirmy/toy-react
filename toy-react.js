const RENDER_TO_DOM = Symbol("render to dom")

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

  // get vchildren() {
  //   return this.children.map(child => child.vdom)
  // }

  // 实际上是个递归调用
  get vdom() {
    return this.render().vdom
  }

  [RENDER_TO_DOM](range) {
    this._range = range
    // 把 vdom 存起来以便对比更新
    this._vdom = this.vdom
    this._vdom[RENDER_TO_DOM](range)
  }

  update() {
    let isSameNode = (oldNode, newNode) => {
      // 类型不同
      if (oldNode.type !== newNode.type) {
        return false
      }
      // 属性不同
      for (let name in newNode.props) {
        if (newNode.props[name] !== oldNode.props[name]) {
          return false
        }
      }
      // 属性的数量不同
      if (Object.keys(oldNode.props).length > Object.keys(newNode.props).length) {
        return false
      }
      if (newNode.type === '#text') {
        // 文本内容不同
        if (newNode.content !== oldNode.content) {
          return false
        }
      }
      return true
    }
    let update = (oldNode, newNode) => {
      // 需要对比的类型：type, props, children
      // #text content
      // 只有根节点 type 和 props 完全一致，则认为这个根节点不需要更新
      // 然后再看子节点是否需要更新
      // 这里直接用 replace 进行更新，这里用最土的同位置更新
      if (!isSameNode(oldNode, newNode)) {
        newNode[RENDER_TO_DOM](oldNode._range)
        return
      }
      // 如果新旧节点一样
      newNode._range = oldNode._range

      let newChildren = newNode.vchildren
      let oldChildren = oldNode.vchildren

      if (!newChild || !newChildren.length) {
        return
      }

      let tailRange = oldChildren[oldChildren.length - 1]._range

      for (let i = 0; i < newChildren.length; i++) {
        let newChild = newChildren[i]
        let oldChild = oldChildren[i]
        if (i < oldChildren.length) {
          update(oldChild, newChild)
        } else {
          let range = document.createRange()
          range.setStart(tailRange.endContainer, tailRange.endOffset)
          range.setEnd(tailRange.endContainer, tailRange.endOffset)
          newChild[RENDER_TO_DOM](range)
          tailRange = range
        }
      }
    }
    let vdom = this.vdom
    update(this._vdom, vdom)
    // 更新之后也更新旧的 vdom
    this._vdom = vdom
  }

  // reRender 退休，不再是重新渲染，而是更新
  // reRender() {
  //   let oldRange = this._range

  //   // 需要保证 range 不为空
  //   let range = document.createRange()
  //   // 把 range 插到之前，起点和终点都是一样的
  //   range.setStart(this._range.startContainer, this._range.startOffset)
  //   range.setEnd(this._range.startContainer, this._range.startOffset)
  //   this[RENDER_TO_DOM](range)

  //   oldRange.setStart(range.endContainer, range.endOffset)
  //   oldRange.deleteContents()
  // }

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
    this.update()
  }
}

class ElementWrapper extends Component {
  constructor(type) {
    super(type)
    this.type = type
    // 希望基于 vdom 进行渲染
    // this.root = document.createElement(type)
  }

  /*
  setAttribute(name, value) {
    if (name.match(/^on([\s\S]+)$/)) {
      // 确保以小写字母开头
      this.root.addEventListener(RegExp.$1.replace(/^[\s\S]/, c => c.toLowerCase()), value)
    } else {
      if (name === 'className') {
        this.root.setAttribute('class', value)
      } else {
        this.root.setAttribute( name, value)
      }
    }
  }

  appendChild(component) {
    let range = document.createRange()
    range.setStart(this.root, this.root.childNodes.length)
    range.setEnd(this.root, this.root.childNodes.length)
    component[RENDER_TO_DOM](range)
  }*/

  get vdom() {
    // 同样是递归调用
    this.vchildren = this.children.map(child => child.vdom)
    return this
    /* {
      type: this.type,
      props: this.props,
      children: this.children.map(child => child.vdom)
    }*/
  }

  [RENDER_TO_DOM](range) {
    this._range = range

    let root = document.createElement(this.type)

    for (let name in this.props) {
      let value = this.props[name]
      if (name.match(/^on([\s\S]+)$/)) {
        // 确保以小写字母开头
        root.addEventListener(RegExp.$1.replace(/^[\s\S]/, c => c.toLowerCase()), value)
      } else {
        if (name === 'className') {
          root.setAttribute('class', value)
        } else {
          root.setAttribute( name, value)
        }
      }
    }

    if (!this.vchildren) {
      this.vchildren = this.children.map(child => child.vdom)
    }

    for (let child of this.vchildren) {
      let childRange = document.createRange()
      childRange.setStart(root, root.childNodes.length)
      childRange.setEnd(root, root.childNodes.length)
      child[RENDER_TO_DOM](childRange)
    }

    replaceContent(range, root)
  }
}

class TextWrapper extends Component {
  constructor(content) {
    super(content)
    this.type = '#text'
    this.content = content
  }

  get vdom() {
    return this
    /*{
      type: "#text",
      content: this.content
    }*/
  }

  [RENDER_TO_DOM](range) {
    this._range = range

    let root = document.createTextNode(this.content)
    replaceContent(range, root)
  }
}

function replaceContent(range, node) {
  range.insertNode(node)
  range.setStartAfter(node)
  range.deleteContents()
  
  range.setStartBefore(node)
  range.setEndAfter(node)
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
      if (child === null) {
        continue
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
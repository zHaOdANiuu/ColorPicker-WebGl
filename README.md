# ColorPicker-WebGl
无依赖项
这是一个基于 WebGL 的颜色选择器(高效绘制,无卡顿)
兼容ES5

![ColorPicker-WebGl](index.gif)

## 安装

```
npm i color-picker-webgl
```

## 示例

```html
<div>
  <p id="show-color"></p>
  <div id="black" style="width: 32px; height: 32px;"></div>
</div>
<div id="parent" style="display: flex"></div>
<script type="module">
  import ColorPicker from './index.js';
  const colorPicker = new ColorPicker(320);
  const parent = document.querySelector('#parent');
  const show = document.querySelector('#show-color');
  const black = document.querySelector('#black');
  parent.appendChild(colorPicker.canvas);
  colorPicker.install();
  const update = () => {
    const { hsb } = colorPicker
    const rgb = hsbToRgb(hsb[0], hsb[1], hsb[2])
    black.style.backgroundColor = show.textContent = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    requestAnimationFrame(update)
  }
  update();
  function hsbToRgb(h, s, b) {
    if (s === 0) return [255, 255, 255]
    if (b === 0) return [0, 0, 0]
    s /= 100
    b /= 100
    const rgb = new Array(3)
    for (let i = -1, o = 240; ++i < 3; o -= 120) {
      let r = 0
      const t = Math.abs(((h + o) % 360) - 240)
      if (t <= 60) r = 255
      else if (60 < t && t < 120)
        r = (1 - (t - 60) / 60) * 255
      r += (255 - r) * (1 - s)
      rgb[i] = r * b
    }
    return rgb
  }
</script>
```

## API[实列属性和方法]

### hsb
hsb属性是一个数组,包含当前颜色盘所在位置映射的 hsb 值

### setUniformData(key: keyof UniformData, value: number)
设置uniform数据,包含颜色盘的明度信息和按钮大小等

### install()
渲染颜色盘,本质是 requestAnimationFrame 的循环调用,事件的注册也在这里,如果是用 Vue 等框架,可以直接在组件挂载时调用 render 方法,在组件销毁时调用 unmounted 方法

### uninstall()
调用 cancelAnimationFrame 停止 requestAnimationFrame 并清除事件监听

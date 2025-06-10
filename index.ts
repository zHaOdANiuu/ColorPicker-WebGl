interface UniformData {
  brightness: number
  btnSize: number
  btnStrokeWidth: number
  lineStrokeWidth: number
}

class ColorPicker {
  public canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private requestAnimationFrameHandle!: number
  private program: WebGLProgram
  private uniformData: UniformData
  private uniformLocation: Record<keyof UniformData, WebGLUniformLocation>
  private eventManger: [string, EventListenerOrEventListenerObject][]
  private selectorPos: Float32Array<ArrayBuffer>
  private scale: number
  private _radius: number
  constructor() {
    this._radius = 400
    this.canvas = document.createElement('canvas')
    this.canvas.width = 400
    this.canvas.height = 400
    this.canvas.style.width = this.canvas.style.height = 400 + 'px'
    this.eventManger = []
    this.uniformData = {
      brightness: 1.0,
      btnSize: 0.06667,
      btnStrokeWidth: 0.008,
      lineStrokeWidth: 0.004
    }
    this.uniformLocation = {
      brightness: 0,
      btnSize: 0,
      btnStrokeWidth: 0,
      lineStrokeWidth: 0
    }
    const tmp = this.canvas.getContext('webgl', { antialias: true })
    if (tmp === null) {
      throw new Error('WebGL2 is not supported by your browser')
    }
    this.gl = tmp
    this.program = this.createWebGLProgram()
    this.scale =
      1.0 - this.uniformData.btnSize - this.uniformData.btnStrokeWidth
    this.selectorPos = new Float32Array(2)
    this.init()
  }
  public get radius(){
    return this._radius
  }
  public set radius(val: number){
    this.canvas.width = val
    this.canvas.height = val
    this.canvas.style.width = this.canvas.style.height = val + 'px'
    this._radius = val
  }
  private get size() {
    return Math.max(this.canvas.width, this.canvas.height) * this.scale
  }
  public get hsb() {
    const x = this.selectorPos[0]
    const y = this.selectorPos[1]
    const radius = Math.sqrt(x * x + y * y)
    let h = Math.atan2(y, x) * (180 / Math.PI)
    if (h < 0) {
      h += 360
    }
    return [h, (radius / this.scale) * 100, this.uniformData.brightness * 100]
  }
  private createWebGLProgram() {
    const { gl } = this
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)
    if (vertexShader === null) {
      throw new Error('Create Vertex Shader return null')
    }
    gl.shaderSource(
      vertexShader,
      `precision mediump float;
attribute vec2 a_position;
void main() {
gl_Position = vec4(a_position, 0, 1);
}`
    )
    gl.compileShader(vertexShader)
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      gl.deleteShader(vertexShader)
      throw new Error(
        `Compile shader error: ${gl.getShaderInfoLog(vertexShader)}`
      )
    }
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    if (fragmentShader === null) {
      throw new Error('Create Fragment Shader return null')
    }
    gl.shaderSource(
      fragmentShader,
      `precision mediump float;
const float PI = acos(-1.0);
const float FULL_CIRCLE_RADIANS = 2.0 * PI;
vec4 line(vec2 ndc, vec2 sPos, vec2 ePos, float w, vec3 color)
{
  vec2 dir = normalize(ePos - sPos);
  vec2 perpDir = vec2(-dir.y, dir.x);
  float d = abs(dot(ndc - sPos, perpDir));
  float l = dot(ndc - sPos, dir);
  float insidePerpendicular = smoothstep(w + 0.005, w - 0.005, d);
  float insideSegment = step(l, length(ePos - sPos)) * step(0.0, l);
  float t = insidePerpendicular * insideSegment;
  return mix(vec4(color, t), vec4(0.0), step(t, 0.0));
}
vec4 fCircle(vec2 ndc, vec3 color, float radius, vec2 pos)
{
  float t = smoothstep(radius, radius - 0.01, length(ndc - pos));
  return vec4(color, t);
}
vec4 sCircle(vec2 ndc, vec3 color, float radius, float stroke, vec2 pos)
{
  float len = length(ndc - pos);
  float r1 = radius - stroke;
  float r2 = radius + stroke;
  float t = smoothstep(r1, r1 + 0.01, len) - smoothstep(r2, r2 + 0.01, len);
  return mix(vec4(color, t), vec4(0.0), step(t, 0.0));
}
vec4 circle(vec2 ndc, vec3 fillColor, vec3 strokeColor, float strokeWidth, float radius, vec2 pos)
{
  vec4 stroke = sCircle(ndc, strokeColor, radius, strokeWidth, pos);
  return mix(fCircle(ndc, fillColor, radius, pos), stroke, stroke.a);
}
vec3 hsvToRgb(float h, float s, float v)
{
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.w);
  return v * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), s);
}
float linear(float t, float tMin, float tMax)
{
  return tMin * (1.0 - t) + tMax * t;
}
vec3 getColorFromPoint(vec2 point, float brig)
{
  float radius = length(point);
  if (radius > 1.0)
  {
    return vec3(0.0);
  }
  float hue = atan(point.y, point.x) / FULL_CIRCLE_RADIANS; // Convert to range [0, 1]
  float saturation = radius;
  float value = 1.0;
  return hsvToRgb(hue, saturation, value);
}
void calculateColor(vec4 data[3], out vec4 result) {
    result = vec4(0.0);
    for (int i = 0; i < 3; i++) {
        vec4 c = data[i];
        result = mix(result, c, c.a);
    }
}
uniform vec2 u_resolution;
uniform vec2 u_position;
uniform float u_brightness;
uniform float u_btnSize;
uniform float u_btnStrokeWidth;
uniform float u_lineStrokeWidth;
void main() {
    vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
    vec4 data[3];
    vec3 strokeColor = vec3(1.0);
    vec3 rgb = hsvToRgb((atan(uv.y, uv.x)) / FULL_CIRCLE_RADIANS, length(uv), 1.0);
    float scale = 1.0 - u_btnSize - u_btnStrokeWidth;
    data[0] = fCircle(uv, rgb, scale, vec2(0.0, 0.0));
    data[1] = line(uv, vec2(0.0), u_position - u_position * u_btnSize, u_lineStrokeWidth, strokeColor);
    data[2] = circle(uv, getColorFromPoint(u_position, u_brightness), strokeColor, u_btnStrokeWidth, u_btnSize, u_position * scale);
    calculateColor(data, gl_FragColor);
}`
    )
    gl.compileShader(fragmentShader)
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      gl.deleteShader(fragmentShader)
      throw new Error(
        `Compile shader error: ${gl.getShaderInfoLog(fragmentShader)}`
      )
    }
    const program = gl.createProgram()
    if (program === null) {
      throw new Error('Create program return null')
    }
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program)
      throw new Error(`Link program error: ${gl.getProgramInfoLog(program)}`)
    }
    gl.useProgram(program)
    return program
  }
  private init() {
    const { gl, canvas, program, uniformData, uniformLocation } = this
    gl.uniform2f(
      gl.getUniformLocation(program, 'u_resolution'),
      canvas.width,
      canvas.height
    )
    uniformLocation.brightness = gl.getUniformLocation(program, 'u_brightness')!
    uniformLocation.btnSize = gl.getUniformLocation(program, 'u_btnSize')!
    uniformLocation.btnStrokeWidth = gl.getUniformLocation(
      program,
      'u_btnStrokeWidth'
    )!
    uniformLocation.lineStrokeWidth = gl.getUniformLocation(
      program,
      'u_lineStrokeWidth'
    )!
    gl.uniform1f(uniformLocation.brightness, uniformData.brightness)
    gl.uniform1f(uniformLocation.btnSize, uniformData.btnSize)
    gl.uniform1f(uniformLocation.btnStrokeWidth, uniformData.btnStrokeWidth)
    gl.uniform1f(uniformLocation.lineStrokeWidth, uniformData.lineStrokeWidth)
  }
  private drawOneFrame() {
    const { gl, program } = this
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]),
      gl.STATIC_DRAW
    )
    const posAttributeLocation = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(posAttributeLocation)
    gl.vertexAttribPointer(posAttributeLocation, 2, gl.FLOAT, false, 0, 0)
    return () => {
      gl.clearColor(0.0, 0.0, 0.0, 0.0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
  }
  private addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLCanvasElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void
  private addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) {
    this.eventManger.push([type, listener])
    this.canvas.addEventListener(type, listener, options)
  }
  private toWebGlPos(x: number, y: number) {
    return [
      ((x - this.canvas.width * 0.5) / this.size) * 2,
      ((this.canvas.height * 0.5 - y) / this.size) * 2
    ]
  }
  private processEvent() {
    const uPosition = this.gl.getUniformLocation(this.program, 'u_position')
    let mousedown = false
    this.addEventListener('mousedown', e => {
      const rect = this.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (!this.isInCircle(x, y)) {
        return
      }
      e.stopPropagation()
      const pos = this.toWebGlPos(x, y)
      this.gl.uniform2f(uPosition, pos[0], pos[1])
      mousedown = true
    })
    this.addEventListener('mousemove', e => {
      const rect = this.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (!this.isInCircle(x, y)) {
        this.canvas.style.cursor = 'default'
        return
      }
      e.stopPropagation()
      if (this.canvas.style.cursor !== 'crosshair')
        this.canvas.style.cursor = 'crosshair'
      if (mousedown) {
        const pos = this.toWebGlPos(x, y)
        this.gl.uniform2f(uPosition, pos[0], pos[1])
        this.selectorPos.set(pos)
      }
    })
    this.addEventListener('mouseup', e => {
      e.stopPropagation()
      mousedown = false
    })
  }
  private isInCircle(x: number, y: number) {
    const { canvas, size } = this
    const offset = (Math.max(canvas.width, canvas.height) - size) * 0.5
    const radius = size * 0.5
    const tmp = offset + radius
    return (x - tmp) ** 2 + (y - tmp) ** 2 <= radius ** 2
  }
  public setUniformData(key: keyof UniformData, value: number) {
    this.uniformData[key] = value
    const tmp = this.uniformLocation[key]
    if (tmp) {
      this.gl.uniform1f(tmp, value)
    }
  }
  public install(parent: HTMLElement = document.body) {
    parent.appendChild(this.canvas)
    const draw = this.drawOneFrame()
    const drawLoop = () => {
      draw()
      this.requestAnimationFrameHandle = requestAnimationFrame(drawLoop)
    }
    drawLoop()
    this.processEvent()
  }
  public uninstall() {
    cancelAnimationFrame(this.requestAnimationFrameHandle)
    this.eventManger.forEach(event => {
      this.canvas.removeEventListener(event[0], event[1])
    })
  }
}

export default ColorPicker

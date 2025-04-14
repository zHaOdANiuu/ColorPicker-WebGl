"use strict";
var ColorPicker = (function () {
    function ColorPicker(radius) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = radius;
        this.canvas.height = radius;
        this.canvas.style.width = this.canvas.style.height = radius + 'px';
        this.eventManger = [];
        this.uniformData = {
            brightness: 1.0,
            btnSize: 0.06667,
            btnStrokeWidth: 0.008,
            lineStrokeWidth: 0.004
        };
        this.uniformLocation = {
            brightness: 0,
            btnSize: 0,
            btnStrokeWidth: 0,
            lineStrokeWidth: 0
        };
        var tmp = this.canvas.getContext('webgl', { antialias: true });
        if (tmp === null) {
            throw new Error('WebGL2 is not supported by your browser');
        }
        this.gl = tmp;
        this.program = this.createWebGLProgram();
        this.scale =
            1.0 - this.uniformData.btnSize - this.uniformData.btnStrokeWidth;
        this.selectorPos = new Float32Array(2);
        this.init();
    }
    Object.defineProperty(ColorPicker.prototype, "size", {
        get: function () {
            return Math.max(this.canvas.width, this.canvas.height) * this.scale;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ColorPicker.prototype, "hsb", {
        get: function () {
            var x = this.selectorPos[0];
            var y = this.selectorPos[1];
            var radius = Math.sqrt(x * x + y * y);
            var h = Math.atan2(y, x) * (180 / Math.PI);
            if (h < 0) {
                h += 360;
            }
            return [h, (radius / this.scale) * 100, this.uniformData.brightness * 100];
        },
        enumerable: false,
        configurable: true
    });
    ColorPicker.prototype.createWebGLProgram = function () {
        var gl = this.gl;
        var vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (vertexShader === null) {
            throw new Error('Create Vertex Shader return null');
        }
        gl.shaderSource(vertexShader, "precision mediump float;\nattribute vec2 a_position;\nvoid main() {\ngl_Position = vec4(a_position, 0, 1);\n}");
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            gl.deleteShader(vertexShader);
            throw new Error("Compile shader error: ".concat(gl.getShaderInfoLog(vertexShader)));
        }
        var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (fragmentShader === null) {
            throw new Error('Create Fragment Shader return null');
        }
        gl.shaderSource(fragmentShader, "precision mediump float;\nconst float PI = acos(-1.0);\nconst float FULL_CIRCLE_RADIANS = 2.0 * PI;\nvec4 line(vec2 ndc, vec2 sPos, vec2 ePos, float w, vec3 color)\n{\n  vec2 dir = normalize(ePos - sPos);\n  vec2 perpDir = vec2(-dir.y, dir.x);\n  float d = abs(dot(ndc - sPos, perpDir));\n  float l = dot(ndc - sPos, dir);\n  float insidePerpendicular = smoothstep(w + 0.005, w - 0.005, d);\n  float insideSegment = step(l, length(ePos - sPos)) * step(0.0, l);\n  float t = insidePerpendicular * insideSegment;\n  return mix(vec4(color, t), vec4(0.0), step(t, 0.0));\n}\nvec4 fCircle(vec2 ndc, vec3 color, float radius, vec2 pos)\n{\n  float t = smoothstep(radius, radius - 0.01, length(ndc - pos));\n  return vec4(color, t);\n}\nvec4 sCircle(vec2 ndc, vec3 color, float radius, float stroke, vec2 pos)\n{\n  float len = length(ndc - pos);\n  float r1 = radius - stroke;\n  float r2 = radius + stroke;\n  float t = smoothstep(r1, r1 + 0.01, len) - smoothstep(r2, r2 + 0.01, len);\n  return mix(vec4(color, t), vec4(0.0), step(t, 0.0));\n}\nvec4 circle(vec2 ndc, vec3 fillColor, vec3 strokeColor, float strokeWidth, float radius, vec2 pos)\n{\n  vec4 stroke = sCircle(ndc, strokeColor, radius, strokeWidth, pos);\n  return mix(fCircle(ndc, fillColor, radius, pos), stroke, stroke.a);\n}\nvec3 hsvToRgb(float h, float s, float v)\n{\n  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\n  vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.w);\n  return v * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), s);\n}\nfloat linear(float t, float tMin, float tMax)\n{\n  return tMin * (1.0 - t) + tMax * t;\n}\nvec3 getColorFromPoint(vec2 point, float brig)\n{\n  float radius = length(point);\n  if (radius > 1.0)\n  {\n    return vec3(0.0);\n  }\n  float hue = atan(point.y, point.x) / FULL_CIRCLE_RADIANS; // Convert to range [0, 1]\n  float saturation = radius;\n  float value = 1.0;\n  return hsvToRgb(hue, saturation, value);\n}\nvoid calculateColor(vec4 data[3], out vec4 result) {\n    result = vec4(0.0);\n    for (int i = 0; i < 3; i++) {\n        vec4 c = data[i];\n        result = mix(result, c, c.a);\n    }\n}\nuniform vec2 u_resolution;\nuniform vec2 u_position;\nuniform float u_brightness;\nuniform float u_btnSize;\nuniform float u_btnStrokeWidth;\nuniform float u_lineStrokeWidth;\nvoid main() {\n    vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;\n    vec4 data[3];\n    vec3 strokeColor = vec3(1.0);\n    vec3 rgb = hsvToRgb((atan(uv.y, uv.x)) / FULL_CIRCLE_RADIANS, length(uv), 1.0);\n    float scale = 1.0 - u_btnSize - u_btnStrokeWidth;\n    data[0] = fCircle(uv, rgb, scale, vec2(0.0, 0.0));\n    data[1] = line(uv, vec2(0.0), u_position - u_position * u_btnSize, u_lineStrokeWidth, strokeColor);\n    data[2] = circle(uv, getColorFromPoint(u_position, u_brightness), strokeColor, u_btnStrokeWidth, u_btnSize, u_position * scale);\n    calculateColor(data, gl_FragColor);\n}");
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            gl.deleteShader(fragmentShader);
            throw new Error("Compile shader error: ".concat(gl.getShaderInfoLog(fragmentShader)));
        }
        var program = gl.createProgram();
        if (program === null) {
            throw new Error('Create program return null');
        }
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.deleteProgram(program);
            throw new Error("Link program error: ".concat(gl.getProgramInfoLog(program)));
        }
        gl.useProgram(program);
        return program;
    };
    ColorPicker.prototype.init = function () {
        var _a = this, gl = _a.gl, canvas = _a.canvas, program = _a.program, uniformData = _a.uniformData, uniformLocation = _a.uniformLocation;
        gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);
        uniformLocation.brightness = gl.getUniformLocation(program, 'u_brightness');
        uniformLocation.btnSize = gl.getUniformLocation(program, 'u_btnSize');
        uniformLocation.btnStrokeWidth = gl.getUniformLocation(program, 'u_btnStrokeWidth');
        uniformLocation.lineStrokeWidth = gl.getUniformLocation(program, 'u_lineStrokeWidth');
        gl.uniform1f(uniformLocation.brightness, uniformData.brightness);
        gl.uniform1f(uniformLocation.btnSize, uniformData.btnSize);
        gl.uniform1f(uniformLocation.btnStrokeWidth, uniformData.btnStrokeWidth);
        gl.uniform1f(uniformLocation.lineStrokeWidth, uniformData.lineStrokeWidth);
    };
    ColorPicker.prototype.drawOneFrame = function () {
        var _a = this, gl = _a.gl, program = _a.program;
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]), gl.STATIC_DRAW);
        var posAttributeLocation = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(posAttributeLocation);
        gl.vertexAttribPointer(posAttributeLocation, 2, gl.FLOAT, false, 0, 0);
        return function () {
            gl.clearColor(0.0, 0.0, 0.0, 0.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        };
    };
    ColorPicker.prototype.addEventListener = function (type, listener, options) {
        this.eventManger.push([type, listener]);
        this.canvas.addEventListener(type, listener, options);
    };
    ColorPicker.prototype.toWebGlPos = function (x, y) {
        return [
            ((x - this.canvas.width * 0.5) / this.size) * 2,
            ((this.canvas.height * 0.5 - y) / this.size) * 2
        ];
    };
    ColorPicker.prototype.processEvent = function () {
        var _this = this;
        var uPosition = this.gl.getUniformLocation(this.program, 'u_position');
        var mousedown = false;
        this.addEventListener('mousedown', function (e) {
            var rect = _this.canvas.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;
            if (!_this.isInCircle(x, y)) {
                return;
            }
            e.stopPropagation();
            var pos = _this.toWebGlPos(x, y);
            _this.gl.uniform2f(uPosition, pos[0], pos[1]);
            mousedown = true;
        });
        this.addEventListener('mousemove', function (e) {
            var rect = _this.canvas.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;
            if (!_this.isInCircle(x, y)) {
                _this.canvas.style.cursor = 'default';
                return;
            }
            e.stopPropagation();
            if (_this.canvas.style.cursor !== 'crosshair')
                _this.canvas.style.cursor = 'crosshair';
            if (mousedown) {
                var pos = _this.toWebGlPos(x, y);
                _this.gl.uniform2f(uPosition, pos[0], pos[1]);
                _this.selectorPos.set(pos);
            }
        });
        this.addEventListener('mouseup', function (e) {
            e.stopPropagation();
            mousedown = false;
        });
    };
    ColorPicker.prototype.isInCircle = function (x, y) {
        var _a = this, canvas = _a.canvas, size = _a.size;
        var offset = (Math.max(canvas.width, canvas.height) - size) * 0.5;
        var radius = size * 0.5;
        var tmp = offset + radius;
        return Math.pow((x - tmp), 2) + Math.pow((y - tmp), 2) <= Math.pow(radius, 2);
    };
    ColorPicker.prototype.setUniformData = function (key, value) {
        this.uniformData[key] = value;
        var tmp = this.uniformLocation[key];
        if (tmp) {
            this.gl.uniform1f(tmp, value);
        }
    };
    ColorPicker.prototype.install = function () {
        var _this = this;
        var draw = this.drawOneFrame();
        var drawLoop = function () {
            draw();
            _this.requestAnimationFrameHandle = requestAnimationFrame(drawLoop);
        };
        drawLoop();
        this.processEvent();
    };
    ColorPicker.prototype.uninstall = function () {
        var _this = this;
        cancelAnimationFrame(this.requestAnimationFrameHandle);
        this.eventManger.forEach(function (event) {
            _this.canvas.removeEventListener(event[0], event[1]);
        });
    };
    return ColorPicker;
}());
export default ColorPicker;

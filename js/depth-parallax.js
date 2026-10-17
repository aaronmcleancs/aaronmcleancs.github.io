(function () {
  var frame = document.querySelector('.stage__frame');
  if (!frame || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var imgs = Array.prototype.slice.call(frame.querySelectorAll('img[data-depth]'));
  if (!imgs.length) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'stage__depth';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false });
  if (!gl) return;
  frame.insertBefore(canvas, frame.querySelector('.stage__caption'));

  var STRENGTH = 0.009;
  var EASE = 0.08;

  var vsrc = 'attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  var fsrc = [
    'precision mediump float;',
    'varying vec2 v;',
    'uniform sampler2D uImg; uniform sampler2D uDepth;',
    'uniform vec2 uScale; uniform vec2 uMouse; uniform float uStrength;',
    'void main(){',
    '  vec2 uv = (vec2(v.x, 1.0 - v.y) - 0.5) * uScale + 0.5;',
    '  float d = texture2D(uDepth, uv).r;',
    '  uv += uMouse * (d - 0.5) * uStrength;',
    '  gl_FragColor = texture2D(uImg, clamp(uv, 0.001, 0.999));',
    '}'
  ].join('\n');

  function shader(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, vsrc));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fsrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uScale = gl.getUniformLocation(prog, 'uScale');
  var uMouse = gl.getUniformLocation(prog, 'uMouse');
  gl.uniform1f(gl.getUniformLocation(prog, 'uStrength'), STRENGTH);
  gl.uniform1i(gl.getUniformLocation(prog, 'uImg'), 0);
  gl.uniform1i(gl.getUniformLocation(prog, 'uDepth'), 1);

  function texture(image) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    return t;
  }

  function load(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () { resolve(im); };
      im.onerror = reject;
      im.src = src;
    });
  }

  var cache = new Map();
  function pair(img) {
    if (!cache.has(img)) {
      cache.set(img, Promise.all([load(img.currentSrc || img.src), load(img.dataset.depth)]).then(function (r) {
        return { img: texture(r[0]), depth: texture(r[1]), aspect: r[0].naturalWidth / r[0].naturalHeight };
      }));
    }
    return cache.get(img);
  }

  var current = null;
  var mouse = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  var raf = null;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(frame.clientWidth * dpr), h = Math.round(frame.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function draw() {
    if (!current) return;
    resize();
    var frameAspect = canvas.width / canvas.height;
    var sx = 1, sy = 1;
    if (current.aspect > frameAspect) sx = frameAspect / current.aspect;
    else sy = current.aspect / frameAspect;
    gl.uniform2f(uScale, sx, sy);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, current.img);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, current.depth);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function tick() {
    mouse.x += (target.x - mouse.x) * EASE;
    mouse.y += (target.y - mouse.y) * EASE;
    draw();
    if (Math.abs(target.x - mouse.x) > 0.0005 || Math.abs(target.y - mouse.y) > 0.0005) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
    }
  }
  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  frame.addEventListener('pointermove', function (e) {
    var r = frame.getBoundingClientRect();
    target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    kick();
  });
  frame.addEventListener('pointerleave', function () {
    target.x = 0;
    target.y = 0;
    kick();
  });

  var swapTimer = null;
  function activate() {
    var active = frame.querySelector('img.is-active');
    canvas.classList.remove('is-on');
    current = null;
    clearTimeout(swapTimer);
    if (!active || !active.dataset.depth) return;
    pair(active).then(function (p) {
      swapTimer = setTimeout(function () {
        if (!active.classList.contains('is-active')) return;
        current = p;
        draw();
        canvas.classList.add('is-on');
      }, 650);
    }).catch(function () {});
  }

  var observer = new MutationObserver(activate);
  frame.querySelectorAll('img').forEach(function (img) {
    observer.observe(img, { attributes: true, attributeFilter: ['class'] });
  });
  window.addEventListener('resize', function () { draw(); });
  activate();
})();

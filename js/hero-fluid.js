(function () {
  var hero = document.querySelector('.hero__section');
  var svgBg = hero && hero.querySelector('.hero__background');
  if (!hero || !svgBg) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'hero__fluid';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return;

  var SIM = 112;
  var DYE = 150;
  var PRESSURE_ITERS = 14;
  var CURL = 4;
  var VEL_DISSIPATION = 0.25;
  var VISCOSITY = 90;
  var VISCOUS_ITERS = 8;
  var DYE_DISSIPATION = 0.22;
  var TIME_SCALE = 0.55;
  var CURRENT = 7;

  var css = getComputedStyle(document.documentElement);
  function hex(name, fallback) {
    var m = /^#?([0-9a-f]{6})$/i.exec(css.getPropertyValue(name).trim()) || /^#?([0-9a-f]{6})$/i.exec(fallback);
    var n = parseInt(m[1], 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  var C1 = hex('--wave-1', '#0756a6'), C2 = hex('--wave-2', '#054585'), C3 = hex('--wave-3', '#043363');
  var ACC = hex('--accent', '#0a84ff'), BG = hex('--bg', '#000000');

  var VS = [
    '#version 300 es',
    'in vec2 aPos; uniform vec2 uTexel;',
    'out vec2 vUv, vL, vR, vT, vB;',
    'void main(){',
    '  vUv = aPos * 0.5 + 0.5;',
    '  vL = vUv - vec2(uTexel.x, 0.0); vR = vUv + vec2(uTexel.x, 0.0);',
    '  vT = vUv + vec2(0.0, uTexel.y); vB = vUv - vec2(0.0, uTexel.y);',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');
  function FS(body) {
    return '#version 300 es\nprecision highp float; precision highp sampler2D;\n' +
      'in vec2 vUv, vL, vR, vT, vB; out vec4 o;\n' + body;
  }
  var SRC = {
    clear: FS('uniform sampler2D uTex; uniform float uValue; void main(){ o = uValue * texture(uTex, vUv); }'),
    splat: FS([

      'uniform sampler2D uTarget; uniform float uAspect, uRadius; uniform vec2 uPoint[6]; uniform vec3 uColor[6];',
      'void main(){ vec3 acc = texture(uTarget, vUv).xyz;',
      '  for (int i = 0; i < 6; i++) { vec2 p = vUv - uPoint[i]; p.x *= uAspect; acc += exp(-dot(p, p) / uRadius) * uColor[i]; }',
      '  o = vec4(acc, 1.0); }'
    ].join('\n')),
    advect: FS([
      'uniform sampler2D uVelocity, uSource; uniform vec2 uSimTexel; uniform float uDt, uDissipation;',
      'void main(){ vec2 c = vUv - uDt * texture(uVelocity, vUv).xy * uSimTexel;',
      '  o = texture(uSource, c) / (1.0 + uDissipation * uDt); }'
    ].join('\n')),
    divergence: FS([
      'uniform sampler2D uVelocity;',
      'void main(){',
      '  float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x, T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;',
      '  vec2 C = texture(uVelocity, vUv).xy;',
      '  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;',
      '  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);',
      '}'
    ].join('\n')),
    curl: FS([
      'uniform sampler2D uVelocity;',
      'void main(){',
      '  float L = texture(uVelocity, vL).y, R = texture(uVelocity, vR).y, T = texture(uVelocity, vT).x, B = texture(uVelocity, vB).x;',
      '  o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);',
      '}'
    ].join('\n')),
    vorticity: FS([
      'uniform sampler2D uVelocity, uCurl; uniform float uCurlStrength, uDt;',
      'void main(){',
      '  float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;',
      '  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));',
      '  f /= length(f) + 0.0001; f *= uCurlStrength * C; f.y *= -1.0;',
      '  o = vec4(texture(uVelocity, vUv).xy + f * uDt, 0.0, 1.0);',
      '}'
    ].join('\n')),
    pressure: FS([
      'uniform sampler2D uPressure, uDivergence;',
      'void main(){',
      '  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;',
      '  o = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);',
      '}'
    ].join('\n')),
    gradient: FS([
      'uniform sampler2D uPressure, uVelocity;',
      'void main(){',
      '  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;',
      '  o = vec4(texture(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);',
      '}'
    ].join('\n')),
    viscous: FS([

      'uniform sampler2D uVelocity, uVelocity0; uniform float uAlpha;',
      'void main(){',
      '  vec2 L = texture(uVelocity, vL).xy, R = texture(uVelocity, vR).xy, T = texture(uVelocity, vT).xy, B = texture(uVelocity, vB).xy;',
      '  o = vec4((texture(uVelocity0, vUv).xy + uAlpha * (L + R + T + B)) / (1.0 + 4.0 * uAlpha), 0.0, 1.0);',
      '}'
    ].join('\n')),
    current: FS([

      'uniform sampler2D uVelocity; uniform float uT, uDt, uStrength, uScroll;',
      'void main(){',
      '  vec2 f = vec2(sin(6.2832 * (vUv.y * 1.15) + uT * 0.11) + 0.35 * sin(6.2832 * (vUv.y * 2.3) - uT * 0.07),',
      '                0.55 * sin(6.2832 * (vUv.x * 0.85) - uT * 0.09) + 0.25 * cos(6.2832 * (vUv.x * 1.9) + uT * 0.05));',

      '  float shear = 0.55 + 0.45 * sin(6.2832 * vUv.x * 1.4 + uT * 0.04) * cos(6.2832 * vUv.x * 0.6 - 1.3);',
      '  vec2 drag = vec2(0.18 * cos(6.2832 * vUv.x * 1.1 + uT * 0.03), shear) * smoothstep(0.0, 0.55, vUv.y);',
      '  o = vec4(texture(uVelocity, vUv).xy + f * uStrength * uDt + drag * uScroll, 0.0, 1.0);',
      '}'
    ].join('\n')),
    display: FS([
      'uniform sampler2D uDye; uniform vec2 uDyeTexel; uniform float uSeed, uParallax, uStretch, uRipple, uProg, uT;',
      'uniform vec3 uBase, uBg;',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
      'vec3 dye(vec2 uv){',
      '  vec3 d = vec3(0.0); float w = 0.0;',
      '  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {',
      '    float k = exp(-float(i * i + j * j) / 1.5);',
      '    d += texture(uDye, uv + vec2(float(i), float(j)) * uDyeTexel * 3.2).rgb * k; w += k; }',
      '  return d / w;',
      '}',
      'void main(){',
      '  vec2 uv = vec2((vUv.x - 0.5) / (1.0 + 0.06 * uProg) + 0.5, 1.0 - (1.0 - vUv.y) / uStretch + uParallax);',
      '  vec2 rip = vec2(sin(uv.y * 8.0 - uT * 0.9) * 0.010, sin(uv.x * 6.0 + uT * 0.7) * 0.005) * uRipple;',
      '  vec3 d = vec3(dye(uv + rip * 1.15).r, dye(uv + rip).g, dye(uv + rip * 0.85).b);',
      '  float y = 1.0 - uv.y;',
      '  vec3 base = mix(uBase, uBg, smoothstep(0.0, 0.88, y));',
      '  vec3 glow = (1.0 - exp(-d * 2.4)) * 0.78 * (1.0 - 0.4 * uProg);',
      '  vec3 col = base + glow * smoothstep(0.98, 0.05, y);',
      '  col += (hash(gl_FragCoord.xy + uSeed) - 0.5) / 255.0;',
      '  o = vec4(col, 1.0);',
      '}'
    ].join('\n'))
  };

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  var vs = compile(gl.VERTEX_SHADER, VS);
  if (!vs) return;
  var P = {};
  for (var name in SRC) {
    var fs = compile(gl.FRAGMENT_SHADER, SRC[name]);
    if (!fs) return;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    var u = {};
    var n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (var k = 0; k < n; k++) {
      var info = gl.getActiveUniform(prog, k);
      u[info.name] = gl.getUniformLocation(prog, info.name);
    }
    P[name] = { prog: prog, u: u };
  }

  var quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function target(w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex: tex, fbo: fbo, w: w, h: h, tx: 1 / w, ty: 1 / h };
  }
  function pair(w, h) {
    var a = target(w, h), b = target(w, h);
    return { read: a, write: b, swap: function () { var t = this.read; this.read = this.write; this.write = t; } };
  }
  function gridSize(short) {
    var asp = hero.clientWidth / Math.max(hero.clientHeight, 1);
    return asp >= 1 ? [Math.round(short * asp), short] : [short, Math.round(short / asp)];
  }
  var sim = gridSize(SIM), dye = gridSize(DYE);
  var velocity = pair(sim[0], sim[1]), pressure = pair(sim[0], sim[1]), dyeT = pair(dye[0], dye[1]);
  var divergence = target(sim[0], sim[1]), curl = target(sim[0], sim[1]), velocity0 = target(sim[0], sim[1]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, velocity.read.fbo);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return;

  var unit = 0, current = null;
  function use(p) { gl.useProgram(p.prog); current = p; unit = 0; return p.u; }
  function bind(loc, t) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.uniform1i(loc, unit++);
  }
  function blit(dst, texel) {
    if (dst) { gl.viewport(0, 0, dst.w, dst.h); gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo); }
    else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    if (current.u.uTexel) gl.uniform2f(current.u.uTexel, texel[0], texel[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  var simTexel = [velocity.read.tx, velocity.read.ty];
  var dyeTexel = [dyeT.read.tx, dyeT.read.ty];

  function splat(targetPair, texel, points, colors, radius) {
    var u = use(P.splat);
    bind(u.uTarget, targetPair.read);
    gl.uniform1f(u.uAspect, sim[0] / sim[1]);
    gl.uniform2fv(u['uPoint[0]'], points);
    gl.uniform3fv(u['uColor[0]'], colors);
    gl.uniform1f(u.uRadius, radius);
    blit(targetPair.write, texel);
    targetPair.swap();
  }

  function step(dt) {
    var u;
    u = use(P.current); bind(u.uVelocity, velocity.read);
    gl.uniform1f(u.uT, t); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uStrength, CURRENT); gl.uniform1f(u.uScroll, scrollImpulse);
    blit(velocity.write, simTexel); velocity.swap();

    u = use(P.curl); bind(u.uVelocity, velocity.read); blit(curl, simTexel);

    u = use(P.vorticity); bind(u.uVelocity, velocity.read); bind(u.uCurl, curl);
    gl.uniform1f(u.uCurlStrength, CURL); gl.uniform1f(u.uDt, dt);
    blit(velocity.write, simTexel); velocity.swap();

    u = use(P.clear); bind(u.uTex, velocity.read); gl.uniform1f(u.uValue, 1.0); blit(velocity0, simTexel);
    u = use(P.viscous);
    for (var v = 0; v < VISCOUS_ITERS; v++) {
      unit = 0;
      bind(u.uVelocity0, velocity0);
      bind(u.uVelocity, velocity.read);
      gl.uniform1f(u.uAlpha, VISCOSITY * dt);
      blit(velocity.write, simTexel); velocity.swap();
    }

    u = use(P.divergence); bind(u.uVelocity, velocity.read); blit(divergence, simTexel);

    u = use(P.clear); bind(u.uTex, pressure.read); gl.uniform1f(u.uValue, 0.8);
    blit(pressure.write, simTexel); pressure.swap();

    u = use(P.pressure);
    for (var i = 0; i < PRESSURE_ITERS; i++) {
      unit = 0;
      bind(u.uDivergence, divergence);
      bind(u.uPressure, pressure.read);
      blit(pressure.write, simTexel); pressure.swap();
    }

    u = use(P.gradient); bind(u.uPressure, pressure.read); bind(u.uVelocity, velocity.read);
    blit(velocity.write, simTexel); velocity.swap();

    u = use(P.advect); bind(u.uVelocity, velocity.read); bind(u.uSource, velocity.read);
    gl.uniform2f(u.uSimTexel, simTexel[0], simTexel[1]); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uDissipation, VEL_DISSIPATION);
    blit(velocity.write, simTexel); velocity.swap();

    u = use(P.advect); bind(u.uVelocity, velocity.read); bind(u.uSource, dyeT.read);
    gl.uniform2f(u.uSimTexel, simTexel[0], simTexel[1]); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uDissipation, DYE_DISSIPATION);
    blit(dyeT.write, dyeTexel); dyeT.swap();
  }

  var sources = [
    { ax: 0.40, fx: 0.031, ay: 0.08, fy: 0.047, ph: 0.0, y0: 0.12, col: C1, amt: 0.55 },
    { ax: 0.36, fx: -0.024, ay: 0.10, fy: 0.038, ph: 2.1, y0: 0.26, col: ACC, amt: 0.30 },
    { ax: 0.44, fx: 0.019, ay: 0.10, fy: 0.029, ph: 4.0, y0: 0.40, col: C2, amt: 0.50 },
    { ax: 0.30, fx: -0.036, ay: 0.07, fy: 0.052, ph: 5.3, y0: 0.10, col: C1, amt: 0.40 },
    { ax: 0.46, fx: 0.014, ay: 0.09, fy: 0.033, ph: 1.2, y0: 0.52, col: C2, amt: 0.38 },
    { ax: 0.42, fx: -0.017, ay: 0.10, fy: 0.025, ph: 3.4, y0: 0.32, col: C1, amt: 0.32 }
  ];
  var FORCE = 3;
  var TAU = Math.PI * 2;
  var pts = new Float32Array(12), vel = new Float32Array(18), ink = new Float32Array(18);
  function emit(t, dt) {
    for (var i = 0; i < sources.length; i++) {
      var s = sources[i];
      var ax = t * s.fx * TAU + s.ph, ay = t * s.fy * TAU + s.ph * 1.7;
      var x = 0.5 + s.ax * Math.sin(ax);
      var yTop = s.y0 + s.ay * Math.sin(ay);
      var vx = s.ax * s.fx * TAU * Math.cos(ax);
      var vy = -s.ay * s.fy * TAU * Math.cos(ay);
      pts[i * 2] = x; pts[i * 2 + 1] = 1 - yTop;
      vel[i * 3] = vx * sim[0] * FORCE * dt; vel[i * 3 + 1] = vy * sim[1] * FORCE * dt;
      var a = s.amt * dt * 0.8;
      ink[i * 3] = s.col[0] * a; ink[i * 3 + 1] = s.col[1] * a; ink[i * 3 + 2] = s.col[2] * a;
    }
    splat(velocity, simTexel, pts, vel, 0.02);
    splat(dyeT, dyeTexel, pts, ink, 0.022);
  }

  var PARALLAX = 0.38, STRETCH = 0.28, SCROLL_DRAG = 0.22, RIPPLE = 14;
  var prog = 0, progTarget = 0, ripple = 0, seed = 0;
  var scrollImpulse = 0, lastScrollY = window.scrollY;
  function onScroll() {
    var h = Math.max(hero.offsetHeight, 1);
    progTarget = Math.min(Math.max(window.scrollY, 0), h) / h;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  prog = progTarget;

  function resize() {
    var cssW = hero.clientWidth, cssH = hero.clientHeight;

    var s = Math.min(1, 760 / Math.max(cssW, 1));
    var w = Math.max(2, Math.round(cssW * s)), h = Math.max(2, Math.round(cssH * s));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  var base = [C2[0] * 0.42, C2[1] * 0.42, C2[2] * 0.42];
  function display() {
    resize();
    var u = use(P.display);
    bind(u.uDye, dyeT.read);
    gl.uniform2f(u.uDyeTexel, dyeTexel[0], dyeTexel[1]);
    gl.uniform1f(u.uParallax, PARALLAX * prog);
    gl.uniform1f(u.uStretch, 1.0 + STRETCH * prog);
    gl.uniform1f(u.uRipple, ripple);
    gl.uniform1f(u.uProg, prog);
    gl.uniform1f(u.uT, t);
    gl.uniform1f(u.uSeed, seed = (seed + 0.37) % 1);
    gl.uniform3fv(u.uBase, base);
    gl.uniform3fv(u.uBg, BG);
    blit(null, [1 / canvas.width, 1 / canvas.height]);
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var speed = TIME_SCALE * (reduce ? 0.5 : 1);
  var t = Math.random() * 200, last = 0;

  function frame(now) {
    var dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    dt *= speed;
    t += dt;
    prog += (progTarget - prog) * 0.1;

    var sy = window.scrollY, moved = (sy - lastScrollY) / Math.max(hero.offsetHeight, 1);
    lastScrollY = sy;

    var push = Math.max(-0.08, Math.min(0.08, moved)) * sim[1] * SCROLL_DRAG * 1.2;
    scrollImpulse += (push - scrollImpulse) * 0.25;
    ripple += (Math.min(1, Math.abs(moved) * RIPPLE) - ripple) * 0.06;
    emit(t, dt);
    step(dt);
    display();
    schedule();
  }

  var inView = true, raf = null;
  function schedule() {
    raf = null;
    if (inView && !document.hidden) raf = requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[entries.length - 1].isIntersecting;
      if (inView && raf === null) { last = 0; schedule(); }
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && raf === null) { last = 0; schedule(); }
  });

  var d0 = (1 / 60) * TIME_SCALE;
  for (var i = 0; i < 240; i++) {
    t += d0;
    emit(t, d0);
    step(d0);
  }

  hero.insertBefore(canvas, hero.firstChild);
  svgBg.hidden = true;
  display();
  schedule();
})();

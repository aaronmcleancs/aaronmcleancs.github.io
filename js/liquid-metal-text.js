// Tuned for a text-sized canvas: stripe scale and refraction close to the original
// liquid-metal shader, with a gentle flow speed.
const params = {
  refraction: 0.006,
  edge: 0.05,
  patternBlur: 0.006,
  liquid: 0.08,
  speed: 0.18,
  patternScale: 2.0,
  patternRatio: 2.0,
};
const vertexShaderSource = `#version 300 es
precision mediump float;

in vec2 a_position;
out vec2 vUv;

        void main() {
  vUv = .5 * (a_position + 1.);
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;


const liquidFragSource = `#version 300 es
precision mediump float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D u_image_texture;
uniform float u_time;
uniform float u_ratio;
uniform float u_img_ratio;
uniform float u_patternScale;
uniform float u_refraction;
uniform float u_edge;
uniform float u_patternBlur;
uniform float u_liquid;
uniform float u_pattern_ratio;
uniform float u_clarity;
uniform vec3 u_color_light;
uniform vec3 u_color_dark;


#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846


vec3 mod289(vec3 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec2 mod289(vec2 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec3 permute(vec3 x) { return mod289(((x*34.)+1.)*x); }
        float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
            vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1., 0.) : vec2(0., 1.);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0., i1.y, 1.)) + i.x + vec3(0., i1.x, 1.));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.);
  m = m*m;
  m = m*m;
  vec3 x = 2. * fract(p * C.www) - 1.;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
            vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130. * dot(m, g);
}

vec2 get_img_uv() {
  vec2 img_uv = vUv;
  img_uv -= .5;
  if (u_ratio > u_img_ratio) {
      img_uv.x = img_uv.x * u_ratio / u_img_ratio;
  } else {
      img_uv.y = img_uv.y * u_img_ratio / u_ratio;
  }
  float scale_factor = 1.;
  img_uv *= scale_factor;
  img_uv += .5;

  img_uv.y = 1. - img_uv.y;

  return img_uv;
}
vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}
float get_color_channel(float c1, float c2, float stripe_p, vec3 w, float extra_blur, float b) {
  float ch = c2;
  float border = 0.;
  float blur = u_patternBlur + extra_blur;

  ch = mix(ch, c1, smoothstep(.0, blur, stripe_p));

  border = w[0];
  ch = mix(ch, c2, smoothstep(border - blur, border + blur, stripe_p));

  b = smoothstep(.2, .8, b);
  border = w[0] + .4 * (1. - b) * w[1];
  ch = mix(ch, c1, smoothstep(border - blur, border + blur, stripe_p));

  border = w[0] + .5 * (1. - b) * w[1];
  ch = mix(ch, c2, smoothstep(border - blur, border + blur, stripe_p));

  border = w[0] + w[1];
  ch = mix(ch, c1, smoothstep(border - blur, border + blur, stripe_p));

  float gradient_t = (stripe_p - w[0] - w[1]) / w[2];
  float gradient = mix(c1, c2, smoothstep(0., 1., gradient_t));
  ch = mix(ch, gradient, smoothstep(border - blur, border + blur, stripe_p));

  return ch;
}

float get_img_frame_alpha(vec2 uv, float img_frame_width) {
  float img_frame_alpha = smoothstep(0., img_frame_width, uv.x) * smoothstep(1., 1. - img_frame_width, uv.x);
  img_frame_alpha *= smoothstep(0., img_frame_width, uv.y) * smoothstep(1., 1. - img_frame_width, uv.y);
  return img_frame_alpha;
}

void main() {
  vec2 uv = vUv;
  uv.y = 1. - uv.y;
  // pattern space is capped near 2:1 (the shader's bulge maths assumes a squarish canvas;
  // on a 7:1 name it went strongly negative at the ends and aliased into noise)
  uv.x *= u_pattern_ratio;

  float diagonal = uv.x - uv.y;

  float t = .001 * u_time;

  vec2 img_uv = get_img_uv();
  vec4 img = texture(u_image_texture, img_uv);

  vec3 color = vec3(0.);
  float opacity = 1.;

  vec3 color1 = u_color_light;
  vec3 color2 = u_color_dark;

  float edge = img.r;
  // rim: the outer edge of each stroke, where glass catches light (img.r -> 1 at the outline)
  float rim = smoothstep(.72, .96, img.r);


  vec2 grad_uv = uv;
  grad_uv.x -= u_pattern_ratio * 0.5;
  grad_uv.y -= 0.5;

  float dist = length(grad_uv + vec2(0., .2 * diagonal));

  grad_uv = rotate(grad_uv, (.25 - .2 * diagonal) * PI);

  float bulge = pow(1.8 * dist, 1.2);
  bulge = 1. - bulge;
  bulge *= pow(uv.y, .3);


  float cycle_width = u_patternScale;
  float thin_strip_1_ratio = .12 / cycle_width * (1. - .4 * bulge);
  float thin_strip_2_ratio = .07 / cycle_width * (1. + .4 * bulge);
  float wide_strip_ratio = (1. - thin_strip_1_ratio - thin_strip_2_ratio);

  float thin_strip_1_width = cycle_width * thin_strip_1_ratio;
  float thin_strip_2_width = cycle_width * thin_strip_2_ratio;

  opacity = 1. - smoothstep(.9 - .5 * u_edge, 1. - .5 * u_edge, edge);
  opacity *= get_img_frame_alpha(img_uv, 0.01);


  float noise = snoise(uv - t);

  edge += (1. - edge) * u_liquid * noise;

  float refr = 0.;
  refr += (1. - bulge);
  refr = clamp(refr, 0., 1.);

  float dir = grad_uv.x;


  dir += diagonal;

  dir -= 2. * noise * diagonal * (smoothstep(0., 1., edge) * smoothstep(1., 0., edge));

  bulge *= clamp(pow(uv.y, .1), .3, 1.);
  dir *= (.1 + (1.1 - edge) * bulge);

  dir *= smoothstep(1., .7, edge);

  dir += .18 * (smoothstep(.1, .2, uv.y) * smoothstep(.4, .2, uv.y));
  dir += .03 * (smoothstep(.1, .2, 1. - uv.y) * smoothstep(.4, .2, 1. - uv.y));

  dir *= (.5 + .5 * pow(uv.y, 2.));

  dir *= cycle_width;

  dir -= t;

  float refr_r = refr;
  refr_r += .03 * bulge * noise;
  float refr_b = 1.3 * refr;

  refr_r += 5. * (smoothstep(-.1, .2, uv.y) * smoothstep(.5, .1, uv.y)) * (smoothstep(.4, .6, bulge) * smoothstep(1., .4, bulge));
  refr_r -= diagonal;

  refr_b += (smoothstep(0., .4, uv.y) * smoothstep(.8, .1, uv.y)) * (smoothstep(.4, .6, bulge) * smoothstep(.8, .4, bulge));
  refr_b -= .2 * edge;

  refr_r *= u_refraction;
  refr_b *= u_refraction;

  vec3 w = vec3(thin_strip_1_width, thin_strip_2_width, wide_strip_ratio);
  w[1] -= .02 * smoothstep(.0, 1., edge + bulge);
  float stripe_r = mod(dir + refr_r, 1.);
  float r = get_color_channel(color1.r, color2.r, stripe_r, w, 0.02 + .03 * u_refraction * bulge, bulge);
  float stripe_g = mod(dir, 1.);
  float g = get_color_channel(color1.g, color2.g, stripe_g, w, 0.01, bulge);
  float stripe_b = mod(dir - refr_b, 1.);
  float b = get_color_channel(color1.b, color2.b, stripe_b, w, .01, bulge);

  color = vec3(r, g, b);

  // Dark glass: the darker the metal, the more see-through it is (u_clarity = 0 is solid),
  // so shadows let the background through while highlights stay bright.
  float lum = dot(color, vec3(.299, .587, .114));
  float alpha = opacity * mix(1. - u_clarity, 1., smoothstep(.05, .85, lum));
  // a light rim keeps every letter's outline readable even where the glass is clearest
  color = mix(color, u_color_light, rim * .55);
  alpha = max(alpha, opacity * rim * .85);

  fragColor = vec4(color * alpha, alpha);
}`;


function init() {
  createTextImage();
  initWebGL();
}

// Resolution of both canvases relative to CSS pixels.
const METAL_SCALE = Math.min((window.devicePixelRatio || 1) * 1.5, 3);

// The effect is laid out across the canvas, so the canvas is cropped tightly around the
// name (plus a small margin) instead of spanning the whole column. Otherwise the letters
// only ever showed a small slice of the pattern.
function createTextImage() {
  const textCanvas = document.getElementById('text-canvas');
  const shaderCanvas = document.getElementById('shader-canvas');
  if (!textCanvas || !shaderCanvas) return;

  const container = textCanvas.parentElement;
  const containerWidth = container.offsetWidth;
  const containerHeight = container.offsetHeight;
  const fontSize = Math.min(Math.floor(containerHeight * 0.65), Math.floor(containerWidth / 7));
  const font = '900 ' + fontSize + 'px "Audiowide", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, sans-serif';

  const ctx = textCanvas.getContext('2d', { willReadFrequently: true });
  ctx.font = font;
  const m = ctx.measureText('Aaron McLean');
  const pad = Math.round(fontSize * 0.1);
  const boxW = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2;
  const boxH = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2;

  [textCanvas, shaderCanvas].forEach(function (c) {
    c.style.left = '50%';
    c.style.top = '50%';
    c.style.width = boxW + 'px';
    c.style.height = boxH + 'px';
    c.style.transform = 'translate(-50%, -50%)';
  });

  textCanvas.width = Math.round(boxW * METAL_SCALE);
  textCanvas.height = Math.round(boxH * METAL_SCALE);
  ctx.setTransform(METAL_SCALE, 0, 0, METAL_SCALE, 0, 0);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, boxW, boxH);
  ctx.fillStyle = 'black';
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Aaron McLean', pad + m.actualBoundingBoxLeft, pad + m.actualBoundingBoxAscent);

  // The container's CSS height only sets the font size; collapse the empty space above and
  // below the letters so the hero's spacing is measured from the visible ink of the name.
  const trim = Math.max(0, (containerHeight - boxH) / 2 + pad);
  container.style.marginTop = -trim + 'px';
  container.style.marginBottom = -trim + 'px';

  window.metalBox = { width: boxW, height: boxH };
  processTextImage(textCanvas);
}

// 1D squared Euclidean distance transform (Felzenszwalb & Huttenlocher), in place.
function edt1d(f, n, v, z, d) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

// Builds the depth texture the shader reads: white outside the letters, and inside them
// a rounded profile that is brightest at each stroke's edge and darkest along its centre,
// like a pipe. Uses an exact distance transform (linear time) shaped into the parabolic
// profile a fully relaxed Poisson solve would give, so every stroke gets full depth
// instead of only a thin ramp at its edges.
function processTextImage(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const W = canvas.width;
  const H = canvas.height;
  const src = ctx.getImageData(0, 0, W, H).data;
  const INF = 1e20;

  const inside = new Uint8Array(W * H);
  const grid = new Float64Array(W * H);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const isIn = src[p] < 128;
    inside[i] = isIn ? 1 : 0;
    grid[i] = isIn ? INF : 0;
  }

  const n = Math.max(W, H);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = grid[y * W + x];
    edt1d(f, H, v, z, d);
    for (let y = 0; y < H; y++) grid[y * W + x] = d[y];
  }
  let maxDist = 0;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) f[x] = grid[row + x];
    edt1d(f, W, v, z, d);
    for (let x = 0; x < W; x++) {
      const dist = Math.sqrt(d[x]);
      grid[row + x] = dist;
      if (inside[row + x] && dist > maxDist) maxDist = dist;
    }
  }
  if (maxDist === 0) maxDist = 1;

  const out = ctx.createImageData(W, H);
  const od = out.data;
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    let gray = 255;
    if (inside[i]) {
      const t = Math.min(grid[i] / maxDist, 1);
      const depth = 1 - (1 - t) * (1 - t);
      gray = Math.floor(255 * (1 - Math.pow(depth, 1.5)));
    }
    od[p] = od[p + 1] = od[p + 2] = gray;
    od[p + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  window.processedTextImage = out;
}

// Metal colours come from css/theme.css (--metal-light / --metal-dark).
function themeMetalColors() {
  const cs = getComputedStyle(document.documentElement);
  function rgb(name, fallback) {
    const probe = document.createElement('span');
    probe.style.color = cs.getPropertyValue(name).trim() || fallback;
    document.body.appendChild(probe);
    const m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) || [];
    probe.remove();
    return m.length >= 3 ? [m[0] / 255, m[1] / 255, m[2] / 255] : null;
  }
  return {
    light: rgb('--metal-light', '#ffffff') || [1, 1, 1],
    dark: rgb('--metal-dark', '#000000') || [0, 0, 0],
    clarity: parseFloat(cs.getPropertyValue('--metal-clarity')) || 0,
  };
}


function initWebGL() {
  const shaderCanvas = document.getElementById('shader-canvas');

  if (!shaderCanvas) {
    console.error('Shader canvas not found');
    return;
  }

  const gl = shaderCanvas.getContext('webgl2', {
    antialias: true,
    alpha: true
  });

  if (!gl) {
    console.error('WebGL2 not supported');
    return;
  }

  const box = window.metalBox;
  shaderCanvas.width = Math.round(box.width * METAL_SCALE);
  shaderCanvas.height = Math.round(box.height * METAL_SCALE);

  gl.viewport(0, 0, shaderCanvas.width, shaderCanvas.height);

  const program = createShaderProgram(gl, vertexShaderSource, liquidFragSource);
  if (!program) {
    console.error('Failed to create shader program');
    return;
  }

  gl.useProgram(program);

  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {};
  const uniformNames = [
    'u_image_texture',
    'u_time',
    'u_ratio',
    'u_img_ratio',
    'u_patternScale',
    'u_refraction',
    'u_edge',
    'u_patternBlur',
    'u_liquid',
    'u_pattern_ratio',
    'u_clarity',
    'u_color_light',
    'u_color_dark'
  ];

  uniformNames.forEach(name => {
    uniforms[name] = gl.getUniformLocation(program, name);
  });

  setupTexture(gl, uniforms);

  gl.uniform1f(uniforms.u_ratio, box.width / box.height);
  gl.uniform1f(uniforms.u_img_ratio, box.width / box.height);
  gl.uniform1f(uniforms.u_pattern_ratio, Math.min(box.width / box.height, params.patternRatio));
  const metal = themeMetalColors();
  gl.uniform3fv(uniforms.u_color_light, metal.light);
  gl.uniform3fv(uniforms.u_color_dark, metal.dark);
  gl.uniform1f(uniforms.u_clarity, metal.clarity);
  gl.uniform1f(uniforms.u_patternScale, params.patternScale);
  gl.uniform1f(uniforms.u_refraction, params.refraction);
  gl.uniform1f(uniforms.u_edge, params.edge);
  gl.uniform1f(uniforms.u_patternBlur, params.patternBlur);
  gl.uniform1f(uniforms.u_liquid, params.liquid);

  window.glContext = {
    gl: gl,
    uniforms: uniforms
  };

  let animationTime = 0;
  let lastTime = 0;

  function render(currentTime) {
    currentTime *= 0.001;
    // resume without a jump after the loop has been paused off screen
    const deltaTime = Math.min(currentTime - lastTime, 0.1);
    lastTime = currentTime;

    animationTime += deltaTime * params.speed * 1000;
    gl.uniform1f(uniforms.u_time, animationTime);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  if (typeof runWhileVisible === 'function') {
    runWhileVisible(shaderCanvas, render);
  } else {
    (function loop(t) { render(t); requestAnimationFrame(loop); })(0);
  }

  // Rebuild only when the width actually changes (phones fire resize when the URL bar
  // moves), and upload the new texture so the change is actually drawn.
  let lastWidth = shaderCanvas.parentElement.offsetWidth;
  let resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      const width = shaderCanvas.parentElement.offsetWidth;
      if (width === lastWidth) return;
      lastWidth = width;

      createTextImage();
      const b = window.metalBox;
      shaderCanvas.width = Math.round(b.width * METAL_SCALE);
      shaderCanvas.height = Math.round(b.height * METAL_SCALE);
      gl.viewport(0, 0, shaderCanvas.width, shaderCanvas.height);
      gl.uniform1f(uniforms.u_ratio, b.width / b.height);
      gl.uniform1f(uniforms.u_img_ratio, b.width / b.height);
      gl.uniform1f(uniforms.u_pattern_ratio, Math.min(b.width / b.height, params.patternRatio));
      const img = window.processedTextImage;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
    }, 150);
  });
}

function createShaderProgram(gl, vsSource, fsSource) {

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vsSource);
  gl.compileShader(vertexShader);


  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader));
    gl.deleteShader(vertexShader);
    return null;
  }


  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fsSource);
  gl.compileShader(fragmentShader);


  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error('Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader));
    gl.deleteShader(fragmentShader);
    gl.deleteShader(vertexShader);
    return null;
  }


  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);


  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program linking error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    gl.deleteShader(fragmentShader);
    gl.deleteShader(vertexShader);
    return null;
  }

  return program;
}


function setupTexture(gl, uniforms) {

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);


  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);


  const checkImage = () => {
    if (window.processedTextImage) {

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        window.processedTextImage.width,
        window.processedTextImage.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        window.processedTextImage.data
      );


      gl.uniform1i(uniforms.u_image_texture, 0);
    } else {

      setTimeout(checkImage, 100);
    }
  };

  checkImage();
}


document.addEventListener('DOMContentLoaded', function () {
  try {
    init();
  } catch (e) {
    console.error('Error initializing liquid metal text:', e);
  }
});
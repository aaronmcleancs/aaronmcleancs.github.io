const frame = document.querySelector('.stage__frame');
const desktop = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)').matches;
const gl2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })();

if (frame && desktop && gl2 && frame.querySelector('img[data-splat]')) {
  const near = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      near.disconnect();
      start().catch(() => {});
    }
  }, { rootMargin: '600px 0px' });
  near.observe(frame);
}

async function start() {
  const [THREE, { SparkRenderer, SplatMesh }] = await Promise.all([import('three'), import('@sparkjsdev/spark')]);

  const canvas = document.createElement('canvas');
  canvas.className = 'stage__splat';
  canvas.setAttribute('aria-hidden', 'true');
  frame.insertBefore(canvas, frame.querySelector('.stage__caption'));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  const camera = new THREE.PerspectiveCamera(36, 1.5, 0.05, 5000);
  scene.add(new SparkRenderer({ renderer }));

  const AMP_X = 0.045, AMP_Y = 0.025, EASE = 0.07;
  const cache = new Map();
  let current = null, raf = null, settle = 0;
  const hover = { x: 0, y: 0 }, cam = { x: 0, y: 0 }, aim = { x: 0, y: 0 };
  const GW = 128, GH = 96;
  function depthGrid(image) {
    const c = document.createElement('canvas');
    c.width = GW; c.height = GH;
    const x = c.getContext('2d');
    x.drawImage(image, 0, 0, GW, GH);
    const d = x.getImageData(0, 0, GW, GH).data, g = new Float32Array(GW * GH);
    for (let i = 0; i < g.length; i++) g[i] = d[i * 4] / 255;
    return g;
  }
  function sampleGrid(grid, u, v) {
    const x = Math.min(GW - 1.001, Math.max(0, u * GW - 0.5)), y = Math.min(GH - 1.001, Math.max(0, v * GH - 0.5));
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * GW + x0;
    const top = grid[i] * (1 - fx) + grid[i + 1] * fx, bot = grid[i + GW] * (1 - fx) + grid[i + GW + 1] * fx;
    return top * (1 - fy) + bot * fy;
  }

  function load(img) {
    if (!cache.has(img)) {
      cache.set(img, (async () => {
        const meta = await (await fetch(img.dataset.splatMeta)).json();
        const mesh = new SplatMesh({ url: img.dataset.splat });
        mesh.quaternion.set(1, 0, 0, 0);
        const depthTex = await new THREE.TextureLoader().loadAsync(img.dataset.depth).catch(() => null);
        let grid = null;
        if (depthTex) {
          depthTex.minFilter = depthTex.magFilter = THREE.LinearFilter; depthTex.generateMipmaps = false;
          grid = depthGrid(depthTex.image);
        }
        await mesh.initialized;
        mesh.visible = false;
        scene.add(mesh);
        return { mesh, meta, depthTex, grid };
      })());
    }
    return cache.get(img);
  }

  const FOCUS_EASE = 0.045, AMOUNT_EASE = 0.05, MAX_BLUR = 7;
  const dof = { d: 0.5, td: 0.5, amt: 0, tamt: 0 };
  const rt = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true, type: THREE.HalfFloatType });
  const post = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: null },
      uFocusD: { value: 0.5 }, uScale: { value: new THREE.Vector2(1, 1) },
      uTexel: { value: new THREE.Vector2(1, 1) }, uAmount: { value: 0 }, uMaxR: { value: MAX_BLUR }, uDof: { value: 1 }
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tColor, tDepth; uniform vec2 uScale, uTexel; uniform float uFocusD, uAmount, uMaxR, uDof; varying vec2 vUv;',
      'float depthAt(vec2 uv){ return texture2D(tDepth, (uv - 0.5) * uScale + 0.5).r; }',
      'void main(){',
      '  float d = depthAt(vUv);',
      '  float r = smoothstep(0.06, 0.36, abs(d - uFocusD) * uDof) * uMaxR * uAmount;',
      '  vec4 c = texture2D(tColor, vUv);',
      '  if (r > 0.35) {',
      '    vec4 acc = c; float wsum = 1.0;',
      '    for (int i = 0; i < 16; i++) {',
      '      float fi = float(i), a = fi * 2.39996, rr = sqrt((fi + 0.5) / 16.0) * r;',
      '      acc += texture2D(tColor, vUv + vec2(cos(a), sin(a)) * rr * uTexel); wsum += 1.0;',
      '    }',
      '    c = acc / wsum;',
      '  }',
      '  gl_FragColor = vec4(c.rgb, 1.0);',
      '}'
    ].join('\n'),
    depthTest: false, depthWrite: false
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Spark encodes for the working colour space when drawing off-screen; drawing in sRGB keeps its
  // blending identical to an on-screen render, so the post pass can pass pixels through untouched.
  function renderToTarget() {
    const cm = THREE.ColorManagement, ws = cm.workingColorSpace;
    cm.workingColorSpace = THREE.SRGBColorSpace;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    cm.workingColorSpace = ws;
  }

  function fit() {
    const w = frame.clientWidth, h = frame.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const pr = renderer.getPixelRatio();
    rt.setSize(Math.round(w * pr), Math.round(h * pr));
    post.uniforms.uTexel.value.set(1 / (w * pr), 1 / (h * pr));
    post.uniforms.uMaxR.value = MAX_BLUR * pr * (current && current.meta.blur || 1);
    post.uniforms.uDof.value = current && current.meta.dof || 1;
    if (current) {
      const ia = current.meta.image_size[0] / current.meta.image_size[1], fa = w / h;
      post.uniforms.uScale.value.set(ia > fa ? fa / ia : 1, ia > fa ? 1 : ia / fa);
      const [iw, ih] = current.meta.image_size, fy = current.meta.intrinsic[1][1];
      const visibleH = iw / ih > camera.aspect ? ih : iw / camera.aspect;
      camera.fov = 2 * Math.atan(visibleH / 2 / fy) * 180 / Math.PI;
    }
    camera.updateProjectionMatrix();
  }

  function target() {
    const depth = current ? current.meta.focus || current.meta.bounds_z[1] : 1;
    aim.x = -hover.x * AMP_X * depth;
    aim.y = hover.y * AMP_Y * depth;
    kick();
  }

  function frameLoop() {
    raf = null;
    if (!current) return;
    cam.x += (aim.x - cam.x) * EASE;
    cam.y += (aim.y - cam.y) * EASE;
    const focus = current.meta.focus || current.meta.bounds_z[1];
    camera.position.set(cam.x, cam.y, 0);
    camera.lookAt(0, 0, -focus);
    dof.d += (dof.td - dof.d) * FOCUS_EASE;
    dof.amt += (dof.tamt - dof.amt) * AMOUNT_EASE;
    const animating = settle-- > 0 || Math.abs(aim.x - cam.x) > 1e-4 || Math.abs(aim.y - cam.y) > 1e-4 ||
      Math.abs(dof.td - dof.d) > 1e-3 || Math.abs(dof.tamt - dof.amt) > 1e-3;
    if (current.depthTex) {
      renderToTarget();
      const U = post.uniforms;
      U.tDepth.value = current.depthTex;
      U.uFocusD.value = dof.d;
      U.uAmount.value = dof.amt;
      renderer.render(postScene, postCam);
    } else {
      renderer.render(scene, camera);
    }
    if (animating) kick();
  }
  function kick() {
    if (!raf && current) raf = requestAnimationFrame(frameLoop);
  }

  let token = 0;
  async function activate() {
    const active = frame.querySelector('img.is-active');
    const my = ++token;
    canvas.classList.remove('is-on');
    frame.classList.remove('has-splat');
    if (!active || !active.dataset.splat) {
      setTimeout(() => { if (my === token && current) { current.mesh.visible = false; current = null; } }, 400);
      return;
    }
    const entry = await load(active).catch(() => null);
    if (!entry || my !== token) return;
    if (current && current !== entry) current.mesh.visible = false;
    current = entry;
    entry.mesh.visible = true;
    fit();
    target();
    cam.x = aim.x; cam.y = aim.y;
    settle = 45;
    kick();
    setTimeout(() => { if (my === token) { canvas.classList.add('is-on'); frame.classList.add('has-splat'); } }, 250);
  }

  frame.addEventListener('pointermove', (e) => {
    const r = frame.getBoundingClientRect();
    hover.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    hover.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (current && current.grid) {
      const sc = post.uniforms.uScale.value;
      const u = ((e.clientX - r.left) / r.width - 0.5) * sc.x + 0.5;
      const v = ((e.clientY - r.top) / r.height - 0.5) * sc.y + 0.5;
      const want = sampleGrid(current.grid, u, v);
      dof.td = want;
      if (dof.tamt === 0 && dof.amt < 0.05) dof.d = want;
    }
    dof.tamt = 1;
    target();
  });
  frame.addEventListener('pointerleave', () => { hover.x = 0; hover.y = 0; dof.tamt = 0; target(); });
  window.addEventListener('resize', () => { fit(); settle = 10; kick(); });

  const observer = new MutationObserver(activate);
  frame.querySelectorAll('img').forEach((img) => observer.observe(img, { attributes: true, attributeFilter: ['class'] }));
  activate();
}

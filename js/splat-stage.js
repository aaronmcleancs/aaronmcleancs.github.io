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
  function load(img) {
    if (!cache.has(img)) {
      cache.set(img, (async () => {
        const meta = await (await fetch(img.dataset.splatMeta)).json();
        const mesh = new SplatMesh({ url: img.dataset.splat });
        mesh.quaternion.set(1, 0, 0, 0);
        const depthTex = await new THREE.TextureLoader().loadAsync(img.dataset.depth).catch(() => null);
        if (depthTex) { depthTex.minFilter = depthTex.magFilter = THREE.LinearFilter; depthTex.generateMipmaps = false; }
        await mesh.initialized;
        mesh.visible = false;
        scene.add(mesh);
        return { mesh, meta, depthTex };
      })());
    }
    return cache.get(img);
  }

  const FOCUS_EASE = 0.09, AMOUNT_EASE = 0.06, MAX_BLUR = 5;
  const dof = { f: { x: 0.5, y: 0.5 }, tf: { x: 0.5, y: 0.5 }, amt: 0, tamt: 0 };
  const rt = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true, type: THREE.HalfFloatType });
  const post = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: null },
      uFocus: { value: new THREE.Vector2(0.5, 0.5) }, uScale: { value: new THREE.Vector2(1, 1) },
      uTexel: { value: new THREE.Vector2(1, 1) }, uAmount: { value: 0 }, uMaxR: { value: MAX_BLUR }
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tColor, tDepth; uniform vec2 uFocus, uScale, uTexel; uniform float uAmount, uMaxR; varying vec2 vUv;',
      'float depthAt(vec2 uv){ return texture2D(tDepth, (uv - 0.5) * uScale + 0.5).r; }',
      'void main(){',
      '  float df = depthAt(uFocus), d = depthAt(vUv);',
      '  float r = clamp(abs(d - df) * 2.6 - 0.04, 0.0, 1.0) * uMaxR * uAmount;',
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
      '  #include <colorspace_fragment>',
      '}'
    ].join('\n'),
    depthTest: false, depthWrite: false
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function fit() {
    const w = frame.clientWidth, h = frame.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const pr = renderer.getPixelRatio();
    rt.setSize(Math.round(w * pr), Math.round(h * pr));
    post.uniforms.uTexel.value.set(1 / (w * pr), 1 / (h * pr));
    post.uniforms.uMaxR.value = MAX_BLUR * pr;
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
    dof.f.x += (dof.tf.x - dof.f.x) * FOCUS_EASE;
    dof.f.y += (dof.tf.y - dof.f.y) * FOCUS_EASE;
    dof.amt += (dof.tamt - dof.amt) * AMOUNT_EASE;
    const animating = settle-- > 0 || Math.abs(aim.x - cam.x) > 1e-4 || Math.abs(aim.y - cam.y) > 1e-4 ||
      Math.abs(dof.tf.x - dof.f.x) > 1e-4 || Math.abs(dof.tf.y - dof.f.y) > 1e-4 || Math.abs(dof.tamt - dof.amt) > 1e-3;
    if (current.depthTex) {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      const U = post.uniforms;
      U.tDepth.value = current.depthTex;
      U.uFocus.value.set(dof.f.x, dof.f.y);
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
    dof.tf.x = (e.clientX - r.left) / r.width;
    dof.tf.y = 1 - (e.clientY - r.top) / r.height;
    dof.tamt = 1;
    target();
  });
  frame.addEventListener('pointerleave', () => { hover.x = 0; hover.y = 0; dof.tamt = 0; target(); });
  window.addEventListener('resize', () => { fit(); settle = 10; kick(); });

  const observer = new MutationObserver(activate);
  frame.querySelectorAll('img').forEach((img) => observer.observe(img, { attributes: true, attributeFilter: ['class'] }));
  activate();
}

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
        await mesh.initialized;
        mesh.visible = false;
        scene.add(mesh);
        return { mesh, meta };
      })());
    }
    return cache.get(img);
  }

  function fit() {
    const w = frame.clientWidth, h = frame.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (current) {
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
    const animating = settle-- > 0 || Math.abs(aim.x - cam.x) > 1e-4 || Math.abs(aim.y - cam.y) > 1e-4;
    renderer.render(scene, camera);
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
    target();
  });
  frame.addEventListener('pointerleave', () => { hover.x = 0; hover.y = 0; target(); });
  window.addEventListener('resize', () => { fit(); settle = 10; kick(); });

  const observer = new MutationObserver(activate);
  frame.querySelectorAll('img').forEach((img) => observer.observe(img, { attributes: true, attributeFilter: ['class'] }));
  activate();
}

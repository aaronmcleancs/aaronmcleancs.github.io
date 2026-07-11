(function () {
  const heroBackground = document.querySelector('.hero__background');
  if (!heroBackground) return;

  const zoomFactor = 1.2;
  let animationFrameId = null;
  let lastScrollY = window.scrollY;
  let currentScale = calculateTargetScale(window.scrollY);

  function getBaseScale(width) {
    const minWidth = 300, maxWidth = 1300;
    if (width <= minWidth) return 1300;
    if (width >= maxWidth) return 220;
    return 1300 - (width - minWidth) * ((1300 - 220) / (maxWidth - minWidth));
  }

  function calculateTargetScale(scrollVal) {
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    const scrollPercent = scrollVal / (scrollHeight - window.innerHeight);
    const baseScale = getBaseScale(window.innerWidth);
    const baselineWidth = 1920;
    const multiplier = window.innerWidth > baselineWidth ? 700 * (baselineWidth / window.innerWidth) : 700;
    const offset = baseScale * 0.4;
    return (baseScale + scrollPercent * multiplier) - offset * (1 - scrollPercent);
  }

  function updateVisuals() {
    const scale = (currentScale * zoomFactor) / 100;
    heroBackground.style.transform = `scale(${scale})`;
  }

  function smoothUpdate() {
    const targetScale = calculateTargetScale(window.scrollY);
    const ease = navigator.userAgent.indexOf('Firefox') !== -1 ? 0.05 : 0.1;
    currentScale += (targetScale - currentScale) * ease;

    updateVisuals();

    if (Math.abs(targetScale - currentScale) > 0.1) {
      animationFrameId = requestAnimationFrame(smoothUpdate);
    } else {
      animationFrameId = null;
    }
  }

  function onScroll() {
    if (Math.abs(window.scrollY - lastScrollY) < 5) return;
    lastScrollY = window.scrollY;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(smoothUpdate);
  }

  let scrollTimeout;
  window.addEventListener('scroll', function () {
    if (!scrollTimeout) {
      scrollTimeout = setTimeout(function () {
        scrollTimeout = null;
        onScroll();
      }, 10);
    }
  }, { passive: true });

  window.addEventListener('resize', function () {
    currentScale = calculateTargetScale(window.scrollY);
    updateVisuals();
  });

  currentScale = calculateTargetScale(window.scrollY);
  updateVisuals();
})();

document.addEventListener('DOMContentLoaded', function () {
  const container = document.querySelector('.terminal-container');
  const textWrapper = document.querySelector('.text-wrapper');

  container.addEventListener('mousemove', function (e) {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const rotateX = y * 0.13;
    const rotateY = x * -0.05;

    textWrapper.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;
  });

  container.addEventListener('mouseleave', function () {
    textWrapper.style.transform = 'rotateX(0) rotateY(0) translateZ(0)';
  });
});

document.addEventListener('DOMContentLoaded', function () {
  const heroSection = document.querySelector('.hero2__section');
  if (!heroSection) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'grid-canvas';
  heroSection.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  let resizeTimer;
  function resizeCanvas() {
    canvas.width = heroSection.offsetWidth;
    canvas.height = heroSection.offsetHeight;
  }

  resizeCanvas();
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, 150);
  });

  const spacing = 45;
  const baseDotRadius = 1.5;
  const maxDotRadius = 2.6;

  const waveSpeed = 0.005;
  const waveAmplitude = 15;
  const waveFrequency = 0.05;

  const scrollTranslationFactor = -0.5;
  let currentScrollOffset = 0;
  let targetScrollOffset = 0;

  const transitionSpeed = 0.05;

  // Frame budget: cap at ~30fps, time step scaled to keep motion speed identical
  const frameInterval = 1000 / 30;
  const timeStep = waveSpeed * 2; // was waveSpeed per ~60fps frame
  let lastFrame = 0;

  let time = 0;

  let targetMouseX = 0;
  let targetMouseY = 0;
  let currentMouseX = 0;
  let currentMouseY = 0;
  let mouseInfluence = 0;
  let mouseInfluenceTarget = 0;
  let mouseTimeout;

  // Pulsing brightness system
  const pulses = [];
  const maxPulses = 3;
  const pulseSpawnInterval = 2000; // ms
  const pulseSpeed = 80; // pixels per second
  const pulseMaxRadius = 300;
  const pulseBrightness = 0.6;

  // Animation gating: only run while on-screen and tab visible
  let inView = false;
  let rafId = null;

  function startLoop() {
    if (rafId === null && inView && !document.hidden) {
      lastFrame = 0;
      rafId = requestAnimationFrame(drawGrid);
    }
  }

  function stopLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) startLoop(); else stopLoop();
    }, { rootMargin: '100px' });
    io.observe(heroSection);
  } else {
    inView = true;
    startLoop();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop(); else startLoop();
  });

  heroSection.addEventListener('mousemove', function (e) {
    const rect = heroSection.getBoundingClientRect();
    targetMouseX = e.clientX - rect.left;
    targetMouseY = e.clientY - rect.top;

    clearTimeout(mouseTimeout);
    mouseInfluenceTarget = 1;

    mouseTimeout = setTimeout(() => {
      mouseInfluenceTarget = 0;
    }, 1000);
  });

  heroSection.addEventListener('mouseleave', function () {
    mouseInfluenceTarget = 0;
  });

  // Track scroll for translation effect
  function updateScrollOffset() {
    targetScrollOffset = window.scrollY * scrollTranslationFactor;
  }

  window.addEventListener('scroll', updateScrollOffset, { passive: true });
  updateScrollOffset();

  // Spawn pulses at random dots (skipped entirely while paused)
  function spawnPulse() {
    if (rafId === null || pulses.length >= maxPulses) return;

    const cols = Math.ceil(canvas.width / spacing) + 1;
    const rows = Math.ceil(canvas.height / spacing) + 1;

    pulses.push({
      x: Math.floor(Math.random() * cols) * spacing,
      y: Math.floor(Math.random() * rows) * spacing,
      radius: 0,
      startTime: Date.now()
    });
  }

  setInterval(spawnPulse, pulseSpawnInterval);

  // Batched rendering: dots are grouped by quantized (radius, opacity) so each
  // group is drawn with a single beginPath/fill instead of one per dot.
  const buckets = new Map();

  function drawGrid(timestamp) {
    rafId = requestAnimationFrame(drawGrid);

    if (timestamp - lastFrame < frameInterval) return;
    lastFrame = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Smooth scroll translation
    currentScrollOffset += (targetScrollOffset - currentScrollOffset) * transitionSpeed;

    // Mouse tracking
    currentMouseX += (targetMouseX - currentMouseX) * transitionSpeed;
    currentMouseY += (targetMouseY - currentMouseY) * transitionSpeed;
    mouseInfluence += (mouseInfluenceTarget - mouseInfluence) * transitionSpeed;

    // Update pulses
    const now = Date.now();
    for (let p = pulses.length - 1; p >= 0; p--) {
      const pulse = pulses[p];
      pulse.radius = ((now - pulse.startTime) / 1000) * pulseSpeed;
      if (pulse.radius > pulseMaxRadius) pulses.splice(p, 1);
    }

    const margin = spacing * 2;
    const startY = Math.floor((currentScrollOffset - margin) / spacing) * spacing;
    const endY = currentScrollOffset + canvas.height + margin;

    const cols = Math.ceil(canvas.width / spacing) + 1;
    const rowStart = Math.floor(startY / spacing);
    const rowEnd = Math.ceil(endY / spacing);

    const mouseOn = mouseInfluence > 0.01;
    const pulseCount = pulses.length;

    buckets.clear();

    for (let i = 0; i < cols; i++) {
      const x = i * spacing;
      for (let j = rowStart; j <= rowEnd; j++) {
        const y = j * spacing - currentScrollOffset;
        if (y < -margin || y > canvas.height + margin) continue;

        // Improved wave animation with multi-layered sine/cosine
        let offsetX = Math.sin(time + j * waveFrequency) * waveAmplitude +
          Math.sin(time * 0.7 + i * waveFrequency * 0.5) * (waveAmplitude * 0.3);
        let offsetY = Math.cos(time + i * waveFrequency) * waveAmplitude +
          Math.cos(time * 0.5 + j * waveFrequency * 0.7) * (waveAmplitude * 0.3);

        let dotRadius = baseDotRadius;
        let brightnessBoost = 0;

        // Pulsing brightness from all active pulses
        for (let p = 0; p < pulseCount; p++) {
          const pulse = pulses[p];
          const distX = x - pulse.x;
          const distY = y - pulse.y;
          const dist = Math.sqrt(distX * distX + distY * distY);
          const band = Math.abs(dist - pulse.radius);

          if (band < 80) {
            const waveFalloff = 1 - band / 80;
            const pulseFade = 1 - pulse.radius / pulseMaxRadius;
            const boost = waveFalloff * pulseFade * pulseBrightness;
            if (boost > brightnessBoost) brightnessBoost = boost;
          }
        }

        // Mouse interaction
        if (mouseOn) {
          const distX = x - currentMouseX;
          const distY = y - currentMouseY;
          const distSq = distX * distX + distY * distY;

          if (distSq < 1000000) { // 1000px radius, squared compare avoids sqrt when out of range
            const dist = Math.sqrt(distSq);
            const factor = 1 - dist / 1000;
            const influence = factor * 15 * mouseInfluence;

            offsetX += (distX / dist) * influence;
            offsetY += (distY / dist) * influence;

            const sizeFactor = factor * factor * mouseInfluence;
            dotRadius = baseDotRadius + (maxDotRadius - baseDotRadius) * sizeFactor;
          }
        }

        const dotX = x + offsetX;
        const dotY = y + offsetY;

        if (dotX >= -spacing && dotX <= canvas.width + spacing &&
          dotY >= -spacing && dotY <= canvas.height + spacing) {

          const waveHeight = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
          let opacity = 0.5 + (waveHeight / (waveAmplitude * 2)) * 0.5;
          opacity += brightnessBoost;
          if (opacity > 1) opacity = 1;

          // Quantize to bucket keys (opacity: 1/32 steps, radius: 0.1px steps)
          const key = ((opacity * 32) | 0) * 64 + ((dotRadius * 10) | 0);
          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = { opacity: ((opacity * 32) | 0) / 32, radius: ((dotRadius * 10) | 0) / 10, pts: [] };
            buckets.set(key, bucket);
          }
          bucket.pts.push(dotX, dotY);
        }
      }
    }

    // One path + fill per bucket
    buckets.forEach(function (bucket) {
      ctx.beginPath();
      const pts = bucket.pts;
      const r = bucket.radius;
      for (let k = 0; k < pts.length; k += 2) {
        ctx.moveTo(pts[k] + r, pts[k + 1]);
        ctx.arc(pts[k], pts[k + 1], r, 0, Math.PI * 2);
      }
      ctx.fillStyle = 'rgba(32, 32, 32, ' + bucket.opacity + ')';
      ctx.fill();
    });

    time += timeStep;
  }
});

document.addEventListener('DOMContentLoaded', function () {
  const scrollSuggestion = document.querySelector('.scroll-suggestion');
  window.addEventListener('scroll', function () {
    if (window.scrollY > 50) {
      scrollSuggestion.classList.add('hidden');
    } else {
      scrollSuggestion.classList.remove('hidden');
    }
  });
});
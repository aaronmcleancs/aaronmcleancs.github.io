// Runs `frame` on rAF only while `el` is on screen and the tab is visible.
function runWhileVisible(el, frame) {
  var inView = true, rafId = null;
  function tick(t) {
    rafId = null;
    frame(t);
    schedule();
  }
  function schedule() {
    if (rafId === null && inView && !document.hidden) rafId = requestAnimationFrame(tick);
  }
  function stop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[entries.length - 1].isIntersecting;
      inView ? schedule() : stop();
    }).observe(el);
  }
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stop() : schedule();
  });
  schedule();
  return { active: function () { return rafId !== null; } };
}

(function () {
  const heroBackground = document.querySelector('.hero__background');
  if (!heroBackground) return;
  const heroSection = heroBackground.parentElement;
  const maxScrollPercent = 0.25;

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

  // Zoom progress is measured across the hero only (0 at the top, 0.25 once the hero has
  // scrolled away, matching the old feel on a shorter page). Measuring across the whole
  // document let the layer reach ~10x scale further down, and the browser then repainted
  // that oversized layer in tiles when scrolling back up.
  function calculateTargetScale(scrollVal) {
    const heroHeight = heroSection.offsetHeight || window.innerHeight;
    const scrollPercent = Math.min(Math.max(scrollVal / heroHeight, 0), 1) * maxScrollPercent;
    const baseScale = getBaseScale(window.innerWidth);
    const baselineWidth = 1920;
    const multiplier = window.innerWidth > baselineWidth ? 700 * (baselineWidth / window.innerWidth) : 700;
    const offset = baseScale * 0.4;
    return (baseScale + scrollPercent * multiplier) - offset * (1 - scrollPercent);
  }

  // Subtle idle drift: slow horizontal sway composed with the scroll zoom
  const driftAmplitude = 35; // px each direction
  const driftPeriod = 12000; // ms per full cycle
  let driftX = 0;

  function updateVisuals() {
    const scale = (currentScale * zoomFactor) / 100;
    heroBackground.style.transform = `translateX(${driftX.toFixed(2)}px) scale(${scale})`;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    runWhileVisible(heroBackground.parentElement, function (timestamp) {
      driftX = Math.sin((timestamp * 2 * Math.PI) / driftPeriod) * driftAmplitude;
      updateVisuals();
    });
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
    // nothing to animate once the hero is fully scrolled past and the scale is already capped
    if (window.scrollY > heroSection.offsetHeight && lastScrollY > heroSection.offsetHeight) {
      lastScrollY = window.scrollY;
      return;
    }
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
  const heroSection = document.querySelector('.hero2__section');
  if (!heroSection) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'grid-canvas';
  heroSection.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    const w = heroSection.offsetWidth;
    const h = heroSection.offsetHeight;
    // resizing clears the canvas and reallocates it; skip no-op resizes (mobile URL bar)
    if (w === canvas.width && h === canvas.height) return;
    canvas.width = w;
    canvas.height = h;
  }

  resizeCanvas();
  let resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, 150);
  });

  const spacing = 45;
  const baseDotRadius = 1.5;
  const maxDotRadius = 2.6;
  const dotColor = 'rgb(71, 71, 71)';

  const waveSpeed = 0.005;
  const waveAmplitude = 15;
  const waveFrequency = 0.05;
  const waveOffset = 5;

  const scrollTranslationFactor = -0.5;
  let currentScrollOffset = 0;
  let targetScrollOffset = 0;

  const transitionSpeed = 0.05;

  let time = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseActive = false;

  let targetMouseX = 0;
  let targetMouseY = 0;
  let currentMouseX = 0;
  let currentMouseY = 0;
  let mouseInfluence = 0;

  // Pulsing brightness system
  const pulses = [];
  const maxPulses = 3;
  const pulseSpawnInterval = 2000; // ms
  const pulseSpeed = 80; // pixels per second
  const pulseMaxRadius = 300;
  const pulseBrightness = 0.6;

  heroSection.addEventListener('mousemove', function (e) {
    const rect = heroSection.getBoundingClientRect();
    targetMouseX = e.clientX - rect.left;
    targetMouseY = e.clientY - rect.top;
    mouseActive = true;

    clearTimeout(mouseTimeout);
    mouseInfluenceTarget = 1;

    mouseTimeout = setTimeout(() => {
      mouseInfluenceTarget = 0;
    }, 1000);
  });

  heroSection.addEventListener('mouseleave', function () {
    mouseInfluenceTarget = 0;
  });

  let mouseTimeout;
  let mouseInfluenceTarget = 0;

  // Track scroll for translation effect
  function updateScrollOffset() {
    targetScrollOffset = window.scrollY * scrollTranslationFactor;
  }

  window.addEventListener('scroll', updateScrollOffset, { passive: true });
  updateScrollOffset(); // Initialize

  // Spawn pulses at random dots
  function spawnPulse() {
    if (pulses.length >= maxPulses) return;

    const cols = Math.ceil(canvas.width / spacing) + 1;
    const rows = Math.ceil(canvas.height / spacing) + 1;

    const randomCol = Math.floor(Math.random() * cols);
    const randomRow = Math.floor(Math.random() * rows);

    pulses.push({
      x: randomCol * spacing,
      y: randomRow * spacing,
      radius: 0,
      startTime: Date.now()
    });
  }

  let gridLoop = null;
  setInterval(function () {
    if (gridLoop && gridLoop.active()) spawnPulse();
  }, pulseSpawnInterval);

  function drawGrid() {
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
      const elapsed = (now - pulse.startTime) / 1000;
      pulse.radius = elapsed * pulseSpeed;

      if (pulse.radius > pulseMaxRadius) {
        pulses.splice(p, 1);
      }
    }

    // Calculate grid bounds with extra margin for smooth transitions
    const margin = spacing * 2;
    const startY = Math.floor((currentScrollOffset - margin) / spacing) * spacing;
    const endY = currentScrollOffset + canvas.height + margin;

    const cols = Math.ceil(canvas.width / spacing) + 1;
    const rowStart = Math.floor(startY / spacing);
    const rowEnd = Math.ceil(endY / spacing);

    // fade the grid in/out over the top and bottom 20% of the section
    const fadeBand = canvas.height * 0.2;
    ctx.fillStyle = 'rgb(32, 32, 32)';
    let styledForGlow = false;

    for (let i = 0; i < cols; i++) {
      for (let j = rowStart; j <= rowEnd; j++) {
        const x = i * spacing;
        const y = j * spacing - currentScrollOffset; // Apply scroll translation

        // Skip dots that are way outside the visible area
        if (y < -margin || y > canvas.height + margin) continue;

        // Improved wave animation with multi-layered sine/cosine
        let offsetX = Math.sin(time + j * waveFrequency) * waveAmplitude +
          Math.sin(time * 0.7 + i * waveFrequency * 0.5) * (waveAmplitude * 0.3);
        let offsetY = Math.cos(time + i * waveFrequency) * waveAmplitude +
          Math.cos(time * 0.5 + j * waveFrequency * 0.7) * (waveAmplitude * 0.3);

        let dotRadius = baseDotRadius;
        let brightnessBoost = 0;

        const edgeFade = Math.min(1, y / fadeBand, (canvas.height - y) / fadeBand);
        if (edgeFade <= 0) continue;

        // Calculate pulsing brightness from all active pulses
        for (const pulse of pulses) {
          const distX = x - pulse.x;
          const distY = y - pulse.y;
          const dist = Math.sqrt(distX * distX + distY * distY);

          if (Math.abs(dist - pulse.radius) < 80) {
            const waveFalloff = 1 - Math.abs(dist - pulse.radius) / 80;
            const pulseAge = pulse.radius / pulseMaxRadius;
            const pulseFade = 1 - pulseAge;
            brightnessBoost = Math.max(brightnessBoost, waveFalloff * pulseFade * pulseBrightness);
          }
        }

        // Mouse interaction
        let mouseGlow = 0;
        if (mouseInfluence > 0.01) {
          const distX = x - currentMouseX;
          const distY = y - currentMouseY;
          const dist = Math.sqrt(distX * distX + distY * distY);
          const maxDist = 1000;

          if (dist < maxDist) {
            const factor = 1 - dist / maxDist;
            const influence = factor * 15 * mouseInfluence;

            offsetX += (distX / dist) * influence;
            offsetY += (distY / dist) * influence;

            const sizeFactor = factor * factor * mouseInfluence;
            dotRadius = baseDotRadius + (maxDotRadius - baseDotRadius) * sizeFactor;
            mouseGlow = sizeFactor;
          }
        }

        const dotX = x + offsetX;
        const dotY = y + offsetY;

        // Only draw dots within the visible area (with some margin)
        if (dotX >= -spacing && dotX <= canvas.width + spacing &&
          dotY >= -spacing && dotY <= canvas.height + spacing) {

          const waveHeight = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
          let opacity = 0.5 + (waveHeight / (waveAmplitude * 2)) * 0.5;
          opacity += brightnessBoost;
          opacity = Math.min(opacity, 1.0);

          // dots near the cursor brighten ~30% of the way toward white
          if (mouseGlow > 0.01) {
            const channel = Math.round(32 + 67 * mouseGlow);
            ctx.fillStyle = `rgb(${channel}, ${channel}, ${channel})`;
            styledForGlow = true;
          } else if (styledForGlow) {
            ctx.fillStyle = 'rgb(32, 32, 32)';
            styledForGlow = false;
          }
          ctx.globalAlpha = opacity * edgeFade;
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    time += waveSpeed;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    drawGrid();
  } else {
    gridLoop = runWhileVisible(heroSection, drawGrid);
  }
});

document.addEventListener('DOMContentLoaded', function () {
  const scrollSuggestion = document.querySelector('.scroll-suggestion');
  if (!scrollSuggestion) return;
  window.addEventListener('scroll', function () {
    scrollSuggestion.classList.toggle('hidden', window.scrollY > 50);
  }, { passive: true });
});
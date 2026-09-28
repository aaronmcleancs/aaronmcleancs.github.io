// Reads an "R G B" triplet token from css/theme.css, e.g. --grid-dot-rgb: 32 32 32
function themeRGB(name, fallback) {
  var parts = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/[\s,]+/).map(Number);
  return parts.length === 3 && parts.every(function (n) { return !isNaN(n); }) ? parts : fallback;
}

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
    return ((baseScale + scrollPercent * multiplier) - offset * (1 - scrollPercent)) * desktopBoost();
  }

  // On standard-aspect desktops and laptops (16:9, 16:10, 3:2...) zoom the waves in a little.
  // They scale from the top edge, so this sits the bands lower without opening a gap under
  // the nav. Phones, tablets and ultrawides keep the original framing.
  function desktopBoost() {
    const w = window.innerWidth;
    const aspect = w / Math.max(window.innerHeight, 1);
    return w >= 1024 && aspect >= 1.3 && aspect <= 1.9 ? 1.2 : 1;
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
  const baseDotRadius = 1.8;
  const maxDotRadius = 2.9;
  const dotRGB = themeRGB('--grid-dot-rgb', [32, 32, 32]);
  const glowRGB = themeRGB('--grid-dot-glow-rgb', [99, 99, 99]);
  const dotFill = 'rgb(' + dotRGB.join(', ') + ')';

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

  // Snakes: quick, infrequent trails that run through the grid in the theme accent. A head
  // steps cell to cell with occasional random turns; the tail behind it is a random length
  // and each segment is darker than the one before. When a snake's run ends, the tail
  // drains away behind the head rather than vanishing.
  const gridDotAlpha = 0.55;
  const reduceGridMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const accentRGB = themeRGB('--accent-rgb', [126, 130, 241]);
  const snakes = [];
  const maxSnakes = 3;
  const snakeStepMs = 55;
  const turnChance = 0.22;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let nextSnakeAt = Date.now() + 600 + Math.random() * 1200;

  function spawnSnake(cols, jMin, jMax, now) {
    if (cols < 6 || jMax - jMin < 4) return;
    const head = [2 + Math.floor(Math.random() * (cols - 4)), jMin + Math.floor(Math.random() * (jMax - jMin + 1))];
    snakes.push({
      cells: [head],
      dir: DIRS[Math.floor(Math.random() * 4)],
      length: 5 + Math.floor(Math.random() * 12),
      // each segment is this fraction of the one ahead of it, reaching ~6% at the tail end
      decay: 0,
      stepsLeft: 18 + Math.floor(Math.random() * 30),
      lastStep: now,
      jMin: jMin,
      jMax: jMax,
      cols: cols
    });
  }

  function stepSnake(snake) {
    if (snake.stepsLeft <= 0) {
      snake.cells.pop(); // run finished: drain the tail
      return;
    }
    let dir = snake.dir;
    if (Math.random() < turnChance) {
      const turns = dir[0] !== 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
      dir = turns[Math.floor(Math.random() * 2)];
    }
    let [hi, hj] = snake.cells[0];
    let ni = hi + dir[0];
    let nj = hj + dir[1];
    // turn back inward at the edges of the grid
    if (ni < 1 || ni > snake.cols - 2) { dir = [-dir[0], 0]; ni = hi + dir[0]; }
    if (nj < snake.jMin || nj > snake.jMax) { dir = [0, -dir[1]]; nj = hj + dir[1]; }
    snake.dir = dir;
    snake.cells.unshift([ni, nj]);
    if (snake.cells.length > snake.length) snake.cells.pop();
    snake.stepsLeft--;
  }

  // brightness for each lit cell this frame: 1 at the head, falling off down the tail
  function snakeCells(now) {
    // (decay is derived from each snake's random length the first time it is drawn)
    const lit = new Map();
    for (let s = snakes.length - 1; s >= 0; s--) {
      const snake = snakes[s];
      while (now - snake.lastStep >= snakeStepMs) {
        stepSnake(snake);
        snake.lastStep += snakeStepMs;
      }
      if (!snake.cells.length) {
        snakes.splice(s, 1);
        continue;
      }
      snake.cells.forEach(function (cell, k) {
        const key = cell[0] + ',' + cell[1];
        if (!snake.decay) snake.decay = Math.pow(0.06, 1 / snake.length);
        const brightness = Math.pow(snake.decay, k);
        lit.set(key, Math.max(lit.get(key) || 0, brightness));
      });
    }
    return lit;
  }

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

    // snakes spawn only in rows that are fully visible (outside the fade bands)
    const snakeNow = Date.now();
    if (!reduceGridMotion && snakeNow >= nextSnakeAt) {
      if (snakes.length < maxSnakes) {
        const jMin = Math.ceil((fadeBand + currentScrollOffset) / spacing);
        const jMax = Math.floor((canvas.height - fadeBand + currentScrollOffset) / spacing);
        spawnSnake(cols, jMin, jMax, snakeNow);
      }
      nextSnakeAt = snakeNow + 800 + Math.random() * 1700;
    }
    const lit = snakes.length ? snakeCells(snakeNow) : null;
    ctx.fillStyle = dotFill;
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

          const snakeGlow = lit ? (lit.get(i + ',' + j) || 0) : 0;
          if (mouseGlow > 0.01 || snakeGlow > 0) {
            // cursor: blend toward the glow colour; snake: tint toward the accent.
            // Snakes only change colour; dot size and brightness still follow the cursor alone.
            const channel = (c) => {
              const base = dotRGB[c] + (glowRGB[c] - dotRGB[c]) * mouseGlow;
              return Math.round(base + (accentRGB[c] - base) * snakeGlow);
            };
            ctx.fillStyle = `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
            styledForGlow = true;
          } else if (styledForGlow) {
            ctx.fillStyle = dotFill;
            styledForGlow = false;
          }
          // regular dots stay subdued; the canvas itself is fully opaque so snakes can glow
          if (snakeGlow > 0) {
            // slight halo behind snake dots, strongest at the head and fading down the tail;
            // the dot itself keeps its normal size and brightness
            const fill = ctx.fillStyle;
            ctx.fillStyle = `rgb(${accentRGB[0]}, ${accentRGB[1]}, ${accentRGB[2]})`;
            ctx.globalAlpha = 0.16 * snakeGlow * edgeFade;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = fill;
          }
          ctx.globalAlpha = opacity * edgeFade * gridDotAlpha;
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
          ctx.fill();

        }
      }
    }

    time += waveSpeed;
  }

  if (reduceGridMotion) {
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
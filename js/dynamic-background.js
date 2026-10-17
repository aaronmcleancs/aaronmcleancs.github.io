function themeRGB(name, fallback) {
  var parts = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/[\s,]+/).map(Number);
  return parts.length === 3 && parts.every(function (n) { return !isNaN(n); }) ? parts : fallback;
}

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

  if (!heroBackground || heroBackground.hidden) return;
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

  function calculateTargetScale(scrollVal) {
    const heroHeight = heroSection.offsetHeight || window.innerHeight;
    const scrollPercent = Math.min(Math.max(scrollVal / heroHeight, 0), 1) * maxScrollPercent;
    const baseScale = getBaseScale(window.innerWidth);
    const baselineWidth = 1920;

    const multiplier = window.innerWidth > baselineWidth ? 350 * (baselineWidth / window.innerWidth) : 350;
    const offset = baseScale * 0.1;
    return ((baseScale + scrollPercent * multiplier) - offset * (1 - scrollPercent)) * desktopBoost();
  }

  function desktopBoost() {
    const w = window.innerWidth;
    const aspect = w / Math.max(window.innerHeight, 1);
    return w >= 1024 && aspect >= 1.3 && aspect <= 1.9 ? 1.2 : 1;
  }

  const driftAmplitude = 35;
  const driftPeriod = 12000;
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
  const baseDotRadius = 1.55;
  const maxDotRadius = 2.6;
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

  const pulses = [];
  const maxPulses = 3;
  const pulseSpawnInterval = 2000;
  const pulseSpeed = 80;
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

  function updateScrollOffset() {
    targetScrollOffset = window.scrollY * scrollTranslationFactor;
  }

  window.addEventListener('scroll', updateScrollOffset, { passive: true });
  updateScrollOffset();

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
      snake.cells.pop();
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

    if (ni < 1 || ni > snake.cols - 2) { dir = [-dir[0], 0]; ni = hi + dir[0]; }
    if (nj < snake.jMin || nj > snake.jMax) { dir = [0, -dir[1]]; nj = hj + dir[1]; }
    snake.dir = dir;
    snake.cells.unshift([ni, nj]);
    if (snake.cells.length > snake.length) snake.cells.pop();
    snake.stepsLeft--;
  }

  function snakeCells(now) {

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

    currentScrollOffset += (targetScrollOffset - currentScrollOffset) * transitionSpeed;

    currentMouseX += (targetMouseX - currentMouseX) * transitionSpeed;
    currentMouseY += (targetMouseY - currentMouseY) * transitionSpeed;
    mouseInfluence += (mouseInfluenceTarget - mouseInfluence) * transitionSpeed;

    const now = Date.now();
    for (let p = pulses.length - 1; p >= 0; p--) {
      const pulse = pulses[p];
      const elapsed = (now - pulse.startTime) / 1000;
      pulse.radius = elapsed * pulseSpeed;

      if (pulse.radius > pulseMaxRadius) {
        pulses.splice(p, 1);
      }
    }

    const margin = spacing * 2;
    const startY = Math.floor((currentScrollOffset - margin) / spacing) * spacing;
    const endY = currentScrollOffset + canvas.height + margin;

    const cols = Math.ceil(canvas.width / spacing) + 1;
    const rowStart = Math.floor(startY / spacing);
    const rowEnd = Math.ceil(endY / spacing);

    const fadeBand = canvas.height * 0.2;

    const snakeNow = Date.now();
    if (snakeNow >= nextSnakeAt) {
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
        const y = j * spacing - currentScrollOffset;

        if (y < -margin || y > canvas.height + margin) continue;

        let offsetX = Math.sin(time + j * waveFrequency) * waveAmplitude +
          Math.sin(time * 0.7 + i * waveFrequency * 0.5) * (waveAmplitude * 0.3);
        let offsetY = Math.cos(time + i * waveFrequency) * waveAmplitude +
          Math.cos(time * 0.5 + j * waveFrequency * 0.7) * (waveAmplitude * 0.3);

        let dotRadius = baseDotRadius;
        let brightnessBoost = 0;

        const edgeFade = Math.min(1, y / fadeBand, (canvas.height - y) / fadeBand);
        if (edgeFade <= 0) continue;

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

        if (dotX >= -spacing && dotX <= canvas.width + spacing &&
          dotY >= -spacing && dotY <= canvas.height + spacing) {

          const waveHeight = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
          let opacity = 0.5 + (waveHeight / (waveAmplitude * 2)) * 0.5;
          opacity += brightnessBoost;
          opacity = Math.min(opacity, 1.0);

          const snakeGlow = lit ? (lit.get(i + ',' + j) || 0) : 0;
          if (mouseGlow > 0.01 || snakeGlow > 0) {

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

          if (snakeGlow > 0) {

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

    if (!reduceGridMotion) time += waveSpeed;
  }

  gridLoop = runWhileVisible(heroSection, drawGrid);
});

document.addEventListener('DOMContentLoaded', function () {
  const scrollSuggestion = document.querySelector('.scroll-suggestion');
  if (!scrollSuggestion) return;
  window.addEventListener('scroll', function () {
    scrollSuggestion.classList.toggle('hidden', window.scrollY > 50);
  }, { passive: true });
});

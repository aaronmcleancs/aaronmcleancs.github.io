document.addEventListener('DOMContentLoaded', function () {
    const footerSection = document.querySelector('.footer-new');
    if (!footerSection) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'footer-grid-canvas';
    footerSection.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    let resizeTimer;
    function resizeCanvas() {
        canvas.width = footerSection.offsetWidth;
        canvas.height = footerSection.offsetHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeCanvas, 150);
    });

    // Matched to the expertise-section grid: same spacing, same layered wave motion,
    // just dimmer dots (and blurred via CSS) so it reads as a quieter echo of it.
    const spacing = 45;
    const baseDotRadius = 1.5;
    const dotBaseColor = '120, 120, 120';

    const waveSpeed = 0.005;
    const waveAmplitude = 15;
    const waveFrequency = 0.05;


    let time = 0;

    // Pulsing brightness system (same mechanic as above, slower cadence)
    const pulses = [];
    const maxPulses = 2;
    const pulseSpawnInterval = 3000;
    const pulseSpeed = 60;
    const pulseMaxRadius = 400;
    const pulseBrightness = 0.5;

    // Animation gating: only run while on-screen and tab visible
    let inView = false;
    let rafId = null;

    function startLoop() {
        if (rafId === null && inView && !document.hidden) {
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
        io.observe(footerSection);
    } else {
        inView = true;
        startLoop();
    }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopLoop(); else startLoop();
    });

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

    // Batched rendering: dots grouped by quantized opacity, one path/fill per group
    const buckets = new Map();

    function drawGrid() {
        rafId = requestAnimationFrame(drawGrid);


        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update pulses
        const now = Date.now();
        for (let p = pulses.length - 1; p >= 0; p--) {
            const pulse = pulses[p];
            pulse.radius = ((now - pulse.startTime) / 1000) * pulseSpeed;
            if (pulse.radius > pulseMaxRadius) pulses.splice(p, 1);
        }

        const margin = spacing * 2;
        const cols = Math.ceil(canvas.width / spacing) + 1;
        const rows = Math.ceil(canvas.height / spacing) + 1;
        const pulseCount = pulses.length;

        buckets.clear();

        for (let i = 0; i < cols; i++) {
            const x = i * spacing;
            for (let j = 0; j < rows; j++) {
                const y = j * spacing;

                // Same multi-layered sine/cosine wave as the expertise-section grid
                const offsetX = Math.sin(time + j * waveFrequency) * waveAmplitude +
                    Math.sin(time * 0.7 + i * waveFrequency * 0.5) * (waveAmplitude * 0.3);
                const offsetY = Math.cos(time + i * waveFrequency) * waveAmplitude +
                    Math.cos(time * 0.5 + j * waveFrequency * 0.7) * (waveAmplitude * 0.3);

                const dotX = x + offsetX;
                const dotY = y + offsetY;

                if (dotX < -margin || dotX > canvas.width + margin ||
                    dotY < -margin || dotY > canvas.height + margin) continue;

                let brightnessBoost = 0;
                for (let p = 0; p < pulseCount; p++) {
                    const pulse = pulses[p];
                    const distX = dotX - pulse.x;
                    const distY = dotY - pulse.y;
                    const dist = Math.sqrt(distX * distX + distY * distY);
                    const band = Math.abs(dist - pulse.radius);

                    if (band < 100) {
                        const waveFalloff = 1 - band / 100;
                        const pulseFade = 1 - pulse.radius / pulseMaxRadius;
                        const boost = waveFalloff * pulseFade * pulseBrightness;
                        if (boost > brightnessBoost) brightnessBoost = boost;
                    }
                }

                const waveHeight = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
                let opacity = 0.3 + (waveHeight / (waveAmplitude * 2)) * 0.4;
                opacity += brightnessBoost;
                if (opacity > 1) opacity = 1;

                const key = (opacity * 32) | 0;
                let bucket = buckets.get(key);
                if (!bucket) {
                    bucket = { opacity: key / 32, pts: [] };
                    buckets.set(key, bucket);
                }
                bucket.pts.push(dotX, dotY);
            }
        }

        buckets.forEach(function (bucket) {
            ctx.beginPath();
            const pts = bucket.pts;
            for (let k = 0; k < pts.length; k += 2) {
                ctx.moveTo(pts[k] + baseDotRadius, pts[k + 1]);
                ctx.arc(pts[k], pts[k + 1], baseDotRadius, 0, Math.PI * 2);
            }
            ctx.fillStyle = 'rgba(' + dotBaseColor + ', ' + bucket.opacity + ')';
            ctx.fill();
        });

        time += waveSpeed;
    }
});

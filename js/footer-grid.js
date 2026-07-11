document.addEventListener('DOMContentLoaded', function () {
    const footerSection = document.querySelector('.footer-new');
    if (!footerSection) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'footer-grid-canvas';
    footerSection.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = footerSection.offsetWidth;
        canvas.height = footerSection.offsetHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Matched to the expertise-section grid: same spacing and layered wave motion,
    // dimmer dots (blurred via CSS) so it reads as a quieter echo of it.
    const spacing = 45;
    const baseDotRadius = 1.5;
    const dotBaseColor = '120, 120, 120';

    const waveSpeed = 0.005;
    const waveAmplitude = 15;
    const waveFrequency = 0.05;

    let time = 0;

    // Pulsing brightness system
    const pulses = [];
    const maxPulses = 2;
    const pulseSpawnInterval = 3000; // Slower for footer
    const pulseSpeed = 60;
    const pulseMaxRadius = 400;
    const pulseBrightness = 0.5;

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

    setInterval(spawnPulse, pulseSpawnInterval);

    function drawGrid() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

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

        const margin = spacing * 2;
        const cols = Math.ceil(canvas.width / spacing) + 1;
        const rows = Math.ceil(canvas.height / spacing) + 1;

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const x = i * spacing;
                const y = j * spacing;

                // Same multi-layered sine/cosine wave as the expertise-section grid
                let offsetX = Math.sin(time + j * waveFrequency) * waveAmplitude +
                    Math.sin(time * 0.7 + i * waveFrequency * 0.5) * (waveAmplitude * 0.3);
                let offsetY = Math.cos(time + i * waveFrequency) * waveAmplitude +
                    Math.cos(time * 0.5 + j * waveFrequency * 0.7) * (waveAmplitude * 0.3);

                const dotX = x + offsetX;
                const dotY = y + offsetY;

                let brightnessBoost = 0;

                // Calculate pulsing brightness
                for (const pulse of pulses) {
                    const distX = dotX - pulse.x;
                    const distY = dotY - pulse.y;
                    const dist = Math.sqrt(distX * distX + distY * distY);

                    if (Math.abs(dist - pulse.radius) < 100) {
                        const waveFalloff = 1 - Math.abs(dist - pulse.radius) / 100;
                        const pulseAge = pulse.radius / pulseMaxRadius;
                        const pulseFade = 1 - pulseAge;
                        brightnessBoost = Math.max(brightnessBoost, waveFalloff * pulseFade * pulseBrightness);
                    }
                }

                if (dotX >= -margin && dotX <= canvas.width + margin &&
                    dotY >= -margin && dotY <= canvas.height + margin) {

                    const waveHeight = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
                    let opacity = 0.3 + (waveHeight / (waveAmplitude * 2)) * 0.4;
                    opacity += brightnessBoost;
                    opacity = Math.min(opacity, 1.0);

                    ctx.beginPath();
                    ctx.arc(dotX, dotY, baseDotRadius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${dotBaseColor}, ${opacity})`;
                    ctx.fill();
                }
            }
        }

        time += waveSpeed;
        requestAnimationFrame(drawGrid);
    }

    drawGrid();
});

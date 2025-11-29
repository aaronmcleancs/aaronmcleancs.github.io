(function () {
    // Create overlay
    let overlay = document.getElementById('global-hue-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-hue-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '99999';
        // Use backdrop-filter to shift hue of everything behind
        overlay.style.backdropFilter = 'hue-rotate(0deg)';
        overlay.style.webkitBackdropFilter = 'hue-rotate(0deg)';
        document.body.appendChild(overlay);
    }

    function setHue(deg) {
        overlay.style.backdropFilter = `hue-rotate(${deg}deg)`;
        overlay.style.webkitBackdropFilter = `hue-rotate(${deg}deg)`;
    }

    // Init from storage
    const savedHue = localStorage.getItem('site-hue') || '0';
    setHue(savedHue);

    // Slider logic
    function initSlider() {
        const slider = document.getElementById('hue-slider');
        if (slider) {
            slider.value = savedHue;
            slider.addEventListener('input', (e) => {
                const val = e.target.value;
                setHue(val);
                localStorage.setItem('site-hue', val);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSlider);
    } else {
        initSlider();
    }
})();

(function () {
  var BASE = 207;
  var TOKENS = [
    ['--accent', 0, 100, 52],
    ['--wave-1', 0, 92, 34],
    ['--wave-2', 0, 93, 27],
    ['--wave-3', 0, 92, 20],
    ['--wave-4', 0.4, 91, 13.5],
    ['--wave-5', -1, 94, 6.7],
    ['--logo-top', -5, 100, 60],
    ['--logo-bottom', 4, 100, 44],
    ['--metal-dark', 1, 92.5, 10.4]
  ];
  var KEY = 'themeTunerHue', ON = 'themeTunerOn';

  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    return [f(0), f(8), f(4)].map(function (v) { return Math.round(v * 255); });
  }
  function hex(rgb) { return '#' + rgb.map(function (v) { return v.toString(16).padStart(2, '0'); }).join(''); }

  function palette(h) {
    return TOKENS.map(function (t) { var rgb = hsl2rgb(h + t[1], t[2], t[3]); return [t[0], hex(rgb), rgb]; });
  }
  function apply(h) {
    var root = document.documentElement.style;
    palette(h).forEach(function (p) {
      root.setProperty(p[0], p[1]);
      if (p[0] === '--accent') root.setProperty('--accent-rgb', p[2].join(' '));
    });
  }

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }

  window.themeTuner = function (on) {
    var next = on === undefined ? read(ON) !== '1' : !!on;
    write(ON, next ? '1' : null);
    if (!next) write(KEY, null);
    location.reload();
    return next ? 'theme tuner on' : 'theme tuner off';
  };

  if (read(ON) !== '1') return;

  var stored = read(KEY);
  var hue = stored === null ? BASE : +stored;
  if (stored !== null) apply(hue);

  function build() {
    var panel = document.createElement('div');
    panel.className = 'theme-tuner';
    panel.innerHTML =
      '<div class="theme-tuner__row"><strong>Theme hue</strong><span class="theme-tuner__val"></span></div>' +
      '<input type="range" min="0" max="359" step="1" aria-label="Theme hue">' +
      '<div class="theme-tuner__sw"></div>' +
      '<div class="theme-tuner__row"><button type="button" data-act="apply">Apply to effects</button><button type="button" data-act="copy">Copy CSS</button><button type="button" data-act="reset">Reset</button></div>' +
      '<p class="theme-tuner__note">Colours update live; "Apply" reloads so the WebGL effects pick them up. Hide with themeTuner(false) in the console.</p>';
    document.body.appendChild(panel);
    var range = panel.querySelector('input'), val = panel.querySelector('.theme-tuner__val'), sw = panel.querySelector('.theme-tuner__sw');
    range.value = hue;

    function render() {
      var p = palette(hue);
      val.textContent = hue + '°  ' + p[0][1];
      sw.innerHTML = p.map(function (x) { return '<i title="' + x[0] + ' ' + x[1] + '" style="background:' + x[1] + '"></i>'; }).join('');
    }
    range.addEventListener('input', function () {
      hue = +range.value;
      apply(hue);
      render();
      write(KEY, hue);
    });
    panel.addEventListener('click', function (e) {
      var act = e.target.dataset && e.target.dataset.act;
      if (act === 'apply') location.reload();
      if (act === 'reset') { write(KEY, null); location.reload(); }
      if (act === 'copy') {
        var p = palette(hue), lines = p.map(function (x) { return '  ' + x[0] + ': ' + x[1] + ';'; });
        lines.splice(1, 0, '  --accent-rgb: ' + p[0][2].join(' ') + ';');
        var txt = lines.join('\n');
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () {
          e.target.textContent = 'Copied'; setTimeout(function () { e.target.textContent = 'Copy CSS'; }, 1200);
        }).catch(function () { window.prompt('Theme CSS', txt); });
      }
    });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();

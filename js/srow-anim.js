(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('.srow[data-pattern]'));
  if (!rows.length) return;

  var css = getComputedStyle(document.documentElement);
  var acc = (css.getPropertyValue('--accent-rgb').trim() || '10 144 255').split(/\s+/).join(',');
  var A = function (a) { return 'rgba(' + acc + ',' + a + ')'; };
  var W = function (a) { return 'rgba(255,255,255,' + a + ')'; };
  var TAU = Math.PI * 2;
  var ease = function (x) { return x * x * (3 - 2 * x); };

  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  var scenes = {
    perf: function (g, w, h, t) {
      var T = 7, p = (t % T) / T, z = Math.pow(2, p), lap = Math.floor(t / T);
      var fx = w * 0.66, fy = h * 0.5, B = h * 2.4;
      g.lineWidth = 1;
      for (var k = -2; k < 9; k++) {
        var side = B * Math.pow(2, -k) * z;
        if (side < 3 || side > w * 3) continue;
        var a = Math.min(1, side / 24) * Math.min(1, (w * 1.4) / side);
        var half = side / 2;
        g.strokeStyle = W(0.13 * a);
        g.beginPath();
        [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (d) {
          g.moveTo(fx + d[0] * side, fy); g.lineTo(fx + d[0] * side, fy + d[1] * side); g.lineTo(fx, fy + d[1] * side);
          g.moveTo(fx + d[0] * half, fy); g.lineTo(fx + d[0] * half, fy + d[1] * side);
          g.moveTo(fx, fy + d[1] * half); g.lineTo(fx + d[0] * side, fy + d[1] * half);
        });
        g.stroke();
        for (var q = 0; q < 6; q++) {
          var s = (k + lap + 40) * 13 + q, dx = hash(s) > 0.5 ? 1 : -1, dy = hash(s + 1) > 0.5 ? 1 : -1;
          var px = fx + dx * (0.55 + 0.4 * hash(s + 2)) * side, py = fy + dy * (0.55 + 0.4 * hash(s + 3)) * side;
          var r = Math.max(0.8, side * 0.012);
          g.fillStyle = q === 0 ? A(0.4 * a) : W(0.22 * a);
          g.beginPath(); g.arc(px, py, Math.min(r, 2.2), 0, TAU); g.fill();
        }
      }
      g.strokeStyle = W(0.08);
      g.beginPath(); g.moveTo(0, fy); g.lineTo(w, fy); g.moveTo(fx, 0); g.lineTo(fx, h); g.stroke();
      g.fillStyle = A(0.45);
      g.beginPath(); g.arc(fx, fy, 1.6, 0, TAU); g.fill();
    },

    quantum: function (g, w, h, t) {
      var T = 2.4, L = 16, p = (t % T) / T;
      var fx = w * 0.62, fy = h * 0.5, gap = 34;
      var src = [[fx - gap, fy, W], [fx + gap, fy, A]];
      var maxR = w * 0.42;
      g.lineWidth = 1;
      src.forEach(function (sc) {
        for (var n = 0; ; n++) {
          var r = (n + p) * L;
          if (r > maxR) break;
          var a = Math.min(1, r / 18) * Math.pow(1 - r / maxR, 1.6);
          g.strokeStyle = sc[2](0.16 * a);
          g.beginPath(); g.arc(sc[0], sc[1], r, 0, TAU); g.stroke();
        }
        g.fillStyle = sc[2](0.4);
        g.beginPath(); g.arc(sc[0], sc[1], 1.6, 0, TAU); g.fill();
      });
    },
    neural: function (g, w, h, t) {
      var T = 0.9, C = 11, p = (t % T) / T, lap = Math.floor(t / T);
      var rows = Math.floor((h - 8) / C), top = (h - rows * C) / 2;
      var kx = w * 0.56, cols = Math.ceil(w / C) + 2;
      var off = ease(p) * C;
      function val(col, r) { var v = Math.sin(col * 0.37 + r * 0.9) * 0.5 + Math.sin(col * 0.11 - r * 0.4) * 0.5; return 0.5 + 0.5 * v * (0.6 + 0.4 * hash(col * 31 + r)); }
      var kc = Math.round(kx / C);
      for (var c = -1; c < cols; c++) {
        var cid = c + lap, x = c * C - off;
        if (x > kx + 3 * C) continue;
        for (var r = 0; r < rows; r++) {
          var v = val(cid, r);
          g.fillStyle = W(0.02 + 0.1 * v);
          g.fillRect(x + 1.5, top + r * C + 1.5, C - 3, C - 3);
        }
      }
      var kr = Math.floor(rows / 2) - 1, ky = top + kr * C;
      var kxL = kc * C - C;
      g.strokeStyle = A(0.5);
      g.lineWidth = 1;
      g.strokeRect(kxL + 0.5, ky + 0.5, 3 * C - 1, 3 * C - 1);
      var ox = kxL + 3 * C + 40, outCols = Math.ceil((w - ox) / C);
      g.strokeStyle = A(0.14);
      g.beginPath();
      g.moveTo(kxL + 3 * C, ky); g.lineTo(ox, ky + C);
      g.moveTo(kxL + 3 * C, ky + 3 * C); g.lineTo(ox, ky + 2 * C);
      g.stroke();
      for (var o = 0; o < outCols; o++) {
        var src = kc - 1 + lap - o, sum = 0;
        for (var dx = 0; dx < 3; dx++) for (var dy = 0; dy < 3; dy++) sum += val(src + dx - 1, kr + dy);
        var xo = ox + o * C + (1 - ease(p)) * C - C;
        if (xo < ox - 0.5) continue;
        var fade = 1 - o / outCols;
        g.fillStyle = o === 0 ? A(0.25 + 0.3 * sum / 9) : W((0.04 + 0.16 * sum / 9) * fade);
        g.fillRect(xo + 1.5, ky + C + 1.5, C - 3, C - 3);
      }
    },
    stack: (function () {
      var UI = [
        [18, 8, 112, 80, 7, 0, 0], [26, 16, 96, 8, 2, 1, 0], [26, 30, 40, 26, 3, 1, 0],
        [72, 31, 50, 3, 1.5, 1, 0], [72, 38, 42, 3, 1.5, 1, 0], [72, 45, 48, 3, 1.5, 1, 0], [72, 52, 30, 3, 1.5, 1, 0],
        [26, 62, 96, 3, 1.5, 1, 0], [26, 68, 80, 3, 1.5, 1, 0], [26, 74, 88, 3, 1.5, 1, 0],
        [26, 79, 30, 6, 3, 1, 1], [106, 18, 12, 4, 2, 1, 1]
      ];
      var DB = [];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) DB.push([24 + c * 26, 22 + r * 18, 23, r === 0 ? 10 : 14, 2, r === 0 ? 1 : 0, r === 0 ? 1 : 0]);
      var CL = [];
      for (var k = 0; k < 3; k++) for (var u = 0; u < 4; u++) CL.push([28 + k * 32, 16 + u * 17, 26, 12, 2, 0, (k * 4 + u) % 3 === 0 ? 1 : 0]);
      var STATES = [UI, DB, CL];
      return function (g, w, h, t) {
        var sc = 0.62, U = 150 * sc, V = 96 * sc;
        var PX = 3 * U, PY = 2 * V;
        var ox = (t * 9) % PX, oy = (t * 5) % PY;
        g.lineWidth = 1;
        for (var row = -2; row * V < h + V * 2; row++) {
          var shift = (((row % 2) + 2) % 2) * U * 1.5;
          for (var col = -3; col * U < w + U * 3; col++) {
            var kind = (((col + (((row % 2) + 2) % 2) * 2) % 3) + 3) % 3;
            var S = STATES[kind];
            var x0 = col * U + shift + ox - PX, y0 = row * V - oy + PY - PY;
            if (x0 > w + U || x0 < -U * 2 || y0 > h + V || y0 < -V * 2) continue;
            for (var i = 0; i < 12; i++) {
              var q = S[i];
              var x = x0 + q[0] * sc, y = y0 + q[1] * sc, rw = q[2] * sc, rh = q[3] * sc;
              g.beginPath(); g.roundRect(x, y, rw, rh, q[4] * sc);
              if (q[5]) { g.fillStyle = q[6] ? A(0.22) : W(0.07); g.fill(); }
              else { g.strokeStyle = q[6] ? A(0.3) : W(0.11); g.stroke(); }
              if (kind === 2 && q[6]) {
                g.fillStyle = A(0.35 + 0.2 * Math.sin(t * 2 + col * 1.7 + row + i));
                g.beginPath(); g.arc(x + rw - 3, y + rh / 2, 1, 0, TAU); g.fill();
              }
            }
          }
        }
      };
    })()
  };

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var items = rows.map(function (row) {
    var canvas = document.createElement('canvas');
    canvas.className = 'srow__anim';
    canvas.setAttribute('aria-hidden', 'true');
    row.insertBefore(canvas, row.firstChild);
    var it = { row: row, canvas: canvas, ctx: canvas.getContext('2d'), draw: scenes[row.dataset.pattern], on: false, t: 0, live: 0 };
    row.addEventListener('mouseenter', function () { it.on = true; it.live = 2; kick(); });
    row.addEventListener('mouseleave', function () { it.on = false; });
    row.addEventListener('focus', function () { it.on = true; it.live = 2; kick(); });
    row.addEventListener('blur', function () { it.on = false; });
    return it;
  });

  var raf = null, last = 0;
  function frame(now) {
    raf = null;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    var any = false;
    items.forEach(function (it) {
      if (it.on) it.live = 2; else it.live -= dt;
      if (it.live <= 0) return;
      any = true;
      var c = it.canvas, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      it.t += dt * (reduce ? 0.5 : 1);
      var g = it.ctx;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      it.draw(g, w, h, it.t);
    });
    if (any) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
})();

(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('[data-repo]'));
  if (!rows.length) return;
  var KEY = 'repoStars:v1', TTL = 6 * 3600 * 1000;


  function paint(stars) {
    rows.forEach(function (r) {
      var n = stars[r.dataset.repo], el = r.querySelector('[data-stars] span');
      if (n != null && el) el.textContent = n;
    });
  }

  var cache = null;
  try { cache = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (cache && Date.now() - cache.at < TTL) { paint(cache.stars); return; }

  var io = new IntersectionObserver(function (entries) {
    if (!entries.some(function (e) { return e.isIntersecting; })) return;
    io.disconnect();
    fetch('https://api.github.com/users/aaronmcleancs/repos?per_page=100')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (list) {
        var stars = {};
        list.forEach(function (repo) { stars[repo.name] = repo.stargazers_count; });
        paint(stars);
        try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), stars: stars })); } catch (e) {}
      })
      .catch(function () {});
  }, { rootMargin: '400px 0px' });
  io.observe(rows[0]);
})();

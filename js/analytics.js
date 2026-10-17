(function () {
  'use strict';

  var ENDPOINT = 'https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev';

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  if (ENDPOINT.indexOf('YOUR-WORKER') !== -1) return;

  var sid;
  try {
    sid = sessionStorage.getItem('am_sid');
    if (!sid) {
      sid = (crypto.randomUUID && crypto.randomUUID()) ||
        Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('am_sid', sid);
    }
  } catch (e) {
    return;
  }

  function send(event) {
    var payload = JSON.stringify({
      sid: sid,
      event: event,
      path: location.pathname,
      ref: event === 'view' ? document.referrer : undefined
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT + '/collect', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(ENDPOINT + '/collect', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true
      }).catch(function () {   });
    }
  }

  send('view');

  var HEARTBEAT_MS = 15000;
  var timer = null;

  function startBeats() {
    if (timer) return;
    timer = setInterval(function () { send('beat'); }, HEARTBEAT_MS);
  }
  function stopBeats() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      stopBeats();
      send('end');
    } else {
      startBeats();
    }
  });
  window.addEventListener('pagehide', function () { send('end'); });

  startBeats();
})();

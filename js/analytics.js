/* ============================================================
 * analytics.js — lightweight first-party beacon
 * Sends pageview + duration heartbeats to a Cloudflare Worker.
 * The endpoint URL is public by design; it only accepts writes.
 * All reads (the dashboard) require server-side auth.
 * ============================================================ */
(function () {
  'use strict';

  // Set this to your deployed Worker URL (no trailing slash)
  var ENDPOINT = 'https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev';

  // Don't track local development or opted-out browsers
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  if (ENDPOINT.indexOf('YOUR-WORKER') !== -1) return; // not configured yet

  // One session id per browser tab-session
  var sid;
  try {
    sid = sessionStorage.getItem('am_sid');
    if (!sid) {
      sid = (crypto.randomUUID && crypto.randomUUID()) ||
        Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('am_sid', sid);
    }
  } catch (e) {
    return; // storage blocked — skip tracking entirely
  }

  function send(event) {
    var payload = JSON.stringify({
      sid: sid,
      event: event,
      path: location.pathname,
      ref: event === 'view' ? document.referrer : undefined
    });
    // sendBeacon survives page unloads; fetch keepalive as fallback
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT + '/collect', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(ENDPOINT + '/collect', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true
      }).catch(function () { /* fire-and-forget */ });
    }
  }

  // Pageview
  send('view');

  // Duration heartbeats — every 15 s while the tab is visible.
  // The server derives session duration from last_seen − started,
  // so a closed laptop or killed tab still yields an accurate figure.
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
      send('end'); // final timestamp on tab hide / close
    } else {
      startBeats();
    }
  });
  window.addEventListener('pagehide', function () { send('end'); });

  startBeats();
})();

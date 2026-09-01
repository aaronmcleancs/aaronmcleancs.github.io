/* ============================================================
 * worker.js — analytics backend for aaronmclean.xyz
 *
 * Endpoints
 *   POST /collect     open  — pageview / heartbeat beacons
 *   POST /login       open  — password → signed session token
 *   GET  /api/stats   auth  — aggregates for the admin dashboard
 *
 * Secrets (never in this repo — set via `wrangler secret put`):
 *   ADMIN_PASSWORD   dashboard password
 *   SESSION_SECRET   HMAC key for signing session tokens
 *
 * This file is safe to publish. Knowing the algorithm gains an
 * attacker nothing without the secrets, which live only in
 * Cloudflare's encrypted secret store.
 * ============================================================ */

const ALLOWED_ORIGINS = [
  'https://aaronmclean.xyz',
  'https://www.aaronmclean.xyz',
  'http://localhost:8000', // local dev; remove if unwanted
];

const TOKEN_TTL_S = 8 * 60 * 60; // 8-hour dashboard sessions
const BOT_RE = /bot|crawl|spider|slurp|headless|preview|scan|monitor|lighthouse|pingdom/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (url.pathname === '/collect' && request.method === 'POST') {
        return await collect(request, env, cors);
      }
      if (url.pathname === '/login' && request.method === 'POST') {
        return await login(request, env, cors);
      }
      if (url.pathname === '/api/stats' && request.method === 'GET') {
        return await stats(request, env, cors);
      }
      return json({ error: 'not found' }, 404, cors);
    } catch (err) {
      return json({ error: 'internal error' }, 500, cors);
    }
  },
};

/* ------------------------------ collect ------------------------------ */

async function collect(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false }, 400, cors); }

  const { sid, event, path, ref } = body || {};
  if (!sid || typeof sid !== 'string' || sid.length > 64) return json({ ok: false }, 400, cors);
  if (!['view', 'beat', 'end'].includes(event)) return json({ ok: false }, 400, cors);

  const ua = request.headers.get('User-Agent') || '';
  if (BOT_RE.test(ua)) return json({ ok: true }, 200, cors); // silently drop bots

  const now = Math.floor(Date.now() / 1000);
  const cf = request.cf || {};
  const country = cf.country || '';
  const region = cf.region || '';
  const city = cf.city || '';

  if (event === 'view') {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO sessions (sid, started, last_seen, duration, country, region, city, referrer, ua, views)
         VALUES (?1, ?2, ?2, 0, ?3, ?4, ?5, ?6, ?7, 1)
         ON CONFLICT(sid) DO UPDATE SET
           last_seen = ?2,
           duration  = ?2 - started,
           views     = views + 1`
      ).bind(sid, now, country, region, city, (ref || '').slice(0, 300), ua.slice(0, 300)),
      env.DB.prepare(
        `INSERT INTO pageviews (sid, path, ts) VALUES (?1, ?2, ?3)`
      ).bind(sid, (path || '/').slice(0, 200), now),
    ]);
  } else {
    // heartbeat / end — just advance the clock on the session
    await env.DB.prepare(
      `UPDATE sessions SET last_seen = ?2, duration = ?2 - started WHERE sid = ?1`
    ).bind(sid, now).run();
  }

  return json({ ok: true }, 200, cors);
}

/* ------------------------------- auth -------------------------------- */

async function login(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad request' }, 400, cors); }

  const supplied = String(body?.password || '');

  // Constant-time comparison: HMAC both values with the session secret
  // and compare digests, so string length/content can't leak via timing.
  const key = await hmacKey(env.SESSION_SECRET);
  const a = await hmac(key, supplied);
  const b = await hmac(key, env.ADMIN_PASSWORD);
  const match = a.length === b.length && a.every((v, i) => v === b[i]);

  if (!match) {
    await sleep(800 + Math.random() * 400); // blunt brute-force throttle
    return json({ error: 'invalid password' }, 401, cors);
  }

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_S;
  const payload = b64url(JSON.stringify({ exp }));
  const sig = b64url(await hmac(key, payload));
  return json({ token: `${payload}.${sig}`, exp }, 200, cors);
}

async function verifyToken(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;

  const key = await hmacKey(env.SESSION_SECRET);
  const expect = b64url(await hmac(key, payload));
  if (expect.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return false;

  try {
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

/* ------------------------------- stats ------------------------------- */

async function stats(request, env, cors) {
  if (!(await verifyToken(request, env))) {
    return json({ error: 'unauthorized' }, 401, cors);
  }

  const now = Math.floor(Date.now() / 1000);
  const d30 = now - 30 * 86400;

  const [totals, byDay, topPages, countries, recent] = await Promise.all([
    env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM pageviews)                          AS total_views,
         (SELECT COUNT(*) FROM sessions)                           AS total_sessions,
         (SELECT COALESCE(AVG(duration),0) FROM sessions
            WHERE duration > 0)                                    AS avg_duration,
         (SELECT COUNT(*) FROM sessions WHERE started >= ?1)       AS sessions_30d`
    ).bind(d30).first(),

    env.DB.prepare(
      `SELECT date(ts,'unixepoch') AS day, COUNT(*) AS views
         FROM pageviews WHERE ts >= ?1
        GROUP BY day ORDER BY day`
    ).bind(d30).all(),

    env.DB.prepare(
      `SELECT path, COUNT(*) AS views FROM pageviews
        GROUP BY path ORDER BY views DESC LIMIT 10`
    ).all(),

    env.DB.prepare(
      `SELECT country, city, COUNT(*) AS sessions FROM sessions
        WHERE country != '' GROUP BY country, city
        ORDER BY sessions DESC LIMIT 15`
    ).all(),

    env.DB.prepare(
      `SELECT sid, started, duration, views, country, region, city, referrer, ua
         FROM sessions ORDER BY started DESC LIMIT 50`
    ).all(),
  ]);

  return json({
    totals,
    byDay: byDay.results,
    topPages: topPages.results,
    countries: countries.results,
    recent: recent.results,
  }, 200, cors);
}

/* ------------------------------ helpers ------------------------------ */

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
}

async function hmac(key, msg) {
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig));
}

function b64url(input) {
  const bytes = Array.isArray(input) ? input : new TextEncoder().encode(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

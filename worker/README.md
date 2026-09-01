# Analytics backend — deployment

The site stays on GitHub Pages untouched. This folder is a Cloudflare Worker
(free tier: 100k requests/day, D1 5 GB) that collects beacons and serves the
`/admin.html` dashboard's API. **Total added cost: $0.**

## Security model

- `ADMIN_PASSWORD` and `SESSION_SECRET` are set with `wrangler secret put`.
  They live encrypted in Cloudflare, are never written to any file, and never
  appear in the git repo. Publishing this entire folder publicly is safe.
- `/login` compares the password server-side (constant-time) and returns an
  HMAC-signed token valid for 8 hours.
- `/api/stats` requires that token. Without it the Worker returns 401 —
  there is no client-side check to bypass.
- `/collect` is intentionally public (it has to be, browsers call it), but it
  is write-only and validates/caps every field.

## One-time setup (~5 minutes)

```bash
npm install -g wrangler
wrangler login                                   # opens browser, free account

cd worker
wrangler d1 create portfolio-analytics           # prints a database_id
# → paste that id into wrangler.toml (database_id = "...")

wrangler d1 execute portfolio-analytics --remote --file=schema.sql

wrangler secret put ADMIN_PASSWORD               # type your dashboard password
wrangler secret put SESSION_SECRET               # paste a long random string, e.g.:
#   openssl rand -base64 48

wrangler deploy                                  # prints your Worker URL
```

## Wire the site to the Worker

Replace `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev` with the deployed
Worker URL in **two places**:

1. `js/analytics.js` — `ENDPOINT` constant
2. `admin.html` — `ENDPOINT` constant

Commit and push. The Worker URL is not a secret; it grants no read access.

## Use

- Dashboard: `https://aaronmclean.xyz/admin.html` (noindex; not linked from nav)
- Rotate the password anytime: `wrangler secret put ADMIN_PASSWORD` + redeploy not required
- Inspect raw data: `wrangler d1 execute portfolio-analytics --remote --command "SELECT COUNT(*) FROM pageviews"`

## Notes

- Geolocation (country/region/city) comes from Cloudflare's `request.cf` on
  the server — nothing is looked up client-side and no IP addresses are stored.
- Obvious bots/crawlers are dropped by user-agent before insert.
- Session duration = last heartbeat − first view (15 s heartbeats while the
  tab is visible), so abruptly closed tabs still record accurate durations.
- If you use a custom domain route for the Worker later, just update the two
  ENDPOINT constants and add the origin to `ALLOWED_ORIGINS` in worker.js.

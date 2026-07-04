# Deploying Rally (extra credit — +2)

**Backend → Render**, **Frontend → Vercel.** Config files are already in the repo
(`render.yaml`, `frontend/vercel.json`); you just plug in URLs and click deploy.

**Why this setup:** Vercel proxies `/api/*` to the Render backend, so the browser sees API
calls as **same-origin**. That keeps the session cookie **first-party** and sidesteps the
third-party-cookie blocking that would otherwise break login across two different domains.

---

## 1. Backend on Render

1. Push to GitHub (done). On **render.com** → **New → Blueprint**, pick this repo. Render reads
   `render.yaml` and creates the `rally-api` web service (root dir `backend`, build `npm install`,
   start `npm start`, health check `/api/health`).
2. After it deploys, copy the service URL (e.g. `https://rally-api.onrender.com`).
3. In the service **Environment**, set:
   - `BASE_URL` = your Render URL (e.g. `https://rally-api.onrender.com`) — used to build image URLs.
   - `CLIENT_ORIGIN` = your Vercel URL (fill in after step 2, e.g. `https://rally.vercel.app`).
   - `SESSION_SECRET`, `NODE_ENV=production`, `DATABASE_PATH`, `UPLOAD_DIR` are set by the blueprint.
4. The DB schema auto-creates on first boot (`db.js` runs `schema.sql`) — no manual setup.

**Persistent storage:** `render.yaml` mounts a 1 GB disk at `/var/data` so the SQLite DB and
uploaded images survive redeploys. **Render disks require a paid instance.** On the free tier,
delete the `disk:` block and set `DATABASE_PATH=./db/app.db`, `UPLOAD_DIR=./uploads` — but note
the DB and images **reset on every redeploy/restart** (fine for a live demo if you register a
fresh account during it). Free instances also cold-start (~30 s first request).

## 2. Frontend on Vercel

1. Edit **`frontend/vercel.json`**: replace `REPLACE-WITH-YOUR-RENDER-URL.onrender.com` with your
   real Render host. Commit + push.
2. On **vercel.com** → **New Project**, import this repo. Set **Root Directory = `frontend`**
   (framework auto-detects as **Vite**; build `npm run build`, output `dist`).
3. Add an Environment Variable: `VITE_API_URL` = `/api` (relative — it goes through the proxy).
4. Deploy, then copy the Vercel URL (e.g. `https://rally.vercel.app`).

## 3. Wire them together

1. Back in Render, set `CLIENT_ORIGIN` = your Vercel URL and **redeploy** the backend.
2. Open the Vercel URL → register → post → confirm the feed loads and login persists on refresh.
3. Add the live URL to the root **`README.md`** ("Live deployment" section).

## Notes / gotchas
- **Images** load directly from Render (`BASE_URL`); the backend already sends
  `Cross-Origin-Resource-Policy: cross-origin` (helmet) so cross-origin `<img>` works.
- **Cookies** are `secure` + `SameSite=None` in production (already coded); the Vercel proxy makes
  them first-party so this is robust across browsers.
- If you ever switch away from the proxy (call Render directly via `VITE_API_URL=https://…/api`),
  cross-site third-party cookies may be blocked by Safari/Chrome — the proxy avoids this.

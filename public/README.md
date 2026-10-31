# oneparty guest app

The public, cloud-hosted half of oneparty: **Dawghouse Halloween**, a haunted-manor themed phone site. Guests scan the QR code shown on the party screens (next to the Jam QR) and can:

- **Costume tab**: enter the contest with their name and costume (one entry per phone, editable while entries are open)
- **Vote tab**: vote for the best costume (trading-card grid, one vote each, can switch, can't vote for yourself). When you turn results on it becomes a **Results** podium
- **Music tab**: see the song that is playing on a spinning record and rate it with up to five candles (the hub reports the current song)
- **Pay tab** (appears once you set it): payment link + Venmo QR for jungle juice and drinks

Everything else (photos for winners, edits, song scores, leaderboard on the screens, phases, payment info) is managed from the **Contest** page of the on-prem hub's control panel. There is no separate admin site to expose: the hub calls this app's `/admin/*` API with an admin key.

## Layout

- `app.mjs`, `server.mjs`: the server. Zero runtime dependencies.
- `index.html`, `src/`: the site, Vue 3 (SFCs) built with Vite. `src/store.js` holds state, the API calls and polling; one component per tab in `src/components/`.
- `static/`: fonts and `qrcode.js`, copied as-is so URLs stay `/fonts/...` and `/qrcode.js`.
- `web/`: the build output the server serves (git-ignored). `/#vote`, `/#music`, `/#pay` deep-link to a tab.

## Run

```
cd public
npm install                    # build tools only (vue, vite); the server needs nothing
npm run build                  # src/ -> web/
ADMIN_KEY=<24+ random chars> npm start     # PORT (8080), DATA_DIR (./data), TRUST_PROXY=1 behind a proxy/CDN
npm run dev                    # Vite dev server on :5174, proxying /api /admin /img to :8080
npm test                       # builds first (pretest), then runs the tests
```

The `Dockerfile` is multi-stage: `npm ci` + build, then a runtime image holding only `app.mjs`, `server.mjs` and the built `web/`. Mount a persistent volume at `/data`: it holds `data.json` and uploaded images.

### Docker image

GitHub Actions (`.github/workflows/guest-app-image.yml`) tests both the local hub and guest app, then builds and pushes a multi-arch (amd64 + arm64) image to the private Harbor project at `registry.tgm.one/oneparty/guest`. Main builds pin their exact digest in Git; Argo CD deploys that digest to East at `https://spook.tgm.one`. See `../docs/deployment.md` for the pipeline and runner configuration.

- push to `main` that touches `public/` → `:latest` and `:sha-<short>`
- git tag `guest-v1.2.3` → `:1.2.3`, `:1.2` and `:latest`
- pull requests only test and build; nothing is pushed

```
docker run -d -p 8080:8080 -e ADMIN_KEY=<24+ random chars> -v guest-data:/data registry.tgm.one/oneparty/guest:latest
```

The Harbor project is private. Authenticate with its scoped pull robot before pulling; East already has the pull credential in its `harbor-pull` Kubernetes Secret. The image has a health check on `/healthz` and runs as an unprivileged user. Build locally with `docker build -t oneparty-guest public`.

The deployed Hub values are `PARTY_API_URL=https://spook.tgm.one` and `PARTY_PUBLIC_URL=https://spook.tgm.one`. Set `PARTY_API_KEY` to the deployment's `ADMIN_KEY`; never put that value in Git or client-side JavaScript.

Behind a proxy or platform load balancer set `TRUST_PROXY=1` (Secure cookies, real client IPs). Serve it over HTTPS; phones need it for the cookie and the Pay link. The site loads only its own files (CSP `default-src 'self'`): no CDNs, no inline scripts.

## Connect the hub

In the hub's `.env` (or on the control panel Contest page): `PARTY_API_URL=https://your-app` and `PARTY_API_KEY=<the same ADMIN_KEY>`. Optionally `PARTY_PUBLIC_URL` if the QR should point somewhere else (a short link, say). The QR link is also editable on the Contest page.

## Notes

- Guests are identified by a server-issued cookie, not their IP (a whole party shares one). Clearing cookies or using another browser lets a guest vote again; you can see counts and remove entries from the Contest page. This is honor-system integrity, fine for a party.
- Uploaded images are checked by magic bytes (jpg/png/webp/gif, 10 MB); SVG is refused.
- The hub keeps a local copy of every photo it uploads so the leaderboard still renders if the venue internet drops.
- The admin key is only ever sent from the hub to this app. It is stored in the hub's `events/<slug>/settings.local.json` (git-ignored) when entered in the UI.
- Guest text is only ever rendered with Vue `{{ }}` interpolation; `v-html` is used solely for the fixed icon table in `src/icons.js`.

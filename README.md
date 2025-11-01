# SafeLink Inspector

A small web app to paste any link and check it safely.
It unshortens redirects, scores risk with simple heuristics, checks reputation (optional APIs), shows TLS/WHOIS/security headers, inspects forms, and lets you preview the page in a sandboxed viewer on a separate origin.

Frontend: **React (Vite)** 
Backend: **Node.js + Express**

---

## Screenshots

### Analyzer

![Analyzer](docs/screenshot-analyzer.png)

### Live sandbox viewer

![Live](docs/screenshot-live.png)

---

## Features

### Analyze any URL

* Unshorten redirect chain
* Risk score + label (with heuristics: IDN, deep subdomains, “login/verify” tokens, long URL, secrets in query)
* Reputation integrations (off until you add keys):


  * Google Safe Browsing (GSB)
  * PhishTank
  * urlscan.io (submit private scan)
  * VirusTotal quick lookup (queues scan if missing)
  

* TLS profile: issuer, SAN match vs host, protocol, expiry days
* WHOIS age via RDAP/WHOIS (registrar + age in days)
* Network info: resolve IP, ASN/Org, geo; optional AbuseIPDB score
* Security headers + parsed `Set-Cookie` flags (Secure/HttpOnly/SameSite)
* HSTS present and HTTP→HTTPS redirect indicator
* Form analysis: action URL, cross-domain posts, sensitive inputs
* List of 3rd-party hosts seen during page load (if available)

### Views

* **Sanitized HTML**: server-stored copy with strict CSP, shown in an iframe
* **Live (sandboxed)**: separate-origin proxy (`/live?url=...`) with CSP, frame-bust fixes, and asset rewriting
* Screenshot tab appears only if your backend provides screenshots (optional)

### History

* Search, filter by risk, sort (newest / by risk)
* Re-analyze, open, live sandbox, view sanitized, copy URL, delete
* Export **CSV/JSON**, import **JSON**
* Public share page: `/public/:id?token=...`

### Keyboard

* `/` focuses the URL input
* `Ctrl+Enter` runs Analyze
* “Show in analyzer” scrolls the main view to top

---

## Project structure

```
SafeLinkInspector/
├─ README.md
├─ .gitignore
├─ docs/
│  ├─ screenshot-analyzer.png
│  └─ screenshot-live.png
│
├─ app/                          # Frontend (React + Vite)
│  ├─ index.html
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ .env.development           # VITE_API_BASE, VITE_LIVE_ORIGIN for dev
│  ├─ .env.production            # values for production
│  └─ src/
│     ├─ main.jsx
│     ├─ App.jsx
│     ├─ api.js                  # fetch helpers (analyze, apiGet, etc.)
│     ├─ styles.css
│     └─ components/
│        ├─ Analyzer.jsx
│        └─ History.jsx
│
└─ server/                       # Backend (Express)
   ├─ package.json
   ├─ vercel.json              
   └─ src/
      ├─ index.mjs               # starts API + live sandbox server
      ├─ liveServer.mjs          # sandbox proxy 
      ├─ store/
      │  └─ db.js                # simple JSON storage for history
      └─ analyzer/
         ├─ forms.js
         ├─ headers.js
         ├─ netinfo.js
         ├─ reputation.js
         ├─ risk.js
         ├─ sanitize.js
         ├─ tls.js
         ├─ unshorten.js
         ├─ vt.js
         └─ whois.js
```

---

## Requirements

* Node.js **20+** (works with Node 22)
---

## Quick start (local dev)

Open **two** terminals (API starts Live too, so two is enough).

### 1) Backend

```bash
cd server
npm install
npm run dev
```

* API: `http://localhost:4000`
* Health: `GET /api/health`
* Live sandbox: `http://localhost:4080` (started from the API process)

### 2) Frontend

```bash
cd app
npm install
# set API and Live origins
# app/.env.development:
#   VITE_API_BASE=http://localhost:4000
#   VITE_LIVE_ORIGIN=http://localhost:4080
npm run dev
```

* Vite dev server: `http://localhost:5173`

---

## Environment variables

### app/.env(.development|.production)

```
VITE_API_BASE=http://localhost:4000
VITE_LIVE_ORIGIN=http://localhost:4080
```

### server/.env 

```
PORT=4000
LIVE_PORT=4080
CACHE_TTL_MIN=15

VT_API_KEY=            # VirusTotal
GSB_API_KEY=           # Google Safe Browsing
PHISHTANK_KEY=         # PhishTank
URLSCAN_KEY=           # urlscan.io
ABUSEIPDB_KEY=         # AbuseIPDB

WHOIS_TTL_MS=86400000
WHOIS_CACHE_MAX=200
RDAP_TIMEOUT_MS=10000
WHOIS_TIMEOUT_MS=10000
```

If ports are busy, change `PORT` and/or `LIVE_PORT`, and update the frontend `.env` accordingly.

---

## API endpoints (main)

* `POST /api/analyze`
  Body: `{ "url":"https://...", "options": { "nocache": false } }`
  Returns analysis object: finalUrl, risk, reputation, tls, whois, net, security headers/cookies, heuristics, forms, sanitized link, etc.


* `GET /api/history`
  Query: `q`, `risk` (`low|medium|high|all`), `sort` (`newest|risk`), `skip`, `limit`


* `GET /api/history/:id`


* `DELETE /api/history/:id`


* `DELETE /api/history`


* `GET /api/history/export?fmt=csv|json`


* `POST /api/history/import`
  Body: JSON array of records


* `GET /api/sanitized/:id`


* `GET /public/:id?token=...`


* Live sandbox:

  * `GET /live?url=...`
  * `GET /asset?url=...`

---

## Deploy

### One repo branch with everything (recommended “main”)

Just push the whole project folder:

```bash
git clone https://github.com/Antot-12/SafeLinkInspector.git
cd SafeLinkInspector
git add .
git commit -m "Initial"
git push origin main
```

### Frontend to **GitHub Pages** (on `gh-pages`)

Build the app and publish the build output:

```bash
cd app
npm install
# set production API/LIVE in app/.env.production:
#   VITE_API_BASE=https://<your-vercel-api>.vercel.app
#   VITE_LIVE_ORIGIN=https://<your-vercel-api>.vercel.app
npm run build
cd ..

git worktree add gh-pages
rm -r -fo gh-pages/*         
cp -r app/dist/* gh-pages/
cd gh-pages
git add .
git commit -m "Publish to GitHub Pages"
git push -u origin gh-pages
cd ..
git worktree remove gh-pages
```

Then enable Pages in your repo settings → Pages → Branch `gh-pages`.

### Backend to **Vercel** (on a separate branch, e.g. `backend-vercel`)

1. Create a new branch, commit the `server/` content (and its `package.json`, `vercel.json`).
2. On Vercel, “Import Project” from GitHub.
3. Project settings:


   * Root directory: `server`
   * Node 20+
   * Add your env vars (API keys, ports ignored on Vercel)

4. Deploy - you’ll get `https://YOUR-API.vercel.app`.
5. In GitHub Pages frontend, set:


   * `VITE_API_BASE=https://YOUR-API.vercel.app`
   * `VITE_LIVE_ORIGIN=https://YOUR-API.vercel.app`
6. Re-build the frontend and push to `gh-pages`.

> CORS: make sure your API allows the Pages origin (your `https://<user>.github.io` domain) in its CORS list.

---

## Security model

* The server fetches HTML, sanitizes it, and serves it with a very strict CSP for viewing.
* The “Live (sandboxed)” view runs on a different origin. It removes CSP/meta-CSP and frame-busting, and rewrites asset URLs to flow through `/asset`.
* No target-site cookies are exposed to the browser by default.

---

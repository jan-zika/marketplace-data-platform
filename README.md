# E-Commerce Marketplace Data Platform

**Team:** Michael Amaya, Vanessa Quiroz, Jan Zika
**Course:** Azure + T-SQL Database Analysis
**Topic:** Sales performance, customer behavior, and trade route visualization for a large Brazilian e-commerce marketplace

**Database export (.bacpac, 49 MB):** [Download from GitHub Releases](https://github.com/jan-zika/marketplace-data-platform/releases/tag/v1.0)

---

## About the Dataset

Source: the Brazilian E-Commerce Public Dataset by Olist ([Kaggle](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce), CC BY-NC-SA 4.0), credited here as its license requires. It covers 2016–2018 with orders, customers, sellers, products, payments, and reviews across 11 tables and ~1.56 million rows.

| Table | Rows | Description |
|---|---|---|
| orders | 99,441 | Order headers with status and timestamps |
| order_items | 112,650 | Line items per order |
| order_payments | 103,886 | Payment method and installments |
| order_reviews | 99,224 | Customer review scores and comments |
| customers | 99,441 | Customer location data |
| sellers | 3,095 | Seller location data |
| products | 32,951 | Product dimensions and category |
| product_category_name_translation | 71 | Portuguese → English category names |
| geolocation | 1,000,163 | ZIP code lat/lng lookup |
| leads_qualified | 8,000 | Marketing qualified leads |
| leads_closed | 842 | Converted leads |

---

## Repository Structure

```
queries/
  01_queries_jan.sql         -- Sales & Revenue (Jan Zika)
  02_queries_michael.sql     -- Customer & Delivery (Michael Amaya)
  03_queries_vanessa.sql     -- Seller & Product Performance (Vanessa Quiroz)
  04_queries_bonus.sql       -- Geolocation analysis + vw_geo view (Jan Zika)
  verify_schema.sql          -- Schema verification (SQL Server)
  verify_schema_sqlite.sql   -- Schema verification (SQLite)

app/
  frontend/
    src/
      App.jsx                -- Root layout + state management (desktop and phone layouts)
      api.js                 -- Fetch wrappers (live backend or static JSON)
      theme.css              -- CSS variables (DF1 palette, dark theme) + phone rules
      useIsMobile.js         -- Breakpoint hook: below 1024 px the phone and tablet layout applies
      components/
        BrazilMap.jsx        -- Leaflet map: circles, route lines, tooltips
    public/
      cities.json            -- Pre-exported city data (514 KB, 1 674 cities)
      routes.json            -- Pre-exported route data (12.7 MB, 35 759 routes)
      favicon.*, logo/       -- DF1 brand kit favicons and the df1.io logo (header credit)
      _headers               -- Cache and security headers (Cloudflare and Netlify both read it)
    index.html
    package.json
    vite.config.js           -- Dev proxy: /api → localhost:8000
    .env.local.example       -- Documents VITE_API_URL for live backend mode

  backend/
    main.py                  -- FastAPI + pyodbc, /api/cities and /api/routes
    requirements.txt

  start.ps1                  -- PowerShell launcher (starts both services)

netlify.toml                 -- Netlify build config (base: app/frontend), live until the Cloudflare cutover
wrangler.jsonc               -- Cloudflare Worker (static assets only), prepared 2026-11-22
package.json                 -- Root tooling: pinned wrangler, build / dev:cf / deploy:cf scripts
```

---

## Analysis Goals

### Jan Zika — Sales & Revenue
- Revenue trend over time
- Most popular payment methods and average installment count
- States with highest average order value
- Product categories driving the most revenue

### Michael Amaya — Customer & Delivery Behavior
- On-time vs late delivery rate
- Customer review score distribution
- Repeat customer rate
- Order status breakdown

### Vanessa Quiroz — Seller & Product Performance
- Top-performing sellers by revenue
- Most popular product categories by volume
- Marketing lead conversion funnel
- Freight cost vs product weight correlation

### Bonus — Interactive Trade Route Map (Jan Zika)
- Interactive Leaflet map of Brazil with seller and buyer cities
- Seller → customer city routes with order counts, distances, and freight values
- `vw_geo`: reusable view that deduplicates geolocation and pre-computes seller-to-customer distance per order

---

## Interactive Map App

The `app/` folder contains a full-stack web app for exploring trade routes between cities.

### Features
- **Three view modes**: Seller (outgoing orders), Buyer (incoming orders), Both (combined GMV)
- **Four metric layers**: Order count, Order value (revenue/spend), Avg shipping distance, Avg freight cost
- **City circles** sized and colored by the active metric (log scale, blue → red gradient)
- **Route lines** between seller and buyer cities, thickness and color by active metric
- **City selection**: click cities on the map or search by name; multi-select supported
- **Show top routes** mode: displays the top N routes globally, independent of city selection
- **Left panel**: scrollable city tiles with per-city stats and individual deselect buttons
- **Resizable** panel/map split
- **Phones and tablets** (below 1024 px): one scrolling column with the header, the map fitted to Brazil and the
  city panel; view mode and metric fold into the menu button; controls are at least 44 px tall and text at least
  12 px. The desktop layout from 1024 px up is unchanged.
- **Branding:** DF1 palette, the DF1 brand kit favicon set and the df1.io logo linking to https://df1.io

### Live Demo

Deployed on Netlify using static JSON (no backend required); a move to a Cloudflare Worker is prepared (see
"Deploying to Cloudflare" below):
**[https://marketplace.df1.io](https://marketplace.df1.io)**

---

## Running Locally

### Option A — Static JSON (no database needed)

The frontend reads pre-exported `cities.json` and `routes.json` from `app/frontend/public/`:

```bash
cd app/frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### Option B — Live backend (requires SQL Server connection)

1. Copy `.env.example` to `.env` in the project root and fill in your credentials:
   ```
   DB_SERVER=...
   DB_NAME=...
   DB_USER=...
   DB_PASSWORD=...
   ```
2. Copy `app/frontend/.env.local.example` to `app/frontend/.env.local` and uncomment `VITE_API_URL=http://localhost:8000`
3. Launch both services:
   ```powershell
   powershell -File app/start.ps1
   ```

Requires Python 3.11+, Node 18+, and [ODBC Driver 18 for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server).

---

## Database Setup

The full database is available as a `.bacpac` export (49 MB) in the [GitHub Releases](../../releases). Import it into SQL Server or Azure SQL using SSMS: **Tasks → Import Data-tier Application**.

For local development the app also works without any database — see Option A above.

---

## Deploying to Netlify

The repo includes a `netlify.toml` at the root. Connect the repo in Netlify and it will automatically build from `app/frontend/` and publish `dist/`.

No environment variables are needed for static JSON mode. To point at a live API, set `VITE_API_URL` in Netlify's environment settings.

---

## Deploying to Cloudflare (prepared 2026-11-22, not yet live)

The site can move from Netlify to a Cloudflare Worker named `marketplace-data-platform` that serves the Vite build
as static assets (free plan; static asset requests are free and do not count as Worker requests). Config:
`wrangler.jsonc`; tooling: the root `package.json` (wrangler 4.125.0, pinned, with `package-lock.json`).

What `netlify.toml` does and where it goes:

| Netlify | Cloudflare |
|---|---|
| Build in `app/frontend`, publish `dist` | `npm run build` at the repo root; `assets.directory` is `./app/frontend/dist` |
| 301 `olist-db.df1.io/*` to `marketplace.df1.io/:splat` | A Redirect Rule in the `df1.io` zone (cutover step 4). A host-based redirect cannot live in the Worker without running its script on every request, because static assets are served before the script. |
| 301 `olist-db.janzika.com/*` to `marketplace.df1.io/:splat` | Already a Cloudflare rule in the `janzika.com` zone (it points at `olist-db.df1.io`); optionally point it straight at `marketplace.df1.io` |
| No functions, proxies, custom headers or SPA fallback | None needed: no Worker script and no `run_worker_first`; unknown paths return 404 as on Netlify. `app/frontend/public/_headers` adds a one-year cache for the content-hashed `/assets/*` files. |

Check locally (no Cloudflare account needed), from the repo root:

```bash
npm ci            # installs wrangler
npm run dev:cf    # builds the app, then runs wrangler dev on http://localhost:8787
```

Expect `/`, `/cities.json`, `/routes.json` and `/favicon.svg` to answer 200, an unknown path 404, and `/assets/*` to
carry `Cache-Control: public, max-age=31536000, immutable`.

Cutover (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment; nothing deploys from GitHub):

1. **Deploy:** `npm run deploy:cf`. With `workers_dev: false` and no routes, the Worker is not reachable yet.
2. **Free the hostname:** Cloudflare dashboard, zone `df1.io`, DNS: delete the DNS-only CNAME `marketplace` that
   points to Netlify. The site is offline from here until step 3 finishes (about a minute).
3. **Attach the domain:** add `"routes": [{ "pattern": "marketplace.df1.io", "custom_domain": true }]` to
   `wrangler.jsonc` and run `npm run deploy:cf` again; Cloudflare creates the DNS record and the certificate.
4. **Old hostname:** zone `df1.io`: replace the CNAME `olist-db` (to Netlify) with a proxied placeholder record
   (`AAAA olist-db 100::`, proxied). Then Rules, Redirect Rules, new rule: hostname equals `olist-db.df1.io`, dynamic
   redirect to `concat("https://marketplace.df1.io", http.request.uri.path)`, status 301, preserve query string.
5. **Verify:** `curl -sI https://marketplace.df1.io/` answers 200 with `server: cloudflare`;
   `curl -sI https://olist-db.df1.io/x` and `curl -sI https://olist-db.janzika.com/x` answer 301 to
   `https://marketplace.df1.io/x`; the map loads on a phone and on a desktop. Then update the ops registry entry
   (`jan-zika/ops`, `src/shared/registry.ts`: platform and console link) and `docs/infrastructure/README.md` in
   `jan-zika/df1-io`.
6. **Retire Netlify:** after a week without problems, delete the Netlify site `marketplace-data-platform`, then
   remove `netlify.toml` from the repo.

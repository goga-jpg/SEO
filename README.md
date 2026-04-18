# 5DM SEO Audit Platform

A branded, password-gated SEO audit tool that lives at **`dashboards.5dm.africa/SEO`**. Users unlock the platform with a shared access password, configure a brand (name, logo, colors), point it at any public URL and receive a personalized audit report at a unique URL like `dashboards.5dm.africa/SEO/Safaricom`. Each completed audit appears as a card on the dashboard.

## Features

- Password gate (`5DMSEO`, case-insensitive)
- Branded audit wizard — brand name, logo upload, brand colors
- Real SEO audit engine:
  - On-page: title, meta description, canonical, robots, headings, images, links
  - Technical: robots.txt, sitemap.xml, HTTPS, www handling
  - Performance & Accessibility & Best-Practices & SEO scores from Google PageSpeed Insights (Lighthouse)
  - Content signals: word count, structured data, language
  - Social: Open Graph + Twitter Cards
- Overall score (0–100) + letter grade, pillar scores, prioritized recommendations
- Unique per-brand URL: `/SEO/{BrandName}`
- Dashboard card grid of all completed audits, color-accented with each brand's palette
- "Download Full Audit" → high-fidelity PDF of the branded report
- "Copy Link" to share the hosted audit

## Local development

```bash
npm start      # zero-dependency Node static server
# → http://localhost:4173/SEO/
```

The bundled server mirrors the production `/SEO/{slug}` routing so pretty URLs work locally.

## Deployment

### Option A — Upload into your existing `dashboards.5dm.africa` host (recommended)

Since `dashboards.5dm.africa` is already live, the cleanest path is to drop this platform into an `SEO/` folder on the same host that serves it.

**Steps:**

1. **Download the ready-to-upload zip** (choose one):
   - **From a release** — tag `v1.0.0` (or any `v*` tag) and the **Package downloadable release** workflow attaches `5dm-seo-audit-platform.zip` to the GitHub Release automatically.
   - **Manually from Actions** — on GitHub: **Actions → Package downloadable release → Run workflow**. When it finishes, download the `5dm-seo-audit-platform` artifact.
   - **Git clone** — `git clone https://github.com/goga-jpg/seo && cd seo && git checkout claude/seo-audit-platform-dtqrj`.

2. **Upload the `SEO/` folder** into your web root for `dashboards.5dm.africa`. The final layout must be:
   ```
   <dashboards-web-root>/SEO/index.html
   <dashboards-web-root>/SEO/css/...
   <dashboards-web-root>/SEO/js/...
   <dashboards-web-root>/SEO/.htaccess
   ```

3. **Visit `https://dashboards.5dm.africa/SEO/`** and unlock with `5DMSEO`. That's it.

The included `.htaccess` handles the `/SEO/{BrandName}` pretty URL fallback on Apache/cPanel hosts. If `dashboards.5dm.africa` runs on Nginx, Netlify, Vercel, Cloudflare Pages or anything else, the matching fallback config is already in the folder (`_redirects`, `vercel.json`, `404.html`).

### Option B — GitHub Pages preview URL

This repo ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that publishes the platform to GitHub Pages. Once **Settings → Pages → Source: GitHub Actions** is enabled, the platform is previewable at `https://goga-jpg.github.io/seo/` — useful for testing before uploading to `dashboards.5dm.africa`. No DNS change required.

### Option C — Any static host

The platform is a static SPA and deploys anywhere. SPA-fallback configs are included:

| Host                          | File                    |
| ----------------------------- | ----------------------- |
| Netlify / Cloudflare Pages    | `_redirects`            |
| Vercel                        | `vercel.json`           |
| Apache / cPanel               | `.htaccess`             |
| GitHub Pages                  | `404.html`              |
| Any Node environment          | `server.js`             |

Deploy the folder so that `index.html` is reachable at `/SEO/index.html`. Any request to `/SEO/<anything>` must fall back to `/SEO/index.html` — the client-side router reads the slug and renders the right view.

## Data storage

Audits are stored in the browser's `localStorage` under `5dm_seo_audits_v1`. Anyone who loads the platform on the same browser sees the same audit cards. To wire persistence to a shared backend (so audits are visible across devices), add a sync layer to `js/storage.js` (`saveAudit`, `listAudits`, `getBySlug`).

## Access password

Set in `js/app.js` via the `PASSWORD` constant. Stored lowercased so the compare is case-insensitive.

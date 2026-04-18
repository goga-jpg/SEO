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

### Option A — GitHub Pages at `dashboards.5dm.africa/SEO` (recommended)

This repo ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that publishes the platform to GitHub Pages under the `/SEO/` path and attaches the custom domain `dashboards.5dm.africa`.

**One-time setup:**

1. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. In your DNS provider for `5dm.africa`, add a CNAME record:
   - **Host:** `dashboards`
   - **Value:** `<your-github-user>.github.io` (e.g. `goga-jpg.github.io`)
3. Push to `main` (or the deploy branch configured in the workflow). The site builds automatically and becomes available at `https://dashboards.5dm.africa/SEO/`.
4. In **Settings → Pages → Custom domain** confirm `dashboards.5dm.africa` and enable **Enforce HTTPS** once the certificate provisions.

The workflow also installs a root-level redirect so `https://dashboards.5dm.africa/` forwards to `/SEO/`.

### Option B — Download the release zip

Tag a release (`git tag v1.0.0 && git push --tags`) or run the **Package downloadable release** workflow manually. A `5dm-seo-audit-platform.zip` will be attached to the release and available under **Actions → artifacts**. Unzip it so the inner `SEO/` folder lives at your web root and visit `/SEO/`.

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

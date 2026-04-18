/* 5DM SEO Audit Platform — audit engine */
(function () {
  "use strict";

  const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
  const FETCH_TIMEOUT_MS = 15000;
  // Multiple proxies — the audit retries across all of them before giving up,
  // so a single flaky provider doesn't break the whole run.
  const PROXIES = [
    { name: "allorigins-raw", url: function (u) { return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); }, mode: "text" },
    { name: "corsproxy.io", url: function (u) { return "https://corsproxy.io/?" + encodeURIComponent(u); }, mode: "text" },
    { name: "codetabs", url: function (u) { return "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u); }, mode: "text" },
    { name: "allorigins-get", url: function (u) { return "https://api.allorigins.win/get?url=" + encodeURIComponent(u); }, mode: "allorigins" },
    { name: "thingproxy", url: function (u) { return "https://thingproxy.freeboard.io/fetch/" + u; }, mode: "text" },
  ];

  function normalizeUrl(raw) {
    if (!raw) return "";
    let u = String(raw).trim();
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try {
      const parsed = new URL(u);
      return parsed.toString();
    } catch (_) {
      return "";
    }
  }

  function fetchWithTimeout(url, opts, timeoutMs) {
    const ctrl = ("AbortController" in window) ? new AbortController() : null;
    const timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || FETCH_TIMEOUT_MS);
    const options = Object.assign({}, opts || {});
    if (ctrl) options.signal = ctrl.signal;
    return fetch(url, options).finally(function () { clearTimeout(timer); });
  }

  async function fetchWithProxy(targetUrl) {
    const errors = [];
    for (let i = 0; i < PROXIES.length; i++) {
      const p = PROXIES[i];
      try {
        const res = await fetchWithTimeout(p.url(targetUrl), { method: "GET" }, FETCH_TIMEOUT_MS);
        if (!res.ok) throw new Error("HTTP " + res.status);
        if (p.mode === "allorigins") {
          const json = await res.json();
          if (json && json.status && json.status.http_code && json.status.http_code >= 400) {
            throw new Error("origin HTTP " + json.status.http_code);
          }
          if (json && typeof json.contents === "string" && json.contents.length) return json.contents;
          throw new Error("empty body");
        }
        const body = await res.text();
        if (!body || body.length < 20) throw new Error("empty body");
        return body;
      } catch (err) {
        errors.push(p.name + ": " + (err && err.message ? err.message : err));
      }
    }
    const e = new Error("All proxies failed — " + errors.join(" | "));
    e.proxyErrors = errors;
    throw e;
  }

  function parseHtml(html) {
    const parser = new DOMParser();
    return parser.parseFromString(html || "", "text/html");
  }

  function getMeta(doc, selector) {
    const el = doc.querySelector(selector);
    if (!el) return "";
    return (el.getAttribute("content") || el.textContent || "").trim();
  }

  function analyzeOnPage(doc, url) {
    const findings = [];

    const title = (doc.querySelector("title") && doc.querySelector("title").textContent || "").trim();
    if (!title) {
      findings.push({ status: "fail", tag: "Critical", title: "Missing <title> tag", body: "Every page must have a unique, descriptive title tag. It's one of the strongest on-page ranking factors." });
    } else if (title.length < 30) {
      findings.push({ status: "warn", tag: "Improve", title: "Title tag is short", body: "Your title is " + title.length + " characters. Aim for 50–60 characters to maximize SERP real estate.", code: title });
    } else if (title.length > 65) {
      findings.push({ status: "warn", tag: "Improve", title: "Title tag is too long", body: "Your title is " + title.length + " characters and may be truncated in search results. Aim for 50–60.", code: title });
    } else {
      findings.push({ status: "pass", tag: "Good", title: "Well-sized <title> tag", body: "Title is " + title.length + " characters.", code: title });
    }

    const desc = getMeta(doc, 'meta[name="description" i]');
    if (!desc) {
      findings.push({ status: "fail", tag: "Critical", title: "Missing meta description", body: "Add a compelling meta description between 140–160 characters. It impacts click-through rates from the SERP." });
    } else if (desc.length < 80) {
      findings.push({ status: "warn", tag: "Improve", title: "Meta description is short", body: "Currently " + desc.length + " characters. Aim for 140–160 characters.", code: desc });
    } else if (desc.length > 170) {
      findings.push({ status: "warn", tag: "Improve", title: "Meta description is too long", body: "Currently " + desc.length + " characters. Google may truncate descriptions longer than ~160.", code: desc });
    } else {
      findings.push({ status: "pass", tag: "Good", title: "Meta description is well-sized", body: desc.length + " characters.", code: desc });
    }

    const canonical = doc.querySelector('link[rel="canonical"]');
    if (!canonical || !canonical.getAttribute("href")) {
      findings.push({ status: "warn", tag: "Improve", title: "Missing canonical tag", body: "Add a <link rel=\"canonical\"> to prevent duplicate content issues, especially across tracking parameters." });
    } else {
      findings.push({ status: "pass", tag: "Good", title: "Canonical tag present", body: "Canonical URL is set.", code: canonical.getAttribute("href") });
    }

    const robots = getMeta(doc, 'meta[name="robots" i]');
    if (/noindex/i.test(robots)) {
      findings.push({ status: "fail", tag: "Critical", title: "Page is set to noindex", body: "A meta robots noindex will prevent this page from appearing in search engines.", code: robots });
    } else {
      findings.push({ status: "pass", tag: "Good", title: "No noindex directive", body: "The page is open to indexing." + (robots ? " Robots: " + robots : "") });
    }

    const h1s = Array.from(doc.querySelectorAll("h1"));
    if (h1s.length === 0) {
      findings.push({ status: "fail", tag: "Critical", title: "Missing H1", body: "Every indexable page should have exactly one descriptive H1." });
    } else if (h1s.length > 1) {
      findings.push({ status: "warn", tag: "Improve", title: "Multiple H1 tags detected", body: "Found " + h1s.length + " H1 tags. Consolidate into a single descriptive H1 and use H2/H3 for subsections." });
    } else {
      findings.push({ status: "pass", tag: "Good", title: "Single H1 tag", body: "H1: \"" + (h1s[0].textContent || "").trim().slice(0, 120) + "\"" });
    }

    const h2s = doc.querySelectorAll("h2").length;
    const h3s = doc.querySelectorAll("h3").length;
    if (h2s === 0) {
      findings.push({ status: "warn", tag: "Improve", title: "No H2 subheadings", body: "Subheadings help users scan content and give crawlers structure." });
    } else {
      findings.push({ status: "pass", tag: "Good", title: "Clear heading structure", body: h2s + " H2 and " + h3s + " H3 subheadings found." });
    }

    const imgs = Array.from(doc.querySelectorAll("img"));
    const missingAlt = imgs.filter(function (i) { return !i.getAttribute("alt") || !i.getAttribute("alt").trim(); }).length;
    if (imgs.length === 0) {
      findings.push({ status: "info", tag: "Info", title: "No images detected", body: "Images were not found in the page markup (they may be injected by JavaScript)." });
    } else if (missingAlt === 0) {
      findings.push({ status: "pass", tag: "Good", title: "All images have alt text", body: imgs.length + " images scanned." });
    } else {
      findings.push({ status: "warn", tag: "Improve", title: missingAlt + " of " + imgs.length + " images missing alt text", body: "Descriptive alt text improves accessibility and image SEO." });
    }

    try {
      const host = new URL(url).hostname;
      const links = Array.from(doc.querySelectorAll("a[href]"));
      let internal = 0, external = 0, nofollow = 0;
      links.forEach(function (a) {
        const href = a.getAttribute("href") || "";
        try {
          const abs = new URL(href, url);
          if (abs.hostname === host) internal++;
          else if (abs.protocol.startsWith("http")) external++;
        } catch (_) { /* ignore */ }
        if ((a.getAttribute("rel") || "").toLowerCase().includes("nofollow")) nofollow++;
      });
      findings.push({ status: "info", tag: "Signal", title: "Link profile", body: internal + " internal, " + external + " external, " + nofollow + " nofollow links on this page." });
    } catch (_) { /* ignore */ }

    return findings;
  }

  function analyzeSocial(doc) {
    const findings = [];
    const ogTitle = getMeta(doc, 'meta[property="og:title" i]');
    const ogDesc = getMeta(doc, 'meta[property="og:description" i]');
    const ogImage = getMeta(doc, 'meta[property="og:image" i]');
    const twCard = getMeta(doc, 'meta[name="twitter:card" i]');

    if (ogTitle && ogDesc && ogImage) {
      findings.push({ status: "pass", tag: "Good", title: "Open Graph tags present", body: "og:title, og:description and og:image are configured for rich social previews." });
    } else {
      findings.push({ status: "warn", tag: "Improve", title: "Incomplete Open Graph tags", body: "Add og:title, og:description and og:image to get branded previews when your pages are shared on social." });
    }

    if (twCard) {
      findings.push({ status: "pass", tag: "Good", title: "Twitter Card declared", body: "twitter:card = " + twCard });
    } else {
      findings.push({ status: "warn", tag: "Improve", title: "Missing Twitter Card", body: "Add twitter:card meta tag (e.g. summary_large_image) for polished Twitter/X previews." });
    }
    return findings;
  }

  function analyzeContent(doc) {
    const findings = [];
    const text = (doc.body && doc.body.innerText || doc.body && doc.body.textContent || "").trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    if (words < 300) {
      findings.push({ status: "warn", tag: "Improve", title: "Thin content", body: "Approximately " + words + " words detected. Aim for 600+ words on indexable pages to demonstrate topical depth." });
    } else {
      findings.push({ status: "pass", tag: "Good", title: "Healthy content volume", body: "Approximately " + words + " words detected on the page." });
    }

    const ldjson = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).length;
    if (ldjson > 0) {
      findings.push({ status: "pass", tag: "Good", title: "Structured data detected", body: ldjson + " JSON-LD block(s) found — eligible for rich results." });
    } else {
      findings.push({ status: "warn", tag: "Improve", title: "No structured data found", body: "Add JSON-LD for Organization, WebSite, BreadcrumbList and content-specific schemas (Article, Product, LocalBusiness)." });
    }

    const langAttr = doc.documentElement && doc.documentElement.getAttribute("lang");
    if (langAttr) {
      findings.push({ status: "pass", tag: "Good", title: "Language declared", body: "<html lang=\"" + langAttr + "\"> is set." });
    } else {
      findings.push({ status: "warn", tag: "Improve", title: "Missing lang attribute", body: "Declare the language on <html> (e.g. <html lang=\"en\">) for accessibility and localization." });
    }
    return findings;
  }

  async function analyzeTechnical(url) {
    const findings = [];
    try {
      const origin = new URL(url).origin;
      const robotsUrl = origin + "/robots.txt";
      const sitemapUrl = origin + "/sitemap.xml";

      const [robotsTxt, sitemapXml] = await Promise.all([
        fetchWithProxy(robotsUrl).catch(function () { return null; }),
        fetchWithProxy(sitemapUrl).catch(function () { return null; }),
      ]);

      if (robotsTxt && /user-agent/i.test(robotsTxt)) {
        findings.push({ status: "pass", tag: "Good", title: "robots.txt is accessible", body: "A robots.txt file is published at " + robotsUrl });
        if (/sitemap:/i.test(robotsTxt)) {
          findings.push({ status: "pass", tag: "Good", title: "Sitemap referenced in robots.txt", body: "Crawlers are guided to the sitemap from robots.txt." });
        } else {
          findings.push({ status: "warn", tag: "Improve", title: "Sitemap not referenced in robots.txt", body: "Add \"Sitemap: " + sitemapUrl + "\" to robots.txt for faster discovery." });
        }
      } else {
        findings.push({ status: "warn", tag: "Improve", title: "robots.txt missing or empty", body: "Publish a robots.txt at " + robotsUrl + " to guide crawlers and reference your sitemap." });
      }

      if (sitemapXml && /<urlset|<sitemapindex/i.test(sitemapXml)) {
        const urlCount = (sitemapXml.match(/<url>/g) || []).length;
        findings.push({ status: "pass", tag: "Good", title: "XML sitemap accessible", body: "Sitemap at " + sitemapUrl + (urlCount ? " (" + urlCount + " URLs)" : "") });
      } else {
        findings.push({ status: "warn", tag: "Improve", title: "XML sitemap not found", body: "Publish an XML sitemap at " + sitemapUrl + " and submit it in Google Search Console." });
      }
    } catch (e) {
      findings.push({ status: "info", tag: "Info", title: "Technical checks skipped", body: "Could not complete robots.txt / sitemap.xml checks: " + e.message });
    }
    return findings;
  }

  function analyzeSecurity(url) {
    const findings = [];
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:") {
        findings.push({ status: "pass", tag: "Good", title: "Served over HTTPS", body: "Secure connection — required for modern SEO and browser trust." });
      } else {
        findings.push({ status: "fail", tag: "Critical", title: "Not served over HTTPS", body: "Migrate the site to HTTPS. Google downranks insecure pages and browsers display warnings." });
      }
      if (parsed.hostname.startsWith("www.")) {
        findings.push({ status: "info", tag: "Signal", title: "Using www subdomain", body: "Ensure the non-www variant 301-redirects to the canonical host." });
      } else {
        findings.push({ status: "info", tag: "Signal", title: "Using apex domain", body: "Ensure the www variant 301-redirects to the canonical host." });
      }
    } catch (_) { /* ignore */ }
    return findings;
  }

  function isPubliclyReachable(url) {
    try {
      const h = new URL(url).hostname;
      if (!h) return false;
      if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return false;
      if (/^10\./.test(h) || /^192\.168\./.test(h)) return false;
      if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return false;
      return true;
    } catch (_) { return false; }
  }

  async function runPageSpeed(url) {
    if (!isPubliclyReachable(url)) {
      throw new Error("PageSpeed Insights can only audit publicly reachable URLs.");
    }
    const endpoint = PSI_ENDPOINT
      + "?url=" + encodeURIComponent(url)
      + "&strategy=mobile"
      + "&category=performance&category=seo&category=accessibility&category=best-practices";
    // PSI can legitimately take 45–60s on slow sites.
    const res = await fetchWithTimeout(endpoint, { method: "GET" }, 90000);
    if (!res.ok) {
      let detail = "HTTP " + res.status;
      try {
        const errJson = await res.json();
        if (errJson && errJson.error && errJson.error.message) detail = errJson.error.message;
      } catch (_) { /* ignore */ }
      throw new Error("PageSpeed Insights request failed (" + detail + ")");
    }
    const data = await res.json();
    const cats = data && data.lighthouseResult && data.lighthouseResult.categories;
    if (!cats) throw new Error("PageSpeed Insights returned no data.");
    function score(id) { return cats[id] ? Math.round((cats[id].score || 0) * 100) : null; }
    return {
      performance: score("performance"),
      accessibility: score("accessibility"),
      bestPractices: score("best-practices"),
      seo: score("seo"),
      metrics: ((data.lighthouseResult.audits || {})["metrics"] || {}).details || null,
      fieldData: data.loadingExperience || null,
    };
  }

  function psiToFindings(psi) {
    const findings = { performance: [], accessibility: [], psiSummary: psi };
    if (!psi) return findings;
    function gradeFor(score) {
      if (score === null || score === undefined) return "info";
      if (score >= 90) return "pass";
      if (score >= 60) return "warn";
      return "fail";
    }

    findings.performance.push({
      status: gradeFor(psi.performance),
      tag: "Score",
      title: "Performance score: " + (psi.performance ?? "N/A") + "/100",
      body: "Measured by Google Lighthouse (mobile). Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1.",
    });
    findings.performance.push({
      status: gradeFor(psi.bestPractices),
      tag: "Score",
      title: "Best Practices score: " + (psi.bestPractices ?? "N/A") + "/100",
      body: "Covers HTTPS, console errors, deprecated APIs and browser best practices.",
    });
    findings.performance.push({
      status: gradeFor(psi.seo),
      tag: "Score",
      title: "Technical SEO score: " + (psi.seo ?? "N/A") + "/100",
      body: "Lighthouse SEO category — mobile-friendliness, crawlability, structured data.",
    });
    findings.accessibility.push({
      status: gradeFor(psi.accessibility),
      tag: "Score",
      title: "Accessibility score: " + (psi.accessibility ?? "N/A") + "/100",
      body: "Covers color contrast, ARIA, tap target size and semantic markup. WCAG 2.1 AA is the baseline.",
    });

    if (psi.fieldData && psi.fieldData.metrics) {
      const m = psi.fieldData.metrics;
      function pushField(label, key, unit, good, ok) {
        const entry = m[key];
        if (!entry) return;
        const val = entry.percentile;
        const display = unit === "ms" ? val + " ms" : (val / 100).toFixed(2);
        let st = "fail";
        if (val <= good) st = "pass"; else if (val <= ok) st = "warn";
        findings.performance.push({
          status: st, tag: "Field Data",
          title: label + ": " + display,
          body: "Real-user field data (CrUX). Lower is better.",
        });
      }
      pushField("Largest Contentful Paint (LCP)", "LARGEST_CONTENTFUL_PAINT_MS", "ms", 2500, 4000);
      pushField("Interaction to Next Paint (INP)", "INTERACTION_TO_NEXT_PAINT", "ms", 200, 500);
      pushField("Cumulative Layout Shift (CLS)", "CUMULATIVE_LAYOUT_SHIFT_SCORE", "cls", 10, 25);
    }

    return findings;
  }

  function computePillars(onpage, technical, performance, accessibility, content, social, security) {
    function pct(arr) {
      if (!arr || !arr.length) return 0;
      const weights = { pass: 1, warn: 0.55, info: 0.85, fail: 0 };
      let total = 0;
      arr.forEach(function (f) { total += (weights[f.status] ?? 0.5); });
      return Math.round((total / arr.length) * 100);
    }
    return {
      onpage: pct(onpage),
      technical: pct(technical),
      performance: pct(performance),
      accessibility: pct(accessibility),
      content: pct(content),
      social: pct(social),
      security: pct(security),
    };
  }

  function gradeFromScore(score) {
    if (score >= 90) return { letter: "A", className: "a" };
    if (score >= 75) return { letter: "B", className: "b" };
    if (score >= 60) return { letter: "C", className: "c" };
    return { letter: "D", className: "d" };
  }

  function buildRecommendations(all) {
    const failed = all.filter(function (f) { return f.status === "fail"; });
    const warned = all.filter(function (f) { return f.status === "warn"; });
    const recs = [];
    failed.slice(0, 6).forEach(function (f) {
      recs.push({ title: f.title, body: f.body, priority: "High" });
    });
    warned.slice(0, 10 - recs.length).forEach(function (f) {
      recs.push({ title: f.title, body: f.body, priority: "Medium" });
    });
    return recs;
  }

  function buildSummary(brandName, url, overall, pillars, counts) {
    const grade = gradeFromScore(overall).letter;
    const weakest = Object.entries(pillars).sort(function (a, b) { return a[1] - b[1]; })[0];
    const strongest = Object.entries(pillars).sort(function (a, b) { return b[1] - a[1]; })[0];
    const weakLabel = weakest ? weakest[0].replace(/^./, function (c) { return c.toUpperCase(); }) : "—";
    const strongLabel = strongest ? strongest[0].replace(/^./, function (c) { return c.toUpperCase(); }) : "—";
    return (
      "This audit evaluates " + brandName + " (" + url + ") across on-page, technical, performance, accessibility, " +
      "content, social and security signals. The site scored " + overall + "/100 overall (grade " + grade + "), " +
      "with " + counts.pass + " checks passing, " + counts.warn + " to improve, and " + counts.fail + " critical issues. " +
      "The strongest pillar is " + strongLabel + " (" + strongest[1] + "/100), while the biggest opportunity is " +
      weakLabel + " (" + weakest[1] + "/100). Prioritize the recommendations on the final page to move the needle fastest."
    );
  }

  function fetchFailedFindings(kind, reason) {
    return [{
      status: "info",
      tag: "Note",
      title: kind + " checks couldn't fetch the page",
      body: "The browser couldn't retrieve the target HTML through any public CORS proxy — this usually means the site blocks automated access (Cloudflare/WAF) or all free proxies are temporarily rate-limited. The performance, accessibility and technical-SEO sections still run against Google's servers. Details: " + reason,
    }];
  }

  async function runAudit(input, onStep) {
    function step(name) { if (typeof onStep === "function") onStep(name); }

    const url = normalizeUrl(input.url);
    if (!url) throw new Error("Please provide a valid website URL.");

    step("fetch");
    // Fetch HTML and run PageSpeed Insights in parallel so one slow call
    // doesn't block the other, and a proxy failure can't kill the run.
    const htmlPromise = fetchWithProxy(url).catch(function (e) { return { __error: e }; });
    const psiPromise = runPageSpeed(url).catch(function (e) { return { __error: e }; });
    const technicalPromise = analyzeTechnical(url);

    step("parse");
    const htmlResult = await htmlPromise;
    let doc = null;
    let fetchError = null;
    if (htmlResult && htmlResult.__error) {
      fetchError = htmlResult.__error;
    } else if (typeof htmlResult === "string") {
      doc = parseHtml(htmlResult);
    }

    let onpage, social, content;
    if (doc) {
      onpage = analyzeOnPage(doc, url);
      social = analyzeSocial(doc);
      content = analyzeContent(doc);
    } else {
      onpage = fetchFailedFindings("On-page", fetchError && fetchError.message || "unknown");
      social = fetchFailedFindings("Social", fetchError && fetchError.message || "unknown");
      content = fetchFailedFindings("Content", fetchError && fetchError.message || "unknown");
    }
    const security = analyzeSecurity(url);

    step("pagespeed");
    const psiResult = await psiPromise;
    let psi = null;
    let psiError = null;
    if (psiResult && psiResult.__error) psiError = psiResult.__error;
    else psi = psiResult;
    const psiFindings = psiToFindings(psi);
    if (!psi && psiError) {
      psiFindings.performance.unshift({
        status: "info", tag: "Note",
        title: "PageSpeed Insights unavailable",
        body: "Couldn't reach Google's PageSpeed Insights API: " + psiError.message + ". Scores will be omitted from this run.",
      });
      psiFindings.accessibility.unshift({
        status: "info", tag: "Note",
        title: "PageSpeed Insights unavailable",
        body: "Couldn't reach Google's PageSpeed Insights API: " + psiError.message,
      });
    }

    step("technical");
    const technical = await technicalPromise;

    step("score");
    const performance = psiFindings.performance;
    const accessibility = psiFindings.accessibility;

    const pillars = computePillars(onpage, technical, performance, accessibility, content, social, security);
    const overall = Math.round(
      (pillars.onpage * 1.2
        + pillars.technical * 1.1
        + pillars.performance * 1.2
        + pillars.accessibility * 1.0
        + pillars.content * 1.0
        + pillars.social * 0.8
        + pillars.security * 1.2)
      / 7.5
    );

    const all = [].concat(onpage, technical, performance, accessibility, content, social, security);
    const counts = {
      pass: all.filter(function (f) { return f.status === "pass"; }).length,
      warn: all.filter(function (f) { return f.status === "warn"; }).length,
      fail: all.filter(function (f) { return f.status === "fail"; }).length,
      info: all.filter(function (f) { return f.status === "info"; }).length,
    };
    const recommendations = buildRecommendations(all);
    const summary = buildSummary(input.brandName, url, overall, pillars, counts);

    step("finalize");
    return {
      url: url,
      brandName: input.brandName,
      colors: {
        primary: input.primaryColor || "#00a651",
        secondary: input.secondaryColor || "#111111",
        accent: input.accentColor || "#ffd200",
      },
      logoDataUrl: input.logoDataUrl || "",
      contactEmail: input.contactEmail || "",
      notes: input.notes || "",
      overall: overall,
      grade: gradeFromScore(overall),
      pillars: pillars,
      counts: counts,
      findings: {
        onpage: onpage,
        technical: technical,
        performance: performance,
        accessibility: accessibility,
        content: content,
        social: social,
        security: security,
      },
      recommendations: recommendations,
      summary: summary,
      createdAt: Date.now(),
    };
  }

  window.Audit = {
    runAudit: runAudit,
    normalizeUrl: normalizeUrl,
  };
})();

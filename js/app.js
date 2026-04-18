/* 5DM SEO Audit Platform — main app, routing, views */
(function () {
  "use strict";

  const PASSWORD = "5dmseo"; // case-insensitive compare
  const BASE_PATH = detectBasePath();

  function detectBasePath() {
    // The app is designed to live under "/SEO" (e.g. dashboards.5dm.africa/SEO).
    // But also support being hosted at the domain root during local dev.
    const p = window.location.pathname;
    const idx = p.toLowerCase().indexOf("/seo");
    if (idx !== -1) {
      // Preserve original casing and trailing slash status
      return p.slice(0, idx + 4); // keeps e.g. "/SEO"
    }
    return "";
  }

  function routeFromLocation() {
    let path = window.location.pathname;
    if (BASE_PATH && path.toLowerCase().startsWith(BASE_PATH.toLowerCase())) {
      path = path.slice(BASE_PATH.length) || "/";
    }
    if (!path.startsWith("/")) path = "/" + path;
    path = path.replace(/\/+$/, "") || "/";

    if (path === "/") return { name: "home" };
    if (path === "/new") return { name: "new" };
    const m = path.match(/^\/([^\/]+)$/);
    if (m) return { name: "report", slug: decodeURIComponent(m[1]) };
    return { name: "notfound" };
  }

  function navigate(path, replace) {
    const url = (BASE_PATH || "") + path;
    if (replace) window.history.replaceState({}, "", url);
    else window.history.pushState({}, "", url);
    render();
  }

  function mount(templateId) {
    const app = document.getElementById("app");
    app.innerHTML = "";
    const tpl = document.getElementById(templateId);
    const node = tpl.content.cloneNode(true);
    app.appendChild(node);
    return app;
  }

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.hidden = true; }, 2400);
  }

  function render() {
    const route = routeFromLocation();

    if (!window.Storage.isAuthed()) {
      return renderAuth();
    }

    if (route.name === "home") return renderDashboard();
    if (route.name === "new") return renderNewAudit();
    if (route.name === "report") return renderReportRoute(route.slug);
    return renderNotFound();
  }

  // AUTH
  function renderAuth() {
    mount("tpl-auth");
    const form = document.querySelector(".auth-form");
    const err = document.querySelector(".auth-error");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const input = form.querySelector('input[name="password"]');
      const val = (input.value || "").trim().toLowerCase();
      if (val === PASSWORD) {
        window.Storage.setAuthed(true);
        err.hidden = true;
        navigate("/", true);
      } else {
        err.hidden = false;
        input.select();
      }
    });
  }

  // DASHBOARD
  function renderDashboard() {
    mount("tpl-dashboard");
    document.querySelectorAll('[data-action="new-audit"]').forEach(function (b) {
      b.addEventListener("click", function () { navigate("/new"); });
    });
    document.querySelector('[data-action="logout"]').addEventListener("click", function () {
      window.Storage.setAuthed(false);
      navigate("/", true);
    });

    const grid = document.querySelector("[data-audit-grid]");
    const empty = document.querySelector("[data-empty]");
    const audits = window.Storage.listAudits();
    if (!audits.length) {
      empty.hidden = false;
      empty.querySelector('[data-action="new-audit"]').addEventListener("click", function () { navigate("/new"); });
      return;
    }
    empty.hidden = true;

    const cardTpl = document.getElementById("tpl-card");
    audits.forEach(function (a) {
      const node = cardTpl.content.cloneNode(true);
      const card = node.querySelector(".audit-card");
      card.style.setProperty("--card-primary", (a.colors && a.colors.primary) || "#00a651");
      card.style.setProperty("--card-accent", (a.colors && a.colors.accent) || "#ffd200");
      const logoImg = node.querySelector(".audit-card-logo img");
      if (a.logoDataUrl) logoImg.src = a.logoDataUrl;
      else { logoImg.remove(); node.querySelector(".audit-card-logo").textContent = (a.brandName || "?").slice(0, 1).toUpperCase(); }
      node.querySelector("[data-score]").textContent = a.overall;
      node.querySelector("[data-name]").textContent = a.brandName;
      node.querySelector("[data-url]").textContent = a.url;
      node.querySelector("[data-date]").textContent = window.Report.formatDate(a.createdAt);
      const grade = node.querySelector("[data-grade]");
      grade.textContent = "Grade " + (a.grade ? a.grade.letter : "—");
      grade.classList.add((a.grade && a.grade.className) || "b");
      function open() { navigate("/" + encodeURIComponent(a.slug)); }
      card.addEventListener("click", open);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
      grid.appendChild(node);
    });
  }

  // NEW AUDIT
  function renderNewAudit() {
    mount("tpl-new-audit");
    document.querySelectorAll('[data-action="back"]').forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); navigate("/"); });
    });
    const form = document.querySelector(".audit-form");
    const logoInput = form.querySelector('input[name="logo"]');
    const preview = form.querySelector("[data-logo-preview]");
    let logoDataUrl = "";

    logoInput.addEventListener("change", function () {
      const file = logoInput.files && logoInput.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast("Logo exceeds 2MB limit."); logoInput.value = ""; return; }
      const reader = new FileReader();
      reader.onload = function () {
        logoDataUrl = String(reader.result || "");
        preview.innerHTML = "";
        const img = document.createElement("img");
        img.src = logoDataUrl; img.alt = "Brand logo preview";
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.brandName || !data.url) { toast("Brand name and URL are required."); return; }

      const id = "audit_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
      const slug = window.Storage.uniqueSlug(data.brandName);

      // Switch to running view
      mount("tpl-running");
      const steps = document.querySelectorAll("[data-progress] li");
      function stepTo(name) {
        let matched = false;
        steps.forEach(function (li) {
          const k = li.getAttribute("data-step");
          if (k === name) { li.classList.add("active"); li.classList.remove("done"); matched = true; }
          else if (!matched) { li.classList.add("done"); li.classList.remove("active"); }
        });
      }

      try {
        const audit = await window.Audit.runAudit({
          brandName: data.brandName,
          url: data.url,
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
          accentColor: data.accentColor,
          contactEmail: data.contactEmail,
          notes: data.notes,
          logoDataUrl: logoDataUrl,
        }, stepTo);
        audit.id = id;
        audit.slug = slug;
        window.Storage.saveAudit(audit);
        steps.forEach(function (li) { li.classList.add("done"); li.classList.remove("active"); });
        setTimeout(function () { navigate("/" + encodeURIComponent(slug)); }, 400);
      } catch (err) {
        console.error("[5DM SEO] Audit failed:", err);
        const msg = (err && err.message) ? err.message : "Audit failed.";
        toast(msg);
        // Render an actionable error screen so the user isn't dumped back to a blank form.
        const app = document.getElementById("app");
        app.innerHTML =
          '<section class="wizard"><div class="wizard-card">' +
          '<h2>Audit couldn\'t complete</h2>' +
          '<p class="muted">' + escapeHtml(msg) + '</p>' +
          '<p class="muted">This usually means the target site is blocking automated access, all public CORS proxies are rate-limited right now, or the URL isn\'t publicly reachable. Try again in a minute, or switch to a different URL.</p>' +
          '<div class="wizard-actions">' +
          '<button type="button" class="btn btn-ghost" data-action="back-home">Back to dashboard</button>' +
          '<button type="button" class="btn btn-primary" data-action="retry">Try again</button>' +
          '</div></div></section>';
        app.querySelector('[data-action="back-home"]').addEventListener("click", function () { navigate("/"); });
        app.querySelector('[data-action="retry"]').addEventListener("click", function () { navigate("/new", true); });
      }
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // REPORT
  function renderReportRoute(slug) {
    const audit = window.Storage.getBySlug(slug);
    if (!audit) return renderNotFound();

    mount("tpl-report");
    const reportRoot = document.querySelector("[data-report]");
    const doc = document.getElementById("report-doc");
    window.Report.renderReport(doc, audit);

    document.querySelectorAll('[data-action="back"]').forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); navigate("/"); });
    });

    document.querySelector('[data-action="copy-link"]').addEventListener("click", function () {
      const url = window.location.origin + (BASE_PATH || "") + "/" + encodeURIComponent(audit.slug);
      navigator.clipboard.writeText(url).then(function () { toast("Link copied: " + url); });
    });

    document.querySelector('[data-action="download-pdf"]').addEventListener("click", function () {
      downloadPdf(audit);
    });
  }

  function downloadPdf(audit) {
    if (!window.html2pdf) { toast("PDF engine is still loading. Try again in a second."); return; }
    const source = document.getElementById("report-doc");
    document.body.classList.add("pdf-mode");
    const filename = (audit.slug || "seo-audit") + "-seo-audit.pdf";
    const opts = {
      margin: 0,
      filename: filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false },
      jsPDF: { unit: "px", format: [source.scrollWidth, source.scrollHeight], orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };
    window.html2pdf().set(opts).from(source).save().then(function () {
      document.body.classList.remove("pdf-mode");
      toast("Audit downloaded.");
    }).catch(function () {
      document.body.classList.remove("pdf-mode");
      toast("PDF export failed. Please try again.");
    });
  }

  function renderNotFound() {
    mount("tpl-notfound");
    document.querySelectorAll('[data-action="back"]').forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); navigate("/", true); });
    });
  }

  window.addEventListener("popstate", render);
  document.addEventListener("DOMContentLoaded", function () {
    // Handle SPA fallback: when a static host rewrites to /SEO/index.html but preserves
    // the intended path via a ?redirect=... query (used by _redirects / 404.html).
    const params = new URLSearchParams(window.location.search);
    const r = params.get("redirect");
    if (r) {
      window.history.replaceState({}, "", r);
    }
    render();
  });
})();

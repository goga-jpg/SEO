/* 5DM SEO Audit Platform — main app, routing, views */
(function () {
  "use strict";

  const PASSWORD = "5dmseo"; // platform password — case-insensitive compare
  const BASE_PATH = detectBasePath();

  function detectBasePath() {
    const p = window.location.pathname;
    const idx = p.toLowerCase().indexOf("/seo");
    if (idx !== -1) return p.slice(0, idx + 4); // preserve original casing
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
    t._timer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function render() {
    const route = routeFromLocation();

    // Platform-wide password gate for the dashboard / wizard.
    // Individual report routes have their own gate (per-audit password).
    if (route.name === "home" || route.name === "new") {
      if (!window.Storage.isAuthed()) return renderPlatformAuth();
    }

    if (route.name === "home") return renderDashboard();
    if (route.name === "new") return renderNewAudit();
    if (route.name === "report") return renderReportRoute(route.slug);
    return renderNotFound();
  }

  // PLATFORM AUTH
  function renderPlatformAuth() {
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
      const pwCode = node.querySelector("[data-password]");
      if (pwCode) pwCode.textContent = a.password || "—";
      const pwCopy = node.querySelector('[data-action="copy-pw"]');
      if (pwCopy) {
        pwCopy.addEventListener("click", function (e) {
          e.stopPropagation();
          navigator.clipboard.writeText(a.password || "").then(function () { toast("Password copied."); });
        });
      }
      function open(e) {
        if (e && e.target && e.target.closest && e.target.closest('[data-action="copy-pw"]')) return;
        navigate("/" + encodeURIComponent(a.slug));
      }
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
    const pwInput = form.querySelector('input[name="auditPassword"]');
    const regenBtn = form.querySelector('[data-action="regen-pw"]');
    let logoDataUrl = "";

    pwInput.value = window.Audit.generatePassword((form.querySelector('input[name="brandName"]') || {}).value || "brand");
    form.querySelector('input[name="brandName"]').addEventListener("input", function (e) {
      if (!pwInput.dataset.customized) pwInput.value = window.Audit.generatePassword(e.target.value);
    });
    pwInput.addEventListener("input", function () { pwInput.dataset.customized = "1"; });
    regenBtn.addEventListener("click", function () {
      const brand = (form.querySelector('input[name="brandName"]') || {}).value || "brand";
      pwInput.value = window.Audit.generatePassword(brand);
      delete pwInput.dataset.customized;
      pwInput.focus();
      pwInput.select();
    });

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
          password: (data.auditPassword || "").trim() || undefined,
        }, stepTo);
        audit.id = id;
        audit.slug = slug;
        window.Storage.saveAudit(audit);
        // Remember the platform-auth granted access for this specific audit too.
        window.Storage.grantAuditAccess(audit.slug);
        sessionStorage.setItem("5dm_just_created", audit.slug);
        steps.forEach(function (li) { li.classList.add("done"); li.classList.remove("active"); });
        setTimeout(function () { navigate("/" + encodeURIComponent(slug)); }, 400);
      } catch (err) {
        console.error("[5DM SEO] Audit failed:", err);
        const msg = (err && err.message) ? err.message : "Audit failed.";
        toast(msg);
        const app = document.getElementById("app");
        app.innerHTML =
          '<section class="wizard"><div class="wizard-card">' +
          '<h2>Audit couldn\'t complete</h2>' +
          '<p class="muted">' + escapeHtml(msg) + '</p>' +
          '<p class="muted">This usually means the target site is blocking automated access, all public CORS proxies are rate-limited, or the URL isn\'t publicly reachable. Try again in a minute, or switch URLs.</p>' +
          '<div class="wizard-actions">' +
          '<button type="button" class="btn btn-ghost" data-action="back-home">Back to dashboard</button>' +
          '<button type="button" class="btn btn-primary" data-action="retry">Try again</button>' +
          '</div></div></section>';
        app.querySelector('[data-action="back-home"]').addEventListener("click", function () { navigate("/"); });
        app.querySelector('[data-action="retry"]').addEventListener("click", function () { navigate("/new", true); });
      }
    });
  }

  // PER-AUDIT GATE
  function renderAuditLock(audit) {
    mount("tpl-audit-lock");
    document.querySelector("[data-lock-title]").textContent = audit.brandName + " — SEO Audit";
    const form = document.querySelector(".auth-form");
    const err = document.querySelector(".auth-error");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const val = (form.querySelector('input[name="password"]').value || "").trim().toLowerCase();
      const expected = (audit.password || "").toLowerCase();
      if (val && val === expected) {
        window.Storage.grantAuditAccess(audit.slug);
        err.hidden = true;
        render();
      } else {
        err.hidden = false;
      }
    });
  }

  // REPORT
  function renderReportRoute(slug) {
    const audit = window.Storage.getBySlug(slug);
    if (!audit) return renderNotFound();

    const hasPlatformAuth = window.Storage.isAuthed();
    const hasAuditAccess = window.Storage.hasAuditAccess(audit.slug);
    if (!hasPlatformAuth && !hasAuditAccess) {
      return renderAuditLock(audit);
    }

    mount("tpl-report");
    const doc = document.getElementById("report-doc");
    const shareUrl = window.location.origin + (BASE_PATH || "") + "/" + encodeURIComponent(audit.slug);

    // View mode: basic / granular
    let mode = "basic";
    const renderOpts = function () {
      return { mode: mode, isPlatform: hasPlatformAuth, shareUrl: shareUrl };
    };
    const toggleButtons = document.querySelectorAll(".view-toggle button");
    toggleButtons.forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.getAttribute("data-mode");
        toggleButtons.forEach(function (x) {
          const active = x === b;
          x.classList.toggle("active", active);
          x.setAttribute("aria-selected", active ? "true" : "false");
        });
        doc.setAttribute("data-mode", mode);
        window.Report.renderReport(doc, audit, renderOpts());
      });
    });

    window.Report.renderReport(doc, audit, renderOpts());

    document.querySelectorAll('[data-action="back"]').forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); navigate("/"); });
    });

    document.querySelector('[data-action="copy-link"]').addEventListener("click", function () {
      const url = window.location.origin + (BASE_PATH || "") + "/" + encodeURIComponent(audit.slug);
      navigator.clipboard.writeText(url).then(function () { toast("Link copied: " + url); });
    });

    document.querySelector('[data-action="download-pdf"]').addEventListener("click", function () {
      downloadPdf(audit, mode);
    });

    // Show share bar when an audit was just created.
    const justCreated = sessionStorage.getItem("5dm_just_created");
    if (justCreated === audit.slug) {
      sessionStorage.removeItem("5dm_just_created");
      mountShareBar(audit);
    }
  }

  function mountShareBar(audit) {
    const bar = document.getElementById("tpl-share-bar").content.cloneNode(true);
    document.body.appendChild(bar);
    const el = document.querySelector(".share-bar");
    const url = window.location.origin + (BASE_PATH || "") + "/" + encodeURIComponent(audit.slug);
    el.querySelector("[data-share-link]").textContent = url;
    el.querySelector("[data-share-pw]").textContent = "Password: " + audit.password;
    el.querySelector('[data-action="copy-link"]').addEventListener("click", function () {
      navigator.clipboard.writeText(url).then(function () { toast("Link copied."); });
    });
    el.querySelector('[data-action="copy-pw"]').addEventListener("click", function () {
      navigator.clipboard.writeText(audit.password).then(function () { toast("Password copied."); });
    });
    el.querySelector('[data-action="dismiss-share"]').addEventListener("click", function () { el.remove(); });
  }

  function downloadPdf(audit, mode) {
    if (!window.html2pdf) { toast("PDF engine is still loading. Try again in a second."); return; }
    const source = document.getElementById("report-doc");
    document.body.classList.add("pdf-mode");
    const suffix = mode === "granular" ? "-granular" : "";
    const filename = (audit.slug || "seo-audit") + "-seo-audit" + suffix + ".pdf";
    // A4 @ 96dpi is 794 x 1123 px. Force the report to that content width so
    // html2canvas rasterises it at the exact proportions jsPDF expects,
    // eliminating the "giant top margin" that happens when source is wider
    // than the A4 page and gets down-scaled.
    const opts = {
      margin: [10, 10, 12, 10],
      filename: filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 794,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
      pagebreak: {
        mode: ["avoid-all", "css", "legacy"],
        avoid: [
          ".finding",
          ".pillar",
          ".stat",
          ".method-steps > li",
          ".recommendations li",
          ".section-intro",
          ".cover",
          ".credentials",
          ".report-footer",
        ],
      },
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
    const params = new URLSearchParams(window.location.search);
    const r = params.get("redirect");
    if (r) window.history.replaceState({}, "", r);
    render();
  });
})();

/* 5DM SEO Audit Platform — report renderer */
(function () {
  "use strict";

  function formatDate(ts) {
    try {
      return new Date(ts).toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric",
      });
    } catch (_) { return ""; }
  }

  function setBrandColors(container, colors) {
    const c = colors || {};
    container.style.setProperty("--brand-primary", c.primary || "#00a651");
    container.style.setProperty("--brand-secondary", c.secondary || "#111111");
    container.style.setProperty("--brand-accent", c.accent || "#ffd200");
  }

  function renderFindings(container, findings) {
    container.innerHTML = "";
    if (!findings || !findings.length) {
      const div = document.createElement("div");
      div.className = "finding info";
      div.innerHTML = '<div class="f-icon">i</div><div class="f-body"><h4>No data</h4><p>No findings were produced for this section.</p></div><span class="f-tag">Info</span>';
      container.appendChild(div);
      return;
    }
    findings.forEach(function (f) {
      const el = document.createElement("div");
      el.className = "finding " + (f.status || "info");
      const icon = f.status === "pass" ? "✓" : f.status === "fail" ? "!" : f.status === "warn" ? "!" : "i";
      el.innerHTML =
        '<div class="f-icon">' + icon + "</div>" +
        '<div class="f-body"><h4></h4><p></p>' + (f.code ? '<code></code>' : '') + "</div>" +
        '<span class="f-tag"></span>';
      el.querySelector("h4").textContent = f.title || "";
      el.querySelector("p").textContent = f.body || "";
      if (f.code) el.querySelector("code").textContent = f.code;
      el.querySelector(".f-tag").textContent = f.tag || f.status || "";
      container.appendChild(el);
    });
  }

  function renderPillars(container, pillars) {
    container.innerHTML = "";
    const labels = {
      onpage: "On-Page",
      technical: "Technical",
      performance: "Performance",
      accessibility: "Accessibility",
      content: "Content",
      social: "Social",
      security: "Security",
    };
    Object.keys(pillars).forEach(function (k) {
      const score = pillars[k] || 0;
      const el = document.createElement("div");
      el.className = "pillar";
      el.innerHTML =
        "<h4>" + labels[k] + "</h4>" +
        '<div class="p-score"><strong>' + score + "</strong><small>/100</small></div>" +
        '<div class="bar"><i style="width: ' + score + '%"></i></div>';
      container.appendChild(el);
    });
  }

  function renderRecommendations(container, recs) {
    container.innerHTML = "";
    if (!recs || !recs.length) {
      const li = document.createElement("li");
      li.innerHTML = "<strong>No critical issues detected.</strong><p>Continue monitoring your site and iterate on content, performance, and technical SEO.</p>";
      container.appendChild(li);
      return;
    }
    recs.forEach(function (r) {
      const li = document.createElement("li");
      li.innerHTML = "<strong></strong><p></p>";
      li.querySelector("strong").textContent = (r.priority ? "[" + r.priority + "] " : "") + r.title;
      li.querySelector("p").textContent = r.body;
      container.appendChild(li);
    });
  }

  function renderReport(root, audit) {
    const report = root;
    setBrandColors(report, audit.colors);
    const logoEl = report.querySelector("[data-brand-logo]");
    if (audit.logoDataUrl) { logoEl.src = audit.logoDataUrl; logoEl.style.display = ""; }
    else { logoEl.style.display = "none"; }
    report.querySelector("[data-brand-name]").textContent = audit.brandName;
    report.querySelector("[data-brand-url]").textContent = audit.url;

    const scoreEl = report.querySelector("[data-score]");
    scoreEl.textContent = audit.overall;
    report.querySelector("[data-date]").textContent = formatDate(audit.createdAt);
    const grade = audit.grade || { letter: "—" };
    report.querySelector("[data-grade]").textContent = grade.letter;

    const ring = report.querySelector("[data-ring-fg]");
    if (ring) {
      const circumference = 2 * Math.PI * 52;
      ring.style.strokeDasharray = circumference;
      ring.style.strokeDashoffset = circumference * (1 - (audit.overall || 0) / 100);
    }

    report.querySelector("[data-summary]").textContent = audit.summary || "";
    renderPillars(report.querySelector("[data-pillars]"), audit.pillars || {});

    const sections = ["onpage", "technical", "performance", "accessibility", "content", "social", "security"];
    sections.forEach(function (s) {
      const c = report.querySelector('[data-findings="' + s + '"]');
      if (c) renderFindings(c, (audit.findings && audit.findings[s]) || []);
    });
    renderRecommendations(report.querySelector("[data-recommendations]"), audit.recommendations || []);
  }

  window.Report = { renderReport: renderReport, formatDate: formatDate };
})();

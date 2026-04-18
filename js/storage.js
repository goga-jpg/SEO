/* 5DM SEO Audit Platform — storage layer */
(function () {
  "use strict";

  const KEY_AUDITS = "5dm_seo_audits_v1";
  const KEY_AUTH = "5dm_seo_auth_v1";

  function slugify(name) {
    return String(name || "")
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
  }

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY_AUDITS);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch (_) {
      return {};
    }
  }

  function writeAll(map) {
    localStorage.setItem(KEY_AUDITS, JSON.stringify(map));
  }

  function listAudits() {
    const map = readAll();
    return Object.values(map).sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function getBySlug(slug) {
    if (!slug) return null;
    const map = readAll();
    const needle = String(slug).toLowerCase();
    const hit = Object.values(map).find(function (a) {
      return (a.slug || "").toLowerCase() === needle;
    });
    if (hit && !hit.password) {
      // Back-fill a password for legacy audits so the gate works.
      hit.password = String(hit.slug).toLowerCase() + "-access";
      map[hit.id] = hit;
      writeAll(map);
    }
    return hit || null;
  }

  function uniqueSlug(baseName) {
    const base = slugify(baseName) || "brand";
    const map = readAll();
    const existing = new Set(
      Object.values(map).map(function (a) {
        return (a.slug || "").toLowerCase();
      })
    );
    if (!existing.has(base.toLowerCase())) return base;
    let i = 2;
    while (existing.has((base + "-" + i).toLowerCase())) i++;
    return base + "-" + i;
  }

  function saveAudit(audit) {
    const map = readAll();
    map[audit.id] = audit;
    writeAll(map);
    return audit;
  }

  function deleteAudit(id) {
    const map = readAll();
    delete map[id];
    writeAll(map);
  }

  // AUTH
  function setAuthed(flag) {
    if (flag) sessionStorage.setItem(KEY_AUTH, "1");
    else sessionStorage.removeItem(KEY_AUTH);
  }
  function isAuthed() {
    return sessionStorage.getItem(KEY_AUTH) === "1";
  }

  const KEY_AUDIT_GRANT_PREFIX = "5dm_audit_grant_";
  function grantAuditAccess(slug) {
    if (!slug) return;
    sessionStorage.setItem(KEY_AUDIT_GRANT_PREFIX + String(slug).toLowerCase(), "1");
  }
  function hasAuditAccess(slug) {
    if (!slug) return false;
    return sessionStorage.getItem(KEY_AUDIT_GRANT_PREFIX + String(slug).toLowerCase()) === "1";
  }

  window.Storage = {
    slugify: slugify,
    uniqueSlug: uniqueSlug,
    listAudits: listAudits,
    getBySlug: getBySlug,
    saveAudit: saveAudit,
    deleteAudit: deleteAudit,
    setAuthed: setAuthed,
    isAuthed: isAuthed,
    grantAuditAccess: grantAuditAccess,
    hasAuditAccess: hasAuditAccess,
  };
})();

#!/usr/bin/env node
/* Zero-dependency static server with SPA fallback for the 5DM SEO Audit Platform.
 * Serves the platform under /SEO/ so the pretty URL /SEO/BrandName resolves locally.
 * Usage:  node server.js [port]
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const ROOT = __dirname;
const BASE = "/SEO";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const resolved = path.normalize(path.join(root, decoded));
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, function (err, data) {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(function (req, res) {
  const reqUrl = new URL(req.url, "http://localhost");
  let pathname = reqUrl.pathname;

  // Strip the /SEO prefix if present so we can resolve files from ROOT.
  if (pathname === BASE) pathname = "/";
  else if (pathname.startsWith(BASE + "/")) pathname = pathname.slice(BASE.length);

  if (pathname === "/") return sendFile(res, path.join(ROOT, "index.html"));

  const filePath = safeJoin(ROOT, pathname);
  if (!filePath) { res.writeHead(400); return res.end("Bad request"); }

  fs.stat(filePath, function (err, stat) {
    if (!err && stat.isFile()) return sendFile(res, filePath);
    // SPA fallback
    sendFile(res, path.join(ROOT, "index.html"));
  });
});

server.listen(PORT, function () {
  console.log("5DM SEO Audit Platform running at http://localhost:" + PORT + BASE + "/");
});

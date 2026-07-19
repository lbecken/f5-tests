#!/usr/bin/env node
/*
 * Tiny zero-dependency server for the Bookmark Manager.
 *
 *   node server.js          → http://localhost:3000
 *   PORT=8080 node server.js
 *
 * Serves the static app files and persists all bookmark data to a plain
 * JSON file next to this script (bookmarks.json by default, override with
 * BOOKMARKS_FILE=/path/to/file.json). Every write first copies the current
 * file to bookmarks.backup.json, then writes atomically (tmp + rename).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = +(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA = process.env.BOOKMARKS_FILE || path.join(ROOT, "bookmarks.json");
const BACKUP = DATA.replace(/\.json$/, "") + ".backup.json";
const MAX_BODY = 200 * 1024 * 1024; // favicons are inlined data: URIs, allow big payloads

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/bookmarks") return api(req, res);

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405); res.end(); return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : buf);
  });
});

function api(req, res) {
  if (req.method === "GET") {
    fs.readFile(DATA, (err, buf) => {
      if (err) { res.writeHead(204); res.end(); return; } // no data yet
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(buf);
    });
    return;
  }
  if (req.method === "PUT") {
    const chunks = [];
    let size = 0, aborted = false;
    req.on("data", c => {
      size += c.length;
      if (size > MAX_BODY) { aborted = true; res.writeHead(413); res.end(); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => {
      if (aborted) return;
      let obj;
      try {
        obj = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!obj || typeof obj !== "object" || !obj.root || obj.root.type !== "folder") throw new Error();
      } catch { res.writeHead(400); res.end("Invalid bookmark data"); return; }
      try {
        if (fs.existsSync(DATA)) fs.copyFileSync(DATA, BACKUP);
        const tmp = DATA + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
        fs.renameSync(tmp, DATA);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
      } catch (e) {
        res.writeHead(500); res.end("Write failed: " + e.message);
      }
    });
    return;
  }
  res.writeHead(405); res.end();
}

server.listen(PORT, () => {
  console.log(`Bookmark Manager:   http://localhost:${PORT}`);
  console.log(`Bookmarks file:     ${DATA}`);
  console.log(`Backup file:        ${BACKUP}`);
});

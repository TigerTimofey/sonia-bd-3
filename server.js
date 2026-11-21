// Local dev server: static files + /api/* (same handlers Vercel runs). Usage: npm run dev
const http = require("http");
const fs = require("fs");
const path = require("path");

// minimal .env loader
try {
  for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const API = { gifts: require("./api/gifts"), reserve: require("./api/reserve"), cancel: require("./api/cancel") };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css",
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ics": "text/calendar; charset=utf-8" };
const BLOCKED = /^\/(api|data|node_modules|\.env|\.git|\.vercel|server\.js|package)/;

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://local");
  const api = pathname.match(/^\/api\/([a-z]+)\/?$/);
  if (api && API[api[1]]) return API[api[1]](req, res);

  let file;
  if (pathname.startsWith("/_outbox/")) file = path.join(ROOT, ".outbox", path.basename(pathname));
  else if (BLOCKED.test(pathname)) { res.statusCode = 404; return res.end("Not found"); }
  else file = path.join(ROOT, decodeURIComponent(pathname === "/" ? "/index.html" : pathname));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }

  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
    res.end(data);
  });
}).listen(PORT, () => {
  const mail = require("./api/_lib/mail").hasSmtp ? "SMTP" : "dev outbox (.outbox/)";
  console.log(`▶ http://localhost:${PORT}  · mail: ${mail}`);
});

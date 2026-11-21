const crypto = require("crypto");
const GIFTS = require("../../gifts.json");

const LANGS = ["ru", "et", "en"];
const pickLang = l => (LANGS.includes(l) ? l : "ru");

function query(req) {
  return Object.fromEntries(new URL(req.url, "http://local").searchParams);
}

// Works with Vercel (pre-parsed req.body) and plain Node (raw stream).
async function body(req) {
  let raw = req.body;
  if (raw === undefined) {
    raw = await new Promise((ok, fail) => {
      let s = "";
      req.on("data", c => { s += c; if (s.length > 1e5) req.destroy(); });
      req.on("end", () => ok(s));
      req.on("error", fail);
    });
  }
  if (raw && typeof raw === "object" && !Buffer.isBuffer(raw)) return raw;
  raw = String(raw || "");
  const type = req.headers["content-type"] || "";
  if (type.includes("application/json")) { try { return JSON.parse(raw); } catch { return {}; } }
  return Object.fromEntries(new URLSearchParams(raw));
}

function json(res, code, data) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function html(res, code, markup) {
  res.statusCode = code;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(markup);
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const findGift = id => GIFTS.find(g => g.id === id);
const giftName = (g, lang) => (typeof g.name === "string" ? g.name : g.name[lang] || g.name.ru || g.name.en);
const newToken = () => crypto.randomBytes(18).toString("hex");
function sameToken(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

module.exports = { GIFTS, pickLang, query, body, json, html, siteUrl, esc, findGift, giftName, newToken, sameToken };

// Storage: Upstash Redis on Vercel, a local JSON file in dev. Values are strings.
const fs = require("fs");
const path = require("path");

const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(R_URL && R_TOK);
const FILE = path.join(process.cwd(), "data", "db.json");

const KEYS = {
  reservations: "sonia-bd-3:reservations", // giftId -> {name,email,token,lang,at}
  gifts: "sonia-bd-3:gifts",               // giftId -> gift JSON
  images: "sonia-bd-3:images",             // giftId -> data:image/...;base64,...
  meta: "sonia-bd-3:meta",
};

async function redis(cmd) {
  const r = await fetch(R_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${R_TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

const readDb = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } };
const writeDb = d => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); };
const fileHash = (d, key) => (d[key] = d[key] || {});

const h = {
  async getall(key) {
    if (!useRedis) return { ...(readDb()[key] || {}) };
    const arr = (await redis(["HGETALL", key])) || [];
    const out = {};
    for (let i = 0; i < arr.length; i += 2) out[arr[i]] = arr[i + 1];
    return out;
  },
  async get(key, field) {
    if (!useRedis) return (readDb()[key] || {})[field] ?? null;
    return redis(["HGET", key, field]);
  },
  async set(key, field, value) {
    if (!useRedis) { const d = readDb(); fileHash(d, key)[field] = value; writeDb(d); return; }
    await redis(["HSET", key, field, value]);
  },
  // true if the field was created, false if it already existed (atomic on Redis)
  async setnx(key, field, value) {
    if (!useRedis) {
      const d = readDb(), hash = fileHash(d, key);
      if (field in hash) return false;
      hash[field] = value; writeDb(d); return true;
    }
    return (await redis(["HSETNX", key, field, value])) === 1;
  },
  async del(key, field) {
    if (!useRedis) { const d = readDb(); delete fileHash(d, key)[field]; writeDb(d); return; }
    await redis(["HDEL", key, field]);
  },
};

// Counter with expiry (login attempts). In-memory in dev.
const mem = new Map();
async function hit(key, ttlSec) {
  if (!useRedis) {
    const now = Date.now(), e = mem.get(key);
    const v = e && e.exp > now ? e.v + 1 : 1;
    mem.set(key, { v, exp: e && e.exp > now ? e.exp : now + ttlSec * 1000 });
    return v;
  }
  const v = await redis(["INCR", key]);
  if (v === 1) await redis(["EXPIRE", key, String(ttlSec)]);
  return v;
}
async function peek(key) {
  if (!useRedis) { const e = mem.get(key); return e && e.exp > Date.now() ? e.v : 0; }
  return Number(await redis(["GET", key])) || 0;
}

const parseAll = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, JSON.parse(v)]));

module.exports = {
  KEYS, h, useRedis, hit, peek,
  reservations: {
    all: async () => parseAll(await h.getall(KEYS.reservations)),
    get: async id => { const v = await h.get(KEYS.reservations, id); return v ? JSON.parse(v) : null; },
    reserve: (id, rec) => h.setnx(KEYS.reservations, id, JSON.stringify(rec)),
    remove: id => h.del(KEYS.reservations, id),
  },
};

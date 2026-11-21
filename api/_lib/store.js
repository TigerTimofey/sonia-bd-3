// Reservation storage: Upstash Redis (on Vercel) or a local JSON file (dev).
const fs = require("fs");
const path = require("path");

const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "sonia-bd-3:reservations";
const FILE = path.join(process.cwd(), "data", "reservations.json");
const useRedis = Boolean(R_URL && R_TOK);

if (!useRedis && process.env.VERCEL) {
  console.warn("No Redis configured: reservations cannot be stored on Vercel.");
}

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

const readFile = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } };
const writeFile = d => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); };

module.exports = {
  async all() {
    if (!useRedis) return readFile();
    const arr = (await redis(["HGETALL", KEY])) || [];
    const out = {};
    for (let i = 0; i < arr.length; i += 2) out[arr[i]] = JSON.parse(arr[i + 1]);
    return out;
  },
  async get(id) {
    if (!useRedis) return readFile()[id] || null;
    const v = await redis(["HGET", KEY, id]);
    return v ? JSON.parse(v) : null;
  },
  // Returns true if reserved, false if someone already holds it (atomic on Redis).
  async reserve(id, rec) {
    if (!useRedis) {
      const d = readFile();
      if (d[id]) return false;
      d[id] = rec; writeFile(d); return true;
    }
    return (await redis(["HSETNX", KEY, id, JSON.stringify(rec)])) === 1;
  },
  async remove(id) {
    if (!useRedis) { const d = readFile(); delete d[id]; writeFile(d); return; }
    await redis(["HDEL", KEY, id]);
  },
};

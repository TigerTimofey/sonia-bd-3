// Copy the gift list (with photos) from the live site into the local dev store (data/db.json).
// Usage: npm run pull   (needs ADMIN_PASSWORD in .env; SITE_URL optional)
const fs = require("fs");
const path = require("path");

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SITE = (process.argv[2] || "https://sonia-party.vercel.app").replace(/\/$/, "");
const FILE = path.join(__dirname, "..", "data", "db.json");
const K = { gifts: "sonia-bd-3:gifts", images: "sonia-bd-3:images", meta: "sonia-bd-3:meta" };

(async () => {
  const r = await fetch(SITE + "/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.ADMIN_PASSWORD },
    body: JSON.stringify({ action: "list" }),
  });
  if (!r.ok) throw new Error("admin list failed: HTTP " + r.status);
  const { gifts } = await r.json();

  let db = {};
  try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}
  db[K.gifts] = {}; db[K.images] = {}; db[K.meta] = { ...(db[K.meta] || {}), seeded: "1" };

  for (const [order, g] of gifts.entries()) {
    const rec = { id: g.id, name: g.name, url: g.url, price: g.price, order, type: g.type, amounts: g.amounts };
    if (g.image && g.image.startsWith("/api/img")) {
      const img = await fetch(SITE + g.image);
      if (img.ok) {
        const type = img.headers.get("content-type") || "image/webp";
        db[K.images][g.id] = `data:${type};base64,` + Buffer.from(await img.arrayBuffer()).toString("base64");
        rec.imageV = new URL(g.image, SITE).searchParams.get("v") || "1";
      }
    }
    db[K.gifts][g.id] = JSON.stringify(rec);
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
  console.log(`Pulled ${gifts.length} gifts (${Object.keys(db[K.images]).length} photos) from ${SITE}`);
})().catch(e => { console.error(e.message); process.exit(1); });

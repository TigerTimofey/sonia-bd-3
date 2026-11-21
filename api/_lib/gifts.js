// Gift catalogue stored in Redis/file. First use seeds it from gifts.json.
const crypto = require("crypto");
const { h, KEYS } = require("./store");
const SEED = require("../../gifts.json");

async function ensureSeeded() {
  if (!(await h.setnx(KEYS.meta, "seeded", "1"))) return;
  let order = 0;
  for (const g of SEED) await h.set(KEYS.gifts, g.id, JSON.stringify({ ...g, order: order++, createdAt: new Date().toISOString() }));
}

async function list() {
  await ensureSeeded();
  const all = await h.getall(KEYS.gifts);
  return Object.values(all).map(v => JSON.parse(v)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function get(id) {
  if (typeof id !== "string" || !id) return null;
  await ensureSeeded();
  const v = await h.get(KEYS.gifts, id);
  return v ? JSON.parse(v) : null;
}

const imageUrl = g => (g.imageV ? `/api/img?id=${encodeURIComponent(g.id)}&v=${g.imageV}` : g.image || "");
const toPublic = g => ({ id: g.id, name: g.name, url: g.url || "", price: g.price || "", image: imageUrl(g) });

const clean = (v, max) => String(v ?? "").trim().slice(0, max);
const IMG_RE = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMG = 750_000; // chars of base64 (~550 KB) — fits Upstash's 1 MB request limit

// Create or update. Returns {gift} or {error}.
async function save(input) {
  const name = { ru: clean(input?.name?.ru, 100), et: clean(input?.name?.et, 100), en: clean(input?.name?.en, 100) };
  if (!name.ru && !name.et && !name.en) return { error: "name" };
  const url = clean(input.url, 600);
  if (url && !/^https?:\/\/\S+$/i.test(url)) return { error: "url" };
  const price = clean(input.price, 30);

  let gift = input.id ? await get(input.id) : null;
  if (input.id && !gift) return { error: "notfound" };
  if (!gift) {
    const all = await list();
    gift = { id: crypto.randomBytes(5).toString("hex"), order: all.reduce((m, g) => Math.max(m, g.order ?? 0), -1) + 1, createdAt: new Date().toISOString() };
  }
  Object.assign(gift, { name, url, price });

  if (input.image) {
    if (typeof input.image !== "string" || !IMG_RE.test(input.image)) return { error: "image" };
    if (input.image.length > MAX_IMG) return { error: "imagesize" };
    await h.set(KEYS.images, gift.id, input.image);
    gift.imageV = Date.now().toString(36);
    delete gift.image;
  } else if (input.removeImage) {
    await h.del(KEYS.images, gift.id);
    delete gift.imageV; delete gift.image;
  }
  await h.set(KEYS.gifts, gift.id, JSON.stringify(gift));
  return { gift };
}

async function remove(id) {
  await h.del(KEYS.gifts, id);
  await h.del(KEYS.images, id);
  await h.del(KEYS.reservations, id);
}

async function move(id, dir) {
  const all = await list();
  const i = all.findIndex(g => g.id === id), j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  for (let k = 0; k < all.length; k++) if (all[k].order !== k) { all[k].order = k; await h.set(KEYS.gifts, all[k].id, JSON.stringify(all[k])); }
}

const image = id => h.get(KEYS.images, id);

module.exports = { list, get, save, remove, move, image, toPublic };

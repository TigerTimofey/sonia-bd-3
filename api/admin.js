// POST /api/admin  (Authorization: Bearer <ADMIN_PASSWORD>)
// body {action: "list"|"save"|"delete"|"unreserve"|"move"|"mail", ...}
const store = require("./_lib/store");
const gifts = require("./_lib/gifts");
const { notifyOwner, notifyOwnerSafe } = require("./_lib/notify");
const u = require("./_lib/util");

const wait = ms => new Promise(r => setTimeout(r, ms));

module.exports = async (req, res) => {
  if (req.method !== "POST") return u.json(res, 405, { error: "method" });
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return u.json(res, 500, { error: "noconfig" });
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  const lockKey = "sonia-bd-3:login-fail:" + ip, MAX_FAILS = 10, LOCK_SEC = 15 * 60;
  try { if ((await store.peek(lockKey)) >= MAX_FAILS) return u.json(res, 429, { error: "locked" }); } catch (e) { console.error(e); }
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!u.sameToken(given, pass)) {
    try { await store.hit(lockKey, LOCK_SEC); } catch (e) { console.error(e); }
    await wait(800);
    return u.json(res, 401, { error: "auth" });
  }

  const b = await u.body(req, 3e6);
  try {
    switch (b.action) {
      case "list": {
        const [list, resv] = await Promise.all([gifts.list(), store.reservations.all()]);
        return u.json(res, 200, {
          gifts: list.map(g => {
            const r = resv[g.id];
            return { ...gifts.toPublic(g), reservation: r ? { name: r.name, email: r.email, at: r.at, lang: r.lang } : null };
          }),
        });
      }
      case "save": {
        const r = await gifts.save(b.gift || {});
        return r.error ? u.json(res, 400, r) : u.json(res, 200, { ok: true, gift: gifts.toPublic(r.gift) });
      }
      case "delete":
        await gifts.remove(String(b.id || ""));
        return u.json(res, 200, { ok: true });
      case "move":
        await gifts.move(String(b.id || ""), Number(b.dir) || 1);
        return u.json(res, 200, { ok: true });
      case "unreserve": {
        const gift = await gifts.get(b.id), rec = gift && (await store.reservations.get(gift.id));
        if (rec) { await store.reservations.remove(gift.id); await notifyOwnerSafe(req, { type: "admin-cancel", gift, who: rec }); }
        return u.json(res, 200, { ok: true });
      }
      case "mail": {
        const r = await notifyOwner(req, { type: "list" });
        return u.json(res, 200, { ok: true, ...r });
      }
      default:
        return u.json(res, 400, { error: "action" });
    }
  } catch (e) {
    console.error(e);
    return u.json(res, 500, { error: "server" });
  }
};

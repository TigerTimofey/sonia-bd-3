// GET  /api/cancel?gift&token&lang → confirmation page (mail scanners that pre-open links can't cancel)
// POST /api/cancel                  → actually cancels the reservation
const store = require("./_lib/store");
const I = require("./_lib/i18n");
const u = require("./_lib/util");

function page(t, lang, inner) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${u.esc(t.pageTitle)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff8f3;font-family:system-ui,sans-serif;color:#3b2f4a;padding:16px;box-sizing:border-box}
.box{background:#fff;border-radius:22px;box-shadow:0 10px 30px rgba(120,80,140,.12);padding:32px 24px;max-width:440px;text-align:center}
.e{font-size:48px}h1{font-size:22px;line-height:1.3}button{border:0;cursor:pointer;font:700 16px system-ui;background:#ff8fb1;color:#fff;padding:13px 24px;border-radius:999px}
a{color:#d4507a;font-weight:700;text-decoration:none;display:inline-block;margin-top:18px}</style></head>
<body><div class="box">${inner}<br><a href="/">${u.esc(t.back)}</a></div></body></html>`;
}

module.exports = async (req, res) => {
  const q = req.method === "POST" ? { ...u.query(req), ...(await u.body(req)) } : u.query(req);
  const lang = u.pickLang(q.lang);
  const t = I[lang];
  const gift = u.findGift(q.gift);

  try {
    const rec = gift && (await store.get(gift.id));
    if (!gift || !rec || !u.sameToken(rec.token, q.token)) {
      return u.html(res, 404, page(t, lang, `<div class="e">🤷</div><h1>${u.esc(t.notFound)}</h1>`));
    }
    const gName = u.esc(u.giftName(gift, lang));

    if (req.method === "POST") {
      await store.remove(gift.id);
      return u.html(res, 200, page(t, lang, `<div class="e">✅</div><h1>${t.done(gName)}</h1>`));
    }
    return u.html(res, 200, page(t, lang, `<div class="e">🎁</div><h1>${t.confirmQ(gName)}</h1>
      <form method="POST" action="/api/cancel">
        <input type="hidden" name="gift" value="${u.esc(gift.id)}">
        <input type="hidden" name="token" value="${u.esc(q.token)}">
        <input type="hidden" name="lang" value="${lang}">
        <button type="submit">${u.esc(t.confirmBtn)}</button>
      </form>`));
  } catch (e) {
    console.error(e);
    u.html(res, 500, page(t, lang, `<div class="e">⚠️</div><h1>Error</h1>`));
  }
};

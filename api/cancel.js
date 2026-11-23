// GET  /api/cancel?gift&token&lang → confirmation page (mail scanners that pre-open links can't cancel)
// POST /api/cancel                  → actually cancels the reservation
const store = require("./_lib/store");
const gifts = require("./_lib/gifts");
const { notifyOwnerSafe } = require("./_lib/notify");
const I = require("./_lib/i18n");
const u = require("./_lib/util");

function page(t, lang, inner) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${u.esc(t.pageTitle)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff8f3;font-family:system-ui,sans-serif;color:#3b2f4a;padding:16px;box-sizing:border-box}
.box{background:#fff;border-radius:22px;box-shadow:0 10px 30px rgba(120,80,140,.12);padding:32px 24px;max-width:440px;text-align:center}
.e{width:64px;height:64px;margin:0 auto;border-radius:50%;background:#ffe1ea;color:#d4507a;display:grid;place-items:center}.e.ok{background:#e2f8ef;color:#2a9d74}h1{font-size:22px;line-height:1.3}button{border:0;cursor:pointer;font:700 16px system-ui;background:#ff8fb1;color:#fff;padding:13px 24px;border-radius:999px}
a{color:#d4507a;font-weight:700;text-decoration:none;display:inline-block;margin-top:18px}</style></head>
<body><div class="box">${inner}<br><a href="/">${u.esc(t.back)}</a></div></body></html>`;
}

module.exports = async (req, res) => {
  const q = req.method === "POST" ? { ...u.query(req), ...(await u.body(req)) } : u.query(req);
  const lang = u.pickLang(q.lang);
  const t = I[lang];
  try {
    const gift = await gifts.get(q.gift);
    const isCard = gift && gift.type === "giftcard";
    const cardKey = isCard && /^[a-f0-9]{36}$/.test(q.token || "") ? `${gift.id}:${q.token}` : null;
    const rec = gift && (isCard ? (cardKey && (await store.giftcards.get(cardKey))) : (await store.reservations.get(gift.id)));
    if (!gift || !rec || !u.sameToken(rec.token, q.token)) {
      return u.html(res, 404, page(t, lang, `<div class="e"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg></div><h1>${u.esc(t.notFound)}</h1>`));
    }
    const gName = u.esc(u.giftName(gift, lang));

    if (req.method === "POST") {
      if (isCard) await store.giftcards.remove(cardKey); else await store.reservations.remove(gift.id);
      await notifyOwnerSafe(req, { type: isCard ? "card-cancel" : "cancel", gift, amount: rec.amount, who: { name: rec.name, email: rec.email } });
      if (isCard) return u.html(res, 200, page(t, lang, `<div class="e ok"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h1>${t.cardDone(gName, rec.amount)}</h1>`));
      return u.html(res, 200, page(t, lang, `<div class="e ok"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h1>${t.done(gName)}</h1>`));
    }
    return u.html(res, 200, page(t, lang, `<div class="e"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13"/><path d="M12 8C10.5 4 7 4 7 6s3 2 5 2zM12 8c1.5-4 5-4 5-2s-3 2-5 2z"/></svg></div><h1>${isCard ? t.cardConfirmQ(gName, rec.amount) : t.confirmQ(gName)}</h1>
      <form method="POST" action="/api/cancel">
        <input type="hidden" name="gift" value="${u.esc(gift.id)}">
        <input type="hidden" name="token" value="${u.esc(q.token)}">
        <input type="hidden" name="lang" value="${lang}">
        <button type="submit">${u.esc(isCard ? t.cardCancelBtn : t.confirmBtn)}</button>
      </form>`));
  } catch (e) {
    console.error(e);
    u.html(res, 500, page(t, lang, `<div class="e"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg></div><h1>Error</h1>`));
  }
};

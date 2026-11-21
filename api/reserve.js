// POST /api/reserve {giftId, name, email, lang} → reserves the gift and e-mails a cancel link.
const store = require("./_lib/store");
const { sendMail } = require("./_lib/mail");
const I = require("./_lib/i18n");
const u = require("./_lib/util");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function emailHtml(t, { name, gift, giftUrl, cancelUrl, site }) {
  const e = u.esc;
  return `<!doctype html><html><body style="margin:0;background:#fff8f3;font-family:Arial,Helvetica,sans-serif;color:#3b2f4a">
  <div style="max-width:520px;margin:0 auto;padding:28px 20px">
    <div style="background:#fff;border-radius:20px;padding:28px;box-shadow:0 8px 24px rgba(120,80,140,.12)">
      <div style="font-size:42px;text-align:center">🎁</div>
      <h2 style="margin:8px 0 16px;text-align:center">${e(t.hello(name))}</h2>
      <p style="font-size:16px;line-height:1.5">${t.booked(e(gift))}</p>
      <p style="font-size:16px;line-height:1.5">${e(t.when)}</p>
      ${giftUrl ? `<p><a href="${e(giftUrl)}" style="color:#d4507a;font-weight:bold">${e(t.giftLink)} →</a></p>` : ""}
      <hr style="border:0;border-top:1px solid #f0e6ee;margin:22px 0">
      <p style="font-size:14px;color:#7a6d88;line-height:1.5">${e(t.changed)}</p>
      <p style="text-align:center;margin:18px 0 6px">
        <a href="${e(cancelUrl)}" style="display:inline-block;background:#ff8fb1;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${e(t.cancelBtn)}</a>
      </p>
    </div>
    <p style="text-align:center;font-size:13px;color:#7a6d88"><a href="${e(site)}" style="color:#7a6d88">${e(t.site)}</a></p>
  </div></body></html>`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return u.json(res, 405, { error: "method" });
  const b = await u.body(req);
  const lang = u.pickLang(b.lang);
  const name = String(b.name || "").trim().slice(0, 60);
  const email = String(b.email || "").trim().slice(0, 120);
  const gift = u.findGift(b.giftId);

  if (!gift) return u.json(res, 400, { error: "gift" });
  if (!name) return u.json(res, 400, { error: "name" });
  if (!EMAIL_RE.test(email)) return u.json(res, 400, { error: "email" });

  const token = u.newToken();
  try {
    const ok = await store.reserve(gift.id, { name, email, token, lang, at: new Date().toISOString() });
    if (!ok) return u.json(res, 409, { error: "taken" });
  } catch (e) {
    console.error(e);
    return u.json(res, 500, { error: "storage" });
  }

  const site = u.siteUrl(req);
  const cancelUrl = `${site}/api/cancel?gift=${encodeURIComponent(gift.id)}&token=${token}&lang=${lang}`;
  const t = I[lang];
  const gName = u.giftName(gift, lang);
  try {
    const r = await sendMail({
      to: email,
      subject: t.subject(gName),
      html: emailHtml(t, { name, gift: gName, giftUrl: gift.url, cancelUrl, site }),
      text: `${t.hello(name)}\n\n${t.booked(gName).replace(/<[^>]+>/g, "")}\n${t.when}\n\n${t.changed}\n${cancelUrl}\n`,
    });
    u.json(res, 200, { ok: true, ...r });
  } catch (e) {
    console.error(e);
    await store.remove(gift.id).catch(() => {}); // roll back so the gift isn't stuck
    u.json(res, 500, { error: "mail" });
  }
};

// E-mail to the parents with the full, current reservation list.
const gifts = require("./gifts");
const store = require("./store");
const { sendMail } = require("./mail");
const { esc, giftName, siteUrl } = require("./util");

const ownerEmail = () => process.env.OWNER_EMAIL || process.env.SMTP_USER;
const fmt = iso => new Date(iso).toLocaleString("ru-RU", { timeZone: "Europe/Tallinn", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

async function listHtml(req) {
  const [all, res, cards] = await Promise.all([gifts.list(), store.reservations.all(), store.giftcards.byGift()]);
  const items = all.filter(g => g.type !== "giftcard"), taken = items.filter(g => res[g.id]).length;
  const td = 'style="padding:10px;border-bottom:1px solid #f0e6ee"';
  const rows = all.map(g => {
    const r = res[g.id];
    const name = esc(giftName(g, "ru"));
    if (g.type === "giftcard") {
      const list = cards[g.id] || [], sum = list.reduce((s, x) => s + x.amount, 0);
      const head = `<tr><td ${td}><b>${name}</b><br><span style="color:#7a6d88">куплено ${list.length} шт. на ${sum} €</span></td><td ${td} colspan="2">${list.length ? "" : '<span style="color:#7a6d88">пока никто</span>'}</td></tr>`;
      const sub = 'style="padding:6px 10px;border-bottom:1px solid #f0e6ee';
      return head + list.map(x => `<tr><td ${sub};padding-left:24px;color:#a5780a;font-weight:bold">${x.amount} €</td><td ${sub}">${esc(x.name)}<br><a href="mailto:${esc(x.email)}" style="color:#2f78c4">${esc(x.email)}</a></td><td ${sub};color:#7a6d88;white-space:nowrap">${fmt(x.at)}</td></tr>`).join("");
    }
    return r
      ? `<tr><td style="padding:10px;border-bottom:1px solid #f0e6ee;font-weight:bold">${name}</td>
           <td style="padding:10px;border-bottom:1px solid #f0e6ee">${esc(r.name)}<br><a href="mailto:${esc(r.email)}" style="color:#2f78c4">${esc(r.email)}</a></td>
           <td style="padding:10px;border-bottom:1px solid #f0e6ee;color:#7a6d88;white-space:nowrap">${fmt(r.at)}</td></tr>`
      : `<tr><td style="padding:10px;border-bottom:1px solid #f0e6ee;font-weight:bold">${name}</td>
           <td style="padding:10px;border-bottom:1px solid #f0e6ee;color:#3dbf8f" colspan="2">свободен</td></tr>`;
  }).join("");
  const site = siteUrl(req);
  return `<p style="font-size:15px;margin:0 0 12px">Забронировано <b>${taken} из ${items.length}</b>.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr style="background:#fff3f7;text-align:left"><th style="padding:10px">Подарок</th><th style="padding:10px">Кто забронировал</th><th style="padding:10px">Когда</th></tr>
    ${rows || `<tr><td colspan="3" style="padding:10px;color:#7a6d88">Подарков пока нет</td></tr>`}
  </table>
  <p style="margin-top:20px"><a href="${esc(site)}/admin" style="color:#d4507a;font-weight:bold">Открыть кабинет →</a></p>`;
}

// event: {type:"reserve"|"cancel"|"admin-cancel"|"list", gift?, who?}
async function notifyOwner(req, event) {
  const to = ownerEmail();
  if (!to) return {};
  const g = event.gift ? giftName(event.gift, "ru") : "";
  const heads = {
    reserve: [`Новая бронь: ${g} — ${event.who?.name}`, `<b>${esc(event.who?.name)}</b> (${esc(event.who?.email)}) забронировал(а) <b>«${esc(g)}»</b>.`],
    cancel: [`Бронь отменена: ${g} — ${event.who?.name}`, `<b>${esc(event.who?.name)}</b> (${esc(event.who?.email)}) отменил(а) бронь <b>«${esc(g)}»</b>. Подарок снова свободен.`],
    "admin-cancel": [`Вы сняли бронь: ${g}`, `Бронь <b>«${esc(g)}»</b> (была на ${esc(event.who?.name)}, ${esc(event.who?.email)}) снята из кабинета.`],
    card: [`Подарочная карта: ${event.amount} € — ${event.who?.name}`, `<b>${esc(event.who?.name)}</b> (${esc(event.who?.email)}) отметил(а), что подарил(а) <b>«${esc(g)}»</b> на <b>${event.amount} €</b>.`],
    "card-cancel": [`Отмена карты: ${event.amount} € — ${event.who?.name}`, `<b>${esc(event.who?.name)}</b> (${esc(event.who?.email)}) отменил(а) отметку <b>«${esc(g)}»</b> на ${event.amount} €.`],
    "admin-card-cancel": [`Вы удалили отметку карты: ${event.amount} €`, `Отметка <b>«${esc(g)}»</b> на ${event.amount} € (${esc(event.who?.name)}, ${esc(event.who?.email)}) удалена из кабинета.`],
    list: ["Список подарков для Сони", "Актуальный список броней:"],
  };
  const [subject, lead] = heads[event.type];
  const html = `<!doctype html><html><body style="margin:0;background:#fff8f3;font-family:Arial,Helvetica,sans-serif;color:#3b2f4a">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border-radius:18px;padding:22px">
    <p style="font-size:16px;line-height:1.5;margin:0 0 18px">${lead}</p>
    ${await listHtml(req)}
  </div></div></body></html>`;
  return sendMail({ to, subject, html, text: subject });
}

// Never let a parent-notification failure break the guest's action.
async function notifyOwnerSafe(req, event) {
  try { return await notifyOwner(req, event); } catch (e) { console.error("owner mail failed:", e.message); return {}; }
}

module.exports = { notifyOwner, notifyOwnerSafe };

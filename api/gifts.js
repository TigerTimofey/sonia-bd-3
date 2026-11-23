// GET /api/gifts → public gift list + which are reserved (no names or e-mails).
const store = require("./_lib/store");
const gifts = require("./_lib/gifts");
const { json } = require("./_lib/util");

module.exports = async (req, res) => {
  try {
    const [list, reserved, cards] = await Promise.all([gifts.list(), store.reservations.all(), store.giftcards.byGift()]);
    const counts = Object.fromEntries(Object.entries(cards).map(([id, arr]) => [id, arr.length]));
    json(res, 200, { gifts: list.map(gifts.toPublic), reserved: Object.keys(reserved), counts });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: "storage" });
  }
};

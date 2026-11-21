// GET /api/gifts → which gifts are reserved (no names or e-mails are exposed).
const store = require("./_lib/store");
const { json } = require("./_lib/util");

module.exports = async (req, res) => {
  try {
    const all = await store.all();
    json(res, 200, { reserved: Object.keys(all) });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: "storage" });
  }
};

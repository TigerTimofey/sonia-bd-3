// GET /api/img?id=<giftId>&v=<version> → gift photo (immutable per version).
const gifts = require("./_lib/gifts");
const { query } = require("./_lib/util");

module.exports = async (req, res) => {
  try {
    const data = await gifts.image(query(req).id || "");
    const m = data && data.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!m) { res.statusCode = 404; return res.end("Not found"); }
    res.statusCode = 200;
    res.setHeader("Content-Type", m[1]);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(Buffer.from(m[2], "base64"));
  } catch (e) {
    console.error(e);
    res.statusCode = 500; res.end();
  }
};

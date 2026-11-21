// Sends mail via SMTP when configured; otherwise (local dev) saves it to .outbox/ for preview.
const fs = require("fs");
const path = require("path");

const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

async function sendMail({ to, subject, html, text }) {
  if (hasSmtp) {
    const nodemailer = require("nodemailer");
    const port = Number(process.env.SMTP_PORT || 465);
    const tx = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await tx.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html, text });
    return {};
  }
  if (process.env.VERCEL) throw new Error("SMTP is not configured");
  const dir = path.join(process.cwd(), ".outbox");
  fs.mkdirSync(dir, { recursive: true });
  const name = `${Date.now()}.html`;
  fs.writeFileSync(path.join(dir, name), `<!-- To: ${to} | Subject: ${subject} -->\n${html}`);
  console.log(`[mail:dev] to=${to} subject="${subject}" → /_outbox/${name}`);
  return { preview: `/_outbox/${name}` };
}

module.exports = { sendMail, hasSmtp };

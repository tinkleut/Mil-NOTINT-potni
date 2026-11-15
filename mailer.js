const nodemailer = require("nodemailer");

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const port = Number(process.env.SMTP_PORT) || 25;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  ...(smtpUser && smtpPass
    ? { auth: { user: smtpUser, pass: smtpPass } }
    : {}),
});

// Send mail using the configured SMTP identity and optional reply address.
async function sendMail({ to, subject, text, html, replyTo }) {
  const from = process.env.MAIL_FROM || process.env.ADMIN_EMAIL;
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP_HOST must be set to send email.");
  }
  if (Boolean(smtpUser) !== Boolean(smtpPass)) {
    throw new Error("SMTP_USER and SMTP_PASS must either both be set or both be omitted.");
  }
  if (!from) {
    throw new Error("Set MAIL_FROM or ADMIN_EMAIL to use as the sender address.");
  }

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    // Keep replies separate from the configured SMTP sender identity.
    ...(replyTo ? { replyTo } : {}),
  });
  console.log("Message sent: %s", info.messageId);
  return info;
}

module.exports = { sendMail };
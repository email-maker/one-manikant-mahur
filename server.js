import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* ================= CONFIG (SAFE) ================= */
const HOURLY_LIMIT = 28;
const PARALLEL = 3;                 // safe burst
const MIN_DELAY = 80;               // ms
const MAX_DELAY = 140;              // ms
const stats = {};                   // gmail -> { count, start }

/* ================= HELPERS ================= */
function resetIfNeeded(gmail) {
  if (!stats[gmail]) {
    stats[gmail] = { count: 0, start: Date.now() };
    return;
  }
  if (Date.now() - stats[gmail].start >= 60 * 60 * 1000) {
    stats[gmail] = { count: 0, start: Date.now() };
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a,b) => Math.floor(a + Math.random()*(b-a+1));

/* Small, honest personalization (no misleading content) */
function personalize(text, email) {
  const name = email.split("@")[0].replace(/[._-]/g, " ").slice(0, 20);
  return text
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{email\}\}/gi, email);
}

/* ================= SAFE SENDER ================= */
async function sendSafely(transporter, mails) {
  let sent = 0;

  for (let i = 0; i < mails.length; i += PARALLEL) {
    const chunk = mails.slice(i, i + PARALLEL);

    const results = await Promise.allSettled(
      chunk.map(m => transporter.sendMail(m))
    );

    results.forEach(r => r.status === "fulfilled" && sent++);

    await sleep(rand(MIN_DELAY, MAX_DELAY));
  }
  return sent;
}

/* ================= SEND API ================= */
app.post("/send", async (req, res) => {
  const { senderName, gmail, apppass, to, subject, message } = req.body;

  resetIfNeeded(gmail);

  if (stats[gmail].count >= HOURLY_LIMIT) {
    return res.json({ success:false, msg:"Mail Limit Full ❌", count: stats[gmail].count });
  }

  const recipients = to.split(/,|\r?\n/).map(x=>x.trim()).filter(Boolean);
  const remaining = HOURLY_LIMIT - stats[gmail].count;
  if (recipients.length > remaining) {
    return res.json({ success:false, msg:"Mail Limit Full ❌", count: stats[gmail].count });
  }

  const baseText =
    message.trim() +
    "\n\n📩 Scanned & Secured — www.avast.com";

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: gmail, pass: apppass }
  });

  try {
    await transporter.verify();
  } catch {
    return res.json({ success:false, msg:"Wrong App Password ❌", count: stats[gmail].count });
  }

  const mails = recipients.map((r, idx) => ({
    from: `"${senderName}" <${gmail}>`,
    to: r,
    replyTo: gmail,
    subject: subject, // honest subject (no clickbait)
    text: personalize(baseText, r),
    headers: {
      "Message-ID": `<${crypto.randomUUID()}@${gmail.split("@")[1]}>`,
      "List-Unsubscribe": "<mailto:unsubscribe@example.com>",
      "X-Mailer": "Secure Mail Client"
    }
  }));

  const sent = await sendSafely(transporter, mails);
  stats[gmail].count += sent;

  return res.json({ success:true, sent, count: stats[gmail].count });
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Safe mail server running on", PORT);
});

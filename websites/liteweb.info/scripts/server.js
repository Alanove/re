const path = require("path");
const fs = require("fs");
const express = require("express");
const nodemailer = require("nodemailer");
const { loadEnv } = require("./load-env");
const { LOCALES, SHOW_ARABIC } = require("./i18n");

loadEnv();

const PORT = Number(process.argv[2] || process.env.PORT || 3041);
const HTML_DIR = path.join(__dirname, "..", "html");
const MAIL_DIR = process.env.MAIL_LOG_DIR || path.join(__dirname, "..", "mails");
const MAIL_FROM = process.env.MAIL_FROM || "hello@liteweb.info";
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "Liteweb";
const MAIL_TO = process.env.MAIL_TO;
const MAIL_PROVIDER = String(process.env.MAIL_PROVIDER || "brevo").toLowerCase();
const MAIL_DRY_RUN = String(process.env.MAIL_DRY_RUN || "").toLowerCase() === "true";
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || "";
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || "";
const RECAPTCHA_MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);

function mailTransportConfig() {
  if (MAIL_PROVIDER === "gmail") {
    return {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER || "",
        pass: String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, ""),
      },
    };
  }
  return {
    host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
    port: Number(process.env.BREVO_SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.BREVO_SMTP_USER || "",
      pass: process.env.BREVO_SMTP_KEY || "",
    },
  };
}

function mailFromAddress() {
  if (MAIL_PROVIDER === "gmail") {
    const gmailUser = process.env.GMAIL_USER || "";
    const from =
      gmailUser && MAIL_FROM.toLowerCase() === gmailUser.toLowerCase()
        ? MAIL_FROM
        : gmailUser || MAIL_FROM;
    return `"${MAIL_FROM_NAME}" <${from}>`;
  }
  return `"${MAIL_FROM_NAME}" <${MAIL_FROM}>`;
}

function smtpHint() {
  if (MAIL_PROVIDER === "gmail") {
    return "Confirm GMAIL_USER and GMAIL_APP_PASSWORD (Google App Password, not your Gmail login).";
  }
  return "Confirm BREVO_SMTP_USER, BREVO_SMTP_KEY, and that this IP is authorized in Brevo.";
}

const transportConfig = mailTransportConfig();
const SMTP_USER = transportConfig.auth.user;
const SMTP_KEY = transportConfig.auth.pass;
const transporter = nodemailer.createTransport(transportConfig);

function apiCopy(code) {
  const loc = LOCALES.find((item) => item.code === code) || LOCALES[0];
  return loc.copy.api;
}

function textValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function verifyRecaptcha(token, expectedAction) {
  if (!RECAPTCHA_SECRET_KEY) return true;
  if (!textValue(token)) return false;
  try {
    const params = new URLSearchParams();
    params.set("secret", RECAPTCHA_SECRET_KEY);
    params.set("response", textValue(token));
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await res.json();
    if (!data || data.success !== true) return false;
    if (typeof data.score === "number" && data.score < RECAPTCHA_MIN_SCORE) {
      console.warn("[recaptcha] low score", data.score);
      return false;
    }
    if (expectedAction && data.action && data.action !== expectedAction) {
      console.warn("[recaptcha] action mismatch", data.action, expectedAction);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[recaptcha] verify failed:", err.message || err);
    return false;
  }
}

function row(label, value) {
  if (!value) return "";
  return `<tr><th style="text-align:left;padding:6px 12px 6px 0;vertical-align:top;color:#4e6073;">${escapeHtml(label)}</th><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`;
}

function plainRow(label, value) {
  if (!value) return "";
  return `${label}: ${value}\n`;
}

function slug(value) {
  return String(value || "mail")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "mail";
}

function logMailFile({ subject, replyTo, fields, sent, error }) {
  fs.mkdirSync(MAIL_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(MAIL_DIR, `${stamp}-${slug(fields.Form)}.txt`);
  const lines = [
    `Date: ${new Date().toISOString()}`,
    `To: ${MAIL_TO || "(not set)"}`,
    `From: ${mailFromAddress()}`,
    `Reply-To: ${replyTo || ""}`,
    `Subject: ${subject}`,
    `SMTP: ${sent ? "sent" : MAIL_DRY_RUN ? "dry-run" : "failed"}`,
  ];
  if (error) lines.push(`SMTP error: ${error}`);
  lines.push("");
  Object.entries(fields).forEach(([label, value]) => {
    if (value) lines.push(`${label}: ${value}`);
  });
  lines.push("");
  fs.writeFileSync(file, lines.join("\n"), "utf8");
  console.log("[mail] saved", file);
  return file;
}

async function sendMail({ subject, replyTo, fields, failMessage }) {
  const htmlRows = Object.entries(fields)
    .map(([label, value]) => row(label, value))
    .join("");
  const textBody = Object.entries(fields)
    .map(([label, value]) => plainRow(label, value))
    .join("");

  let sent = false;
  let smtpError = "";

  if (MAIL_DRY_RUN) {
    console.log("[mail] dry run — file log only");
  } else if (!SMTP_USER || !SMTP_KEY || !MAIL_TO) {
    smtpError = "Mail is not configured (MAIL_TO or SMTP credentials missing).";
    console.error("[mail]", smtpError);
  } else {
    try {
      console.log("[mail] sending to", MAIL_TO);
      await transporter.sendMail({
        from: mailFromAddress(),
        to: MAIL_TO,
        replyTo,
        subject,
        text: textBody.trim(),
        html: `<table style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#191c1d;">${htmlRows}</table>`,
      });
      sent = true;
      console.log("[mail] sent", subject);
    } catch (err) {
      smtpError = err.message || String(err);
      console.error("[mail] SMTP failed:", smtpError);
    }
  }

  try {
    logMailFile({ subject, replyTo, fields, sent, error: smtpError });
  } catch (err) {
    console.error("[mail] file log failed:", err.message);
  }

  if (!sent && !MAIL_DRY_RUN) {
    const fail = new Error(failMessage || "We could not save or send your message. Please email us directly.");
    fail.status = 500;
    throw fail;
  }
}

async function handleContact(body) {
  const form = textValue(body.form) || "contact";
  const name = textValue(body.name);
  const email = textValue(body.email);
  const company = textValue(body.company);
  const phone = textValue(body.phone);
  const subject = textValue(body.subject);
  const message = textValue(body.message || body.details);
  const projectType = textValue(body.project_type);
  const timeline = textValue(body.timeline);
  const honeypot = textValue(body.website || body._gotcha);
  const captchaToken = textValue(body["g-recaptcha-response"] || body.recaptchaToken);

  const api = apiCopy(body.locale);

  if (honeypot) {
    console.log("[contact] honeypot skip");
    return { ok: true, skipped: true };
  }

  if (RECAPTCHA_SECRET_KEY && !(await verifyRecaptcha(captchaToken, form === "project" ? "project" : "contact"))) {
    const err = new Error(api.captchaFail);
    err.status = 400;
    throw err;
  }

  if (!name || !isEmail(email) || !message) {
    const err = new Error(api.required);
    err.status = 400;
    throw err;
  }

  if (form === "project") {
    if (!company || !projectType || !timeline) {
      const err = new Error(api.projectRequired);
      err.status = 400;
      throw err;
    }
    return sendMail({
      subject: `LiteWeb project request: ${name}`,
      replyTo: email,
      failMessage: api.sendFail,
      fields: {
        Form: "Start a Project",
        Name: name,
        Email: email,
        Company: company,
        Phone: phone,
        "Project type": projectType,
        Timeline: timeline,
        Details: message,
      },
    });
  }

  return sendMail({
    subject: `LiteWeb contact: ${subject || name}`,
    replyTo: email,
    failMessage: api.sendFail,
    fields: {
      Form: "Contact",
      Name: name,
      Email: email,
      Company: company,
      Subject: subject,
      Message: message,
    },
  });
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true, limit: "32kb" }));

app.get("/api/config", (req, res) => {
  res.json({ recaptchaSiteKey: RECAPTCHA_SITE_KEY });
});

app.post(["/api/contact", "/api/project"], async (req, res) => {
  try {
    const body = Object.assign({}, req.body || {});
    if (req.path === "/api/project") body.form = body.form || "project";
    await handleContact(body);
    res.json({ ok: true });
  } catch (err) {
    const status = err.status || 500;
    const api = apiCopy(req.body && req.body.locale);
    const message =
      status >= 500
        ? api.sendFail
        : err.message;
    console.error("[contact]", err.message);
    res.status(status).json({ ok: false, error: message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ ok: false, error: apiCopy(req.body && req.body.locale).invalid });
  }
  next(err);
});

app.use((req, res, next) => {
  if (!SHOW_ARABIC && (req.path === "/ar" || req.path.startsWith("/ar/"))) {
    const rest = req.path.replace(/^\/ar\/?/, "");
    const dest = !rest || rest === "index.html" ? "/" : `/${rest}`;
    return res.redirect(302, dest);
  }
  next();
});

app.use(express.static(HTML_DIR, { extensions: ["html"] }));

app.use((req, res) => {
  const arabic = SHOW_ARABIC && (req.path === "/ar" || req.path.startsWith("/ar/"));
  res.status(404).sendFile(path.join(HTML_DIR, arabic ? "ar" : "", "404.html"));
});

const server = app.listen(PORT, (err) => {
  if (err) {
    console.error(`[server] could not listen on port ${PORT}: ${err.message}`);
    process.exit(1);
  }
  console.log(`LiteWeb running at http://localhost:${PORT}`);
  console.log("[mail] submissions saved under", MAIL_DIR);
  console.log("[mail] provider", MAIL_PROVIDER);
  if (RECAPTCHA_SECRET_KEY && RECAPTCHA_SITE_KEY) {
    console.log("[recaptcha] v3 enabled");
  } else {
    console.warn("[recaptcha] not configured — set RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY");
  }
  if (MAIL_DRY_RUN) {
    console.log("[mail] dry run on — SMTP skipped. Set MAIL_DRY_RUN=false on the production server.");
    return;
  }
  console.log("[mail] verifying SMTP…");
  transporter
    .verify()
    .then(() => {
      console.log("[mail] SMTP ready");
    })
    .catch((verifyErr) => {
      console.warn("[mail] SMTP failed.", smtpHint());
      console.warn("[mail]", verifyErr.response || verifyErr.message);
    });
});

server.on("error", (err) => {
  console.error(`[server] could not listen on port ${PORT}: ${err.message}`);
  process.exit(1);
});

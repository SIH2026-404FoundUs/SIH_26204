import nodemailer from "nodemailer";

// This project has never had an email provider configured (confirmed: no
// SMTP/SendGrid/Resend credentials anywhere in .env or package.json before
// this file). Rather than either (a) silently doing nothing, which would
// make email verification and password reset untestable and functionally
// fake, or (b) inventing a "sent" response with no real delivery behind it,
// this reads real SMTP credentials when they're configured and otherwise
// logs the actual email -- including the real, working link -- to the
// server console. That's genuinely usable for local dev and for curl-testing
// this whole flow end to end (copy the link straight out of the terminal),
// and it's honest about not being real delivery. Add SMTP_HOST/PORT/USER/PASS
// (or swap in any nodemailer-compatible provider) to send for real; nothing
// else in this file needs to change.
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || "Sahyatri <no-reply@sahyatri.local>";

const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/**
 * @param {{to: string, subject: string, text: string, html?: string}} message
 */
export async function sendMail({ to, subject, text, html }) {
  if (transporter) {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, text, html: html || undefined });
    return { delivered: true };
  }

  // Dev fallback -- clearly labelled, never mistaken for a real send.
  console.log(
    "\n[mailer] NO SMTP CONFIGURED -- printing email instead of sending it.\n" +
    `[mailer] to: ${to}\n[mailer] subject: ${subject}\n[mailer] body:\n${text}\n`
  );
  return { delivered: false, reason: "no_smtp_configured" };
}

export function verificationEmail(link) {
  return {
    subject: "Verify your Sahyatri account",
    text: `Welcome to Sahyatri. Verify your email to finish creating your account:\n\n${link}\n\nThis link expires in 24 hours and can only be used once. If you didn't create this account, you can ignore this email.`,
  };
}

export function passwordResetEmail(link) {
  return {
    subject: "Reset your Sahyatri password",
    text: `We received a request to reset your Sahyatri password:\n\n${link}\n\nThis link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email -- your password will not change.`,
  };
}

// Transport only -- every actual email's subject/text/html lives in
// emailTemplates.js, one function per email type (password reset, welcome,
// booking confirmation, flash offer, waitlist fulfilled, complaint status).
//
// Deliberately NOT SMTP. Outbound SMTP (ports 25/465/587) is exactly the
// kind of thing that works fine locally and then silently times out once
// deployed -- most cloud hosts (Render, Railway, Vercel, plenty of Heroku
// tiers) block or throttle outbound SMTP ports by default, and the failure
// mode is a hung connection, not a clean error. Brevo's plain HTTPS REST
// API (a POST to port 443, same as any other API call this backend already
// makes) sidesteps that whole class of problem entirely -- nothing here
// needs an SMTP relay, a special port, or provider-specific transport code.
//
// Brevo over Resend specifically because it supports single-sender
// verification -- verifying one email address (no domain purchase/DNS
// required) is enough to send to ANY recipient. Resend's shared sandbox
// sender can only deliver to the account's own address until a full domain
// is verified, which isn't available here (no team domain yet).
//
// When BREVO_API_KEY isn't set, this logs the exact email to the console
// instead of a fabricated "sent" response -- genuinely usable for local dev
// and for curl-testing any email flow end to end without ever pretending to
// have delivered something it didn't.
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || "reddysathvik2005@gmail.com";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * @param {{to: string, subject: string, text: string, html?: string}} message
 */
export async function sendMail({ to, subject, text, html }) {
  if (BREVO_API_KEY) {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { email: MAIL_FROM, name: "Sahyatri" },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Brevo API returned ${res.status}: ${body.slice(0, 300)}`);
    }
    return { delivered: true };
  }

  // Dev fallback -- clearly labelled, never mistaken for a real send.
  console.log(
    "\n[mailer] NO BREVO_API_KEY CONFIGURED -- printing email instead of sending it.\n" +
    `[mailer] to: ${to}\n[mailer] subject: ${subject}\n[mailer] body:\n${text}\n`
  );
  return { delivered: false, reason: "no_provider_configured" };
}

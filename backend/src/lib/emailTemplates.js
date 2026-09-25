import { getDestination } from "../services/pressure/seed.js";

// Every real, working email this app sends -- one function per email type,
// each returning { subject, text, html } for sendMail() (lib/mailer.js).
// Shared plain HTML wrapper so every email looks like it came from the same
// product without pulling in external images/fonts (many mail clients block
// remote assets anyway) -- inline styles only, table-free since we don't
// need Outlook-grade layout for a hackathon's worth of transactional email.

const BRAND = "Sahyatri";
const INK = "#1a1a2e";
const PRESSURE = "#c2410c";

function destName(destId) {
  return getDestination(destId)?.name || destId;
}

function wrapHtml(bodyHtml) {
  return `
<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
  <div style="background: ${INK}; padding: 20px 24px; border-radius: 8px 8px 0 0;">
    <span style="color: #fff; font-size: 18px; font-weight: 600;">${BRAND}</span>
  </div>
  <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
    ${bodyHtml}
  </div>
  <p style="color: #9ca3af; font-size: 11px; margin-top: 16px; text-align: center;">
    You're receiving this because you have a ${BRAND} account. This is a transactional email about your own activity.
  </p>
</div>`;
}

function button(url, label) {
  return `<a href="${url}" style="display:inline-block; background:${PRESSURE}; color:#fff; text-decoration:none; padding:10px 20px; border-radius:6px; font-weight:600; font-size:14px; margin-top:12px;">${label}</a>`;
}

export function passwordResetEmail(link) {
  const text = `We received a request to reset your ${BRAND} password:\n\n${link}\n\nThis link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email -- your password will not change.`;
  return {
    subject: `Reset your ${BRAND} password`,
    text,
    html: wrapHtml(`
      <p>We received a request to reset your ${BRAND} password.</p>
      ${button(link, "Reset password")}
      <p style="color:#6b7280; font-size:13px; margin-top:16px;">This link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email.</p>
    `),
  };
}

const ROLE_INTRO = {
  traveller: "Plan a trip against real crowding data, discover verified local businesses, and get notified the moment a flash offer opens up.",
  operator: "Declare your availability, run flash offers, and see real feedback and growth insights for your business.",
  authority: "Track destination pressure, review community submissions, and manage tourist complaints from your dashboard.",
  worker: "Set up your worker profile, get matched to nearby gigs the moment they're posted, and get rated for the work you complete.",
};

export function welcomeEmail({ fullName, role }) {
  const intro = ROLE_INTRO[role] || ROLE_INTRO.traveller;
  const text = `Hi ${fullName},\n\nWelcome to ${BRAND}. ${intro}\n\nYou're all set -- your account is ready to use.`;
  return {
    subject: `Welcome to ${BRAND}`,
    text,
    html: wrapHtml(`
      <p>Hi ${fullName},</p>
      <p>Welcome to ${BRAND}. ${intro}</p>
      <p style="color:#6b7280; font-size:13px;">You're all set -- your account is ready to use.</p>
    `),
  };
}

export function bookingConfirmationEmail({ fullName, businessName, destId, date, status }) {
  const dateStr = new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" });
  const statusLine = status === "confirmed"
    ? "This booking is confirmed -- real availability was matched at the time you booked."
    : "This is a booking request -- the business hasn't declared matching availability yet, so treat this as pending until they confirm.";
  const text = `Hi ${fullName},\n\nYour booking request for ${businessName} in ${destName(destId)} on ${dateStr} was received.\n\n${statusLine}`;
  return {
    subject: status === "confirmed" ? `Booking confirmed -- ${businessName}` : `Booking request received -- ${businessName}`,
    text,
    html: wrapHtml(`
      <p>Hi ${fullName},</p>
      <p>Your booking request for <strong>${businessName}</strong> in ${destName(destId)} on ${dateStr} was received.</p>
      <p style="color:#6b7280; font-size:13px;">${statusLine}</p>
    `),
  };
}

export function flashOfferEmail({ fullName, destId, discountPct, effectivePrice, appUrl }) {
  const text = `Hi ${fullName},\n\nA flash offer just opened near ${destName(destId)}: ${discountPct}% off, now ₹${effectivePrice}. You were on the waitlist for this -- claim it before it's gone: ${appUrl}/offers`;
  return {
    subject: `Flash offer near ${destName(destId)} -- ${discountPct}% off`,
    text,
    html: wrapHtml(`
      <p>Hi ${fullName},</p>
      <p>A flash offer just opened near <strong>${destName(destId)}</strong>: <strong>${discountPct}% off</strong>, now ₹${effectivePrice}.</p>
      <p style="color:#6b7280; font-size:13px;">You were on the waitlist for this. First to claim it wins it.</p>
      ${button(`${appUrl}/offers`, "Claim this offer")}
    `),
  };
}

export function waitlistFulfilledEmail({ fullName, destId, appUrl }) {
  const text = `Hi ${fullName},\n\nYou successfully claimed an offer near ${destName(destId)}. Details: ${appUrl}/offers`;
  return {
    subject: `You claimed an offer near ${destName(destId)}`,
    text,
    html: wrapHtml(`
      <p>Hi ${fullName},</p>
      <p>You successfully claimed an offer near <strong>${destName(destId)}</strong>.</p>
      ${button(`${appUrl}/offers`, "View details")}
    `),
  };
}

const COMPLAINT_STATUS_LABEL = { under_review: "under review", resolved: "resolved" };

export function complaintStatusEmail({ fullName, category, destId, status, appUrl }) {
  const statusLabel = COMPLAINT_STATUS_LABEL[status] || status;
  const text = `Hi ${fullName},\n\nYour ${category} report about ${destName(destId)} is now ${statusLabel}. See it here: ${appUrl}/safety`;
  return {
    subject: `Your report about ${destName(destId)} is now ${statusLabel}`,
    text,
    html: wrapHtml(`
      <p>Hi ${fullName},</p>
      <p>Your report about <strong>${destName(destId)}</strong> is now <strong>${statusLabel}</strong>.</p>
      ${button(`${appUrl}/safety`, "View your reports")}
    `),
  };
}

// Group Travel lifecycle (Revised Implementation Plan §14) -- reuses this
// same sendMail/emailTemplates convention rather than a new Notification
// collection (this codebase composes in-app notifications live from real
// feature data client-side; email is the "reached you even if you're not
// watching the app right now" channel every other lifecycle event here already uses).
export function groupJoinRequestEmail({ fullName, requesterName, destId, appUrl, groupTripId }) {
  const text = `Hi ${fullName},\n\n${requesterName} wants to join your group trip to ${destName(destId)}. Review the request: ${appUrl}/travel-together/groups/${groupTripId}`;
  return {
    subject: `${requesterName} wants to join your ${destName(destId)} group`,
    text,
    html: wrapHtml(`
      <p>Hi ${fullName},</p>
      <p><strong>${requesterName}</strong> wants to join your group trip to <strong>${destName(destId)}</strong>.</p>
      ${button(`${appUrl}/travel-together/groups/${groupTripId}`, "Review request")}
    `),
  };
}

const SEVERITY_PREFIX = { critical: "URGENT", warning: "Warning", info: "Notice" };

// Sent to every account when an authority sends a platform-wide emergency
// broadcast (disaster, safety incident) -- see broadcastAlert.model.js's own
// comment on why this is a separate, directly-authored alert rather than a
// row in the externally-sourced Alert collection.
export function emergencyBroadcastEmail({ fullName, title, body, severity, appUrl }) {
  const prefix = SEVERITY_PREFIX[severity] || "Notice";
  const text = `${prefix}: ${title}\n\n${body}\n\nSent by a Sahyatri tourism authority to every account. View current alerts: ${appUrl}/alerts`;
  const barColor = severity === "critical" ? "#dc2626" : severity === "warning" ? "#d97706" : INK;
  return {
    subject: `[${prefix}] ${title}`,
    text,
    html: wrapHtml(`
      <p style="display:inline-block; background:${barColor}; color:#fff; font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; padding:3px 8px; border-radius:4px;">${prefix}</p>
      <p style="margin-top:10px; font-size:16px; font-weight:700;">${title}</p>
      <p>Hi ${fullName},</p>
      <p>${body}</p>
      <p style="color:#6b7280; font-size:13px;">Sent by a ${BRAND} tourism authority to every account.</p>
      ${button(`${appUrl}/alerts`, "View current alerts")}
    `),
  };
}

export function groupJoinDecisionEmail({ fullName, destId, accepted, appUrl, groupTripId }) {
  const verb = accepted ? "accepted" : "declined";
  const text = `Hi ${fullName},\n\nYour request to join the group trip to ${destName(destId)} was ${verb}.${accepted ? ` See the squad: ${appUrl}/travel-together/groups/${groupTripId}` : ""}`;
  return {
    subject: `Your request to join the ${destName(destId)} group was ${verb}`,
    text,
    html: wrapHtml(`
      <p>Hi ${fullName},</p>
      <p>Your request to join the group trip to <strong>${destName(destId)}</strong> was <strong>${verb}</strong>.</p>
      ${accepted ? button(`${appUrl}/travel-together/groups/${groupTripId}`, "View your squad") : ""}
    `),
  };
}

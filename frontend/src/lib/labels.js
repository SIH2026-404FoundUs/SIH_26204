// Every place a raw backend enum would otherwise leak into the UI
// (verificationTier, offer.status, submission.status...) reads its label and
// badge tone from here, so "visit-verified" always renders as "Visit
// verified" with the same tone no matter which page shows it.

export const VERIFICATION_TIER = {
  'self-declared': { label: 'Self-declared', tone: 'neutral' },
  'visit-verified': { label: 'Visit verified', tone: 'success' },
  registered: { label: 'Registered', tone: 'info' },
}

export function verificationTier(tier) {
  return VERIFICATION_TIER[tier] || { label: tier || 'Unverified', tone: 'neutral' }
}

export const OFFER_STATUS = {
  open: { label: 'Available now', tone: 'success' },
  claimed: { label: 'Already claimed', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'danger' },
}

export function offerStatus(status) {
  return OFFER_STATUS[status] || { label: status, tone: 'neutral' }
}

export const WAITLIST_STATE = {
  waiting: { label: 'Waiting', tone: 'info' },
  fulfilled: { label: 'Fulfilled', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export function waitlistState(state) {
  return WAITLIST_STATE[state] || { label: state, tone: 'neutral' }
}

export const SUBMISSION_STATUS = {
  queued: { label: 'Pending review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Not approved', tone: 'danger' },
  flagged: { label: 'Flagged', tone: 'danger' },
}

export function submissionStatus(status) {
  return SUBMISSION_STATUS[status] || { label: status, tone: 'neutral' }
}

export const ALERT_SEVERITY = {
  info: { label: 'Informational', tone: 'neutral' },
  warning: { label: 'Warning', tone: 'warning' },
  critical: { label: 'Critical', tone: 'danger' },
}

export function alertSeverity(severity) {
  return ALERT_SEVERITY[severity] || { label: severity || 'Informational', tone: 'neutral' }
}

export const ALERT_KIND_LABEL = {
  weather: 'Weather',
  road: 'Road conditions',
  policy: 'Policy notice',
  restriction: 'Access restriction',
  hazard: 'Hazard',
}

export function alertKindLabel(kind) {
  return ALERT_KIND_LABEL[kind] || kind
}

export const COMPLAINT_CATEGORY_LABEL = {
  safety_advisory: 'Safety concern',
  overcharging_pricing: 'Overcharging',
  hygiene_cleanliness: 'Hygiene / cleanliness',
  service_misrepresentation: 'Service not as described',
  transport_issue: 'Transport issue',
  other: 'Other',
}

export function complaintCategoryLabel(category) {
  return COMPLAINT_CATEGORY_LABEL[category] || category
}

// A trip's own honest acceptance-rate data (redistribution.kind), made
// visible to the traveller who generated it -- the point of the My Trips
// page per the frontend sitemap doc (Page 6).
export const REDISTRIBUTION_KIND_LABEL = {
  none: { label: 'Went as planned', tone: 'neutral' },
  place: { label: 'Redirected to another place', tone: 'success' },
  date: { label: 'Shifted to another date', tone: 'success' },
}

export function redistributionKindLabel(kind) {
  return REDISTRIBUTION_KIND_LABEL[kind] || { label: kind || 'Planning', tone: 'neutral' }
}

export const TRIP_STATE_LABEL = {
  draft: { label: 'In progress', tone: 'warning' },
  planned: { label: 'Planned', tone: 'success' },
}

export function tripStateLabel(state) {
  return TRIP_STATE_LABEL[state] || { label: state || 'Unknown', tone: 'neutral' }
}

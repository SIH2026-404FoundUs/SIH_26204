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

export const BOOKING_STATUS = {
  pending: { label: 'Request sent', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export function bookingStatus(status) {
  return BOOKING_STATUS[status] || { label: status, tone: 'neutral' }
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
  // Traveller-facing
  safety_advisory: 'Safety concern',
  overcharging_pricing: 'Overcharging',
  hygiene_cleanliness: 'Hygiene / cleanliness',
  service_misrepresentation: 'Service not as described',
  transport_issue: 'Transport issue',
  // Operator-facing -- an operator reporting something is never
  // complaining about being overcharged the way a traveller would; see
  // complaint.model.js's own comment on this split.
  traveller_dispute: 'Traveller dispute',
  unfair_review: 'Unfair review',
  payment_billing_issue: 'Payment / billing issue',
  platform_policy_issue: 'Platform / policy issue',
  // Worker-facing -- see complaint.model.js's own comment on this split.
  gig_dispute: 'Gig dispute',
  nonpayment: 'Non-payment',
  unsafe_work_conditions: 'Unsafe work conditions',
  unfair_rating: 'Unfair rating',
  other: 'Other',
}

// Which categories each role's report form actually offers -- same shared
// enum/collection, different vocabulary per who's filing it.
export const TRAVELLER_COMPLAINT_CATEGORIES = [
  'safety_advisory', 'overcharging_pricing', 'hygiene_cleanliness', 'service_misrepresentation', 'transport_issue', 'other',
]
export const OPERATOR_COMPLAINT_CATEGORIES = [
  'traveller_dispute', 'unfair_review', 'payment_billing_issue', 'platform_policy_issue', 'safety_advisory', 'other',
]
export const WORKER_COMPLAINT_CATEGORIES = [
  'gig_dispute', 'nonpayment', 'unsafe_work_conditions', 'unfair_rating', 'platform_policy_issue', 'other',
]

export function complaintCategoryLabel(category) {
  return COMPLAINT_CATEGORY_LABEL[category] || category
}

// complaintService.js's own real status progression -- "logged" the moment
// it's submitted, moving to "under_review"/"resolved" only when an
// authority actually acts on it (no auto-resolution anywhere).
export const COMPLAINT_STATUS = {
  logged: { label: 'Logged', tone: 'info' },
  under_review: { label: 'Under review', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
}

export function complaintStatus(status) {
  return COMPLAINT_STATUS[status] || { label: status, tone: 'neutral' }
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

// Worker role -- WorkerProfile.skills / GigRequest.skillNeeded's shared enum
// (worker-role-spec.md §02).
export const WORKER_SKILL_LABEL = {
  guide: 'Guide',
  driver: 'Driver',
  cook: 'Cook',
  cleaner: 'Cleaner',
  porter: 'Porter',
  other: 'Other',
}

export function workerSkillLabel(skill) {
  return WORKER_SKILL_LABEL[skill] || skill
}

// WorkerProfile.governmentId.idType -- self-declared, same as the rest of
// the profile (only verificationTier moving past "self-declared" would mean
// anyone actually checked it).
export const GOVERNMENT_ID_TYPE_LABEL = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  voter_id: 'Voter ID',
  driving_license: 'Driving licence',
  passport: 'Passport',
}

export function governmentIdTypeLabel(idType) {
  return GOVERNMENT_ID_TYPE_LABEL[idType] || idType
}

// Worker badges -- computed from data the profile already carries, never a
// separate stored achievement collection (nothing here can drift from the
// numbers backing it). Each test runs against { profile, completedCount };
// a badge only ever appears when its condition is honestly met, no
// participation badges.
const WORKER_BADGE_DEFS = [
  {
    key: 'id_verified',
    label: 'ID on file',
    tone: 'info',
    test: (p) => Boolean(p.legalName?.trim() && p.governmentId?.idNumber?.trim()),
  },
  {
    key: 'top_rated',
    label: 'Top rated',
    tone: 'success',
    test: (p) => (p.rating?.avg || 0) >= 4.5 && (p.rating?.count || 0) >= 3,
  },
  {
    key: 'reliable',
    label: 'Reliable',
    tone: 'success',
    test: (p, completedCount) => completedCount >= 5,
  },
  {
    key: 'available_now',
    label: 'Available now',
    tone: 'warning',
    test: (p) => p.availability?.mode === 'now',
  },
]

export function getWorkerBadges(profile, completedCount = 0) {
  if (!profile) return []
  return WORKER_BADGE_DEFS.filter((b) => b.test(profile, completedCount)).map((b) => ({ key: b.key, label: b.label, tone: b.tone }))
}

// GigMatch.status -- a worker's own view of one accepted/offered/completed
// job (My Jobs screen).
export const GIG_MATCH_STATUS = {
  offered: { label: 'Offered to you', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'neutral' },
  completed: { label: 'Completed', tone: 'success' },
  no_show: { label: 'No-show', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export function gigMatchStatus(status) {
  return GIG_MATCH_STATUS[status] || { label: status, tone: 'neutral' }
}

// GigRequest.status -- an operator's own view of a posted gig's fill state.
export const GIG_REQUEST_STATUS = {
  open: { label: 'Open — no offers sent yet', tone: 'neutral' },
  matched: { label: 'Matched — awaiting a worker to accept', tone: 'info' },
  filled: { label: 'Filled', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'warning' },
}

export function gigRequestStatus(status) {
  return GIG_REQUEST_STATUS[status] || { label: status, tone: 'neutral' }
}

// GroupTrip.status (Revised Implementation Plan §11's lifecycle).
export const GROUP_TRIP_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  open: { label: 'Open — accepting members', tone: 'success' },
  forming: { label: 'Full — squad forming', tone: 'info' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  active: { label: 'Active', tone: 'success' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

export function groupTripStatus(status) {
  return GROUP_TRIP_STATUS[status] || { label: status, tone: 'neutral' }
}

// GroupTripMember.status -- a creator's view of one join request/membership.
export const GROUP_MEMBER_STATUS = {
  requested: { label: 'Requested', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'neutral' },
  left: { label: 'Left', tone: 'neutral' },
}

export function groupMemberStatus(status) {
  return GROUP_MEMBER_STATUS[status] || { label: status, tone: 'neutral' }
}

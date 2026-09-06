/**
 * Real-Time Tourism Alerts & Safety Advisory Service Module
 *
 * Implements:
 * - Section 3.3 verified advisories with mandatory sourceUrl and sourceName attribution.
 * - Idempotent sha256 hash deduplication and validTo/validFrom time filtering.
 * - Agent wrapper tool getVerifiedAlerts() for ADK agent.
 * - Seeded district emergency contacts registry.
 * - Safe, revocable, read-only shareable trip records.
 * - Tourist complaint logging (quality moderation).
 *
 * STRICT RULE: Zero crime-based safety scoring anywhere in this module.
 */

export {
  ingestAlert,
  getVerifiedAlerts,
  pollAlertsJob,
  calculateAlertHash,
  VALID_ALERT_KINDS,
  VALID_SEVERITIES,
} from "./alertService.js";

export {
  getEmergencyContacts,
  DISTRICT_EMERGENCY_REGISTRY,
  DEFAULT_STATEWIDE_EMERGENCY_CONTACTS,
} from "./emergencyContacts.js";

export {
  createShareableTripRecord,
  getShareableTripRecord,
  revokeShareableTripRecord,
  DEFAULT_SHARE_EXPIRATION_DAYS,
} from "./shareableTripService.js";

export {
  submitTouristComplaint,
  getUserComplaints,
  VALID_COMPLAINT_CATEGORIES,
} from "./complaintService.js";

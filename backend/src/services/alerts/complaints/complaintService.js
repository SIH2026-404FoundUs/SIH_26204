/**
 * Tourist Complaint Logging Service
 *
 * Implements complaint intake for safety, pricing, hygiene, and service issues.
 * Logs complaints for platform moderation and business feedback aggregation.
 *
 * Note per specification: Complaints are logged internally for platform quality control.
 * We explicitly do not claim complaints are auto-forwarded to government authorities.
 */

export const VALID_COMPLAINT_CATEGORIES = [
  "safety_advisory",
  "overcharging_pricing",
  "hygiene_cleanliness",
  "service_misrepresentation",
  "transport_issue",
  // Operator-facing categories -- see complaint.model.js's own comment on
  // this same split.
  "traveller_dispute",
  "unfair_review",
  "payment_billing_issue",
  "platform_policy_issue",
  // Worker-facing categories -- see complaint.model.js's own comment on
  // this same split.
  "gig_dispute",
  "nonpayment",
  "unsafe_work_conditions",
  "unfair_rating",
  "other",
];

/**
 * Submit a tourist complaint report.
 *
 * @param {Object} complaintData - Complaint parameters.
 * @param {string} complaintData.userId - Submitter tourist user ID.
 * @param {string} complaintData.destId - Canonical destination slug (e.g. "shimla").
 * @param {string} [complaintData.businessId] - Optional target business ID.
 * @param {string} [complaintData.category="other"] - Complaint category.
 * @param {string} complaintData.text - Detailed complaint description.
 * @param {Array<string>} [complaintData.photos] - Optional photo evidence URLs.
 *
 * @param {Object} [models] - Database models (ComplaintModel, AuditLogModel).
 * @returns {Promise<Object>} Creation result object.
 */
export async function submitTouristComplaint(complaintData, models = {}) {
  const { ComplaintModel, AuditLogModel } = models;
  const { userId, destId, businessId = null, category = "other", text, photos = [] } = complaintData;

  if (!userId || !destId || !text) {
    return {
      success: false,
      status: 400,
      error: "MISSING_COMPLAINT_PARAMETERS",
      message: "userId, destId, and text are required",
    };
  }

  const cleanCategory = VALID_COMPLAINT_CATEGORIES.includes(category) ? category : "other";

  const newComplaint = {
    userId: String(userId),
    destId: String(destId).toLowerCase().trim(),
    businessId: businessId ? String(businessId) : null,
    category: cleanCategory,
    text: String(text).trim(),
    photos: Array.isArray(photos) ? photos : [],
    status: "logged", // "logged" | "under_review" | "resolved"
    createdAt: new Date(),
  };

  let savedDoc = null;
  if (ComplaintModel && typeof ComplaintModel.create === "function") {
    savedDoc = await ComplaintModel.create(newComplaint);
  } else {
    savedDoc = {
      _id: "comp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      ...newComplaint,
    };
  }

  if (AuditLogModel && typeof AuditLogModel.create === "function") {
    await AuditLogModel.create({
      actor: String(userId),
      action: "complaint.submit",
      target: String(savedDoc._id),
      reasonCode: "COMPLAINT_LOGGED",
      meta: { destId, category: cleanCategory },
      at: new Date(),
    }).catch(() => {});
  }

  return {
    success: true,
    status: 201,
    complaint: savedDoc,
    disclaimer: "Complaint logged for platform quality and moderation review.",
  };
}

/**
 * Get logged complaints for a user.
 *
 * @param {string} userId - User ID.
 * @param {Object} [models] - Database models.
 * @returns {Promise<Array<Object>>} Array of user complaints.
 */
export async function getUserComplaints(userId, models = {}) {
  const { ComplaintModel } = models;
  if (!userId) return [];

  if (ComplaintModel && typeof ComplaintModel.find === "function") {
    return ComplaintModel.find({ userId: String(userId) }).sort({ createdAt: -1 });
  }

  return [];
}

/**
 * Every logged complaint, for the authority moderation view -- optionally
 * filtered to one status (e.g. only "logged" ones still needing a look).
 *
 * @param {Object} [params] - { status }.
 * @param {Object} [models] - Database models (ComplaintModel).
 * @returns {Promise<Array<Object>>} All matching complaints, newest first.
 */
export async function getAllComplaints({ status, limit = 50, skip = 0 } = {}, models = {}) {
  const { ComplaintModel } = models;
  if (!ComplaintModel || typeof ComplaintModel.find !== "function") return [];
  const filter = status ? { status } : {};
  return ComplaintModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
}

export const VALID_COMPLAINT_STATUSES = ["logged", "under_review", "resolved"];

/**
 * Every complaint was created "logged" and nothing ever moved it -- there
 * was no authority-facing way to change a status at all until this. Real
 * status progression, no auto-resolution: an authority has to actually act.
 *
 * @param {string} complaintId - Target complaint ID.
 * @param {string} status - One of VALID_COMPLAINT_STATUSES.
 * @param {Object} [models] - Database models (ComplaintModel, AuditLogModel).
 * @returns {Promise<Object>} Result with the updated complaint.
 */
export async function updateComplaintStatus(complaintId, status, models = {}) {
  const { ComplaintModel, AuditLogModel } = models;

  if (!complaintId || !VALID_COMPLAINT_STATUSES.includes(status)) {
    return { success: false, status: 400, error: "INVALID_STATUS", message: `status must be one of: ${VALID_COMPLAINT_STATUSES.join(", ")}` };
  }
  if (!ComplaintModel || typeof ComplaintModel.findByIdAndUpdate !== "function") {
    return { success: false, status: 500, error: "MODEL_UNAVAILABLE", message: "Could not update complaint" };
  }

  const complaint = await ComplaintModel.findByIdAndUpdate(complaintId, { $set: { status } }, { new: true });
  if (!complaint) {
    return { success: false, status: 404, error: "COMPLAINT_NOT_FOUND", message: "Complaint not found" };
  }

  if (AuditLogModel && typeof AuditLogModel.create === "function") {
    await AuditLogModel.create({
      actor: "authority",
      action: "complaint.status_changed",
      target: String(complaintId),
      reasonCode: `COMPLAINT_${status.toUpperCase()}`,
      meta: { status },
      at: new Date(),
    }).catch(() => {});
  }

  return { success: true, status: 200, complaint };
}

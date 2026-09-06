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

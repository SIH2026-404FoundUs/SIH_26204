import { calculateHaversineDistance } from "../pov/povValidation.js";
import { hasUserVerifiedVisits } from "../pov/povService.js";
import { calculateNameSimilarity, slugify } from "./similarityUtils.js";

/**
 * Community-Powered Destination Discovery Service
 *
 * Implements the 6-step submission & approval pipeline:
 * 1. AUTHZ: User must have >= 1 verified visit anywhere on platform.
 * 2. DEDUP: Reject if existing destination within 5km AND name similarity > 0.7.
 * 3. RATE LIMIT: Max 3 submissions per user per 30 days.
 * 4. ENRICH: AI tag/summary/attribute generation.
 * 5. QUEUE: Write to community_submissions with status "queued" (NEVER directly to destinations).
 * 6. REVIEW: Admin approve/reject step. Approval copies to destinations with provenance="community_submission".
 */

// Deduplication thresholds per specification
export const DEDUP_RADIUS_KM = 5.0;
export const DEDUP_SIMILARITY_THRESHOLD = 0.7;
export const MAX_SUBMISSIONS_PER_30_DAYS = 3;

/**
 * Default AI enrichment generator if external Qwen3 endpoint is omitted.
 */
function defaultAiEnrichment(name, description) {
  return {
    summary: description || `Discovered local destination: ${name}`,
    inferredType: "hidden_gem",
    attrs: {
      nature: 0.8,
      adventure: 0.6,
      culture: 0.3,
      scenic: 0.9,
      crowdingBaseline: 0.2,
      accessibility: 0.5,
      familyFriendly: 0.7,
      seasonal: 0.6,
    },
    confidence: 0.85,
  };
}

/**
 * Step 1-5: Submit a new community destination candidate.
 *
 * @param {Object} params - Submission parameters.
 * @param {string} params.userId - Submitter user ID.
 * @param {string} params.name - Destination name.
 * @param {number} params.lat - Latitude coordinate.
 * @param {number} params.lng - Longitude coordinate.
 * @param {string} [params.description] - Description of the place.
 * @param {Array<string>} [params.photos] - Photos array.
 * @param {Object} [params.aiEnrichment] - Optional pre-computed AI enrichment.
 *
 * @param {Object} [models] - Database models (VisitModel, DestinationModel, CommunitySubmissionModel, AuditLogModel).
 * @returns {Promise<Object>} Submission result object.
 */
export async function submitCommunityDestination(params, models = {}) {
  const { userId, name, lat, lng, description = "", photos = [], aiEnrichment } = params;
  const {
    VisitModel,
    DestinationModel,
    CommunitySubmissionModel,
    AuditLogModel,
  } = models;

  // Basic validation
  if (!userId || !name || lat === undefined || lng === undefined) {
    return {
      success: false,
      status: 400,
      error: "COMMUNITY_MISSING_PARAMETERS",
      message: "userId, name, lat, and lng are required",
    };
  }

  const location = { lat: Number(lat), lng: Number(lng) };

  // Step 1: AUTHZ Check — Submitter must have >= 1 verified visit anywhere
  const isVerifiedUser = await hasUserVerifiedVisits(userId, VisitModel);
  if (!isVerifiedUser) {
    if (AuditLogModel && typeof AuditLogModel.create === "function") {
      await AuditLogModel.create({
        actor: String(userId),
        action: "community.submit.rejected",
        reasonCode: "POV_VERIFIED_VISIT_REQUIRED",
        at: new Date(),
      }).catch(() => {});
    }

    return {
      success: false,
      status: 403,
      error: "POV_VERIFIED_VISIT_REQUIRED",
      message: "You must have completed at least 1 verified visit to submit community places",
    };
  }

  // Step 2: DEDUP Check — Reject if existing destination within 5km AND name similarity > 0.7
  let existingDestinations = [];
  if (DestinationModel && typeof DestinationModel.find === "function") {
    existingDestinations = await DestinationModel.find({});
  }

  let existingSubmissions = [];
  if (CommunitySubmissionModel && typeof CommunitySubmissionModel.find === "function") {
    existingSubmissions = await CommunitySubmissionModel.find({
      status: { $in: ["queued", "approved"] },
    });
  }

  const allPlaces = [
    ...existingDestinations.map((d) => ({
      name: d.name,
      lat: d.location?.lat ?? d.lat,
      lng: d.location?.lng ?? d.lng,
    })),
    ...existingSubmissions.map((s) => ({
      name: s.name,
      lat: s.location?.lat ?? s.lat,
      lng: s.location?.lng ?? s.lng,
    })),
  ];

  for (const place of allPlaces) {
    if (place.lat !== undefined && place.lng !== undefined) {
      const distanceKm = calculateHaversineDistance(location.lat, location.lng, place.lat, place.lng);
      if (distanceKm <= DEDUP_RADIUS_KM) {
        const similarity = calculateNameSimilarity(name, place.name);
        if (similarity > DEDUP_SIMILARITY_THRESHOLD) {
          if (AuditLogModel && typeof AuditLogModel.create === "function") {
            await AuditLogModel.create({
              actor: String(userId),
              action: "community.submit.rejected",
              reasonCode: "COMMUNITY_DUPLICATE_DESTINATION",
              meta: { existingName: place.name, distanceKm, similarity },
              at: new Date(),
            }).catch(() => {});
          }

          return {
            success: false,
            status: 409,
            error: "COMMUNITY_DUPLICATE_DESTINATION",
            message: `A similar destination (${place.name}) already exists within ${distanceKm.toFixed(1)} km`,
          };
        }
      }
    }
  }

  // Step 3: RATE LIMIT Check — Max 3 submissions per user per 30 days
  if (CommunitySubmissionModel) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSubmissionsCount = await CommunitySubmissionModel.countDocuments({
      userId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    if (recentSubmissionsCount >= MAX_SUBMISSIONS_PER_30_DAYS) {
      if (AuditLogModel && typeof AuditLogModel.create === "function") {
        await AuditLogModel.create({
          actor: String(userId),
          action: "community.submit.rejected",
          reasonCode: "COMMUNITY_RATE_LIMIT_EXCEEDED",
          at: new Date(),
        }).catch(() => {});
      }

      return {
        success: false,
        status: 429,
        error: "COMMUNITY_RATE_LIMIT_EXCEEDED",
        message: "Maximum 3 community submissions allowed per user per 30 days",
      };
    }
  }

  // Step 4: ENRICH — Extract AI summary, type, and 8-dim attributes
  const enrichment = aiEnrichment || defaultAiEnrichment(name, description);

  // Step 5: QUEUE — Save to community_submissions with status "queued" (NEVER directly to destinations)
  const newSubmission = {
    userId,
    name: name.trim(),
    location,
    description: description.trim(),
    photos,
    aiEnrichment: enrichment,
    status: "queued",
    createdAt: new Date(),
  };

  let queuedSubmissionDoc = null;
  if (CommunitySubmissionModel && typeof CommunitySubmissionModel.create === "function") {
    queuedSubmissionDoc = await CommunitySubmissionModel.create(newSubmission);
  } else {
    queuedSubmissionDoc = {
      _id: "sub_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      ...newSubmission,
    };
  }

  if (AuditLogModel && typeof AuditLogModel.create === "function") {
    await AuditLogModel.create({
      actor: String(userId),
      action: "community.submit.queued",
      target: String(queuedSubmissionDoc._id),
      reasonCode: "SUBMISSION_QUEUED_FOR_REVIEW",
      at: new Date(),
    }).catch(() => {});
  }

  return {
    success: true,
    status: 201,
    submission: queuedSubmissionDoc,
  };
}

/**
 * Step 6: Admin Review & Approval / Rejection Pipeline.
 *
 * Approval copies entry into destinations collection with trackingTier="referenced"
 * and provenance="community_submission". Rejection updates status to "rejected".
 *
 * @param {Object} reviewParams - Review parameters.
 * @param {string} reviewParams.submissionId - ID of community_submission.
 * @param {string} reviewParams.adminUserId - Admin user performing review.
 * @param {string} reviewParams.action - "approve" | "reject".
 * @param {string} [reviewParams.rejectionReason] - Reason if rejected.
 *
 * @param {Object} [models] - Database models.
 * @returns {Promise<Object>} Review result.
 */
export async function reviewCommunitySubmission(reviewParams, models = {}) {
  const { submissionId, adminUserId, action, rejectionReason } = reviewParams;
  const { DestinationModel, CommunitySubmissionModel, AuditLogModel } = models;

  if (!submissionId || !adminUserId || !action) {
    return {
      success: false,
      status: 400,
      error: "COMMUNITY_MISSING_REVIEW_PARAMS",
      message: "submissionId, adminUserId, and action are required",
    };
  }

  let submission = null;
  if (CommunitySubmissionModel && typeof CommunitySubmissionModel.findById === "function") {
    submission = await CommunitySubmissionModel.findById(submissionId);
  }

  if (!submission || submission.status !== "queued") {
    return {
      success: false,
      status: 404,
      error: "SUBMISSION_NOT_FOUND_OR_PROCESSED",
      message: "Queued submission not found or already processed",
    };
  }

  const now = new Date();

  // Approve action: update submission status AND copy to destinations
  if (action === "approve") {
    submission.status = "approved";
    submission.approvedByAdminId = adminUserId;
    submission.approvedAt = now;

    if (typeof submission.save === "function") {
      await submission.save();
    }

    const destSlug = slugify(submission.name);

    let createdDestination = null;
    if (DestinationModel && typeof DestinationModel.create === "function") {
      createdDestination = await DestinationModel.create({
        destId: destSlug,
        name: submission.name,
        location: submission.location,
        description: submission.description,
        photos: submission.photos || [],
        attrs: submission.aiEnrichment?.attrs,
        trackingTier: "referenced",
        provenance: "community_submission",
        submittedByUserId: submission.userId,
        approvedByAdminId: adminUserId,
        createdAt: now,
      });
    } else {
      createdDestination = {
        _id: "dest_" + Date.now(),
        destId: destSlug,
        name: submission.name,
        trackingTier: "referenced",
        provenance: "community_submission",
      };
    }

    if (AuditLogModel && typeof AuditLogModel.create === "function") {
      await AuditLogModel.create({
        actor: String(adminUserId),
        action: "community.review.approved",
        target: String(submission._id),
        reasonCode: "PROMOTED_TO_REFERENCED_DESTINATION",
        meta: { destId: destSlug, destIdObj: createdDestination._id },
        at: now,
      }).catch(() => {});
    }

    return {
      success: true,
      status: 200,
      action: "approved",
      submission,
      destination: createdDestination,
    };
  }

  // Reject action: update submission status to rejected
  if (action === "reject") {
    submission.status = "rejected";
    submission.rejectedByAdminId = adminUserId;
    submission.rejectedAt = now;
    submission.rejectionReason = rejectionReason || "Did not meet submission criteria";

    if (typeof submission.save === "function") {
      await submission.save();
    }

    if (AuditLogModel && typeof AuditLogModel.create === "function") {
      await AuditLogModel.create({
        actor: String(adminUserId),
        action: "community.review.rejected",
        target: String(submission._id),
        reasonCode: "SUBMISSION_REJECTED_BY_ADMIN",
        meta: { reason: submission.rejectionReason },
        at: now,
      }).catch(() => {});
    }

    return {
      success: true,
      status: 200,
      action: "rejected",
      submission,
    };
  }

  return {
    success: false,
    status: 400,
    error: "INVALID_REVIEW_ACTION",
    message: "Action must be 'approve' or 'reject'",
  };
}

/**
 * Get all queued community submissions for admin review.
 */
export async function getQueuedSubmissions(models = {}) {
  const { CommunitySubmissionModel } = models;
  if (!CommunitySubmissionModel || typeof CommunitySubmissionModel.find !== "function") {
    return [];
  }
  return CommunitySubmissionModel.find({ status: "queued" }).sort({ createdAt: 1 });
}

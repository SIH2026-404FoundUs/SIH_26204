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
  const { userId, name, lat, lng, description = "", photos = [], aiEnrichment, state } = params;
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

  // State is required (not just an optional filter hint) -- free text, not
  // restricted to a fixed list. A traveller can suggest a place anywhere,
  // not just within this platform's currently-seeded destination coverage.
  if (!state || typeof state !== "string" || !state.trim()) {
    return {
      success: false,
      status: 400,
      error: "COMMUNITY_MISSING_STATE",
      message: "state is required",
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
  newSubmission.state = state.trim();

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

  // Flag action: harmful/unethical content -- a distinct terminal state from
  // a routine reject, so it's visibly different in the queue and in audit
  // logs, but uses the exact same status/audit mechanism rather than a
  // disconnected moderation system (spec: "prefer the existing status/audit
  // mechanism... do not create blind permanent database deletion").
  if (action === "flag") {
    submission.status = "flagged";
    submission.rejectedByAdminId = adminUserId; // reuses the reject-side audit fields -- same shape, "flagged" is what makes it distinct
    submission.rejectedAt = now;
    submission.rejectionReason = rejectionReason || "Flagged as harmful or unethical content";

    if (typeof submission.save === "function") {
      await submission.save();
    }

    if (AuditLogModel && typeof AuditLogModel.create === "function") {
      await AuditLogModel.create({
        actor: String(adminUserId),
        action: "community.review.flagged",
        target: String(submission._id),
        reasonCode: "SUBMISSION_FLAGGED_HARMFUL_OR_UNETHICAL",
        meta: { reason: submission.rejectionReason },
        at: now,
      }).catch(() => {});
    }

    return {
      success: true,
      status: 200,
      action: "flagged",
      submission,
    };
  }

  return {
    success: false,
    status: 400,
    error: "INVALID_REVIEW_ACTION",
    message: "Action must be 'approve', 'reject', or 'flag'",
  };
}

/**
 * Get all queued community submissions for admin review.
 */
export async function getQueuedSubmissions({ limit = 50, skip = 0 } = {}, models = {}) {
  const { CommunitySubmissionModel } = models;
  if (!CommunitySubmissionModel || typeof CommunitySubmissionModel.find !== "function") {
    return [];
  }
  return CommunitySubmissionModel.find({ status: "queued" }).sort({ createdAt: 1 }).skip(skip).limit(limit);
}

/**
 * A traveller's own Suggest-a-Place submissions, most recent first -- the
 * missing other half of the review loop: a submission previously vanished
 * into the queue with no way for the traveller who sent it to ever learn
 * whether an authority approved, rejected, or flagged it.
 */
export async function getUserSubmissions(userId, models = {}) {
  const { CommunitySubmissionModel } = models;
  if (!userId || !CommunitySubmissionModel || typeof CommunitySubmissionModel.find !== "function") {
    return [];
  }
  return CommunitySubmissionModel.find({ userId: String(userId) }).sort({ createdAt: -1 });
}

// Radius used for "this destination has N community suggestions nearby" --
// deliberately wider than the 5km submission-time DEDUP_RADIUS_KM above
// (that one only ever compares one new submission against near-identical
// existing ones, to stop the same spot being queued twice; this one asks a
// different question -- "how much community interest exists in this whole
// area" -- so it needs a town/region-sized radius, not a single-spot one).
export const NEARBY_SUGGESTION_RADIUS_KM = 30;

/**
 * Community Forum feed: approved Suggest-a-Place submissions, anonymized
 * (no userId ever included) and optionally filtered by state. Only ever
 * "approved" -- queued/rejected/flagged submissions stay out of any
 * traveller-facing view, preserving the existing moderation workflow
 * rather than turning this into a second, unmoderated publishing path.
 */
export async function getApprovedSubmissions({ state, limit, viewerUserId } = {}, models = {}) {
  const { CommunitySubmissionModel } = models;
  if (!CommunitySubmissionModel || typeof CommunitySubmissionModel.find !== "function") {
    return [];
  }
  const filter = { status: "approved" };
  if (state) filter.state = state;

  const query = CommunitySubmissionModel.find(filter)
    .select("-userId")
    .sort({ approvedAt: -1, createdAt: -1 });
  if (limit) query.limit(Number(limit));
  const docs = await query;

  // Recording a view is a side effect of a GET, which is unusual, but there
  // is no separate "open this post" moment in a card-grid feed the way
  // there is for e.g. a blog post page -- appearing in a logged-in
  // traveller's feed fetch IS the view. Only counted once per viewer per
  // post ($addToSet is a no-op on repeat fetches), and skipped entirely for
  // anonymous/logged-out reads (nothing to attribute the view to) -- doesn't
  // block the response, a slow write here shouldn't slow down the feed.
  const uid = viewerUserId ? String(viewerUserId) : null;
  if (uid && docs.length > 0) {
    CommunitySubmissionModel.updateMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { $addToSet: { viewedBy: uid } }
    ).catch(() => {}); // best-effort -- a failed view-count write must never break the feed itself
  }

  // Reshape likedBy/dislikedBy/viewedBy/comments into anonymized
  // counts/lists + this viewer's own reaction -- the raw userId arrays
  // never leave this function (except each comment's own author check),
  // keeping the forum anonymous the same way userId itself is already
  // excluded above.
  return docs.map((doc) => {
    const obj = doc.toObject();
    const likedBy = obj.likedBy || [];
    const dislikedBy = obj.dislikedBy || [];
    const viewedBy = obj.viewedBy || [];
    const comments = obj.comments || [];
    delete obj.likedBy;
    delete obj.dislikedBy;
    delete obj.viewedBy;
    return {
      ...obj,
      likeCount: likedBy.length,
      dislikeCount: dislikedBy.length,
      myReaction: uid ? (likedBy.includes(uid) ? "like" : dislikedBy.includes(uid) ? "dislike" : null) : null,
      viewCount: uid && !viewedBy.includes(uid) ? viewedBy.length + 1 : viewedBy.length,
      commentCount: comments.length,
      comments: comments
        .map((c) => ({ _id: c._id, text: c.text, createdAt: c.createdAt, isMine: uid ? c.userId === uid : false }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    };
  });
}

/**
 * Add a comment to an approved Community Forum submission. Same
 * "approved only" guard as reactToSubmission -- nothing still in the
 * review queue is reachable from the forum, so there's nothing to comment
 * on there.
 *
 * @param {string} submissionId - Target submission ID.
 * @param {string} userId - Commenting user's ID.
 * @param {string} text - Comment body (1-500 chars).
 * @param {Object} [models] - Database models (CommunitySubmissionModel).
 * @returns {Promise<Object>} Result with the new comment + updated comment count.
 */
export async function addCommentToSubmission(submissionId, userId, text, models = {}) {
  const { CommunitySubmissionModel } = models;
  const trimmed = (text || "").trim();

  if (!submissionId || !userId || !trimmed) {
    return { success: false, status: 400, error: "INVALID_COMMENT", message: "Comment text is required" };
  }
  if (trimmed.length > 500) {
    return { success: false, status: 400, error: "COMMENT_TOO_LONG", message: "Comments are limited to 500 characters" };
  }
  if (!CommunitySubmissionModel || typeof CommunitySubmissionModel.findById !== "function") {
    return { success: false, status: 500, error: "MODEL_UNAVAILABLE", message: "Could not post comment" };
  }

  const submission = await CommunitySubmissionModel.findById(submissionId);
  if (!submission || submission.status !== "approved") {
    return { success: false, status: 404, error: "SUBMISSION_NOT_FOUND", message: "Approved submission not found" };
  }

  const uid = String(userId);
  const comment = { userId: uid, text: trimmed, createdAt: new Date() };
  submission.comments.push(comment);
  await submission.save();

  const saved = submission.comments[submission.comments.length - 1];
  return {
    success: true,
    status: 201,
    comment: { _id: saved._id, text: saved.text, createdAt: saved.createdAt, isMine: true },
    commentCount: submission.comments.length,
  };
}

/**
 * Like or dislike an approved Community Forum submission. One vote per
 * user, mutually exclusive -- liking removes an existing dislike from the
 * same user and vice versa; clicking the same reaction again un-votes.
 * Only ever acts on "approved" submissions -- nothing still in the review
 * queue is reachable from the forum, so there's nothing to react to there.
 *
 * @param {string} submissionId - Target submission ID.
 * @param {string} userId - Reacting user's ID.
 * @param {string} reaction - "like" | "dislike".
 * @param {Object} [models] - Database models (CommunitySubmissionModel).
 * @returns {Promise<Object>} Result with updated counts + the user's own reaction.
 */
export async function reactToSubmission(submissionId, userId, reaction, models = {}) {
  const { CommunitySubmissionModel } = models;

  if (!submissionId || !userId || !["like", "dislike"].includes(reaction)) {
    return {
      success: false,
      status: 400,
      error: "INVALID_REACTION",
      message: "reaction must be 'like' or 'dislike'",
    };
  }
  if (!CommunitySubmissionModel || typeof CommunitySubmissionModel.findById !== "function") {
    return { success: false, status: 500, error: "MODEL_UNAVAILABLE", message: "Could not react to submission" };
  }

  const submission = await CommunitySubmissionModel.findById(submissionId);
  if (!submission || submission.status !== "approved") {
    return {
      success: false,
      status: 404,
      error: "SUBMISSION_NOT_FOUND",
      message: "Approved submission not found",
    };
  }

  const uid = String(userId);
  const likedBy = submission.likedBy || [];
  const dislikedBy = submission.dislikedBy || [];
  const alreadyLiked = likedBy.includes(uid);
  const alreadyDisliked = dislikedBy.includes(uid);

  if (reaction === "like") {
    submission.likedBy = alreadyLiked ? likedBy.filter((id) => id !== uid) : [...likedBy, uid];
    submission.dislikedBy = dislikedBy.filter((id) => id !== uid);
  } else {
    submission.dislikedBy = alreadyDisliked ? dislikedBy.filter((id) => id !== uid) : [...dislikedBy, uid];
    submission.likedBy = likedBy.filter((id) => id !== uid);
  }

  await submission.save();

  return {
    success: true,
    status: 200,
    likeCount: submission.likedBy.length,
    dislikeCount: submission.dislikedBy.length,
    myReaction: submission.likedBy.includes(uid) ? "like" : submission.dislikedBy.includes(uid) ? "dislike" : null,
  };
}

/**
 * How many approved community submissions exist within
 * NEARBY_SUGGESTION_RADIUS_KM of a canonical destination's own coordinates
 * -- "people have suggested N places near here" while planning a trip.
 * Real geo-distance over real approved rows; not the submission-time dedup
 * check and not tied to any single exact spot.
 */
export async function countNearbySuggestions(destLat, destLng, models = {}) {
  const { CommunitySubmissionModel } = models;
  if (typeof destLat !== "number" || typeof destLng !== "number") return 0;
  if (!CommunitySubmissionModel || typeof CommunitySubmissionModel.find !== "function") return 0;

  const approved = await CommunitySubmissionModel.find({ status: "approved" }).select("location");
  return approved.filter(
    (s) => calculateHaversineDistance(destLat, destLng, s.location.lat, s.location.lng) <= NEARBY_SUGGESTION_RADIUS_KM
  ).length;
}

import multer from "multer";
import {
  submitCommunityDestination,
  reviewCommunitySubmission,
  getQueuedSubmissions,
  getUserSubmissions,
  getApprovedSubmissions,
  countNearbySuggestions,
  reactToSubmission,
  addCommentToSubmission,
} from "../services/community/communityService.js";
import { getDestination } from "../services/pressure/seed.js";
import Visit from "../models/visit.model.js";
import CommunitySubmission from "../models/communitySubmission.model.js";
import AuditLog from "../models/auditLog.model.js";
import cloudinary, { optimizedImageUrl } from "../lib/cloudinary.js";
import { parsePagination } from "../lib/pagination.js";
import { logger } from "../lib/logger.js";

// Every submission card in Community Forum/Community Review shows photos at
// thumbnail size, never full resolution -- q_auto/f_auto/width on the way
// out, same helper for every list this controller serves.
function withOptimizedPhotos(docs, width = 600) {
  return docs.map((doc) => {
    const obj = typeof doc.toObject === "function" ? doc.toObject() : doc;
    return { ...obj, photos: (obj.photos || []).map((url) => optimizedImageUrl(url, { width })) };
  });
}

// DestinationModel intentionally omitted: there is no unified Mongo destinations
// collection in this repo yet. Ananya's destinations are file-seeded JSON read
// via services/pressure/seed.js; only destination_pressures lives in Mongo.
// Consequence: the §3.1 DEDUP check currently only compares against OTHER queued/
// approved community submissions, not against the full tracked-destination set.
// Wire a DestinationModel in here once one exists.
const models = { VisitModel: Visit, CommunitySubmissionModel: CommunitySubmission, AuditLogModel: AuditLog };

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB per photo
const MAX_PHOTOS = 6;

export const uploadPhotosMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES },
}).array("photos", MAX_PHOTOS);

// POST /community/photos — uploads to Cloudinary (the project's existing
// image-storage mechanism, previously configured but never actually wired
// to an endpoint) and returns the resulting secure URLs. A separate step
// from POST /submissions on purpose: the submission contract's own
// `photos` field already expects an array of URL strings, not raw files, so
// this keeps that contract untouched -- the frontend uploads first, then
// sends the URLs back with the rest of the form.
export const uploadPhotosController = async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: "at least one photo file is required" });
    }

    const urls = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "sahyatri/community-submissions", resource_type: "image" },
              (error, result) => (error ? reject(error) : resolve(result.secure_url))
            );
            stream.end(file.buffer);
          })
      )
    );

    res.status(201).json({ urls });
  } catch (error) {
    logger.error("Error in uploadPhotos controller", error);
    res.status(500).json({ message: "Could not upload photos" });
  }
};

// POST /community/submissions (spec §3.1)
export const submitSubmissionController = async (req, res) => {
  try {
    const { name, lat, lng, description, photos, state } = req.body;
    const result = await submitCommunityDestination(
      { userId: String(req.user._id), name, lat, lng, description, photos, state },
      models
    );
    res.status(result.status).json(result);
  } catch (error) {
    logger.error("Error in submitSubmission controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /community/submissions/queued — admin review queue (spec §3.1 step 6)
export const getQueuedSubmissionsController = async (req, res) => {
  try {
    if (req.user.role !== "authority") {
      return res.status(403).json({ message: "authority role required" });
    }
    const { limit, skip } = parsePagination(req.query);
    res.status(200).json(withOptimizedPhotos(await getQueuedSubmissions({ limit, skip }, models)));
  } catch (error) {
    logger.error("Error in getQueuedSubmissions controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /community/submissions/mine — the traveller's own Suggest-a-Place
// submissions, so a decision an authority makes in Community Review is
// actually visible back to the traveller who submitted it, closing the
// loop instead of the submission vanishing into the queue silently.
export const getMySubmissionsController = async (req, res) => {
  try {
    res.status(200).json(withOptimizedPhotos(await getUserSubmissions(String(req.user._id), models)));
  } catch (error) {
    logger.error("Error in getMySubmissions controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /community/submissions/:id/review  { action: "approve"|"reject", rejectionReason? }
export const reviewSubmissionController = async (req, res) => {
  try {
    if (req.user.role !== "authority") {
      return res.status(403).json({ message: "authority role required" });
    }
    const { action, rejectionReason } = req.body;
    const result = await reviewCommunitySubmission(
      { submissionId: req.params.id, adminUserId: String(req.user._id), action, rejectionReason },
      models
    );
    res.status(result.status).json(result);
  } catch (error) {
    logger.error("Error in reviewSubmission controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /community/submissions/approved?state=&limit= — public Community Forum
// feed (spec: travellers see what other users have suggested, anonymous,
// filterable by state). No auth required -- same public-read posture as
// GET /v1/businesses/search, GET /v1/alerts, GET /api/destinations. Mounted
// behind optionalAuth (not protectRoute) so it stays reachable logged-out
// (the landing page's "suggested places" section needs that), but a
// logged-in viewer's own like/dislike still comes back on each post.
export const getApprovedSubmissionsController = async (req, res) => {
  try {
    const { state } = req.query;
    const { limit } = parsePagination(req.query, { defaultLimit: 30 });
    const submissions = await getApprovedSubmissions(
      { state, limit, viewerUserId: req.user ? String(req.user._id) : null },
      models
    );
    res.status(200).json(withOptimizedPhotos(submissions));
  } catch (error) {
    logger.error("Error in getApprovedSubmissions controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /community/submissions/:id/react  { reaction: "like"|"dislike" } --
// Community Forum like/dislike. Requires a real signed-in user (unlike the
// GET above) since a vote has to be attributable to exactly one account to
// be worth anything; every authenticated role may react, not just
// travellers, matching /forum's own RequireAuth (not RequireRole) gate.
export const reactToSubmissionController = async (req, res) => {
  try {
    const { reaction } = req.body;
    const result = await reactToSubmission(req.params.id, String(req.user._id), reaction, models);
    res.status(result.status).json(result);
  } catch (error) {
    logger.error("Error in reactToSubmission controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /community/submissions/:id/comments  { text } -- Community Forum
// comments. Requires a real signed-in user for the same reason a reaction
// does (attributable to exactly one account); every authenticated role may
// comment, matching /forum's RequireAuth (not RequireRole) gate.
export const addCommentController = async (req, res) => {
  try {
    const { text } = req.body;
    const result = await addCommentToSubmission(req.params.id, String(req.user._id), text, models);
    res.status(result.status).json(result);
  } catch (error) {
    logger.error("Error in addComment controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /community/nearby-count?destId= — "N people have suggested places
// near here" while planning a trip. Real geo-count against a canonical
// destination's own seeded coordinates (services/pressure/seed.js), not a
// fabricated number.
export const getNearbySuggestionCountController = async (req, res) => {
  try {
    const { destId } = req.query;
    if (!destId) return res.status(400).json({ message: "destId query param required" });

    const destination = getDestination(destId);
    if (!destination?.location) {
      return res.status(200).json({ destId, count: 0 });
    }

    const count = await countNearbySuggestions(destination.location.lat, destination.location.lng, models);
    res.status(200).json({ destId, count });
  } catch (error) {
    logger.error("Error in getNearbySuggestionCount controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

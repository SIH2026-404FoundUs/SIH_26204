import multer from "multer";
import {
  submitCommunityDestination,
  reviewCommunitySubmission,
  getQueuedSubmissions,
  getUserSubmissions,
  getApprovedSubmissions,
  countNearbySuggestions,
} from "../services/community/communityService.js";
import { getDestination } from "../services/pressure/seed.js";
import Visit from "../models/visit.model.js";
import CommunitySubmission from "../models/communitySubmission.model.js";
import AuditLog from "../models/auditLog.model.js";
import cloudinary from "../lib/cloudinary.js";

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
    console.log("Error in uploadPhotos controller", error.message);
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
    console.log("Error in submitSubmission controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /community/submissions/queued — admin review queue (spec §3.1 step 6)
export const getQueuedSubmissionsController = async (req, res) => {
  try {
    if (req.user.role !== "authority") {
      return res.status(403).json({ message: "authority role required" });
    }
    res.status(200).json(await getQueuedSubmissions(models));
  } catch (error) {
    console.log("Error in getQueuedSubmissions controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /community/submissions/mine — the traveller's own Suggest-a-Place
// submissions, so a decision an authority makes in Community Review is
// actually visible back to the traveller who submitted it, closing the
// loop instead of the submission vanishing into the queue silently.
export const getMySubmissionsController = async (req, res) => {
  try {
    res.status(200).json(await getUserSubmissions(String(req.user._id), models));
  } catch (error) {
    console.log("Error in getMySubmissions controller", error.message);
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
    console.log("Error in reviewSubmission controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /community/submissions/approved?state=&limit= — public Community Forum
// feed (spec: travellers see what other users have suggested, anonymous,
// filterable by state). No auth required -- same public-read posture as
// GET /v1/businesses/search, GET /v1/alerts, GET /api/destinations.
export const getApprovedSubmissionsController = async (req, res) => {
  try {
    const { state, limit } = req.query;
    const submissions = await getApprovedSubmissions({ state, limit }, models);
    res.status(200).json(submissions);
  } catch (error) {
    console.log("Error in getApprovedSubmissions controller", error.message);
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
    console.log("Error in getNearbySuggestionCount controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

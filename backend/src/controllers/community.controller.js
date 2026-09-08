import {
  submitCommunityDestination,
  reviewCommunitySubmission,
  getQueuedSubmissions,
} from "../services/community/communityService.js";
import Visit from "../models/visit.model.js";
import CommunitySubmission from "../models/communitySubmission.model.js";
import AuditLog from "../models/auditLog.model.js";

// DestinationModel intentionally omitted: there is no unified Mongo destinations
// collection in this repo yet. Ananya's destinations are file-seeded JSON read
// via services/pressure/seed.js; only destination_pressures lives in Mongo.
// Consequence: the §3.1 DEDUP check currently only compares against OTHER queued/
// approved community submissions, not against the full tracked-destination set.
// Wire a DestinationModel in here once one exists.
const models = { VisitModel: Visit, CommunitySubmissionModel: CommunitySubmission, AuditLogModel: AuditLog };

// POST /community/submissions (spec §3.1)
export const submitSubmissionController = async (req, res) => {
  try {
    const { name, lat, lng, description, photos } = req.body;
    const result = await submitCommunityDestination(
      { userId: String(req.user._id), name, lat, lng, description, photos },
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

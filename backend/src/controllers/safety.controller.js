import { getEmergencyContacts } from "../services/alerts/emergencyContacts.js";
import {
  createShareableTripRecord,
  getShareableTripRecord,
  revokeShareableTripRecord,
  tripBelongsToUser,
} from "../services/alerts/shareable-trips/shareableTripService.js";
import { submitTouristComplaint, getUserComplaints, getAllComplaints, updateComplaintStatus } from "../services/alerts/complaints/complaintService.js";
import ShareableTrip from "../models/shareableTrip.model.js";
import Complaint from "../models/complaint.model.js";
import AuditLog from "../models/auditLog.model.js";
import Trip from "../models/trip.model.js";
import User from "../models/user.model.js";
import { sendMail } from "../lib/mailer.js";
import { complaintStatusEmail } from "../lib/emailTemplates.js";
import { parsePagination } from "../lib/pagination.js";
import { logger } from "../lib/logger.js";

const APP_URL = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();

// GET /api/v1/safety/emergency-contacts/:destId — public, seeded district-keyed
// registry (spec §5.4). No DB needed: the registry is a static, hand-verified
// table, same as a seeded collection would be for this MVP's purposes.
export const getEmergencyContactsController = (req, res) => {
  res.status(200).json(getEmergencyContacts(req.params.destId));
};

// POST /api/v1/safety/trips/share — auth required
export const createShareableTripController = async (req, res) => {
  try {
    const userId = String(req.user._id);
    if (!(await tripBelongsToUser(req.body.tripId, userId, Trip))) {
      return res.status(404).json({ message: "trip not found" });
    }
    const result = await createShareableTripRecord(
      { ...req.body, userId },
      { ShareableTripModel: ShareableTrip, AuditLogModel: AuditLog }
    );
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/v1/safety/trips/share/:token — public read-only projection
export const getShareableTripController = async (req, res) => {
  try {
    const result = await getShareableTripRecord(req.params.token, { ShareableTripModel: ShareableTrip });
    res.status(result.status || 200).json(result);
  } catch (error) {
    logger.error("Error in getShareableTrip controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/safety/trips/share/:token/revoke — auth required, owner only
export const revokeShareableTripController = async (req, res) => {
  try {
    const result = await revokeShareableTripRecord(
      req.params.token,
      String(req.user._id),
      { ShareableTripModel: ShareableTrip, AuditLogModel: AuditLog }
    );
    res.status(result.status || 200).json(result);
  } catch (error) {
    logger.error("Error in revokeShareableTrip controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/safety/complaints — auth required
export const submitComplaintController = async (req, res) => {
  try {
    const result = await submitTouristComplaint(
      { ...req.body, userId: String(req.user._id) },
      { ComplaintModel: Complaint, AuditLogModel: AuditLog }
    );
    res.status(result.status).json(result);
  } catch (error) {
    logger.error("Error in submitComplaint controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/safety/complaints/mine — auth required
export const getMyComplaintsController = async (req, res) => {
  try {
    res.status(200).json(await getUserComplaints(String(req.user._id), { ComplaintModel: Complaint }));
  } catch (error) {
    logger.error("Error in getMyComplaints controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/safety/complaints — authority-only moderation view. Every
// complaint ever submitted was stuck at "logged" forever before this --
// nothing could even see them all in one place, let alone act on them.
export const getAllComplaintsController = async (req, res) => {
  try {
    if (req.user.role !== "authority") return res.status(403).json({ message: "authority role required" });
    const { status } = req.query;
    const { limit, skip } = parsePagination(req.query);
    res.status(200).json(await getAllComplaints({ status, limit, skip }, { ComplaintModel: Complaint }));
  } catch (error) {
    logger.error("Error in getAllComplaints controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// PATCH /api/v1/safety/complaints/:id/status  { status } — authority-only.
// Emails the original submitter on a real status change (best-effort, never
// blocks the response) -- the first time this app has ever closed that loop.
export const updateComplaintStatusController = async (req, res) => {
  try {
    if (req.user.role !== "authority") return res.status(403).json({ message: "authority role required" });
    const { status } = req.body;
    const result = await updateComplaintStatus(req.params.id, status, { ComplaintModel: Complaint, AuditLogModel: AuditLog });

    if (result.success && result.complaint.status !== "logged") {
      const submitter = await User.findById(result.complaint.userId).select("email fullName").catch(() => null);
      if (submitter) {
        sendMail({
          to: submitter.email,
          ...complaintStatusEmail({
            fullName: submitter.fullName,
            category: result.complaint.category,
            destId: result.complaint.destId,
            status: result.complaint.status,
            appUrl: APP_URL,
          }),
        }).catch(() => {});
      }
    }

    res.status(result.status).json(result);
  } catch (error) {
    logger.error("Error in updateComplaintStatus controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

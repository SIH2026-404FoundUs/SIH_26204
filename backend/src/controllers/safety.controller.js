import { getEmergencyContacts } from "../services/alerts/emergencyContacts.js";
import {
  createShareableTripRecord,
  getShareableTripRecord,
  revokeShareableTripRecord,
  tripBelongsToUser,
} from "../services/alerts/shareableTripService.js";
import { submitTouristComplaint, getUserComplaints } from "../services/alerts/complaintService.js";
import ShareableTrip from "../models/shareableTrip.model.js";
import Complaint from "../models/complaint.model.js";
import AuditLog from "../models/auditLog.model.js";
import Trip from "../models/trip.model.js";

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
    console.log("Error in getShareableTrip controller", error.message);
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
    console.log("Error in revokeShareableTrip controller", error.message);
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
    console.log("Error in submitComplaint controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/safety/complaints/mine — auth required
export const getMyComplaintsController = async (req, res) => {
  try {
    res.status(200).json(await getUserComplaints(String(req.user._id), { ComplaintModel: Complaint }));
  } catch (error) {
    console.log("Error in getMyComplaints controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

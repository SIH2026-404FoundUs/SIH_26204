import express from "express";
import { protectRouteOrService } from "../middleware/serviceAuth.middleware.js";
import {
  createGroupTripController,
  listGroupTripsController,
  getMyGroupTripsController,
  getGroupTripController,
  updateGroupTripController,
  getGroupMembersController,
  joinGroupTripController,
  leaveGroupTripController,
  acceptGroupMemberController,
  rejectGroupMemberController,
  getGroupMatchReasonsController,
  searchGroupMatchesController,
  requestCaptainController,
} from "../controllers/groupTrips.controller.js";

const router = express.Router();

// Every Group Travel route requires a signed-in traveller OR a trusted
// internal service call (ai-service's SequentialAgent tools, same pattern
// trips.controller.js already uses) -- discovery itself is not public
// (§19: "non-members see limited group/member information"), simplest
// honest enforcement for an MVP is auth-required reads, same posture as
// My Trips.
router.use(protectRouteOrService);

// Static/prefixed paths BEFORE "/:id" so "me" and "search" are never
// parsed as a group id.
router.get("/me", getMyGroupTripsController);
router.get("/search/matches", searchGroupMatchesController);

router.get("/", listGroupTripsController);
router.post("/", createGroupTripController);
router.get("/:id", getGroupTripController);
router.patch("/:id", updateGroupTripController);
router.get("/:id/members", getGroupMembersController);
router.post("/:id/join", joinGroupTripController);
router.post("/:id/leave", leaveGroupTripController);
router.post("/:id/members/:userId/accept", acceptGroupMemberController);
router.post("/:id/members/:userId/reject", rejectGroupMemberController);
router.get("/:id/matches", getGroupMatchReasonsController);
router.post("/:id/captain", requestCaptainController);

export default router;

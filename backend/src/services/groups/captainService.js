/**
 * Captain/Gig bridge (Revised Implementation Plan §13/§17) -- connects a
 * GroupTrip to the EXISTING Worker/Gig marketplace. No second worker
 * marketplace, no parallel matching/acceptance logic: this just calls
 * createGigRequest() (gigService.js, unchanged) with group context in the
 * notes, and links the resulting GigRequest back to the group so the
 * existing atomic-accept flow can close the loop.
 */

import { createGigRequest } from "../gigs/gigService.js";

export async function requestCaptainForGroup(groupTripId, actorId, { skillNeeded = "guide", budget } = {}, models = {}) {
  const { GroupTripModel, GigRequestModel, GigMatchModel, WorkerProfileModel } = models;
  const group = await GroupTripModel.findById(groupTripId);
  if (!group) return { success: false, status: 404, message: "group trip not found" };
  if (String(group.creatorId) !== String(actorId)) {
    return { success: false, status: 403, message: "only the creator can request a captain" };
  }
  if (group.captainId) {
    return { success: false, status: 400, message: "this group already has a captain assigned" };
  }

  const result = await createGigRequest(
    actorId,
    {
      destId: group.destId,
      skillNeeded,
      startDate: group.startDate,
      endDate: group.endDate,
      headcount: 1,
      budget,
      notes: `Group captain/guide for a ${group.currentMembers}-person travel squad.`,
    },
    { GigRequestModel, GigMatchModel, WorkerProfileModel }
  );
  if (!result.success) return result;

  await GroupTripModel.updateOne({ _id: groupTripId }, { $set: { captainGigRequestId: result.gigRequest._id } });
  return { success: true, status: 201, gigRequest: result.gigRequest, matchCount: result.matchCount };
}

// Called from gigs.controller.js's existing accept-gig path once a worker
// atomically claims the gig -- gigService.acceptGig() itself needs no
// changes; this just closes the loop back onto the group afterward.
// Returns linked:false (not an error) for the overwhelming majority of
// gig accepts that have nothing to do with a group at all.
export async function assignCaptainFromGig(gigRequestId, workerUserId, models = {}) {
  const { GroupTripModel } = models;
  const group = await GroupTripModel.findOne({ captainGigRequestId: gigRequestId });
  if (!group) return { success: true, status: 200, linked: false };
  await GroupTripModel.updateOne({ _id: group._id }, { $set: { captainId: workerUserId } });
  return { success: true, status: 200, linked: true, groupTripId: group._id };
}

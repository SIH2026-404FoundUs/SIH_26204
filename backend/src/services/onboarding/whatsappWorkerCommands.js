/**
 * Worker-role WhatsApp text commands -- extends the existing inbound-text
 * branch (whatsappWebhook.controller.js's `type === "text"` handling,
 * previously only DRAFT_CONFIRM replies) with two additive capabilities the
 * low-bandwidth pass called for: accepting/declining a gig offer by a plain
 * text reply, and a short Travel Education fact lookup by destination name.
 * Both matter specifically because this channel already works on 2G/
 * intermittent connectivity (proven by the existing onboarding pipeline) --
 * no new infrastructure, same webhook, same sendWhatsAppMessage() primitive.
 *
 * Deliberately rule-based, not AI-interpreted: a worker's "YES" either maps
 * to a real pending offer or it doesn't, and a destination lookup either
 * returns real seeded facts or says it found nothing -- never a guessed
 * interpretation of ambiguous text.
 */

import { loadDestinations } from "../pressure/seed.js";
import { acceptGig } from "../gigs/gigService.js";

const ACCEPT_WORDS = new Set(["yes", "y", "accept", "1"]);
const DECLINE_WORDS = new Set(["no", "n", "decline", "2"]);

function formatDestinationFacts(dest) {
  const lines = [`${dest.displayName}`];
  if (dest.nearestAirport) lines.push(`Nearest airport: ${dest.nearestAirport}`);
  if (dest.nearestRailhead) lines.push(`Nearest railhead: ${dest.nearestRailhead}${dest.railheadDistanceKm ? ` (${dest.railheadDistanceKm} km)` : ""}`);
  if (dest.road_corridor) lines.push(`Road: ${dest.road_corridor}`);
  if (dest.baseline_hotelMedianINR) lines.push(`Typical stay price: Rs ${dest.baseline_hotelMedianINR}/night`);
  return lines.join("\n");
}

// Finds the destination whose displayName/_id best matches free text -- an
// exact id match first, then a case-insensitive substring match against
// the display name (e.g. "manali" or "info manali" both find Manali).
function findDestinationByText(text) {
  const needle = text.trim().toLowerCase();
  const destinations = loadDestinations();
  const exact = destinations.find((d) => d._id === needle);
  if (exact) return exact;
  return destinations.find((d) => d.displayName?.toLowerCase().includes(needle)) || null;
}

/**
 * @param {Object} params - { from, text }.
 * @param {Object} models - { UserModel, WorkerProfileModel, GigMatchModel, GigRequestModel }.
 * @param {Object} [deps] - { sendMessageFn } for sendWhatsAppMessage's own injectable send backend.
 * @returns {Promise<{handled: boolean, action?: string}>} handled:false means
 *   "not a worker command, caller should fall through to its own handling."
 */
export async function handleWorkerTextCommand({ from, text }, models, { sendMessageFn } = {}) {
  const { UserModel, WorkerProfileModel, GigMatchModel, GigRequestModel } = models;
  const { sendWhatsAppMessage } = await import("./sendMessage.js");

  const user = await UserModel.findOne({ phone: from, role: "worker" });
  if (!user) return { handled: false };

  const profile = await WorkerProfileModel.findOne({ userId: user._id });
  if (!profile) return { handled: false };

  const normalized = text.trim().toLowerCase();

  if (ACCEPT_WORDS.has(normalized) || DECLINE_WORDS.has(normalized)) {
    const pendingMatch = await GigMatchModel.findOne({ workerId: profile._id, status: "offered" }).sort({ createdAt: -1 });
    if (!pendingMatch) {
      await sendWhatsAppMessage(from, "You have no pending gig offers right now.", sendMessageFn);
      return { handled: true, action: "no_pending_offer" };
    }

    if (ACCEPT_WORDS.has(normalized)) {
      const result = await acceptGig(String(pendingMatch.gigRequestId), user._id, {
        GigRequestModel,
        GigMatchModel,
        WorkerProfileModel,
      });
      await sendWhatsAppMessage(
        from,
        result.success ? "Gig accepted. The operator has been notified." : `Could not accept: ${result.message}`,
        sendMessageFn
      );
      return { handled: true, action: "accept" };
    }

    // Decline: same atomic "only if still offered" guard acceptGig uses,
    // just flipping to "declined" instead of "accepted" -- a second reply
    // after someone else already claimed it (or after it auto-cancelled)
    // finds nothing to update and fails honestly rather than racing.
    const declined = await GigMatchModel.findOneAndUpdate(
      { _id: pendingMatch._id, status: "offered" },
      { $set: { status: "declined", respondedAt: new Date() } },
      { new: true }
    );
    await sendWhatsAppMessage(
      from,
      declined ? "Gig declined." : "That offer is no longer available to respond to.",
      sendMessageFn
    );
    return { handled: true, action: "decline" };
  }

  // Not an accept/decline reply -- try it as a Travel Education lookup
  // (real seeded facts only, never fabricated prose).
  const dest = findDestinationByText(normalized);
  if (dest) {
    await sendWhatsAppMessage(from, formatDestinationFacts(dest), sendMessageFn);
    return { handled: true, action: "education_lookup" };
  }

  return { handled: false };
}

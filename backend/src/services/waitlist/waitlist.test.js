/**
 * SmartWaitlist & Offers Unit Test Suite
 *
 * Verifies:
 * 1. Atomic Claim Fix (Concurrent burst simulation: 1 winner receives status 200, others receive 409 already_claimed)
 * 2. "Nearby" Matching by canonical destId slug
 * 3. Budget Headroom x Recency ranking
 * 4. 20 recipient cap limit
 * 5. 24h flash notification cap (max 3 per 24h)
 * 6. 7-day decline ban rule
 * 7. Scheduled offer expiration job
 */

import assert from "assert";
import {
  createOffer,
  claimOfferAtomic,
  expireOffersJob,
  filterAndRankWaitlists,
  recordDestinationDecline,
  createWaitlistEntry,
  processOfferMatching,
} from "./index.js";

async function runTests() {
  console.log("🧪 Starting SmartWaitlist & Offers Unit Tests...\n");

  const destId = "shimla";
  const businessId = "bus_restaurant_001";
  const offerDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

  // Test 1: Atomic Claim Lock & Concurrency Simulation
  console.log("Test 1: Atomic Claim Fix — Concurrent Burst Simulation");
  
  // Mock shared offer document in database
  let inMemoryOffer = {
    _id: "off_atomic_123",
    businessId,
    destId,
    date: offerDate,
    originalPrice: 1000,
    discountPct: 30,
    effectivePrice: 700,
    status: "open",
    claimedBy: null,
    claimedAt: null,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins validity
  };

  const mockOfferModel = {
    findOneAndUpdate: async (query, update) => {
      // Simulate MongoDB atomic query match: _id, status="open", expiresAt > now
      const now = new Date();
      if (
        inMemoryOffer._id === query._id &&
        inMemoryOffer.status === query.status &&
        inMemoryOffer.expiresAt > now
      ) {
        // Atomic state mutation
        inMemoryOffer.status = update.$set.status;
        inMemoryOffer.claimedBy = update.$set.claimedBy;
        inMemoryOffer.claimedAt = update.$set.claimedAt;
        return { ...inMemoryOffer };
      }
      return null; // Return null if lock failed / already claimed
    },
  };

  const mockWaitlistModel = {
    updateOne: async () => ({ nModified: 1 }),
  };

  const models = {
    OfferModel: mockOfferModel,
    WaitlistModel: mockWaitlistModel,
  };

  // Simulate 10 tourists firing concurrent claim requests simultaneously
  const touristIds = Array.from({ length: 10 }, (_, i) => `user_tourist_${i + 1}`);
  const claimPromises = touristIds.map((userId) =>
    claimOfferAtomic("off_atomic_123", userId, models)
  );

  const results = await Promise.all(claimPromises);

  const winners = results.filter((r) => r.status === 200);
  const losers = results.filter((r) => r.status === 409);

  assert.strictEqual(winners.length, 1);
  assert.strictEqual(losers.length, 9);
  assert.strictEqual(losers[0].error, "already_claimed");
  assert.strictEqual(inMemoryOffer.status, "claimed");
  assert.notStrictEqual(inMemoryOffer.claimedBy, null);

  console.log(`  ✅ Concurrent burst test passed! 1 Winner (${winners[0].offer.claimedBy}), 9 rejected with 409 already_claimed.`);

  // Test 2: "Nearby" Destination Matching (destId matching)
  console.log("\nTest 2: 'Nearby' Destination Matching (Canonical destId)");
  const testOffer = {
    _id: "off_shimla_999",
    destId: "shimla",
    effectivePrice: 500,
    date: offerDate,
  };

  const candidateWaitlists = [
    {
      _id: "w1",
      userId: "u1",
      destId: "shimla", // Matches
      state: "waiting",
      window: { from: new Date(Date.now() - 3600000), to: new Date(Date.now() + 86400000) },
      criteria: { maxPriceINR: 1000 },
      createdAt: new Date(Date.now() - 2000),
    },
    {
      _id: "w2",
      userId: "u2",
      destId: "manali", // Different destination -> MUST be filtered out
      state: "waiting",
      window: { from: new Date(Date.now() - 3600000), to: new Date(Date.now() + 86400000) },
      criteria: { maxPriceINR: 1000 },
      createdAt: new Date(Date.now() - 1000),
    },
  ];

  const matchedNear = filterAndRankWaitlists(candidateWaitlists, testOffer);
  assert.strictEqual(matchedNear.length, 1);
  assert.strictEqual(matchedNear[0]._id, "w1");
  console.log("  ✅ Filtered out different destination ('manali'); matched same destId ('shimla')");

  // Test 3: Budget Headroom & Recency Ranking + 20 Recipient Cap
  console.log("\nTest 3: Budget Headroom Ranking & 20 Recipient Cap");
  // Create 30 waitlists for shimla with varying budget headroom
  const largeWaitlistPool = Array.from({ length: 30 }, (_, i) => ({
    _id: `w_pool_${i + 1}`,
    userId: `u_pool_${i + 1}`,
    destId: "shimla",
    state: "waiting",
    window: { from: new Date(Date.now() - 3600000), to: new Date(Date.now() + 86400000) },
    criteria: { maxPriceINR: 600 + i * 50 }, // Increasing budget headroom
    createdAt: new Date(Date.now() - i * 10000),
  }));

  const rankedRecipients = filterAndRankWaitlists(largeWaitlistPool, testOffer);
  assert.strictEqual(rankedRecipients.length, 20); // Must be capped at 20 max
  // Highest budget headroom should rank first
  assert.strictEqual(rankedRecipients[0].criteria.maxPriceINR >= rankedRecipients[19].criteria.maxPriceINR, true);
  console.log(`  ✅ Capped at exactly 20 recipients out of 30 candidates; ranked by budget headroom.`);

  // Test 4: Rate Limiting — Max 3 Notifications per 24h
  console.log("\nTest 4: Rate Limiting — Max 3 Notifications per 24h");
  const overNotifiedWaitlist = {
    _id: "w_overnotified",
    userId: "u_spammer",
    destId: "shimla",
    state: "waiting",
    window: { from: new Date(Date.now() - 3600000), to: new Date(Date.now() + 86400000) },
    criteria: { maxPriceINR: 1000 },
    notificationHistory: [
      { sentAt: new Date(Date.now() - 1 * 3600000) },
      { sentAt: new Date(Date.now() - 2 * 3600000) },
      { sentAt: new Date(Date.now() - 3 * 3600000) }, // 3 in 24h
    ],
  };

  const rateLimitMatch = filterAndRankWaitlists([overNotifiedWaitlist], testOffer);
  assert.strictEqual(rateLimitMatch.length, 0);
  console.log("  ✅ Rejected user with 3 notifications in last 24h");

  // Test 5: Rate Limiting — 7-Day Decline Ban Rule
  console.log("\nTest 5: Rate Limiting — 7-Day Decline Ban Rule");
  let declinedWaitlist = {
    _id: "w_declined",
    userId: "u_decliner",
    destId: "shimla",
    state: "waiting",
    window: { from: new Date(Date.now() - 3600000), to: new Date(Date.now() + 86400000) },
    criteria: { maxPriceINR: 1000 },
    declinedDestinations: [],
  };

  recordDestinationDecline(declinedWaitlist, "shimla", new Date(Date.now() - 2 * 86400000)); // Declined 2 days ago

  const declineMatch = filterAndRankWaitlists([declinedWaitlist], testOffer);
  assert.strictEqual(declineMatch.length, 0);
  console.log("  ✅ Excluded user who declined 'shimla' within the last 7 days");

  // Test 6: Offer Expiration Job
  console.log("\nTest 6: Scheduled Offer Expiration Job");
  let expiredCount = 0;
  const mockOfferModelWithExpiry = {
    updateMany: async (query, update) => {
      assert.strictEqual(query.status, "open");
      assert.strictEqual(update.$set.status, "expired");
      expiredCount = 5;
      return { modifiedCount: 5 };
    },
  };

  const jobResult = await expireOffersJob({ OfferModel: mockOfferModelWithExpiry });
  assert.strictEqual(jobResult.expiredCount, 5);
  console.log(`  ✅ Expired offers job successfully updated ${jobResult.expiredCount} expired open offers.`);

  console.log("\n🎉 ALL 6 SMARTWAITLIST & OFFERS UNIT TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});

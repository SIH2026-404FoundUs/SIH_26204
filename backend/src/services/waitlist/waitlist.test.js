/**
 * Jest Unit Test Suite for SmartWaitlist & Shared Offers
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

import {
  claimOfferAtomic,
  expireOffersJob,
  filterAndRankWaitlists,
  recordDestinationDecline,
} from "./index.js";

describe("SmartWaitlist & Shared Offers Service", () => {
  const destId = "shimla";
  const businessId = "bus_restaurant_001";
  const offerDate = new Date(Date.now() + 2 * 60 * 60 * 1000);

  test("Atomic Claim Fix — Concurrent Burst Simulation", async () => {
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
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    const mockOfferModel = {
      findOneAndUpdate: async (query, update) => {
        const now = new Date();
        if (
          inMemoryOffer._id === query._id &&
          inMemoryOffer.status === query.status &&
          inMemoryOffer.expiresAt > now
        ) {
          inMemoryOffer.status = update.$set.status;
          inMemoryOffer.claimedBy = update.$set.claimedBy;
          inMemoryOffer.claimedAt = update.$set.claimedAt;
          return { ...inMemoryOffer };
        }
        return null;
      },
    };

    const mockWaitlistModel = {
      updateOne: async () => ({ nModified: 1 }),
    };

    const models = {
      OfferModel: mockOfferModel,
      WaitlistModel: mockWaitlistModel,
    };

    const touristIds = Array.from({ length: 10 }, (_, i) => `user_tourist_${i + 1}`);
    const claimPromises = touristIds.map((userId) =>
      claimOfferAtomic("off_atomic_123", userId, models)
    );

    const results = await Promise.all(claimPromises);

    const winners = results.filter((r) => r.status === 200);
    const losers = results.filter((r) => r.status === 409);

    expect(winners.length).toBe(1);
    expect(losers.length).toBe(9);
    expect(losers[0].error).toBe("already_claimed");
    expect(inMemoryOffer.status).toBe("claimed");
    expect(inMemoryOffer.claimedBy).not.toBeNull();
  });

  test("Nearby Destination Matching (Canonical destId)", () => {
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
        destId: "shimla",
        state: "waiting",
        window: { from: new Date(Date.now() - 3600000), to: new Date(Date.now() + 86400000) },
        criteria: { maxPriceINR: 1000 },
        createdAt: new Date(Date.now() - 2000),
      },
      {
        _id: "w2",
        userId: "u2",
        destId: "manali",
        state: "waiting",
        window: { from: new Date(Date.now() - 3600000), to: new Date(Date.now() + 86400000) },
        criteria: { maxPriceINR: 1000 },
        createdAt: new Date(Date.now() - 1000),
      },
    ];

    const matchedNear = filterAndRankWaitlists(candidateWaitlists, testOffer);
    expect(matchedNear.length).toBe(1);
    expect(matchedNear[0]._id).toBe("w1");
  });

  test("Budget Headroom Ranking & 20 Recipient Cap", () => {
    const testOffer = {
      _id: "off_shimla_999",
      destId: "shimla",
      effectivePrice: 500,
      date: offerDate,
    };

    const largeWaitlistPool = Array.from({ length: 30 }, (_, i) => ({
      _id: `w_pool_${i + 1}`,
      userId: `u_pool_${i + 1}`,
      destId: "shimla",
      state: "waiting",
      window: { from: new Date(Date.now() - 3600000), to: new Date(Date.now() + 86400000) },
      criteria: { maxPriceINR: 600 + i * 50 },
      createdAt: new Date(Date.now() - i * 10000),
    }));

    const rankedRecipients = filterAndRankWaitlists(largeWaitlistPool, testOffer);
    expect(rankedRecipients.length).toBe(20);
    expect(rankedRecipients[0].criteria.maxPriceINR >= rankedRecipients[19].criteria.maxPriceINR).toBe(true);
  });

  test("Rate Limiting — Max 3 Notifications per 24h", () => {
    const testOffer = {
      _id: "off_shimla_999",
      destId: "shimla",
      effectivePrice: 500,
      date: offerDate,
    };

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
        { sentAt: new Date(Date.now() - 3 * 3600000) },
      ],
    };

    const rateLimitMatch = filterAndRankWaitlists([overNotifiedWaitlist], testOffer);
    expect(rateLimitMatch.length).toBe(0);
  });

  test("Rate Limiting — 7-Day Decline Ban Rule", () => {
    const testOffer = {
      _id: "off_shimla_999",
      destId: "shimla",
      effectivePrice: 500,
      date: offerDate,
    };

    let declinedWaitlist = {
      _id: "w_declined",
      userId: "u_decliner",
      destId: "shimla",
      state: "waiting",
      window: { from: new Date(Date.now() - 3600000), to: new Date(Date.now() + 86400000) },
      criteria: { maxPriceINR: 1000 },
      declinedDestinations: [],
    };

    recordDestinationDecline(declinedWaitlist, "shimla", new Date(Date.now() - 2 * 86400000));

    const declineMatch = filterAndRankWaitlists([declinedWaitlist], testOffer);
    expect(declineMatch.length).toBe(0);
  });

  test("Scheduled Offer Expiration Job", async () => {
    const mockOfferModelWithExpiry = {
      updateMany: async (query, update) => {
        expect(query.status).toBe("open");
        expect(update.$set.status).toBe("expired");
        return { modifiedCount: 5 };
      },
    };

    const jobResult = await expireOffersJob({ OfferModel: mockOfferModelWithExpiry });
    expect(jobResult.expiredCount).toBe(5);
  });
});

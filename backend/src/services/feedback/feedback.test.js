/**
 * Jest Unit Test Suite for AI Tourist Feedback Intelligence & Business Growth Ranking
 *
 * Verifies:
 * 1. Tourist feedback submission (category, rating 1-5, comment validation)
 * 2. Minimum feedback threshold check (skipped if < 5 reviews, processed if >= 5)
 * 3. Theme mentions threshold (surfaces ONLY themes with mentions >= 3, with valid evidenceIdx pointers)
 * 4. Actionable business improvement recommendations (action, effort, impact)
 * 5. Section 3.4 Growth Ranking Formula (isLocallyOnboarded, tierWeight, isInLowPressureDest)
 */

import {
  submitTouristFeedback,
  processBusinessFeedback,
  getBusinessFeedbackInsights,
  calculateBusinessGrowthRank,
  rankBusinessesForGrowth,
} from "./index.js";

describe("AI Tourist Feedback Intelligence & Growth Ranking", () => {
  const businessId = "bus_hotel_shimla_001";
  const destId = "shimla";

  test("Tourist Feedback Submission & Validation", async () => {
    const badRatingResult = await submitTouristFeedback({
      userId: "usr_tourist_1",
      businessId,
      destId,
      category: "hotel",
      rating: 6,
      comment: "Great stay!",
    });
    expect(badRatingResult.success).toBe(false);
    expect(badRatingResult.status).toBe(400);
    expect(badRatingResult.error).toBe("INVALID_RATING");

    const validSubmissionResult = await submitTouristFeedback({
      userId: "usr_tourist_1",
      businessId,
      destId,
      category: "hotel",
      rating: 5,
      comment: "Staff was friendly, room was very clean and tidy!",
    });
    expect(validSubmissionResult.success).toBe(true);
    expect(validSubmissionResult.status).toBe(201);
    expect(validSubmissionResult.feedback.rating).toBe(5);
  });

  test("Minimum Feedback Threshold Check (< 5 reviews skipped)", async () => {
    const mockFeedbackModelUnderThreshold = {
      find: async () => [
        { comment: "Good", rating: 4 },
        { comment: "Clean room", rating: 5 },
      ],
    };

    const underThresholdResult = await processBusinessFeedback(businessId, {
      FeedbackModel: mockFeedbackModelUnderThreshold,
    });
    expect(underThresholdResult.processed).toBe(false);
    expect(underThresholdResult.reason).toBe("MINIMUM_FEEDBACK_THRESHOLD_NOT_MET");
    expect(underThresholdResult.reviewCount).toBe(2);
  });

  test("AI Theme Extraction & Mentions Threshold (mentions >= 3)", async () => {
    const mockReviews = [
      { comment: "The room cleanliness was bad, dusty bed and dirty bathroom", rating: 2 },
      { comment: "Hot water geyser was not working in the morning", rating: 2 },
      { comment: "Very dirty washroom and dusty room, cleanliness needs work", rating: 1 },
      { comment: "Staff was polite and friendly", rating: 5 },
      { comment: "Extremely dirty room, dust everywhere, bad cleanliness", rating: 1 },
      { comment: "Good food taste", rating: 4 },
    ];

    const mockFeedbackModelOverThreshold = {
      find: async () => mockReviews,
    };

    const mockBusinessModel = {
      findByIdAndUpdate: async (id, update) => ({ _id: id, ...update.$set }),
    };

    const processedResult = await processBusinessFeedback(businessId, {
      FeedbackModel: mockFeedbackModelOverThreshold,
      BusinessModel: mockBusinessModel,
    });

    expect(processedResult.processed).toBe(true);
    expect(processedResult.totalReviews).toBe(6);
    expect(processedResult.themes.length > 0).toBe(true);

    const cleanlinessTheme = processedResult.themes.find((t) => t.theme.includes("Cleanliness"));
    expect(cleanlinessTheme).not.toBeUndefined();
    expect(cleanlinessTheme.mentions >= 3).toBe(true);
    expect(Array.isArray(cleanlinessTheme.evidenceIdx)).toBe(true);

    const foodTheme = processedResult.themes.find((t) => t.theme.includes("Food Quality"));
    expect(foodTheme).toBeUndefined();
  });

  test("Business Insights Retrieval & Evidence Mapping", async () => {
    const mockReviews = [
      { comment: "The room cleanliness was bad, dusty bed and dirty bathroom", rating: 2 },
      { comment: "Hot water geyser was not working in the morning", rating: 2 },
      { comment: "Very dirty washroom and dusty room, cleanliness needs work", rating: 1 },
      { comment: "Staff was polite and friendly", rating: 5 },
      { comment: "Extremely dirty room, dust everywhere, bad cleanliness", rating: 1 },
      { comment: "Good food taste", rating: 4 },
    ];

    const mockFeedbackModelOverThreshold = {
      find: async () => mockReviews,
    };

    const insights = await getBusinessFeedbackInsights(businessId, {
      FeedbackModel: mockFeedbackModelOverThreshold,
    });

    expect(insights.totalReviews).toBe(6);
    expect(insights.meetsThreshold).toBe(true);
    expect(insights.themes[0].sourceSnippets.length > 0).toBe(true);
    expect(insights.actions.length > 0).toBe(true);
  });

  test("Section 3.4 Business Growth Ranking Formula", () => {
    const busA = {
      _id: "bus_a",
      onboardedVia: "web",
      verificationTier: "self-declared",
      destId: "shimla",
    };
    const rankA = calculateBusinessGrowthRank(busA, { baseRelevance: 1.0, isInLowPressureDest: false });
    expect(rankA.rank).toBe(1.0);

    const busB = {
      _id: "bus_b",
      onboardedVia: "whatsapp",
      verificationTier: "visit-verified",
      destId: "tirthan-valley",
    };
    const rankB = calculateBusinessGrowthRank(busB, { baseRelevance: 1.0, isInLowPressureDest: true });
    expect(rankB.rank).toBe(1.788);

    const rankedList = rankBusinessesForGrowth([busA, busB], { lowPressureDestinations: ["tirthan-valley"] });
    expect(rankedList[0]._id).toBe("bus_b");
  });
});

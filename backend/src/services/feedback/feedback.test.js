/**
 * AI Tourist Feedback Intelligence & Business Growth Ranking Unit Test Suite
 *
 * Verifies:
 * 1. Tourist feedback submission (category, rating 1-5, comment validation)
 * 2. Minimum feedback threshold check (skipped if < 5 reviews, processed if >= 5)
 * 3. Theme mentions threshold (surfaces ONLY themes with mentions >= 3, with valid evidenceIdx pointers)
 * 4. Actionable business improvement recommendations (action, effort, impact)
 * 5. Section 3.4 Growth Ranking Formula (isLocallyOnboarded, tierWeight, isInLowPressureDest)
 */

import assert from "assert";
import {
  submitTouristFeedback,
  processBusinessFeedback,
  getBusinessFeedbackInsights,
  calculateBusinessGrowthRank,
  rankBusinessesForGrowth,
} from "./index.js";

async function runTests() {
  console.log("🧪 Starting AI Tourist Feedback & Growth Ranking Unit Tests...\n");

  const businessId = "bus_hotel_shimla_001";
  const destId = "shimla";

  // Test 1: Tourist Feedback Submission
  console.log("Test 1: Tourist Feedback Submission & Validation");

  // Invalid rating test
  const badRatingResult = await submitTouristFeedback({
    userId: "usr_tourist_1",
    businessId,
    destId,
    category: "hotel",
    rating: 6, // invalid
    comment: "Great stay!",
  });
  assert.strictEqual(badRatingResult.success, false);
  assert.strictEqual(badRatingResult.status, 400);
  assert.strictEqual(badRatingResult.error, "INVALID_RATING");

  // Valid submission
  const validSubmissionResult = await submitTouristFeedback({
    userId: "usr_tourist_1",
    businessId,
    destId,
    category: "hotel",
    rating: 5,
    comment: "Staff was friendly, room was very clean and tidy!",
  });
  assert.strictEqual(validSubmissionResult.success, true);
  assert.strictEqual(validSubmissionResult.status, 201);
  assert.strictEqual(validSubmissionResult.feedback.rating, 5);
  console.log("  ✅ Validated rating boundaries (1-5) and created valid feedback document");

  // Test 2: Minimum Feedback Threshold Check (< 5 reviews skipped)
  console.log("\nTest 2: Minimum Feedback Threshold Check (< 5 reviews skipped)");
  const mockFeedbackModelUnderThreshold = {
    find: async () => [
      { comment: "Good", rating: 4 },
      { comment: "Clean room", rating: 5 },
    ], // Only 2 reviews
  };

  const underThresholdResult = await processBusinessFeedback(businessId, {
    FeedbackModel: mockFeedbackModelUnderThreshold,
  });
  assert.strictEqual(underThresholdResult.processed, false);
  assert.strictEqual(underThresholdResult.reason, "MINIMUM_FEEDBACK_THRESHOLD_NOT_MET");
  assert.strictEqual(underThresholdResult.reviewCount, 2);
  console.log("  ✅ Business with 2 reviews correctly skipped (< 5 threshold requirement)");

  // Test 3: AI Theme Extraction & Mentions Threshold (mentions >= 3)
  console.log("\nTest 3: AI Theme Extraction & Mentions Threshold (mentions >= 3)");
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

  let savedBusinessUpdates = null;
  const mockBusinessModel = {
    findByIdAndUpdate: async (id, update) => {
      savedBusinessUpdates = update.$set;
      return { _id: id, ...update.$set };
    },
  };

  const processedResult = await processBusinessFeedback(businessId, {
    FeedbackModel: mockFeedbackModelOverThreshold,
    BusinessModel: mockBusinessModel,
  });

  assert.strictEqual(processedResult.processed, true);
  assert.strictEqual(processedResult.totalReviews, 6);
  assert.strictEqual(processedResult.themes.length > 0, true);

  // Cleanliness theme mentioned in 3 reviews -> Must be surfaced
  const cleanlinessTheme = processedResult.themes.find((t) => t.theme.includes("Cleanliness"));
  assert.notStrictEqual(cleanlinessTheme, undefined);
  assert.strictEqual(cleanlinessTheme.mentions >= 3, true);
  assert.strictEqual(Array.isArray(cleanlinessTheme.evidenceIdx), true);

  // General single-mention items (like food quality) must NOT surface as a theme since mentions < 3
  const foodTheme = processedResult.themes.find((t) => t.theme.includes("Food Quality"));
  assert.strictEqual(foodTheme, undefined);

  console.log(`  ✅ Surfaced theme '${cleanlinessTheme.theme}' (Mentions: ${cleanlinessTheme.mentions} >= 3) with evidence pointers: [${cleanlinessTheme.evidenceIdx.join(", ")}]`);

  // Test 4: Business Insights Endpoint Mapping
  console.log("\nTest 4: Business Insights Retrieval & Evidence Mapping");
  const insights = await getBusinessFeedbackInsights(businessId, {
    FeedbackModel: mockFeedbackModelOverThreshold,
  });

  assert.strictEqual(insights.totalReviews, 6);
  assert.strictEqual(insights.meetsThreshold, true);
  assert.strictEqual(insights.themes[0].sourceSnippets.length > 0, true);
  assert.strictEqual(insights.actions.length > 0, true);
  console.log(`  ✅ Generated ${insights.actions.length} business improvement action items (e.g. '${insights.actions[0].action}')`);

  // Test 5: Section 3.4 Business Growth Ranking Formula
  console.log("\nTest 5: Section 3.4 Business Growth Ranking Formula");

  // Business A: Standard web onboarded, self-declared, crowded dest (no boosts)
  // rank = 1.0 * (1 + 0.30 * 0) * (1 + 0.20 * 0) * (1 + 0.25 * 0) = 1.0
  const busA = {
    _id: "bus_a",
    onboardedVia: "web",
    verificationTier: "self-declared",
    destId: "shimla",
  };
  const rankA = calculateBusinessGrowthRank(busA, { baseRelevance: 1.0, isInLowPressureDest: false });
  assert.strictEqual(rankA.rank, 1.0);

  // Business B: WhatsApp onboarded (+30%), visit-verified (+10%), low-pressure dest (+25%)
  // rank = 1.0 * (1 + 0.30 * 1) * (1 + 0.20 * 0.5) * (1 + 0.25 * 1) = 1.30 * 1.10 * 1.25 = 1.7875 -> 1.788
  const busB = {
    _id: "bus_b",
    onboardedVia: "whatsapp",
    verificationTier: "visit-verified",
    destId: "tirthan-valley",
  };
  const rankB = calculateBusinessGrowthRank(busB, { baseRelevance: 1.0, isInLowPressureDest: true });
  assert.strictEqual(rankB.rank, 1.788);

  // Test array ranking helper
  const rankedList = rankBusinessesForGrowth([busA, busB], { lowPressureDestinations: ["tirthan-valley"] });
  assert.strictEqual(rankedList[0]._id, "bus_b"); // WhatsApp + Low Pressure business ranks first
  console.log(`  ✅ Growth ranking formula verified: Local WhatsApp + Low Pressure supply (${busB._id}) ranked #1 (${rankedList[0].growthRank}) over established chain (${busA._id}: ${rankedList[1].growthRank})`);

  console.log("\n🎉 ALL 5 FEEDBACK INTELLIGENCE & GROWTH RANKING UNIT TESTS PASSED!");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});

/**
 * Multilingual Translation Service Unit Test Suite
 *
 * Verifies:
 * 1. Indic language text translation (Hindi, Telugu, etc.)
 * 2. Feedback review translation batch helper
 * 3. Advisory alert localization helper
 */

import assert from "assert";
import {
  translateText,
  translateFeedbackReviews,
  translateAlertForTourist,
} from "./index.js";

async function runTests() {
  console.log("🧪 Starting Multilingual Translation Unit Tests...\n");

  // Test 1: Indic Language Text Translation
  console.log("Test 1: Indic Language Text Translation");
  const resHindi = await translateText({ text: "clean room", targetLanguage: "hi" });
  assert.strictEqual(resHindi.success, true);
  assert.strictEqual(resHindi.translatedText, "कमरा साफ था");

  const resTelugu = await translateText({ text: "good food", targetLanguage: "te" });
  assert.strictEqual(resTelugu.success, true);
  assert.strictEqual(resTelugu.translatedText, "ఆహారం బాగుంది");
  console.log("  ✅ Indic translation fallbacks verified for Hindi ('कमरा साफ था') & Telugu ('ఆహారం బాగుంది')");

  // Test 2: Feedback Review Translation Batch
  console.log("\nTest 2: Feedback Review Translation Batch");
  const reviews = [
    { comment: "clean room", rating: 5 },
    { comment: "good food", rating: 4 },
  ];

  const translatedReviews = await translateFeedbackReviews(reviews);
  assert.strictEqual(translatedReviews.length, 2);
  assert.strictEqual(translatedReviews[0].originalComment, "clean room");
  console.log("  ✅ Batch feedback reviews processed cleanly");

  // Test 3: Advisory Alert Localization
  console.log("\nTest 3: Advisory Alert Localization for Tourists");
  const alert = {
    _id: "a100",
    body: "heavy snowfall alert",
    sourceName: "IMD Shimla",
  };

  const localizedAlert = await translateAlertForTourist(alert, "hi");
  assert.strictEqual(localizedAlert.body, "भारी बर्फबारी की चेतावनी");
  assert.strictEqual(localizedAlert.originalBody, "heavy snowfall alert");
  console.log("  ✅ Advisory alert localized to Hindi ('भारी बर्फबारी की चेतावनी')");

  console.log("\n🎉 ALL 3 MULTILINGUAL TRANSLATION UNIT TESTS PASSED!");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});

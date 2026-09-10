/**
 * Jest Unit Test Suite for Multilingual Translation Service
 *
 * Verifies:
 * 1. Indic language text translation (Hindi, Telugu, etc.)
 * 2. Feedback review translation batch helper
 * 3. Advisory alert localization helper
 */

import {
  translateText,
  translateFeedbackReviews,
  translateAlertForTourist,
} from "./index.js";

describe("Multilingual Translation Service", () => {
  test("Indic Language Text Translation", async () => {
    const resHindi = await translateText({ text: "clean room", targetLanguage: "hi" });
    expect(resHindi.success).toBe(true);
    expect(resHindi.translatedText).toBe("कमरा साफ था");

    const resTelugu = await translateText({ text: "good food", targetLanguage: "te" });
    expect(resTelugu.success).toBe(true);
    expect(resTelugu.translatedText).toBe("ఆహారం బాగుంది");
  });

  test("Feedback Review Translation Batch", async () => {
    const reviews = [
      { comment: "clean room", rating: 5 },
      { comment: "good food", rating: 4 },
    ];

    const translatedReviews = await translateFeedbackReviews(reviews);
    expect(translatedReviews.length).toBe(2);
    expect(translatedReviews[0].originalComment).toBe("clean room");
  });

  test("Advisory Alert Localization for Tourists", async () => {
    const alert = {
      _id: "a100",
      body: "heavy snowfall alert",
      sourceName: "IMD Shimla",
    };

    const localizedAlert = await translateAlertForTourist(alert, "hi");
    expect(localizedAlert.body).toBe("भारी बर्फबारी की चेतावनी");
    expect(localizedAlert.originalBody).toBe("heavy snowfall alert");
  });
});

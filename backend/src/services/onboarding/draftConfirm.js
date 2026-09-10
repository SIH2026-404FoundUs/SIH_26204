import Business from "../../models/business.model.js";
import BusinessAvailability from "../../models/businessAvailability.model.js";
import { transitionDraft } from "./stateMachine.js";
import { parseUnitCount } from "./dateParser.js";
import { extractFields } from "./extractFields.js";
import { validateExtractionShape, checkExtractionHonesty } from "./extraction.js";
import { sendWhatsAppMessage } from "./sendMessage.js";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Formats availability date range from stored BusinessAvailability records.
 * Examples: "Oct 10–20", "Oct 28 – Nov 5", "Oct 10"
 *
 * @param {Array<Object>} records - BusinessAvailability records sorted by date asc
 * @returns {string}
 */
export function formatAvailabilityRange(records) {
  if (!records || records.length === 0) {
    return "Not specified";
  }

  const dStart = new Date(records[0].date);
  const dEnd = new Date(records[records.length - 1].date);

  const mStart = MONTH_NAMES[dStart.getUTCMonth()];
  const dayStart = dStart.getUTCDate();
  const yStart = dStart.getUTCFullYear();

  const mEnd = MONTH_NAMES[dEnd.getUTCMonth()];
  const dayEnd = dEnd.getUTCDate();
  const yEnd = dEnd.getUTCFullYear();

  if (dStart.getTime() === dEnd.getTime()) {
    return `${mStart} ${dayStart}`;
  }

  if (mStart === mEnd && yStart === yEnd) {
    return `${mStart} ${dayStart}–${dayEnd}`;
  }

  if (yStart === yEnd) {
    return `${mStart} ${dayStart} – ${mEnd} ${dayEnd}`;
  }

  return `${mStart} ${dayStart}, ${yStart} – ${mEnd} ${dayEnd}, ${yEnd}`;
}

/**
 * Builds the listing summary confirmation message using ONLY data stored in MongoDB.
 *
 * @param {string} businessId
 * @param {string} [language="en"]
 * @param {Object} [options]
 * @param {boolean} [options.includeIntro=false] - whether to include the availability recorded intro
 * @returns {Promise<string>}
 */
export async function buildDraftConfirmationMessage(businessId, language = "en", { includeIntro = false } = {}) {
  const business = await Business.findById(businessId);
  if (!business) {
    throw new Error(`buildDraftConfirmationMessage: business ${businessId} not found`);
  }

  const availRecords = await BusinessAvailability.find({ businessId }).sort({ date: 1 });

  const name = business.name || "Not specified";
  const location = business.nearestLandmark || "Not specified";
  const rooms = business.capacity ?? (availRecords[0]?.units?.total ?? "Not specified");

  let priceStr = "Not specified";
  if (business.priceRangeINR?.min != null) {
    if (business.priceRangeINR.max != null && business.priceRangeINR.max !== business.priceRangeINR.min) {
      priceStr = `₹${business.priceRangeINR.min}–₹${business.priceRangeINR.max}/night`;
    } else {
      priceStr = `₹${business.priceRangeINR.min}/night`;
    }
  } else if (business.priceRangeINR?.max != null) {
    priceStr = `₹${business.priceRangeINR.max}/night`;
  }

  const availabilityStr = formatAvailabilityRange(availRecords);
  const photoCount = Array.isArray(business.photos) ? business.photos.length : 0;

  const isHindi = language === "hi";

  const intro = includeIntro
    ? isHindi
      ? "आपकी उपलब्धता तिथियां और इकाइयां दर्ज कर ली गई हैं। (Your availability dates and units have been recorded.)\n\n"
      : "Your availability dates and units have been recorded.\n\n"
    : "";

  const header = isHindi
    ? "कृपया अपनी लिस्टिंग की पुष्टि करें (Please confirm your listing):"
    : "Please confirm your listing:";

  const footer = isHindi
    ? "पुष्टि करने के लिए YES लिखें, या बताएं कि आप क्या बदलना चाहते हैं। (Reply YES to confirm, or tell me what you would like to change.)"
    : "Reply YES to confirm, or tell me what you would like to change.";

  return `${intro}${header}

Name: ${name}
Location: ${location}
Rooms: ${rooms}
Price: ${priceStr}
Availability: ${availabilityStr}
Photos: ${photoCount}

${footer}`;
}

/**
 * Parses numeric price from a correction text.
 *
 * @param {string} text
 * @returns {number|null}
 */
export function parsePriceCorrection(text) {
  if (!text || typeof text !== "string") return null;

  // Match e.g. "price is 3000", "price: 3000", "rate is 3000", "keemat 3000 hai"
  const m1 = text.match(/(?:price|rate|cost|keemat|kiraya)\s*(?:is|hai|to|of|mein|ko)?\s*(?:rs\.?|inr|₹)?\s*(\d+)/i);
  if (m1) {
    const val = parseInt(m1[1], 10);
    if (val > 0) return val;
  }

  // Match e.g. "₹3000", "Rs. 3000", "Rs 3000"
  const m2 = text.match(/(?:rs\.?|inr|₹)\s*(\d+)/i);
  if (m2) {
    const val = parseInt(m2[1], 10);
    if (val > 0) return val;
  }

  // Match e.g. "3000 rupees", "3000/night", "3000 per night"
  const m3 = text.match(/(\d+)\s*(?:rupees|rs|inr|per\s*night|\/night)/i);
  if (m3) {
    const val = parseInt(m3[1], 10);
    if (val > 0) return val;
  }

  return null;
}

/**
 * Checks whether the incoming message is a clear, unambiguous confirmation.
 * Examples: "YES", "yes", "Yes, confirm", "Haan", "haan confirm", "ha", "हाँ", "हा".
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isConfirmationReply(text) {
  if (!text || typeof text !== "string") return false;
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const confirmRegexes = [
    /^yes$/,
    /^yes\s+confirm$/,
    /^yes\s+please$/,
    /^confirm$/,
    /^confirmed$/,
    /^haan$/,
    /^ha$/,
    /^haan\s+confirm$/,
    /^ha\s+confirm$/,
    /^haanji$/,
    /^hanji$/,
    /^हाँ$/,
    /^हां$/,
    /^हाँ\s+confirm$/,
    /^हां\s+confirm$/,
    /^हा$/,
    /^हा\s+confirm$/,
    /^sahi\s+hai$/,
    /^theek\s+hai$/,
  ];

  return confirmRegexes.some((regex) => regex.test(cleaned));
}

/**
 * Parses simple corrections from text or calls extractFields.
 *
 * @param {string} text
 * @param {Object} [deps]
 * @param {string} [deps.language]
 * @param {Function} [deps.extractFn]
 * @param {Object} [deps.existingBusiness]
 * @returns {Promise<Object|null>} updates to apply, or null if no valid correction found
 */
export async function parseDraftCorrection(text, { language = "en", extractFn, existingBusiness } = {}) {
  if (!text || typeof text !== "string") return null;

  const updates = {};

  // 1. Check for room / capacity corrections (e.g. "I have 4 rooms", "4 rooms", "char kamre")
  const unitsCount = parseUnitCount(text);
  if (unitsCount !== null && unitsCount > 0) {
    updates.capacity = unitsCount;
  }

  // 2. Check for price corrections (e.g. "The price is 3000", "₹3000/night")
  const price = parsePriceCorrection(text);
  if (price !== null && price > 0) {
    updates.priceRangeINR = { min: price, max: price };
  }

  // 3. If no deterministic matches, or in addition, try extraction pipeline if extractFn provided
  if (Object.keys(updates).length === 0 && extractFn) {
    try {
      const extracted = await extractFields(text, language, null, extractFn);
      if (extracted) {
        const shape = validateExtractionShape(extracted);
        if (shape.valid) {
          const honesty = checkExtractionHonesty(extracted, text);
          if (honesty.honest) {
            for (const [key, val] of Object.entries(extracted)) {
              if (val !== null && val !== undefined && (!Array.isArray(val) || val.length > 0)) {
                updates[key] = val;
              }
            }
          }
        }
      }
    } catch {
      // Extraction failed or service unreachable — keep updates as-is
    }
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

/**
 * Returns clarification prompt when reply is neither clear confirmation nor valid correction.
 *
 * @param {string} [language="en"]
 * @returns {string}
 */
export function getClarificationMessage(language = "en") {
  if (language === "hi") {
    return "हम आपका संदेश समझ नहीं पाए। कृपया अपनी लिस्टिंग की पुष्टि करने के लिए YES लिखें, या बताएं कि आप क्या बदलना चाहते हैं (उदाहरण के लिए, 'I have 4 rooms' या 'The price is 3000')।";
  }
  return "We could not understand your reply. Please reply YES to confirm your listing, or tell us what you would like to change (for example, 'I have 4 rooms' or 'The price is 3000').";
}

/**
 * Returns celebratory message when listing transitions to LIVE.
 *
 * @param {string} [language="en"]
 * @returns {string}
 */
export function getLiveConfirmedMessage(language = "en") {
  if (language === "hi") {
    return "बधाई हो! आपकी लिस्टिंग अब प्लेटफॉर्म पर लाइव है। (Congratulations! Your listing is now LIVE on the platform.)";
  }
  return "Congratulations! Your listing is now LIVE on the platform.";
}

/**
 * Processes a provider reply (text or transcribed audio) while in DRAFT_CONFIRM.
 *
 * @param {Object} params
 * @param {string} params.ownerPhone
 * @param {string} params.text
 * @param {string} params.messageId
 * @param {Function} [params.sendMessageFn]
 * @param {Function} [params.extractFn]
 * @param {string} [params.language]
 * @returns {Promise<Object>}
 */
export async function processDraftConfirmReply({
  ownerPhone,
  text,
  messageId,
  sendMessageFn,
  extractFn,
  language = "en",
}) {
  const existing = await Business.findOne({ ownerPhone });
  if (!existing) {
    return { applied: false, reason: "business_not_found" };
  }

  const attemptMessageId = messageId || crypto.randomUUID();

  // Whole-attempt idempotency: skip replayed message
  if (existing.lastWhatsAppMessageId != null && existing.lastWhatsAppMessageId === attemptMessageId) {
    return {
      applied: false,
      reason: "duplicate_message",
      businessId: existing._id,
      onboardingState: existing.onboardingState,
    };
  }

  if (existing.onboardingState !== "DRAFT_CONFIRM") {
    return {
      applied: false,
      reason: "not_in_draft_confirm",
      businessId: existing._id,
      onboardingState: existing.onboardingState,
    };
  }

  const lang = language || existing.transcriptLang || "en";

  // 1. Check for clear confirmation reply
  if (isConfirmationReply(text)) {
    const transition = transitionDraft(existing, "LIVE", attemptMessageId);
    if (!transition.applied) {
      return {
        applied: false,
        reason: transition.reason,
        businessId: existing._id,
        onboardingState: existing.onboardingState,
      };
    }

    const saved = await Business.findOneAndUpdate(
      { _id: existing._id },
      {
        $set: {
          onboardingState: "LIVE",
          verificationTier: "self-declared",
          lastWhatsAppMessageId: attemptMessageId,
        },
      },
      { new: true, runValidators: true, context: "query" }
    );

    const liveMsg = getLiveConfirmedMessage(lang);
    try {
      await sendWhatsAppMessage(ownerPhone, liveMsg, sendMessageFn);
    } catch (err) {
      console.error(`processDraftConfirmReply: failed to send live confirmation message: ${err.message}`);
    }

    return {
      applied: true,
      outcome: "confirmed_live",
      businessId: saved._id,
      onboardingState: "LIVE",
      verificationTier: saved.verificationTier,
    };
  }

  // 2. Check for valid correction
  const correctionUpdates = await parseDraftCorrection(text, {
    language: lang,
    extractFn,
    existingBusiness: existing,
  });

  if (correctionUpdates) {
    const saved = await Business.findOneAndUpdate(
      { _id: existing._id },
      {
        $set: {
          ...correctionUpdates,
          onboardingState: "DRAFT_CONFIRM",
          lastWhatsAppMessageId: attemptMessageId,
        },
      },
      { new: true, runValidators: true, context: "query" }
    );

    // Keep availability records in sync if capacity or price was corrected
    if (correctionUpdates.capacity != null) {
      await BusinessAvailability.updateMany(
        { businessId: existing._id },
        {
          $set: {
            "units.total": correctionUpdates.capacity,
            "units.available": correctionUpdates.capacity,
            updatedAt: new Date(),
          },
        }
      );
    }
    if (correctionUpdates.priceRangeINR?.min != null) {
      await BusinessAvailability.updateMany(
        { businessId: existing._id },
        {
          $set: {
            pricePerNight: correctionUpdates.priceRangeINR.min,
            updatedAt: new Date(),
          },
        }
      );
    }

    // Generate updated summary from MongoDB and send again
    const updatedSummary = await buildDraftConfirmationMessage(saved._id, lang);
    try {
      await sendWhatsAppMessage(ownerPhone, updatedSummary, sendMessageFn);
    } catch (err) {
      console.error(`processDraftConfirmReply: failed to send updated summary: ${err.message}`);
    }

    return {
      applied: true,
      outcome: "correction_applied",
      businessId: saved._id,
      onboardingState: "DRAFT_CONFIRM",
      updates: correctionUpdates,
    };
  }

  // 3. Ambiguous / unclear reply — ask for clarification, remain in DRAFT_CONFIRM
  const clarifyMsg = getClarificationMessage(lang);
  await Business.findOneAndUpdate(
    { _id: existing._id },
    {
      $set: {
        lastWhatsAppMessageId: attemptMessageId,
      },
    },
    { new: true, runValidators: true, context: "query" }
  );

  try {
    await sendWhatsAppMessage(ownerPhone, clarifyMsg, sendMessageFn);
  } catch (err) {
    console.error(`processDraftConfirmReply: failed to send clarification message: ${err.message}`);
  }

  return {
    applied: false,
    outcome: "clarification_requested",
    businessId: existing._id,
    onboardingState: "DRAFT_CONFIRM",
  };
}

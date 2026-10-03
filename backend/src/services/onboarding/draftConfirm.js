import Business from "../../models/business.model.js";
import BusinessAvailability from "../../models/businessAvailability.model.js";
import { transitionDraft, isReplayedMessage } from "./stateMachine.js";
import { parseUnitCount } from "./extraction/dateParser.js";
import { extractFields } from "./extraction/extractFields.js";
import { validateExtractionShape, checkExtractionHonesty } from "./extraction/extraction.js";
import { sendWhatsAppMessage } from "./messaging/sendMessage.js";

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

const DEFAULT_LANGUAGE = "en";

export const DRAFT_INTRO_MESSAGES = {
  en: "Your availability dates and units have been recorded.\n\n",
  hi: "आपकी उपलब्धता तिथियां और इकाइयां दर्ज कर ली गई हैं। (Your availability dates and units have been recorded.)\n\n",
  te: "మీ లభ్యత తేదీలు మరియు యూనిట్లు నమోదు చేయబడ్డాయి. (Your availability dates and units have been recorded.)\n\n",
  ta: "உங்கள் கிடைக்கும் தேதிகள் மற்றும் யூனிட்டுகள் பதிவு செய்யப்பட்டுள்ளன. (Your availability dates and units have been recorded.)\n\n",
  kn: "ನಿಮ್ಮ ಲಭ್ಯತೆಯ ದಿನಾಂಕಗಳು ಮತ್ತು ಯೂನಿಟ್‌ಗಳನ್ನು ದಾಖಲಿಸಲಾಗಿದೆ. (Your availability dates and units have been recorded.)\n\n",
  ml: "ലഭ്യത തീയതികളും യൂണിറ്റുകളും രേഖപ്പെടുത്തിയിട്ടുണ്ട്. (Your availability dates and units have been recorded.)\n\n",
  mr: "तुमच्या उपलब्धतेच्या तारखा आणि युनिट्स नोंदवले गेले आहेत. (Your availability dates and units have been recorded.)\n\n",
  bn: "আপনার উপলব্ধতার তারিখ এবং ইউনিট রেকর্ড করা হয়েছে। (Your availability dates and units have been recorded.)\n\n",
  gu: "તમારી ઉપલબ્ધ તારીખો અને એકમો નોંધાઈ ગયા છે. (Your availability dates and units have been recorded.)\n\n",
  pa: "ਤੁਹਾਡੀਆਂ ਉਪਲਬਧਤਾ ਤਾਰੀਖਾਂ ਅਤੇ ਯੂਨਿਟ ਦਰਜ ਕੀਤੇ ਗਏ ਹਨ। (Your availability dates and units have been recorded.)\n\n",
  od: "ଆପଣଙ୍କ ଉପଲବ୍ଧ ତାରିଖ ଏବଂ ୟୁନିଟ୍ ରେକର୍ଡ ହୋଇଛି। (Your availability dates and units have been recorded.)\n\n",
  as: "আপোনাৰ উপলব্ধ তাৰিখ আৰু ইউনিটসমূহ সংৰক্ষণ কৰা হৈছে। (Your availability dates and units have been recorded.)\n\n",
  ur: "آپ کی دستیابی کی تاریخیں اور یونٹس ریکارڈ کر لیے گئے ہیں۔ (Your availability dates and units have been recorded.)\n\n",
  ne: "तपाईंको उपलब्धता मिति र युनिटहरू दर्ता गरिएका छन्। (Your availability dates and units have been recorded.)\n\n",
  kok: "तुमच्यो उपलब्ध तारखो आनी युनिट्स नोंद केल्यांत. (Your availability dates and units have been recorded.)\n\n",
  ks: "تہنٛزِ دٔستیاب تٲریخ تہٕ یوٗنِٹ گٔیہِ دَرٕج۔ (Your availability dates and units have been recorded.)\n\n",
  sd: "توهان جي دستيابي جون تاريخون ۽ يونٽ رڪارڊ ڪيا ويا آهن. (Your availability dates and units have been recorded.)\n\n",
  sa: "भवतः उपलभ्यतिथयः घटकाः च अङ्किताः सन्ति। (Your availability dates and units have been recorded.)\n\n",
  sat: "ᱟᱢᱟᱜ ᱛᱟᱹᱨᱤᱠᱷ ᱟᱨ ᱭᱩᱱᱤᱴ ᱨᱮᱠᱚᱨᱰ ᱮᱱᱟ᱾ (Your availability dates and units have been recorded.)\n\n",
  mni: "নহাক্কী ফংগদবা তারিক অমসুং য়ুনিটশিং রিকোর্দ তৌরে। (Your availability dates and units have been recorded.)\n\n",
  brx: "नोंथांनि अक्ट' आरो इउनिफोरखौ थिसननाय जाबाय। (Your availability dates and units have been recorded.)\n\n",
  mai: "अहाँक उपलब्धता तिथि आ यूनिट दर्ज कएल गेल। (Your availability dates and units have been recorded.)\n\n",
  doi: "तुहांडियां उपलब्ध तरीकां ते यूनिट दर्ज करी लित्ते गे न। (Your availability dates and units have been recorded.)\n\n",
};

export const DRAFT_HEADER_MESSAGES = {
  en: "Please confirm your listing:",
  hi: "कृपया अपनी लिस्टिंग की पुष्टि करें (Please confirm your listing):",
  te: "దయచేసి మీ లిస్టింగ్‌ను నిర్ధారించండి (Please confirm your listing):",
  ta: "உங்கள் பட்டியலை உறுதிப்படுத்தவும் (Please confirm your listing):",
  kn: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪಟ್ಟಿಯನ್ನು ದೃಢೀಕರಿಸಿ (Please confirm your listing):",
  ml: "നിങ്ങളുടെ ലിസ്റ്റിംഗ് സ്ഥിരീകരിക്കുക (Please confirm your listing):",
  mr: "कृपया तुमच्या लिस्टिंगची पुष्टी करा (Please confirm your listing):",
  bn: "অনুগ্রহ করে আপনার তালিকা নিশ্চিত করুন (Please confirm your listing):",
  gu: "કૃપા કરીને તમારી સૂચિની પુષ્ટિ કરો (Please confirm your listing):",
  pa: "ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਸੂਚੀ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ (Please confirm your listing):",
  od: "ଦୟାକରି ଆପଣଙ୍କ ଲିଷ୍ଟିଂ ନିଶ୍ଚିତ କରନ୍ତୁ (Please confirm your listing):",
  as: "অনুগ্ৰহ কৰি আপোনাৰ তালিকা নিশ্চিত কৰক (Please confirm your listing):",
  ur: "براہ کرم اپنی لسٹنگ کی تصدیق کریں (Please confirm your listing):",
  ne: "कृपया आफ्नो सूची पुष्टि गर्नुहोस् (Please confirm your listing):",
  kok: "उपकार करून तुमची वळेरी खात्री करात (Please confirm your listing):",
  ks: "مہر Manny کٔرِتھ کٔرِو پنٛنہِ لِسٹِنٛگٕچ تَصدیٖق (Please confirm your listing):",
  sd: "مهرباني ڪري پنهنجي لسٽنگ جي تصديق ڪريو (Please confirm your listing):",
  sa: "कृपया स्वकीयसूचीं पुष्टयन्तु (Please confirm your listing):",
  sat: "ᱫᱟᱭᱟ ᱠᱟᱛᱮ ᱟᱢᱟᱜ ᱞᱤᱥᱴᱤᱝ ᱯᱩᱥᱴᱤ ᱢᱮ (Please confirm your listing):",
  mni: "চানবীদুনা নহাক্কী লিষ্টিং অসি য়ারে হায়না ফোংদোকপীয়ু (Please confirm your listing):",
  brx: "अननानै नोंथांनि लिस्टखौ रोखा खालाम (Please confirm your listing):",
  mai: "कृपया अपन लिस्टिंगक पुष्टिकरण करू (Please confirm your listing):",
  doi: "कृप्या अपनी लिस्टिंग गी पक्का करो (Please confirm your listing):",
};

export const DRAFT_FOOTER_MESSAGES = {
  en: "Reply YES to confirm, or tell me what you would like to change.",
  hi: "पुष्टि करने के लिए YES लिखें, या बताएं कि आप क्या बदलना चाहते हैं। (Reply YES to confirm, or tell me what you would like to change.)",
  te: "నిర్ధారించడానికి YES అని పంపండి, లేదా మీరు ఏమి మార్చాలనుకుంటున్నారో చెప్పండి. (Reply YES to confirm, or tell me what you would like to change.)",
  ta: "உறுதிப்படுத்த YES என்று பதிலளிக்கவும், அல்லது எதை மாற்ற விரும்புகிறீர்கள் என்று கூறவும். (Reply YES to confirm, or tell me what you would like to change.)",
  kn: "ದೃಢೀಕರಿಸಲು YES ಎಂದು ಉತ್ತರಿಸಿ, ಅಥವಾ ನೀವು ಏನನ್ನು ಬದಲಾಯಿಸಲು ಬಯಸುತ್ತೀರಿ ಎಂದು ತಿಳಿಸಿ. (Reply YES to confirm, or tell me what you would like to change.)",
  ml: "സ്ഥിരീകരിക്കാൻ YES എന്ന് മറുപടി നൽകുക, അല്ലെങ്കിൽ എന്ത് മാറ്റണമെന്ന് പറയുക. (Reply YES to confirm, or tell me what you would like to change.)",
  mr: "पुष्टी करण्यासाठी YES पाठवा, किंवा तुम्हाला काय बदलायचे आहे ते सांगा. (Reply YES to confirm, or tell me what you would like to change.)",
  bn: "নিশ্চিত করতে YES লিখুন, অথবা আপনি কী পরিবর্তন করতে চান তা জানান। (Reply YES to confirm, or tell me what you would like to change.)",
  gu: "પુષ્ટિ કરવા માટે YES લખો, અથવા તમે શું બદલવા માંગો છો તે જણાવો. (Reply YES to confirm, or tell me what you would like to change.)",
  pa: "ਪੁਸ਼ਟੀ ਕਰਨ ਲਈ YES ਲਿਖੋ, ਜਾਂ ਦੱਸੋ ਕਿ ਤੁਸੀਂ ਕੀ ਬਦਲਣਾ ਚਾਹੁੰਦੇ ਹੋ। (Reply YES to confirm, or tell me what you would like to change.)",
  od: "ନିଶ୍ଚିତ କରିବାକୁ YES ଲେଖନ୍ତୁ, କିମ୍ବା ଆପଣ କ’ଣ ପରିବର୍ତ୍ତନ କରିବାକୁ ଚାହାଁନ୍ତି କୁହନ୍ତୁ। (Reply YES to confirm, or tell me what you would like to change.)",
  as: "নিশ্চিত কৰিবলৈ YES লিখক, বা আপুনি কি সলনি কৰিব বিচাৰে কওক। (Reply YES to confirm, or tell me what you would like to change.)",
  ur: "تصدیق کے لیے YES لکھیں، یا بتائیں کہ آپ کیا تبدیل کرنا چاہتے ہیں۔ (Reply YES to confirm, or tell me what you would like to change.)",
  ne: "पुष्टि गर्नका लागि YES लेख्नुहोस्, वा के परिवर्तन गर्न चाहनुहुन्छ बताउनुहोस्। (Reply YES to confirm, or tell me what you would like to change.)",
  kok: "खात्री करपाक YES धाडात, वा कितें बदलूंक आसा तें सांगात. (Reply YES to confirm, or tell me what you would like to change.)",
  ks: "تَصدیٖق کَرنہٕ خٲطرٕ لٮ۪کھِو YES، یا ؤنِو تۄہہِ کِیاہ چِھو بَدلاوُن یَژھان۔ (Reply YES to confirm, or tell me what you would like to change.)",
  sd: "تصديق لاءِ YES لکو، يا ٻڌايو ته توهان ڇا تبديل ڪرڻ چاهيو ٿا. (Reply YES to confirm, or tell me what you would like to change.)",
  sa: "पुष्टिकरणाय YES इति लिखन्तु, अथवा किं परिवर्तयितुम् इच्छन्ति वदन्तु। (Reply YES to confirm, or tell me what you would like to change.)",
  sat: "ᱯᱩᱥᱴᱤ ᱞᱟᱹᱜᱤᱫ YES ᱚᱞ ᱢᱮ, ᱥᱮ ᱪᱮᱫ ᱵᱚᱫᱚᱞ ᱥᱟᱱᱟᱭᱮᱫ ᱢᱮᱭᱟ ᱞᱟᱹᱭ ᱢᱮ᱾ (Reply YES to confirm, or tell me what you would like to change.)",
  mni: "য়ারে হায়বগীদমক YES থারকউ, নত্রগা করি শেমদোকপা পাম্বগে ফোংদোকপীয়ু। (Reply YES to confirm, or tell me what you would like to change.)",
  brx: "रोखा खालामनो थाखाय YES हर, एबा मा सोलायनो लुबैयो खिन्था हर। (Reply YES to confirm, or tell me what you would like to change.)",
  mai: "पुष्टि करबाक लेल YES लिखू, वा बताउ जे अहाँ की बदलए चाहैत छी। (Reply YES to confirm, or tell me what you would like to change.)",
  doi: "पक्का करने लेई YES भेजो, या दसौ कि तुस केह् बदलना चाह्न्दे ओ। (Reply YES to confirm, or tell me what you would like to change.)",
};

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

  const intro = includeIntro
    ? (DRAFT_INTRO_MESSAGES[language] ?? DRAFT_INTRO_MESSAGES[DEFAULT_LANGUAGE])
    : "";

  const header = DRAFT_HEADER_MESSAGES[language] ?? DRAFT_HEADER_MESSAGES[DEFAULT_LANGUAGE];
  const footer = DRAFT_FOOTER_MESSAGES[language] ?? DRAFT_FOOTER_MESSAGES[DEFAULT_LANGUAGE];

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
    .replace(/[.,!?;:–—_"\(\)\[\]{}]/g, " ")
    .replace(/['’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const confirmRegexes = [
    /^yes$/,
    /^yes\s+(?:i\s+)?confirm(?:ed)?$/,
    /^yes\s+please$/,
    /^i\s+confirm(?:ed)?$/,
    /^confirm$/,
    /^confirmed$/,
    /^(?:that'?s|thats|that\s+is)\s+correct$/,
    /^correct$/,
    /^okay?$/,
    /^haan$/,
    /^ha$/,
    /^haan\s+(?:i\s+)?confirm(?:ed)?$/,
    /^ha\s+(?:i\s+)?confirm(?:ed)?$/,
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
 * @returns {Promise<Object|null>} updates to apply, or null if no valid correction found
 */
export async function parseDraftCorrection(text, { language = "en", extractFn } = {}) {
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
export const CLARIFICATION_MESSAGES = {
  en: "We could not understand your reply. Please reply YES to confirm your listing, or tell us what you would like to change (for example, 'I have 4 rooms' or 'The price is 3000').",
  hi: "हम आपका संदेश समझ नहीं पाए। कृपया अपनी लिस्टिंग की पुष्टि करने के लिए YES लिखें, या बताएं कि आप क्या बदलना चाहते हैं (उदाहरण के लिए, 'I have 4 rooms' या 'The price is 3000')।",
  te: "మేము మీ ప్రత్యుత్తరాన్ని అర్థం చేసుకోలేకపోయాము. దయచేసి మీ లిస్టింగ్‌ను నిర్ధారించడానికి YES అని పంపండి, లేదా మీరు ఏమి మార్చాలనుకుంటున్నారో చెప్పండి (ఉదాహరణకు, 'I have 4 rooms' లేదా 'The price is 3000').",
  ta: "உங்கள் பதிலை எங்களால் புரிந்து கொள்ள முடியவில்லை. பட்டியலை உறுதிப்படுத்த YES என்று அனுப்பவும், அல்லது மாற்ற விரும்புவதை கூறவும் (உதாரணமாக, 'I have 4 rooms' அல்லது 'The price is 3000').",
  kn: "ನಿಮ್ಮ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ನಮಗೆ ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಪಟ್ಟಿಯನ್ನು ದೃಢೀಕರಿಸಲು YES ಎಂದು ಉತ್ತರಿಸಿ, ಅಥವಾ ಬದಲಾಯಿಸಲು ಬಯಸುವುದನ್ನು ತಿಳಿಸಿ (ಉದಾಹರಣೆಗೆ, 'I have 4 rooms' ಅಥವಾ 'The price is 3000').",
  ml: "നിങ്ങളുടെ മറുപടി മനസ്സിലാക്കാൻ കഴിഞ്ഞില്ല. ലിസ്റ്റിംഗ് സ്ഥിരീകരിക്കാൻ YES എന്ന് അയക്കുക, അല്ലെങ്കിൽ മാറ്റം പറയുക (ഉദാഹരണത്തിന്, 'I have 4 rooms' അല്ലെങ്കിൽ 'The price is 3000').",
  mr: "आम्हाला तुमचा संदेश समजला नाही. कृपया पुष्टी करण्यासाठी YES पाठवा, किंवा तुम्हाला काय बदलायचे आहे ते सांगा (उदा. 'I have 4 rooms' किंवा 'The price is 3000').",
  bn: "আমরা আপনার বার্তা বুঝতে পারিনি। নিশ্চিত করতে অনুগ্রহ করে YES লিখুন, অথবা আপনি কী পরিবর্তন করতে চান তা জানান (যেমন, 'I have 4 rooms' বা 'The price is 3000')।",
  gu: "અમે તમારો સંદેશ સમજી શક્યા નથી. કૃપા કરીને પુષ્ટિ કરવા માટે YES લખો, અથવા શું બદલવું છે તે જણાવો (ઉદાહરણ તરીકે, 'I have 4 rooms' અથવા 'The price is 3000').",
  pa: "ਅਸੀਂ ਤੁਹਾਡਾ ਸੁਨੇਹਾ ਨਹੀਂ ਸਮਝ ਸਕੇ। ਪੁਸ਼ਟੀ ਲਈ ਕਿਰਪਾ ਕਰਕੇ YES ਲਿਖੋ, ਜਾਂ ਦੱਸੋ ਕਿ ਤੁਸੀਂ ਕੀ ਬਦਲਣਾ ਚਾਹੁੰਦੇ ਹੋ (ਉਦਾਹਰਣ ਲਈ, 'I have 4 rooms' ਜਾਂ 'The price is 3000')।",
  od: "ଆମେ ଆପଣଙ୍କ ବାର୍ତ୍ତା ବୁଝିପାରିଲୁ ନାହିଁ। ନିଶ୍ଚିତ କରିବାକୁ ଦୟାକରି YES ଲେଖନ୍ତୁ, କିମ୍ବା ପରିବର୍ତ୍ତନ ବିଷୟରେ କୁହନ୍ତୁ (ଉଦାହରଣ ସ୍ୱରୂପ, 'I have 4 rooms' କିମ୍ବା 'The price is 3000')।",
  as: "আমি আপোনাৰ বাৰ্তা বুজি নাপালোঁ। নিশ্চিত কৰিবলৈ অনুগ্ৰহ কৰি YES লিখক, বা কি সলনি কৰিব বিচাৰে কওক (উদাহৰণস্বৰূপে, 'I have 4 rooms' বা 'The price is 3000')।",
  ur: "ہم آپ کا پیغام سمجھ نہیں سکے۔ تصدیق کے لیے براہ کرم YES لکھیں، یا بتائیں کہ آپ کیا تبدیل کرنا چاہتے ہیں (مثلاً، 'I have 4 rooms' یا 'The price is 3000')۔",
  ne: "हामीले तपाईंको सन्देश बुझ्न सकेनौं। कृपया पुष्टि गर्न YES लेख्नुहोस्, वा के परिवर्तन गर्न चाहनुहुन्छ बताउनुहोस् (उदाहरणका लागि, 'I have 4 rooms' वा 'The price is 3000')।",
  kok: "आमी तुमचो संदेश समजूंक शकले नात. उपकार करून वळेरी खात्री करपाक YES धाडात, वा कितें बदलूंक आसा तें सांगात (देखीक, 'I have 4 rooms' वा 'The price is 3000').",
  ks: "اسہِ ہٮ۪کِو نہٕ تہنٛز پیغام سَمٕجھِتھ۔ مہر Manny کٔرِتھ لٮ۪کھِو YES یا ؤنِو کِیاہ چِھو بَدلاوُن یَژھان (مِثال, 'I have 4 rooms' یا 'The price is 3000')۔",
  sd: "اسان توهان جو پيغام سمجهي نه سگهياسين. مهرباني ڪري تصديق لاءِ YES لکو، يا ٻڌايو ته ڇا تبديل ڪرڻ چاهيو ٿا (مثال طور، 'I have 4 rooms' يا 'The price is 3000').",
  sa: "वयं भवतः सन्देशं ज्ञातुं न अशक्नुम। कृपया पुष्टिकरणाय YES इति लिखन्तु, अथवा किं परिवर्तयितुम् इच्छन्ति वदन्तु (यथा, 'I have 4 rooms' वा 'The price is 3000')।",
  sat: "ᱟᱞᱮ ᱟᱢᱟᱜ ᱠᱟᱛᱷᱟ ᱵᱟᱞᱮ ᱵᱩᱡᱷᱟᱹᱣ ᱫᱟᱲᱮᱭᱟᱫ-ᱟ᱾ ᱫᱟᱭᱟ ᱠᱟᱛᱮ YES ᱚᱞ ᱢᱮ ᱥᱮ ᱪᱮᱫ ᱵᱚᱫᱚᱞ ᱥᱟᱱᱟᱭᱮᱫ ᱢᱮᱭᱟ ᱞᱟᱹᱭ ᱢᱮ (ᱡᱮᱞᱮᱠᱟ, 'I have 4 rooms' ᱥᱮ 'The price is 3000')᱾",
  mni: "নহাক্কী পাউ অসি খঙবা ঙমদে। চানবীদুনা য়ারে হায়বগীদমক YES থারকউ, নত্রগা করি শেমদোকপা পাম্বগে ফোংদোকপীয়ু (খুদম ওইনা, 'I have 4 rooms' নত্রগা 'The price is 3000')।",
  brx: "जों नोंथांनि खौरां बुजिमोननो हायाखै। अननानै रोखा खालामनो थाखाय YES हर, एबा मा सोलायनो लुबैयो खिन्था (जेरै, 'I have 4 rooms' एबा 'The price is 3000')।",
  mai: "हम अहाँक संदेश बुझि नै सकलहुँ। कृपया पुष्टिकरण लेल YES लिखू, वा बताउ जे की बदलए चाहैत छी (उदाहरणक लेल, 'I have 4 rooms' वा 'The price is 3000')।",
  doi: "अस्सें गी तुहांडा सुनेहा समझ नेईं आया। कृप्या पक्का करने लेई YES भेजो, या दसौ कि तुस केह् बदलना चाह्न्दे ओ (मसाल लेई, 'I have 4 rooms' या 'The price is 3000')।",
};

export const LIVE_CONFIRMED_MESSAGES = {
  en: "Congratulations! Your listing is now LIVE on the platform.",
  hi: "बधाई हो! आपकी लिस्टिंग अब प्लेटफॉर्म पर लाइव है। (Congratulations! Your listing is now LIVE on the platform.)",
  te: "అభినందనలు! మీ లిస్టింగ్ ఇప్పుడు ప్లాట్‌ఫారమ్‌లో లైవ్‌లో ఉంది. (Congratulations! Your listing is now LIVE on the platform.)",
  ta: "வாழ்த்துகள்! உங்கள் பட்டியல் இப்போது தளத்தில் நேரலையில் உள்ளது. (Congratulations! Your listing is now LIVE on the platform.)",
  kn: "ಅಭಿನಂದನೆಗಳು! ನಿಮ್ಮ ಪಟ್ಟಿಯು ಈಗ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್‌ನಲ್ಲಿ ಲೈವ್ ಆಗಿದೆ. (Congratulations! Your listing is now LIVE on the platform.)",
  ml: "അഭിനന്ദനങ്ങൾ! നിങ്ങളുടെ ലിസ്റ്റിംഗ് ഇപ്പോൾ പ്ലാറ്റ്‌ഫോമിൽ തത്സമയമാണ്. (Congratulations! Your listing is now LIVE on the platform.)",
  mr: "अभिनंदन! तुमचे लिस्टिंग आता प्लॅटफॉर्मवर थेट लाईव्ह आहे. (Congratulations! Your listing is now LIVE on the platform.)",
  bn: "অভিনন্দন! আপনার তালিকা এখন প্ল্যাটফর্মে লাইভ হয়েছে। (Congratulations! Your listing is now LIVE on the platform.)",
  gu: "અભિનંદન! તમારી સૂચિ હવે પ્લેટફોર્મ પર લાઈવ છે. (Congratulations! Your listing is now LIVE on the platform.)",
  pa: "ਵਧਾਈਆਂ! ਤੁਹਾਡੀ ਸੂਚੀ ਹੁਣ ਪਲੇਟਫਾਰਮ 'ਤੇ ਲਾਈਵ ਹੈ। (Congratulations! Your listing is now LIVE on the platform.)",
  od: "ଅଭିନନ୍ଦନ! ଆପଣଙ୍କ ଲିଷ୍ଟିଂ ବର୍ତ୍ତମାନ ପ୍ଲାଟଫର୍ମରେ ଲାଇଭ୍ ହୋଇଛି। (Congratulations! Your listing is now LIVE on the platform.)",
  as: "অভিনন্দন! আপোনাৰ তালিকা এতিয়া প্লেটফৰ্মত লাইভ হৈছে। (Congratulations! Your listing is now LIVE on the platform.)",
  ur: "مبارک ہو! آپ کی لسٹنگ اب پلیٹ فارم پر لائیو ہے۔ (Congratulations! Your listing is now LIVE on the platform.)",
  ne: "बधाई छ! तपाईंको सूची अब प्लेटफर्ममा प्रत्यक्ष (LIVE) भएको छ। (Congratulations! Your listing is now LIVE on the platform.)",
  kok: "अभिनंदन! तुमची वळेरी आतां प्लॅटफॉर्माचेर थेट (LIVE) आसा. (Congratulations! Your listing is now LIVE on the platform.)",
  ks: "مُبارَک! تہنٛز لِسٹِنٛگ چھےٚ وُنِہ پِلیٹ فارمَس پٮ۪ٹھ لایِو۔ (Congratulations! Your listing is now LIVE on the platform.)",
  sd: "مبارڪون! توهان جي لسٽنگ هاڻي پليٽ فارم تي لائيو آهي. (Congratulations! Your listing is now LIVE on the platform.)",
  sa: "अभिनन्दनानि! भवतः सूची अधुना मञ्चे सजीवा (LIVE) अस्ति।",
  sat: "ᱥᱟᱨᱦᱟᱣ! ᱟᱢᱟᱜ ᱞᱤᱥᱴᱤᱝ ᱱᱤᱛᱚᱜ ᱯᱞᱮᱴᱯᱷᱚᱨᱢ ᱨᱮ ᱞᱟᱭᱤᱵᱷ ᱮᱱᱟ᱾ (Congratulations! Your listing is now LIVE on the platform.)",
  mni: "নুংঙাইবা ফোংদোকচরি! নহাক্কী লিষ্টিং অসি হৌজিক প্লেতফোর্মদা লাইভ ওইরে। (Congratulations! Your listing is now LIVE on the platform.)",
  brx: "गोजोननाय थाबाय! नोंथांनि लिस्टआ दा प्लेटफर्मआव लाइभ जाबाय। (Congratulations! Your listing is now LIVE on the platform.)",
  mai: "बधाई! अहाँक लिस्टिंग आब प्लेटफार्म पर लाइव अछि। (Congratulations! Your listing is now LIVE on the platform.)",
  doi: "मुबारकबाद! तुहांडी लिस्टिंग हुण प्लेटफार्म पर लाइव ऐ। (Congratulations! Your listing is now LIVE on the platform.)",
};

/**
 * Returns clarification prompt when reply is neither clear confirmation nor valid correction.
 *
 * @param {string} [language="en"]
 * @returns {string}
 */
export function getClarificationMessage(language = "en") {
  return CLARIFICATION_MESSAGES[language] ?? CLARIFICATION_MESSAGES[DEFAULT_LANGUAGE];
}

/**
 * Returns celebratory message when listing transitions to LIVE.
 *
 * @param {string} [language="en"]
 * @returns {string}
 */
export function getLiveConfirmedMessage(language = "en") {
  return LIVE_CONFIRMED_MESSAGES[language] ?? LIVE_CONFIRMED_MESSAGES[DEFAULT_LANGUAGE];
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
  if (isReplayedMessage(existing, attemptMessageId)) {
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

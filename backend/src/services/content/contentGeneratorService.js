// Tourism Publicity Generator -- operator-only. Turns a business's own
// words (typed, or spoken and transcribed) into ready-to-post marketing
// copy across five platforms, eleven languages/dialects, and eight tones,
// with an extract-then-generate pipeline specifically so the model is never
// generating from the operator's raw text directly (see extractFacts below
// for why that matters).
//
// Dual-provider: Groq (llama-3.3-70b-versatile) is the primary LLM; on any
// Groq failure (network, rate limit, non-2xx, unparsable JSON after one
// retry) this fails over to Mistral (mistral-large-latest) automatically.
// Whisper large-v3 transcription is Groq-only (spec calls for Whisper
// large-v3 specifically; Mistral has no equivalent audio endpoint), so a
// Groq outage takes down voice input but not text-based generation.
import Business from "../../models/business.model.js";
import BusinessAvailability from "../../models/businessAvailability.model.js";
import { getDestination } from "../pressure/seed.js";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
// openai/gpt-oss-120b: Groq's own current large general-purpose model (the
// same one already referenced in ai-service/app/agents/travel_agent.py's
// own comments) -- llama-3.3-70b-versatile has been retired on Groq's side
// and 404s. It's a reasoning model, so every call to it needs
// reasoning_format: "hidden" (see chatJSON) or its raw chain-of-thought
// leaks into `content` instead of a clean JSON reply.
const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_EXTRACT_MODEL = "openai/gpt-oss-20b"; // smaller/faster, plenty for the extraction step
// mistral-large-latest isn't included in every Mistral API tier (403
// tier_not_allowed); mistral-medium-latest is Mistral's current
// general-purpose model available on a standard key.
const MISTRAL_MODEL = "mistral-medium-latest";

export const LANGUAGES = {
  en: { label: "English", instruction: "Write entirely in English." },
  hi: { label: "Hindi", instruction: "Write entirely in Hindi, using Devanagari script." },
  te: { label: "Telugu", instruction: "Write entirely in Telugu, using Telugu script." },
  gu: { label: "Gujarati", instruction: "Write entirely in Gujarati, using Gujarati script." },
  bn: { label: "Bengali", instruction: "Write entirely in Bengali, using Bengali script." },
  as: { label: "Assamese", instruction: "Write entirely in Assamese, using Bengali-Assamese script." },
  "hi-en": { label: "Hinglish (English + Hindi)", instruction: "Write in Hinglish -- casual, natural Hindi-English code-mixing the way Indian social media actually reads, Latin script throughout (Hindi words transliterated, not Devanagari)." },
  "te-en": { label: "Telugish (English + Telugu)", instruction: "Write in Telugish -- casual, natural Telugu-English code-mixing, Latin script throughout (Telugu words transliterated, not Telugu script)." },
  "gu-en": { label: "Gujlish (English + Gujarati)", instruction: "Write in Gujlish -- casual, natural Gujarati-English code-mixing, Latin script throughout." },
  "bn-en": { label: "Banglish (English + Bengali)", instruction: "Write in Banglish -- casual, natural Bengali-English code-mixing, Latin script throughout." },
  "as-en": { label: "Asmish (English + Assamese)", instruction: "Write in Asmish -- casual, natural Assamese-English code-mixing, Latin script throughout." },
};

export const PLATFORMS = {
  instagram: {
    label: "Instagram",
    instruction: "Instagram caption: open with a strong wanderlust hook in the first line, use clean short paragraphs with line breaks for readability, and end with exactly 6 to 10 relevant hashtags on their own line.",
    hashtagRange: [6, 10],
    maxChars: null,
  },
  twitter: {
    label: "X / Twitter",
    instruction: "X/Twitter post: punchy and concise, the ENTIRE post including hashtags must stay under 270 characters, include exactly 2 to 3 hashtags, minimal line breaks.",
    hashtagRange: [2, 3],
    maxChars: 270,
  },
  facebook: {
    label: "Facebook",
    instruction: "Facebook post: warm community-storytelling tone, a few short paragraphs, include 3 to 5 relevant hashtags at the end.",
    hashtagRange: [3, 5],
    maxChars: null,
  },
  whatsapp: {
    label: "WhatsApp Broadcast/Status",
    instruction: "WhatsApp broadcast/status message: use *single asterisks* for bold highlights (WhatsApp's own markdown, never real bold formatting or double asterisks), short emoji bullet points for key details, and end with a direct reply call-to-action (e.g. \"Reply YES to book\" or \"Reply NOW for this offer\"). No hashtags.",
    hashtagRange: [0, 0],
    maxChars: null,
  },
  general: {
    label: "General Promotional Post",
    instruction: "Universal promotional copy for a printed flyer, brochure, or any channel -- no platform-specific formatting or character limit. Clear, persuasive copy. 0 to 3 hashtags, optional.",
    hashtagRange: [0, 3],
    maxChars: null,
  },
};

export const TONES = {
  professional: "Professional -- polished, businesslike, confident.",
  friendly: "Friendly -- warm, approachable, conversational.",
  exciting: "Exciting -- high energy, enthusiastic, punchy.",
  premium: "Premium -- refined, aspirational, understated luxury.",
  "local-cultural": "Local Cultural -- rooted in local culture, tradition and place, evocative of the region's own character.",
  storytelling: "Storytelling -- a short narrative moment, not a list of features.",
  minimal: "Minimal -- spare, few words, let the offer speak for itself.",
  "ai-decides": null, // no forced tone -- picked per the facts/platform instead
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw Object.assign(new Error(`${name} is not configured`), { code: "MISSING_ENV" });
  return value;
}

async function fetchWithTimeout(url, options, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One JSON-mode chat completion call against a Groq/Mistral-style
 * (OpenAI-compatible) endpoint. Throws on any non-2xx or unparsable body --
 * callers decide whether that means "try the next provider".
 */
async function chatJSON({ url, apiKey, model, messages, extraBody }) {
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.7, response_format: { type: "json_object" }, ...extraBody }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${url} returned ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error(`${url} returned no message content`);
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`${url} returned content that was not valid JSON`);
  }
}

/**
 * Extract-then-generate, step one: pull ONLY facts the operator actually
 * stated in their own text (typed, or their voice transcript) into
 * structured JSON -- never inferred, never embellished. This runs as its
 * own small, cheap model call specifically so a later "write me a post"
 * call is grounded against a short fact sheet instead of free-form prose
 * it could creatively misread. Verified business/availability data (real
 * DB rows, see attachBusinessFacts below) always takes priority over
 * anything extracted here when both exist.
 */
async function extractStatedFacts(rawText, { apiKey }) {
  if (!rawText?.trim()) return {};
  const messages = [
    {
      role: "system",
      content:
        "You extract facts from a small-business owner's own promotional text. " +
        "Return ONLY facts explicitly present in the text -- never infer, guess, round, or add anything not stated. " +
        'Return strict JSON: {"highlights": string[], "offerDescription": string|null, "mentionedPrice": string|null, ' +
        '"mentionedDiscount": string|null, "callToAction": string|null}. ' +
        "Use null (not an empty string, not a guess) for anything not explicitly present.",
    },
    { role: "user", content: rawText },
  ];
  try {
    return await chatJSON({ url: GROQ_CHAT_URL, apiKey, model: GROQ_EXTRACT_MODEL, messages, extraBody: { reasoning_format: "hidden" } });
  } catch {
    return {}; // extraction failing shouldn't block generation -- generation still has rawText as a fallback fact
  }
}

/**
 * Real, DB-backed facts for a business the operator actually owns --
 * source of truth over anything in free text, since these are verified
 * records rather than claims. Only ever looked up for a business the
 * requesting operator owns (ownerUserId check), same as every other
 * operator-scoped read in this app.
 */
async function attachBusinessFacts(businessId, ownerUserId) {
  if (!businessId) return null;
  const business = await Business.findOne({ _id: businessId, ownerUserId: String(ownerUserId) }).lean();
  if (!business) return null;

  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const nextAvailability = await BusinessAvailability.findOne({ businessId: business._id, date: { $gte: today } })
    .sort({ date: 1 })
    .lean();

  const destination = business.destId ? getDestination(business.destId) : null;

  return {
    name: business.name || null,
    type: business.type || null,
    destination: destination?.name || business.destId || null,
    verificationTier: business.verificationTier || null,
    amenities: business.amenities?.length ? business.amenities : null,
    meals: business.meals?.length ? business.meals : null,
    nearestLandmark: business.nearestLandmark || null,
    priceRangeINR: business.priceRangeINR?.min || business.priceRangeINR?.max ? business.priceRangeINR : null,
    realPricePerNight: nextAvailability?.pricePerNight ?? null,
    realDiscountPct: nextAvailability?.discountPct ?? null,
  };
}

function pruneNulls(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0)));
}

/**
 * Whisper large-v3 transcription via Groq's OpenAI-compatible audio
 * endpoint. verbose_json is requested specifically to get the detected
 * language back -- the plain "json"/text formats don't include it, and
 * cross-lingual generation needs to know what the operator actually spoke
 * in even before they pick an output language.
 */
export async function transcribeVoice(audioBuffer, filename = "audio.webm") {
  const apiKey = requireEnv("GROQ_API_KEY");
  const form = new FormData();
  form.append("file", new Blob([audioBuffer]), filename);
  form.append("model", "whisper-large-v3");
  form.append("response_format", "verbose_json");

  const res = await fetchWithTimeout(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  }, 60_000);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Whisper transcription failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  if (typeof data?.text !== "string") throw new Error("Whisper transcription returned an unexpected shape");
  return { transcript: data.text.trim(), detectedLanguage: data.language || null };
}

/**
 * Full generate pipeline: extract facts -> build a grounded prompt -> Groq,
 * falling back to Mistral on any failure. Returns
 * { variants: [{body, hashtags}], provider, warnings }.
 */
export async function generateContent({ rawText, businessId, ownerUserId, language, platform, tone, variantCount }) {
  if (!rawText?.trim()) throw Object.assign(new Error("Describe what you want to promote first"), { status: 400 });
  if (!LANGUAGES[language]) throw Object.assign(new Error("Unsupported language"), { status: 400 });
  if (!PLATFORMS[platform]) throw Object.assign(new Error("Unsupported platform"), { status: 400 });
  if (!(tone in TONES)) throw Object.assign(new Error("Unsupported tone"), { status: 400 });
  const n = Number(variantCount);
  if (!Number.isInteger(n) || n < 1 || n > 3) throw Object.assign(new Error("variantCount must be 1, 2, or 3"), { status: 400 });

  const groqKey = process.env.GROQ_API_KEY;
  const mistralKey = process.env.MISTRAL_API_KEY;

  const [statedFacts, businessFacts] = await Promise.all([
    groqKey ? extractStatedFacts(rawText, { apiKey: groqKey }) : {},
    attachBusinessFacts(businessId, ownerUserId),
  ]);

  // Verified business/availability data wins over anything merely stated,
  // since it's a real DB row rather than a claim -- e.g. a real
  // realDiscountPct overrides a vaguer mentionedDiscount string.
  const facts = pruneNulls({
    ...statedFacts,
    ...(businessFacts || {}),
    rawOperatorText: rawText.trim(),
  });

  const platformSpec = PLATFORMS[platform];
  const languageSpec = LANGUAGES[language];
  const toneInstruction = TONES[tone] || "Choose whichever tone best fits the facts and platform below.";

  const systemPrompt =
    "You are a tourism marketing copywriter for Sahyatri, writing on behalf of a verified local business. " +
    "CRITICAL: you must ONLY use the facts provided below. Never invent, infer, or embellish a price, discount, rating, " +
    "amenity, or claim that is not explicitly present in the facts. If a detail (like price) is missing, write generically " +
    "around it instead of making one up -- a vague-but-honest post is always better than a fabricated specific. " +
    `Tone: ${toneInstruction} ` +
    `Language: ${languageSpec.instruction} ` +
    `Platform: ${platformSpec.instruction} ` +
    `Write exactly ${n} distinct variant(s) -- each meaningfully different in angle or wording, not near-duplicates. ` +
    'Return strict JSON only: {"variants": [{"body": string, "hashtags": string[]}]} with exactly ' +
    `${n} entries, hashtags without the leading "#" character (added on display). No commentary outside the JSON.`;

  const userPrompt = `Verified facts (JSON) -- use only these, nothing else:\n${JSON.stringify(facts, null, 2)}`;
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let raw;
  let provider;
  if (groqKey) {
    try {
      raw = await chatJSON({ url: GROQ_CHAT_URL, apiKey: groqKey, model: GROQ_MODEL, messages, extraBody: { reasoning_format: "hidden" } });
      provider = "groq";
    } catch (groqError) {
      console.log("Content generation: Groq failed, falling back to Mistral --", groqError.message);
    }
  }
  if (!raw) {
    if (!mistralKey) {
      throw Object.assign(
        new Error(groqKey ? "Groq failed and no Mistral fallback is configured" : "No LLM provider is configured"),
        { status: 502 }
      );
    }
    raw = await chatJSON({ url: MISTRAL_CHAT_URL, apiKey: mistralKey, model: MISTRAL_MODEL, messages });
    provider = "mistral";
  }

  const variants = Array.isArray(raw?.variants) ? raw.variants : [];
  if (variants.length === 0) throw Object.assign(new Error("The model returned no usable content -- try again"), { status: 502 });

  const warnings = [];
  const processed = variants.slice(0, n).map((v, i) => {
    const body = String(v?.body || "").trim();
    const hashtags = Array.isArray(v?.hashtags) ? v.hashtags.map((h) => String(h).replace(/^#/, "")).filter(Boolean) : [];

    if (platformSpec.maxChars) {
      const fullLength = body.length + hashtags.reduce((sum, h) => sum + h.length + 2, 0);
      if (fullLength > platformSpec.maxChars) {
        warnings.push(`Variant ${i + 1} is ${fullLength} characters, over ${platformSpec.label}'s ${platformSpec.maxChars}-character limit -- consider regenerating or trimming.`);
      }
    }
    const [minTags, maxTags] = platformSpec.hashtagRange;
    if (hashtags.length < minTags || hashtags.length > maxTags) {
      warnings.push(`Variant ${i + 1} has ${hashtags.length} hashtags; ${platformSpec.label} works best with ${minTags}-${maxTags}.`);
    }
    return { body, hashtags };
  });

  return { variants: processed, provider, warnings, facts };
}

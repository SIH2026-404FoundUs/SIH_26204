// Voice Onboarding — destId resolution (the gap explicitly flagged as
// unbuilt in earlier work on this branch): given a spoken place name (a
// reply to getNextFollowUpQuestion's destId question, e.g. "Shimla" or
// "near the mall in Shimla"), resolve it to the canonical DESTINATIONS
// slug (e.g. "shimla").
//
// No AI call: this is a lookup problem against real seed data, not an
// extraction problem. Confirmed before writing this — no Destination
// Mongoose model exists anywhere in this codebase (checked, not assumed):
// destinations live only as JSON seed files under src/seeds/destinations/,
// currently read directly by services/substitution/standardize.js.
// Deliberately NOT reusing that loader here: it auto-initializes z-score
// stats as an unconditional import-time side effect (irrelevant to this
// feature), and getTrackedDestinations() filters to trackingTier ===
// "tracked" only, the wrong dataset for this (a business can be near any
// real destination, not just ones tracked for pressure monitoring). This
// module reads the same seed JSON files directly instead — same real
// data, no unrelated coupling.
//
// Matching approach: two-tier, word-boundary-aware SUBSTRING matching on
// normalized text — not edit-distance/typo-tolerant fuzzy matching,
// scoped to what the task's own example illustrates (extra words around
// an exact name, e.g. "near the mall in Shimla", not misspellings of it).
//
//   Tier 1 (specific): each destination's `name`, and the first
//   comma-segment of its `displayName` (e.g. "Golconda Fort" from
//   "Golconda Fort, Hyderabad, Telangana") — real place names an
//   operator would plausibly say.
//
//   Tier 2 (broader, fallback ONLY if tier 1 finds nothing at all): each
//   destination's `_id` slug (hyphens -> spaces) and every OTHER
//   comma-segment of displayName (district/state) — real but much less
//   specific; several real destinations share a district/state
//   (confirmed: exactly three destinations have "Hyderabad" in their
//   displayName — charminar-hyderabad, golconda-hyderabad,
//   hussain-sagar-hyderabad).
//
// Confidence rule: resolve ONLY when exactly one destination matches at
// whichever tier produced any matches. Zero matches, or two-or-more ties
// at the same tier (e.g. the transcript just says "Hyderabad"), returns
// null rather than guessing — the same "return null rather than
// fabricate" discipline the extraction prompt already follows.
//
// Known, accepted limitation, not solved here: a destination `name` that
// is also a common word (e.g. "Mandi" literally means "market" in Hindi)
// could false-positive on unrelated speech. No clean fix without deeper
// NLP; flagged, not silently ignored.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS_DESTINATIONS_DIR = path.join(__dirname, "../../seeds/destinations");
const ALIASES_FILE = path.join(__dirname, "../../seeds/destinationAliases.json");

let cachedDestinations = null;
let cachedAliases = null;

function loadDestinations() {
  if (cachedDestinations) {
    return cachedDestinations;
  }
  if (!fs.existsSync(SEEDS_DESTINATIONS_DIR)) {
    cachedDestinations = [];
    return cachedDestinations;
  }
  const files = fs.readdirSync(SEEDS_DESTINATIONS_DIR).filter((file) => file.endsWith(".json"));
  cachedDestinations = files.map((file) =>
    JSON.parse(fs.readFileSync(path.join(SEEDS_DESTINATIONS_DIR, file), "utf-8"))
  );
  return cachedDestinations;
}

function loadAliases() {
  if (cachedAliases) {
    return cachedAliases;
  }
  if (!fs.existsSync(ALIASES_FILE)) {
    cachedAliases = { destinations: {}, regions: {} };
    return cachedAliases;
  }
  cachedAliases = JSON.parse(fs.readFileSync(ALIASES_FILE, "utf-8"));
  return cachedAliases;
}

export function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

// Whole-word substring check: pads both sides with a single space so a
// candidate only matches at real word boundaries within the
// space-delimited normalized haystack (e.g. "mandi" must not match
// inside some longer unrelated word that happens to contain it).
function containsWholeWordSubstring(normalizedHaystack, normalizedNeedle) {
  if (!normalizedNeedle) return false;
  return ` ${normalizedHaystack} `.includes(` ${normalizedNeedle} `);
}

function buildCandidates(destination, aliases) {
  const displayNameParts = String(destination.displayName ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const tier1 = new Set();
  if (destination.name) tier1.add(normalize(destination.name));
  if (displayNameParts[0]) tier1.add(normalize(displayNameParts[0]));

  // Destination-specific aliases (English, Hindi, landmark variants) from data layer
  const destAliases = aliases?.destinations?.[destination._id] ?? [];
  for (const alias of destAliases) {
    tier1.add(normalize(alias));
  }
  tier1.delete("");

  const tier2 = new Set();
  if (destination._id) tier2.add(normalize(destination._id.replace(/-/g, " ")));
  for (const part of displayNameParts.slice(1)) {
    tier2.add(normalize(part));
  }
  if (destination.district) {
    tier2.add(normalize(destination.district));
  }
  if (destination.state) {
    tier2.add(normalize(destination.state));
  }

  // Add regional aliases that associate with this destination
  const destDistrictNorm = normalize(destination.district);
  const destIdNorm = normalize(destination._id.replace(/-/g, " "));
  const destDisplayNorm = normalize(destination.displayName);

  for (const [regionKey, regionAliases] of Object.entries(aliases?.regions ?? {})) {
    const keyNorm = normalize(regionKey.replace(/-/g, " "));
    const isAssociated =
      destDistrictNorm.includes(keyNorm) ||
      destIdNorm.includes(keyNorm) ||
      destDisplayNorm.includes(keyNorm);

    if (isAssociated) {
      for (const alias of regionAliases) {
        tier2.add(normalize(alias));
      }
    }
  }

  tier2.delete("");
  for (const candidate of tier1) {
    tier2.delete(candidate);
  }

  return { tier1: [...tier1], tier2: [...tier2] };
}

/**
 * Resolves a spoken place name in `transcript` to the canonical
 * DESTINATIONS `_id` slug, or null if no confident match is found. See
 * module docstring for the exact matching/confidence rules.
 *
 * Disambiguation:
 * - If tier 1 produces exactly 1 match, resolves immediately.
 * - If tier 1 produces >= 2 matches, returns null (ambiguous).
 * - If tier 1 produces 0 matches, checks tier 2 (region / district).
 * - Region matches act as candidate filters. If multiple destinations
 *   belong to the matched region, context (such as an existing landmark)
 *   can disambiguate. If still ambiguous, returns null.
 *
 * @param {string} transcript
 * @param {Object|string} [context] - Optional draft context (e.g. { landmark } or landmark string)
 * @returns {string|null}
 */
export function resolveDestId(transcript, context = {}) {
  const normalizedTranscript = normalize(transcript);
  if (!normalizedTranscript) {
    return null;
  }

  const landmarkContext =
    typeof context === "string" ? context : context?.landmark ?? context?.nearestLandmark ?? null;
  const normalizedLandmark = landmarkContext ? normalize(landmarkContext) : null;

  const destinations = loadDestinations();
  const aliases = loadAliases();

  const tier1Matches = [];
  const tier2Matches = [];
  const destinationMap = new Map();

  for (const destination of destinations) {
    const { tier1, tier2 } = buildCandidates(destination, aliases);
    destinationMap.set(destination._id, { tier1, tier2 });

    if (tier1.some((candidate) => containsWholeWordSubstring(normalizedTranscript, candidate))) {
      tier1Matches.push(destination._id);
    } else if (tier2.some((candidate) => containsWholeWordSubstring(normalizedTranscript, candidate))) {
      tier2Matches.push(destination._id);
    }
  }

  if (tier1Matches.length === 1) return tier1Matches[0];
  if (tier1Matches.length >= 2) return null; // ambiguous even among specific names -- don't guess

  // Tier 2: Region / District matches (contextual filters)
  if (tier2Matches.length === 1) {
    return tier2Matches[0];
  }

  if (tier2Matches.length >= 2 && normalizedLandmark) {
    // Attempt landmark disambiguation among the candidate destinations
    const landmarkDisambiguated = tier2Matches.filter((id) => {
      const { tier1 } = destinationMap.get(id);
      return tier1.some(
        (c) =>
          containsWholeWordSubstring(normalizedLandmark, c) ||
          containsWholeWordSubstring(c, normalizedLandmark)
      );
    });

    if (landmarkDisambiguated.length === 1) {
      return landmarkDisambiguated[0];
    }
  }

  return null; // zero matches, or an ambiguous broader match (e.g. "Hyderabad" alone, "Kullu" alone)
}

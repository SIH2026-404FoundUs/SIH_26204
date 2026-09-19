// Voice Onboarding — Deterministic parser for availability dates and units (Section 1.1: AWAITING_DATES).
//
// Interprets natural language expressions like:
// - "I'm available from October 10 to October 20, I have 3 rooms."
// - "10th October to 20th October, 2 rooms"
// - "from October 10 until October 20"
// - "October 10" (single date)
// - "అక్టోబర్ 10 నుంచి అక్టోబర్ 20 వరకు"
// - "అక్టోబర్ 12 నుంచి అక్టోబర్ 15 వరకు మూడు గదులు ఖాళీగా ఉన్నాయి"
// - "10 अक्टूबर से 20 अक्टूबर तक तीन कमरे"
//
// Rules:
// - Uses current year when year is not explicitly stated.
// - Returns null when dates or unit count cannot be confidently determined.
// - Units: { total: N, available: N }.
// - Extracts date range from a sentence without requiring the whole transcript to match.
// - Unicode-safe boundaries (does not rely on ASCII-only \b for Indic text).

const MONTHS = {
  // English
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,

  // Telugu
  "జనవరి": 0,
  "ఫిబ్రవరి": 1,
  "మార్చి": 2,
  "ఏప్రిల్": 3,
  "మే": 4,
  "జూన్": 5,
  "జూలై": 6,
  "ఆగస్టు": 7,
  "ఆగస్ట్": 7,
  "సెప్టెంబరు": 8,
  "సెప్టెంబర్": 8,
  "అక్టోబరు": 9,
  "అక్టోబర్": 9,
  "నవంబరు": 10,
  "నవంబర్": 10,
  "డిసెంబరు": 11,
  "డిసెంబర్": 11,

  // Hindi
  "जनवरी": 0,
  "फ़रवरी": 1,
  "फरवरी": 1,
  "मार्च": 2,
  "अप्रैल": 3,
  "मई": 4,
  "जून": 5,
  "जुलाई": 6,
  "अगस्त": 7,
  "सितम्बर": 8,
  "सितंबर": 8,
  "अक्टूबर": 9,
  "अक्तूबर": 9,
  "नवम्बर": 10,
  "नवंबर": 10,
  "दिसम्बर": 11,
  "दिसंबर": 11,
};

// Sort by length descending so longer tokens match first (e.g. సెప్టెంబరు before సెప్టెంబర్)
const MONTH_NAMES_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

const NUMBER_WORDS = {
  // English
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,

  // Hindi transliterated
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  paanch: 5,
  panch: 5,
  che: 6,
  chheh: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,

  // Hindi Devanagari
  "एक": 1,
  "दो": 2,
  "तीन": 3,
  "चार": 4,
  "पांच": 5,
  "पाँच": 5,
  "छह": 6,
  "छः": 6,
  "सात": 7,
  "आठ": 8,
  "नौ": 9,
  "दस": 10,

  // Telugu
  "ఒకటి": 1,
  "ఒక": 1,
  "రెండు": 2,
  "మూడు": 3,
  "నాలుగు": 4,
  "ఐదు": 5,
  "ఆరు": 6,
  "ఏడు": 7,
  "ఎనిమిది": 8,
  "తొమ్మిది": 9,
  "పది": 10,
};

const NUMBER_WORDS_PATTERN = Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join("|");

const UNIT_WORDS_PATTERN =
  "rooms?|kamre|kamra|कमरे|कमरा|कमरों|यूनिट|सीटें?|सीट|टेबल|स्लॉट|గదులు?|గది|రూమ్స్?|రూములు?|రూమ్|యూనిట్లు?|యూనిట్స్?|సీట్లు?|సీట్స్?|టేబుల్స్?|units?|tables?|seats?|slots?";

// Unicode-safe boundaries that work for English, Indic scripts (Telugu, Devanagari), and numbers
const BOUNDARY_START = "(?<=^|[^\\p{L}\\p{N}])";
const BOUNDARY_END = "(?=$|[^\\p{L}\\p{N}])";

const PREFIX_PATTERN = "(?:(?:from|నుంచి|నుండి|से)\\s+)?";
const SEPARATORS_PATTERN = "(?:to|until|till|-|నుంచి|నుండి|వరకు|సే|से|तक)";
const SUFFIX_PATTERN = "(?:\\s*(?:వరకు|तक))?";

/**
 * Normalizes Devanagari and Telugu digits to standard ASCII 0-9.
 */
function normalizeIndicNumerals(str) {
  if (!str) return "";
  return str
    .replace(/[०-९]/g, (ch) => String(ch.charCodeAt(0) - 0x0966))
    .replace(/[౦-౯]/g, (ch) => String(ch.charCodeAt(0) - 0x0c66));
}

/**
 * Normalizes day string like "10th", "1st", "2nd", "3rd", "10వ", "10वीं" to integer 1..31.
 */
function parseDay(str) {
  if (!str) return null;
  const match = str.match(/^(\d{1,2})(?:st|nd|rd|th|వ|वीं|वां)?$/iu);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  return val >= 1 && val <= 31 ? val : null;
}

/**
 * Verifies that day, month, year form a valid calendar date (e.g. rejects Feb 31, April 31).
 */
function isValidDateParts(year, month, day) {
  if (month < 0 || month > 11 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month, day));
  return (
    !isNaN(d.getTime()) &&
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month &&
    d.getUTCDate() === day
  );
}

/**
 * Parses a single date token into { month: 0..11, day: 1..31, year: YYYY }.
 */
export function parseDateToken(token, defaultYear) {
  if (!token) return null;
  const clean = normalizeIndicNumerals(token.trim());

  // Pattern 1: Month Day Year? e.g. "October 10", "Oct 10th", "October 10 2026", "October 10, 2026", "అక్టోబర్ 10"
  const monthFirst = new RegExp(
    `^(${MONTH_NAMES_PATTERN})\\s+(\\d{1,2}(?:st|nd|rd|th|వ|वीं|वां)?)(?:,?(\\s+\\d{4}))?$`,
    "iu"
  );
  const m1 = clean.match(monthFirst);
  if (m1) {
    const month = MONTHS[m1[1].toLowerCase()];
    const day = parseDay(m1[2]);
    const year = m1[3] ? parseInt(m1[3].trim(), 10) : defaultYear;
    if (day !== null && month !== undefined && isValidDateParts(year, month, day)) {
      return { month, day, year };
    }
  }

  // Pattern 2: Day Month Year? e.g. "10th October", "10 Oct 2026", "10th of October", "10 అక్టోబర్"
  const dayFirst = new RegExp(
    `^(\\d{1,2}(?:st|nd|rd|th|వ|वीं|वां)?)(?:\\s+of)?\\s+(${MONTH_NAMES_PATTERN})(?:,?(\\s+\\d{4}))?$`,
    "iu"
  );
  const m2 = clean.match(dayFirst);
  if (m2) {
    const day = parseDay(m2[1]);
    const month = MONTHS[m2[2].toLowerCase()];
    const year = m2[3] ? parseInt(m2[3].trim(), 10) : defaultYear;
    if (day !== null && month !== undefined && isValidDateParts(year, month, day)) {
      return { month, day, year };
    }
  }

  // Pattern 3: YYYY-MM-DD or DD-MM-YYYY or DD/MM/YYYY
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (isValidDateParts(year, month, day)) {
      return { month, day, year };
    }
  }

  const slashMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : defaultYear;
    if (isValidDateParts(year, month, day)) {
      return { month, day, year };
    }
  }

  return null;
}

/**
 * Extracts the start and end Date objects from transcript.
 * Extracts from natural language without requiring the full transcript to match.
 *
 * @param {string} text
 * @param {number} defaultYear
 * @returns {{ startDate: Date, endDate: Date } | null}
 */
export function parseAvailabilityDates(rawText, defaultYear = new Date().getFullYear()) {
  if (!rawText || typeof rawText !== "string") return null;
  const text = normalizeIndicNumerals(rawText);

  // Pattern 1: Month Day to [Month] Day
  // e.g. "October 10 to October 20", "October 10 to 20", "అక్టోబర్ 10 నుంచి అక్టోబర్ 20 వరకు", "अक्टूबर 10 से 20 तक"
  const m1 = new RegExp(
    `${BOUNDARY_START}${PREFIX_PATTERN}(${MONTH_NAMES_PATTERN})\\s+(\\d{1,2}(?:st|nd|rd|th|వ|वीं|वां)?)(?:,?(\\s+\\d{4}))?\\s+${SEPARATORS_PATTERN}\\s+(?:(${MONTH_NAMES_PATTERN})\\s+)?(\\d{1,2}(?:st|nd|rd|th|వ|वीं|वां)?)(?:,?(\\s+\\d{4}))?${SUFFIX_PATTERN}${BOUNDARY_END}`,
    "iu"
  );
  const match1 = text.match(m1);
  if (match1) {
    const startMonth = MONTHS[match1[1].toLowerCase()];
    const startDay = parseDay(match1[2]);
    const startYear = match1[3] ? parseInt(match1[3].trim(), 10) : defaultYear;

    const endMonth = match1[4] ? MONTHS[match1[4].toLowerCase()] : startMonth;
    const endDay = parseDay(match1[5]);
    const endYear = match1[6]
      ? parseInt(match1[6].trim(), 10)
      : match1[3]
      ? parseInt(match1[3].trim(), 10)
      : defaultYear;

    if (
      startDay !== null &&
      endDay !== null &&
      startMonth !== undefined &&
      endMonth !== undefined &&
      isValidDateParts(startYear, startMonth, startDay) &&
      isValidDateParts(endYear, endMonth, endDay)
    ) {
      const startDate = new Date(Date.UTC(startYear, startMonth, startDay));
      const endDate = new Date(Date.UTC(endYear, endMonth, endDay));
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate >= startDate) {
        return { startDate, endDate };
      }
    }
  }

  // Pattern 2: Day [Month] to Day Month
  // e.g. "10th October to 20th October", "10th to 20th October", "10 అక్టోబర్ నుంచి 20 అక్టోబర్ వరకు"
  const m2 = new RegExp(
    `${BOUNDARY_START}${PREFIX_PATTERN}(\\d{1,2}(?:st|nd|rd|th|వ|वीं|वां)?)(?:\\s+of)?(?:\\s+(${MONTH_NAMES_PATTERN}))?(?:,?(\\s+\\d{4}))?\\s+${SEPARATORS_PATTERN}\\s+(\\d{1,2}(?:st|nd|rd|th|వ|वीं|वां)?)(?:\\s+of)?\\s+(${MONTH_NAMES_PATTERN})(?:,?(\\s+\\d{4}))?${SUFFIX_PATTERN}${BOUNDARY_END}`,
    "iu"
  );
  const match2 = text.match(m2);
  if (match2) {
    const endMonth = MONTHS[match2[5].toLowerCase()];
    const startMonth = match2[2] ? MONTHS[match2[2].toLowerCase()] : endMonth;
    const startDay = parseDay(match2[1]);
    const endDay = parseDay(match2[4]);
    const startYear = match2[3] ? parseInt(match2[3].trim(), 10) : defaultYear;
    const endYear = match2[6] ? parseInt(match2[6].trim(), 10) : defaultYear;

    if (
      startDay !== null &&
      endDay !== null &&
      startMonth !== undefined &&
      endMonth !== undefined &&
      isValidDateParts(startYear, startMonth, startDay) &&
      isValidDateParts(endYear, endMonth, endDay)
    ) {
      const startDate = new Date(Date.UTC(startYear, startMonth, startDay));
      const endDate = new Date(Date.UTC(endYear, endMonth, endDay));
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate >= startDate) {
        return { startDate, endDate };
      }
    }
  }

  // Pattern 3: Single Date Month Day: "October 10", "on October 15", "అక్టోబర్ 10"
  const single1 = new RegExp(
    `${BOUNDARY_START}(${MONTH_NAMES_PATTERN})\\s+(\\d{1,2}(?:st|nd|rd|th|వ|वीं|वां)?)(?:,?(\\s+\\d{4}))?${BOUNDARY_END}`,
    "iu"
  );
  const matchSingle1 = text.match(single1);
  if (matchSingle1) {
    const month = MONTHS[matchSingle1[1].toLowerCase()];
    const day = parseDay(matchSingle1[2]);
    const year = matchSingle1[3] ? parseInt(matchSingle1[3].trim(), 10) : defaultYear;
    if (day !== null && month !== undefined && isValidDateParts(year, month, day)) {
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) {
        return { startDate: d, endDate: d };
      }
    }
  }

  // Pattern 4: Single Date Day Month: "10th October", "10 అక్టోబర్", "10 अक्टूबर"
  const single2 = new RegExp(
    `${BOUNDARY_START}(\\d{1,2}(?:st|nd|rd|th|వ|वीं|वां)?)(?:\\s+of)?\\s+(${MONTH_NAMES_PATTERN})(?:,?(\\s+\\d{4}))?${BOUNDARY_END}`,
    "iu"
  );
  const matchSingle2 = text.match(single2);
  if (matchSingle2) {
    const day = parseDay(matchSingle2[1]);
    const month = MONTHS[matchSingle2[2].toLowerCase()];
    const year = matchSingle2[3] ? parseInt(matchSingle2[3].trim(), 10) : defaultYear;
    if (day !== null && month !== undefined && isValidDateParts(year, month, day)) {
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) {
        return { startDate: d, endDate: d };
      }
    }
  }

  return null;
}

/**
 * Extracts number of available units from transcript.
 *
 * @param {string} rawText
 * @returns {number|null}
 */
export function parseUnitCount(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const text = normalizeIndicNumerals(rawText);

  // Digits + unit words: e.g. "3 rooms", "have 4 units", "5 tables", "3 గదులు", "4 कमरे"
  const digitsMatch = text.match(
    new RegExp(
      `${BOUNDARY_START}(\\d+)\\s*(?:${UNIT_WORDS_PATTERN})${BOUNDARY_END}`,
      "iu"
    )
  );
  if (digitsMatch) {
    const n = parseInt(digitsMatch[1], 10);
    if (n > 0 && n <= 1000) return n;
  }

  // Number words + unit words: e.g. "three rooms", "teen kamre", "మూడు గదులు", "तीन कमरे"
  const wordsMatch = text.match(
    new RegExp(
      `${BOUNDARY_START}(${NUMBER_WORDS_PATTERN})\\s*(?:${UNIT_WORDS_PATTERN})${BOUNDARY_END}`,
      "iu"
    )
  );
  if (wordsMatch) {
    const key = wordsMatch[1].toLowerCase();
    return NUMBER_WORDS[key] ?? null;
  }

  // Fallback: "capacity of 3", "have 3", "మొత్తం 3", "कुल 3", etc.
  const fallbackMatch = text.match(
    /(?:have|capacity\s*(?:of)?|total\s*(?:of)?|మొత్తం|సామర్థ్యం|कुल|क्षमता)\s*(\d+)/iu
  );
  if (fallbackMatch) {
    const n = parseInt(fallbackMatch[1], 10);
    if (n > 0 && n <= 1000) return n;
  }

  return null;
}

/**
 * Generates an array of Date objects for each day in [startDate, endDate] (inclusive).
 * Dates are set to midnight UTC.
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Date[]}
 */
export function generateDateRange(startDate, endDate) {
  const dates = [];
  const curr = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

  while (curr <= end) {
    dates.push(new Date(curr.getTime()));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return dates;
}

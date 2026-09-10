// Voice Onboarding — Deterministic parser for availability dates and units (Section 1.1: AWAITING_DATES).
//
// Interprets natural language expressions like:
// - "I'm available from October 10 to October 20, I have 3 rooms."
// - "10th October to 20th October, 2 rooms"
// - "from October 10 until October 20"
// - "October 10" (single date)
//
// Rules:
// - Uses current year when year is not explicitly stated.
// - Returns null when dates or unit count cannot be confidently determined.
// - Units: { total: N, available: N }.

const MONTHS = {
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
};

const MONTH_NAMES_PATTERN = Object.keys(MONTHS).join("|");

const NUMBER_WORDS = {
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
};

/**
 * Normalizes day string like "10th", "1st", "2nd", "3rd" to integer 1..31.
 */
function parseDay(str) {
  if (!str) return null;
  const match = str.match(/^(\d{1,2})(?:st|nd|rd|th)?$/i);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  return val >= 1 && val <= 31 ? val : null;
}

/**
 * Parses a single date token into { month: 0..11, day: 1..31, year: YYYY }.
 */
function parseDateToken(token, defaultYear) {
  if (!token) return null;
  const clean = token.trim();

  // Pattern 1: Month Day Year? e.g. "October 10", "Oct 10th", "October 10 2026", "October 10, 2026"
  const monthFirst = new RegExp(
    `^(${MONTH_NAMES_PATTERN})\\s+(\\d{1,2}(?:st|nd|rd|th)?)(?:,?(\\s+\\d{4}))?$`,
    "i"
  );
  const m1 = clean.match(monthFirst);
  if (m1) {
    const month = MONTHS[m1[1].toLowerCase()];
    const day = parseDay(m1[2]);
    const year = m1[3] ? parseInt(m1[3].trim(), 10) : defaultYear;
    if (day !== null && month !== undefined) {
      return { month, day, year };
    }
  }

  // Pattern 2: Day Month Year? e.g. "10th October", "10 Oct 2026", "10th of October"
  const dayFirst = new RegExp(
    `^(\\d{1,2}(?:st|nd|rd|th)?)(?:\\s+of)?\\s+(${MONTH_NAMES_PATTERN})(?:,?(\\s+\\d{4}))?$`,
    "i"
  );
  const m2 = clean.match(dayFirst);
  if (m2) {
    const day = parseDay(m2[1]);
    const month = MONTHS[m2[2].toLowerCase()];
    const year = m2[3] ? parseInt(m2[3].trim(), 10) : defaultYear;
    if (day !== null && month !== undefined) {
      return { month, day, year };
    }
  }

  // Pattern 3: YYYY-MM-DD or DD-MM-YYYY or DD/MM/YYYY
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return { month, day, year };
    }
  }

  const slashMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : defaultYear;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return { month, day, year };
    }
  }

  return null;
}

/**
 * Extracts the start and end Date objects from transcript.
 *
 * @param {string} text
 * @param {number} defaultYear
 * @returns {{ startDate: Date, endDate: Date } | null}
 */
export function parseAvailabilityDates(text, defaultYear = new Date().getFullYear()) {
  if (!text || typeof text !== "string") return null;

  // Pattern A: "<Date1> (to|until|till|-) <Date2>"
  // where Date can be:
  // - Month Day (e.g. "October 10")
  // - Day Month (e.g. "10th October")
  // or second part is just Day (e.g. "October 10 to 20")
  // or first part is just Day (e.g. "10th to 20th October")
  
  // 1. Month Day to [Month] Day
  const m1 = new RegExp(
    `(?:from\\s+)?\\b(${MONTH_NAMES_PATTERN})\\s+(\\d{1,2}(?:st|nd|rd|th)?)(?:,?(\\s+\\d{4}))?\\s+(?:to|until|till|-)\\s+(?:(${MONTH_NAMES_PATTERN})\\s+)?(\\d{1,2}(?:st|nd|rd|th)?)(?:,?(\\s+\\d{4}))?\\b`,
    "i"
  );
  const match1 = text.match(m1);
  if (match1) {
    const startMonth = MONTHS[match1[1].toLowerCase()];
    const startDay = parseDay(match1[2]);
    const startYear = match1[3] ? parseInt(match1[3].trim(), 10) : defaultYear;

    const endMonth = match1[4] ? MONTHS[match1[4].toLowerCase()] : startMonth;
    const endDay = parseDay(match1[5]);
    const endYear = match1[6] ? parseInt(match1[6].trim(), 10) : (match1[3] ? parseInt(match1[3].trim(), 10) : defaultYear);

    if (startDay !== null && endDay !== null) {
      const startDate = new Date(Date.UTC(startYear, startMonth, startDay));
      const endDate = new Date(Date.UTC(endYear, endMonth, endDay));
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate >= startDate) {
        return { startDate, endDate };
      }
    }
  }

  // 2. Day Month to Day Month (or Day to Day Month)
  const m2 = new RegExp(
    `(?:from\\s+)?\\b(\\d{1,2}(?:st|nd|rd|th)?)(?:\\s+of)?(?:\\s+(${MONTH_NAMES_PATTERN}))?(?:,?(\\s+\\d{4}))?\\s+(?:to|until|till|-)\\s+(\\d{1,2}(?:st|nd|rd|th)?)(?:\\s+of)?\\s+(${MONTH_NAMES_PATTERN})(?:,?(\\s+\\d{4}))?\\b`,
    "i"
  );
  const match2 = text.match(m2);
  if (match2) {
    const endMonth = MONTHS[match2[5].toLowerCase()];
    const startMonth = match2[2] ? MONTHS[match2[2].toLowerCase()] : endMonth;
    const startDay = parseDay(match2[1]);
    const endDay = parseDay(match2[4]);
    const startYear = match2[3] ? parseInt(match2[3].trim(), 10) : defaultYear;
    const endYear = match2[6] ? parseInt(match2[6].trim(), 10) : defaultYear;

    if (startDay !== null && endDay !== null) {
      const startDate = new Date(Date.UTC(startYear, startMonth, startDay));
      const endDate = new Date(Date.UTC(endYear, endMonth, endDay));
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate >= startDate) {
        return { startDate, endDate };
      }
    }
  }

  // 3. Single Date: "October 10", "10th October", "on October 15", etc.
  const single1 = new RegExp(
    `\\b(${MONTH_NAMES_PATTERN})\\s+(\\d{1,2}(?:st|nd|rd|th)?)(?:,?(\\s+\\d{4}))?\\b`,
    "i"
  );
  const matchSingle1 = text.match(single1);
  if (matchSingle1) {
    const month = MONTHS[matchSingle1[1].toLowerCase()];
    const day = parseDay(matchSingle1[2]);
    const year = matchSingle1[3] ? parseInt(matchSingle1[3].trim(), 10) : defaultYear;
    if (day !== null && month !== undefined) {
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) {
        return { startDate: d, endDate: d };
      }
    }
  }

  const single2 = new RegExp(
    `\\b(\\d{1,2}(?:st|nd|rd|th)?)(?:\\s+of)?\\s+(${MONTH_NAMES_PATTERN})(?:,?(\\s+\\d{4}))?\\b`,
    "i"
  );
  const matchSingle2 = text.match(single2);
  if (matchSingle2) {
    const day = parseDay(matchSingle2[1]);
    const month = MONTHS[matchSingle2[2].toLowerCase()];
    const year = matchSingle2[3] ? parseInt(matchSingle2[3].trim(), 10) : defaultYear;
    if (day !== null && month !== undefined) {
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
 * @param {string} text
 * @returns {number|null}
 */
export function parseUnitCount(text) {
  if (!text || typeof text !== "string") return null;

  // Patterns like "3 rooms", "have 4 units", "5 tables", "three rooms", "teen kamre"
  const digitsMatch = text.match(/(\d+)\s*(?:rooms?|kamre|kamra|units?|tables?|seats?|slots?)/i);
  if (digitsMatch) {
    const n = parseInt(digitsMatch[1], 10);
    if (n > 0 && n <= 1000) return n;
  }

  const wordsPattern = Object.keys(NUMBER_WORDS).join("|");
  const wordsMatch = text.match(new RegExp(`\\b(${wordsPattern})\\s*(?:rooms?|kamre|kamra|units?|tables?|seats?|slots?)`, "i"));
  if (wordsMatch) {
    return NUMBER_WORDS[wordsMatch[1].toLowerCase()] ?? null;
  }

  // Fallback: "capacity of 3", "have 3"
  const fallbackMatch = text.match(/(?:have|capacity\s*(?:of)?|total\s*(?:of)?)\s*(\d+)/i);
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

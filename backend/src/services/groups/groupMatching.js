/**
 * Group Travel matching (Revised Implementation Plan §12) -- rule-based
 * and fully explainable, deliberately not ML in this first implementation.
 * Every factor is a plain boolean the caller can show a reason for; the
 * internal weighted score exists ONLY to rank search results, and is never
 * itself returned to a client as a pseudo-precise percentage (§12: "Do not
 * expose pseudo-precise scores such as 87.4%. Show reasons instead.").
 *
 * Only travel-style/logistics attributes are ever compared -- no gender,
 * religion, age, or any other sensitive/protected attribute is read here
 * or exists anywhere on User/preferences for this purpose (§12/§19).
 */

const WEIGHTS = { travelType: 0.25, activities: 0.2, budget: 0.2, pace: 0.15, dates: 0.1, groupSize: 0.1 };

function rangesOverlap(a = {}, b = {}) {
  // Either side having no stated range is treated as "no constraint",
  // hence compatible -- a group/traveller who hasn't set a budget
  // shouldn't be excluded from every match over a field they left blank.
  if (a.min == null && a.max == null) return true;
  if (b.min == null && b.max == null) return true;
  const aMin = a.min ?? -Infinity, aMax = a.max ?? Infinity;
  const bMin = b.min ?? -Infinity, bMax = b.max ?? Infinity;
  return aMin <= bMax && bMin <= aMax;
}

function datesOverlap(group, dateRange) {
  if (!dateRange?.startDate || !dateRange?.endDate) return true; // no dates supplied to compare against
  const gStart = new Date(group.startDate).getTime();
  const gEnd = new Date(group.endDate).getTime();
  const wantStart = new Date(dateRange.startDate).getTime();
  const wantEnd = new Date(dateRange.endDate).getTime();
  return gStart <= wantEnd && wantStart <= gEnd;
}

/**
 * @param {Object} group - a GroupTrip document (or lean object).
 * @param {Object} preferences - the traveller's User.preferences subdocument.
 * @param {Object} [dateRange] - optional {startDate, endDate} to check overlap against.
 * @returns {{factors: Object<string,boolean>, reasons: string[], score: number}}
 */
export function computeMatchFactors(group, preferences = {}, dateRange = null) {
  const factors = {};
  const reasons = [];
  let score = 0;

  const groupTypes = group.travelTypes || [];
  const userTypes = preferences.travelTypes || [];
  factors.travelType = groupTypes.length > 0 && userTypes.some((t) => groupTypes.includes(t));
  if (factors.travelType) { reasons.push("Same travel style"); score += WEIGHTS.travelType; }

  const groupActivities = group.activities || [];
  const userActivities = preferences.preferredActivities || [];
  const sharedActivities = groupActivities.filter((a) => userActivities.includes(a));
  factors.activities = sharedActivities.length > 0;
  if (factors.activities) { reasons.push(`Shared ${sharedActivities[0].replace(/_/g, " ")} activity`); score += WEIGHTS.activities; }

  factors.budget = rangesOverlap(group.budgetRange, preferences.budgetRange);
  if (factors.budget) { reasons.push("Budget ranges overlap"); score += WEIGHTS.budget; }

  factors.pace = Boolean(group.pace && preferences.preferredPace && group.pace === preferences.preferredPace);
  if (factors.pace) { reasons.push("Matching pace"); score += WEIGHTS.pace; }

  factors.dates = datesOverlap(group, dateRange);
  if (factors.dates && dateRange) { reasons.push("Dates match"); score += WEIGHTS.dates; }
  else if (factors.dates) score += WEIGHTS.dates; // no explicit dates asked for -- neutral pass, no reason claimed

  factors.groupSize = Boolean(preferences.preferredGroupSize && group.preferredGroupSize === preferences.preferredGroupSize);
  if (factors.groupSize) { reasons.push("Group size matches your preference"); score += WEIGHTS.groupSize; }

  return { factors, reasons, score: Math.round(score * 1000) / 1000 };
}

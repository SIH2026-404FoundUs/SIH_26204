/**
 * Helper utilities for monetary calculations and precision rounding.
 */

/**
 * Rounds a monetary amount to 2 decimal places.
 * Uses Number.EPSILON to accurately handle floating-point precision issues.
 *
 * @param {number|string} value - The numeric value to round
 * @returns {number} - The value rounded to 2 decimal places
 */
export function roundToTwo(value) {
  const num = Number(value);
  if (isNaN(num)) {
    return 0;
  }
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Formats a numeric value into a 2-decimal place string.
 *
 * @param {number|string} value
 * @returns {string}
 */
export function formatCurrency(value) {
  return roundToTwo(value).toFixed(2);
}

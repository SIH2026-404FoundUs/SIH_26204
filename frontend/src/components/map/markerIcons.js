/**
 * markerIcons.js - Custom SVG pin icons for category map markers.
 * Generates styled SVG markers for Stays, Food, Attractions, Transport, and Local Services.
 */

const CATEGORY_STYLES = {
  stays: {
    bg: '#4F46E5', // Indigo
    border: '#3730A3',
    emoji: '🏨',
    label: 'Stays'
  },
  food: {
    bg: '#D97706', // Amber / Gold
    border: '#92400E',
    emoji: '🍱',
    label: 'Food & Dining'
  },
  attractions: {
    bg: '#059669', // Emerald Green
    border: '#065F46',
    emoji: '🏔️',
    label: 'Attractions'
  },
  transport: {
    bg: '#2563EB', // Blue
    border: '#1E40AF',
    emoji: '🚌',
    label: 'Transport'
  },
  localServices: {
    bg: '#7C3AED', // Purple
    border: '#5B21B6',
    emoji: '🛠️',
    label: 'Local Services'
  }
};

/**
 * Generates an SVG Data URI marker pin for a specific category.
 * @param {string} categoryKey - 'stays' | 'food' | 'attractions' | 'transport' | 'localServices'
 * @returns {string} SVG Data URL
 */
export function getCategoryMarkerIconSvg(categoryKey = 'attractions') {
  const style = CATEGORY_STYLES[categoryKey] || CATEGORY_STYLES.attractions;

  const svg = `
  <svg width="36" height="42" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg">
    <filter id="shadow" x="0" y="0" width="36" height="42" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
    <g filter="url(#shadow)">
      <path d="M18 0C8.05887 0 0 8.05887 0 18C0 28.5 18 38 18 38C18 38 36 28.5 36 18C36 8.05887 27.9411 0 18 0Z" fill="${style.bg}"/>
      <path d="M18 1C8.61116 1 1 8.61116 1 18C1 27.5 18 36.5 18 36.5C18 36.5 35 27.5 35 18C35 8.61116 27.3888 1 18 1Z" stroke="${style.border}" stroke-width="1.5"/>
      <circle cx="18" cy="16" r="12" fill="white"/>
      <text x="18" y="20.5" font-size="13" text-anchor="middle" dominant-baseline="middle">${style.emoji}</text>
    </g>
  </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export { CATEGORY_STYLES };

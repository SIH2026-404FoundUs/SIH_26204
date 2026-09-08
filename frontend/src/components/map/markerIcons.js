import { Hotel, Utensils, Camera, Bus, Wrench } from 'lucide-react';

/**
 * markerIcons.js - Custom SVG pin icons for category map markers.
 * Generates compact vector SVG markers with Lucide icons for Stays, Food, Attractions, Transport, and Local Services.
 */

const CATEGORY_STYLES = {
  stays: {
    bg: '#4F46E5', // Indigo
    border: '#3730A3',
    icon: Hotel,
    label: 'Stays'
  },
  food: {
    bg: '#D97706', // Amber / Gold
    border: '#92400E',
    icon: Utensils,
    label: 'Food'
  },
  attractions: {
    bg: '#059669', // Emerald Green
    border: '#065F46',
    icon: Camera,
    label: 'Attractions'
  },
  transport: {
    bg: '#2563EB', // Blue
    border: '#1E40AF',
    icon: Bus,
    label: 'Transport'
  },
  localServices: {
    bg: '#7C3AED', // Purple
    border: '#5B21B6',
    icon: Wrench,
    label: 'Services'
  }
};

const SVG_ICON_PATHS = {
  stays: `<path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5m-4-14h.01M9 9h.01M9 13h.01M15 9h.01M15 13h.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  food: `<path d="M18 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V2M12 2v20M18 15a3 3 0 0 0 3-3V2M6 2v6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  attractions: `<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  transport: `<path d="M8 6v6m8-6v6M4 10h16M6 18h.01M18 18h.01M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  localServices: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
};

/**
 * Generates a small 20x24 vector SVG Data URI marker pin for a specific category.
 * @param {string} categoryKey - 'stays' | 'food' | 'attractions' | 'transport' | 'localServices'
 * @returns {string} SVG Data URL
 */
export function getCategoryMarkerIconSvg(categoryKey = 'attractions') {
  const style = CATEGORY_STYLES[categoryKey] || CATEGORY_STYLES.attractions;
  const iconPath = SVG_ICON_PATHS[categoryKey] || SVG_ICON_PATHS.attractions;

  const svg = `
  <svg width="26" height="31" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <filter id="sd" x="-2" y="-1" width="28" height="32" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
    <g filter="url(#sd)">
      <path d="M12 0C5.37 0 0 5.37 0 12C0 19 12 26 12 26C12 26 24 19 24 12C24 5.37 18.63 0 12 0Z" fill="${style.bg}" stroke="#ffffff" stroke-width="1.2"/>
      <g transform="translate(2, 1.5) scale(0.83)">
        ${iconPath}
      </g>
    </g>
  </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export { CATEGORY_STYLES };

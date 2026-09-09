import { Car, Bus, Train, Bike, Footprints } from 'lucide-react';

// Split out of TravelModeSelector.jsx: react-refresh's only-export-components
// rule wants a component file to export components only, and RouteDetailsPanel
// needs this same list too (to look up a mode's label/fareMode by key).
export const TRAVEL_MODES = [
  { key: 'DRIVE', label: 'Car', icon: Car, emoji: '🚗', fareMode: 'cab' },
  { key: 'TRANSIT', label: 'Bus', icon: Bus, emoji: '🚌', fareMode: 'bus' },
  { key: 'TRAIN', label: 'Train', icon: Train, emoji: '🚆', fareMode: 'train' },
  { key: 'TWO_WHEELER', label: 'Bike', icon: Bike, emoji: '🛵', fareMode: 'auto' },
  { key: 'WALK', label: 'Walk', icon: Footprints, emoji: '🚶', fareMode: 'walk' },
];

import { Car, Bus, Train, Plane, Bike, Footprints } from 'lucide-react';

/**
 * TravelModeSelector - UI selector component for travel modes.
 * Supports:
 * - 🚗 Car (DRIVE)
 * - 🚌 Bus (TRANSIT)
 * - 🚆 Train (TRAIN)
 * - ✈️ Flight (FLIGHT)
 * - 🛵 Two Wheeler (TWO_WHEELER)
 * - 🚶 Walk (WALK)
 *
 * Props:
 * - value: string (Default: 'DRIVE')
 * - onChange: function(modeKey)
 */
export const TRAVEL_MODES = [
  { key: 'DRIVE', label: 'Car', icon: Car, emoji: '🚗', fareMode: 'cab' },
  { key: 'TRANSIT', label: 'Bus', icon: Bus, emoji: '🚌', fareMode: 'bus' },
  { key: 'TRAIN', label: 'Train', icon: Train, emoji: '🚆', fareMode: 'train' },
  { key: 'FLIGHT', label: 'Flight', icon: Plane, emoji: '✈️', fareMode: 'flight' },
  { key: 'TWO_WHEELER', label: 'Bike', icon: Bike, emoji: '🛵', fareMode: 'auto' },
  { key: 'WALK', label: 'Walk', icon: Footprints, emoji: '🚶', fareMode: 'walk' },
];

export default function TravelModeSelector({ value = 'DRIVE', onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200">
      {TRAVEL_MODES.map((mode) => {
        const Icon = mode.icon;
        const isSelected = value === mode.key;

        return (
          <button
            key={mode.key}
            type="button"
            onClick={() => onChange && onChange(mode.key)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isSelected
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
            title={`${mode.label} (${mode.key})`}
          >
            <Icon size={14} className={isSelected ? 'text-white' : 'text-slate-500'} />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

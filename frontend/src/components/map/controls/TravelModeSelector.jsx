import { TRAVEL_MODES } from '../travelModes';

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
export default function TravelModeSelector({ value = 'DRIVE', onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg bg-white/80 p-1">
      {TRAVEL_MODES.map((mode) => {
        const Icon = mode.icon;
        const isSelected = value === mode.key;

        return (
          <button
            key={mode.key}
            type="button"
            onClick={() => onChange && onChange(mode.key)}
            className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition-all ${
              isSelected
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
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

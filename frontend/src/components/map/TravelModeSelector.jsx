import { TRAVEL_MODES } from './travelModes';

/**
 * TravelModeSelector - Segmented control for the route's travel mode.
 * Icons only, with the selected mode's label shown inline so the current
 * choice is always readable without spending width on every label.
 *
 * Props:
 * - value: string (Default: 'DRIVE')
 * - onChange: function(modeKey)
 */
export default function TravelModeSelector({ value = 'DRIVE', onChange }) {
  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-slate-200/80 bg-slate-100/70 p-0.5" role="group" aria-label="Travel mode">
      {TRAVEL_MODES.map((mode) => {
        const Icon = mode.icon;
        const isSelected = value === mode.key;

        return (
          <button
            key={mode.key}
            type="button"
            onClick={() => onChange && onChange(mode.key)}
            aria-pressed={isSelected}
            title={mode.label}
            className={`flex h-8 items-center gap-1.5 rounded-[10px] px-2 text-[11px] font-bold transition-all ${
              isSelected
                ? 'bg-white text-[#5b52e6] shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'
            }`}
          >
            <Icon size={15} />
            {isSelected && <span>{mode.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

import { BriefcaseBusiness, BusFront, Building2, Landmark, Utensils, Hotel, Flame, X } from 'lucide-react'

const DESTINATION_LAYERS = [
  ['stays', 'Stays', Building2],
  ['food', 'Food', Utensils],
  ['attractions', 'Attractions', Landmark],
  ['transport', 'Transport', BusFront],
  ['localServices', 'Services', BriefcaseBusiness],
]

function LayerRow({ icon: Icon, label, hint, active, onToggle, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${active ? 'bg-[#6C63FF] text-white' : 'bg-slate-100 text-slate-500'}`}>
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-slate-800">{label}</span>
        {hint && <span className="block truncate text-[10px] text-slate-400">{hint}</span>}
      </span>
      <span className={`relative h-4 w-7 shrink-0 rounded-full transition ${active ? 'bg-[#6C63FF]' : 'bg-slate-200'}`} aria-hidden="true">
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${active ? 'left-3.5' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div className="pt-2 first:pt-0">
      <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{title}</p>
      {children}
    </div>
  )
}

/**
 * LayerControls - Popover opened from the map tool rail. Every overlay the map
 * can draw lives here, in one place, grouped by where its data comes from.
 * (These toggles used to be split between this panel and the command bar,
 * with Hotels/Food/Heatmap duplicated in both.)
 */
export default function LayerControls({ hasDestination, visibleCategories, onToggle, visiblePlaces, onTogglePlaces, heatmapVisible, onToggleHeatmap, onClose }) {
  return (
    <div className="w-64 rounded-2xl border border-white/70 bg-white/95 p-2 shadow-[0_20px_60px_rgba(15,23,42,.16)] backdrop-blur-2xl animate-fade-up" role="dialog" aria-label="Map layers">
      <div className="mb-1 flex items-center justify-between px-2 pt-0.5">
        <p className="text-xs font-extrabold text-slate-900">Map layers</p>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close map layers">
          <X size={14} />
        </button>
      </div>

      <Section title="Across India">
        <LayerRow icon={Flame} label="Crowd pressure" hint="Heatmap for your start date" active={Boolean(heatmapVisible)} onToggle={() => onToggleHeatmap?.(!heatmapVisible)} />
      </Section>

      <Section title="Nearby places">
        <LayerRow icon={Hotel} label="Hotels" hint={hasDestination ? 'Around your destination' : 'Around the map centre'} active={Boolean(visiblePlaces?.hotels)} onToggle={() => onTogglePlaces?.('hotels', !visiblePlaces?.hotels)} />
        <LayerRow icon={Utensils} label="Restaurants" hint={hasDestination ? 'Around your destination' : 'Around the map centre'} active={Boolean(visiblePlaces?.restaurants)} onToggle={() => onTogglePlaces?.('restaurants', !visiblePlaces?.restaurants)} />
      </Section>

      <Section title="Destination data">
        {!hasDestination && <p className="px-2 pb-1 text-[10px] leading-4 text-slate-400">Choose a destination to turn these on.</p>}
        {DESTINATION_LAYERS.map(([key, label, Icon]) => (
          <LayerRow key={key} icon={Icon} label={label} disabled={!hasDestination} active={hasDestination && Boolean(visibleCategories?.[key])} onToggle={() => onToggle?.(key, !visibleCategories?.[key])} />
        ))}
      </Section>
    </div>
  )
}

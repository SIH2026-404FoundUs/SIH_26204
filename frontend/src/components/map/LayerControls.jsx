import { BriefcaseBusiness, BusFront, Building2, Layers3, Landmark, Utensils, Hotel, Flame } from 'lucide-react'

const LAYERS = [
  ['stays', 'Stays', Building2],
  ['food', 'Food', Utensils],
  ['attractions', 'Attractions', Landmark],
  ['transport', 'Transport', BusFront],
  ['localServices', 'Services', BriefcaseBusiness],
]

export default function LayerControls({ visibleCategories, onToggle, visiblePlaces, onTogglePlaces, heatmapVisible, onToggleHeatmap }) {
  const toggles = [
    ['hotels', 'Hotels', Hotel, Boolean(visiblePlaces?.hotels), () => onTogglePlaces?.('hotels', !visiblePlaces?.hotels)],
    ['restaurants', 'Restaurants', Utensils, Boolean(visiblePlaces?.restaurants), () => onTogglePlaces?.('restaurants', !visiblePlaces?.restaurants)],
    ['heatmap', 'Heatmap', Flame, Boolean(heatmapVisible), () => onToggleHeatmap?.(!heatmapVisible)],
  ]
  return (
    <div className="absolute bottom-4 right-4 z-20 w-[min(210px,calc(100%-2rem))] rounded-[18px] border border-white/50 bg-white/80 p-2.5 shadow-[0_20px_60px_rgba(0,0,0,.08)] backdrop-blur-2xl">
      <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
        <Layers3 size={13} className="text-indigo-600" /> Map layers
      </div>
      <div className="grid grid-cols-2 gap-1">
        {toggles.map(([key, label, Icon, active, toggle]) => (
          <button key={key} type="button" onClick={toggle} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold transition hover:-translate-y-0.5 ${active ? 'bg-[#6C63FF] text-white' : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
        {LAYERS.map(([key, label, Icon]) => {
          const active = Boolean(visibleCategories?.[key])
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle?.(key, !active)}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold transition hover:-translate-y-0.5 ${active ? 'bg-[#6C63FF] text-white' : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}
            >
              <Icon size={13} /> {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

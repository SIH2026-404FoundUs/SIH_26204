import { useEffect, useState } from 'react';
import { Flame, Calendar, MapPin, Navigation, Filter, Route, Loader2, Hotel, Utensils, Camera, Bus, Wrench } from 'lucide-react';
import api from '../../lib/api';
import { CATEGORY_STYLES } from './markerIcons';
import TravelModeSelector from './TravelModeSelector';

/**
 * MapControls - Floating control panel overlay on the interactive map.
 * Provides Source (Origin) input, Destination dropdown (36 cities), Date picker,
 * Travel Mode selector, Get Route action button, and layer toggles.
 */
export default function MapControls({
  source = 'Delhi',
  onChangeSource,
  destId = '',
  onChangeDestId,
  date = '2026-12-26',
  onChangeDate,
  travelMode = 'DRIVE',
  onChangeTravelMode,
  onFetchRoute,
  isFetchingRoute = false,
  heatmapVisible = false,
  onToggleHeatmap,
  visibleCategories = { stays: false, food: false, attractions: false, transport: false, localServices: false },
  onToggleCategory
}) {
  const [destinations, setDestinations] = useState([]);

  const CATEGORIES = [
    { key: 'stays', label: 'Stays', icon: Hotel },
    { key: 'food', label: 'Food', icon: Utensils },
    { key: 'attractions', label: 'Attractions', icon: Camera },
    { key: 'transport', label: 'Transport', icon: Bus },
    { key: 'localServices', label: 'Services', icon: Wrench }
  ];

  // Fetch all 36 destinations dynamically
  useEffect(() => {
    let isMounted = true;

    api.get('/destinations')
      .then((res) => {
        if (!isMounted) return;
        const raw = res.data?.data || res.data || [];
        const formatted = raw.map((d) => ({
          id: d._id || d.id,
          label: d.displayName || d.name || d._id,
          state: d.state || ''
        }));
        if (formatted.length > 0) {
          setDestinations(formatted);
        }
      })
      .catch((err) => {
        console.error('[MapControls] Failed to fetch destinations:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const dropdownItems = destinations.length > 0 ? destinations : [
    { id: 'manali', label: 'Manali, Himachal Pradesh' },
    { id: 'shimla', label: 'Shimla, Himachal Pradesh' },
    { id: 'dharamshala', label: 'Dharamshala, Himachal Pradesh' },
    { id: 'charminar-hyderabad', label: 'Charminar, Hyderabad, Telangana' },
    { id: 'warangal-fort', label: 'Warangal Fort, Telangana' }
  ];

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-md backdrop-blur-md transition-all max-w-[95vw] sm:max-w-none">
      {/* 1. Top Controls: 3 Inputs (Source, Destination, Date) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Source (Travelling From Input) */}
        <div className="flex items-center gap-1.5">
          <Navigation size={14} className="text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold text-slate-500 hidden sm:inline">From:</span>
          <input
            type="text"
            value={source}
            onChange={(e) => onChangeSource && onChangeSource(e.target.value)}
            placeholder="e.g. Delhi, Hyderabad"
            className="w-28 sm:w-32 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="hidden h-5 w-px bg-slate-200 sm:block" />

        {/* Destination Dropdown (All 36 Destinations) */}
        <div className="flex items-center gap-1.5">
          <MapPin size={15} className="text-indigo-600 shrink-0" />
          <span className="text-xs font-semibold text-slate-500 hidden sm:inline">To:</span>
          <select
            value={destId}
            onChange={(e) => onChangeDestId && onChangeDestId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 max-w-[200px] truncate"
          >
            <option value="">-- Select Destination --</option>
            {dropdownItems.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden h-5 w-px bg-slate-200 sm:block" />

        {/* Date Picker */}
        <div className="flex items-center gap-1.5">
          <Calendar size={15} className="text-indigo-500 shrink-0" />
          <input
            type="date"
            value={date}
            onChange={(e) => onChangeDate && onChangeDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      {/* 2. Middle Row: Travel Mode Selector & Get Route Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hidden sm:inline">Mode:</span>
          <TravelModeSelector
            value={travelMode}
            onChange={(mode) => onChangeTravelMode && onChangeTravelMode(mode)}
          />
        </div>

        <button
          type="button"
          onClick={() => onFetchRoute && onFetchRoute()}
          disabled={isFetchingRoute || !source || !destId}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white transition shadow-sm ${
            isFetchingRoute || !source || !destId
              ? 'bg-indigo-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
          }`}
        >
          {isFetchingRoute ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Fetching Route...</span>
            </>
          ) : (
            <>
              <Route size={14} />
              <span>Get Route</span>
            </>
          )}
        </button>
      </div>

      <div className="h-px w-full bg-slate-200/80" />

      {/* 3. Bottom Controls: Layer Toggles (OFF by default) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Heatmap Toggle (OFF by default) */}
        <div className="flex items-center gap-2">
          <Flame
            size={16}
            className={heatmapVisible ? 'text-amber-500 animate-pulse' : 'text-slate-400'}
          />
          <span className="text-xs font-semibold text-slate-700">Pressure Heatmap</span>
          <button
            type="button"
            onClick={() => onToggleHeatmap && onToggleHeatmap(!heatmapVisible)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              heatmapVisible ? 'bg-amber-500' : 'bg-slate-300'
            }`}
            role="switch"
            aria-checked={heatmapVisible}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                heatmapVisible ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Category Marker Buttons (OFF by default) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            <Filter size={12} />
            <span>Categories:</span>
          </div>

          {CATEGORIES.map((cat) => {
            const isChecked = visibleCategories[cat.key] === true;
            const style = CATEGORY_STYLES[cat.key];
            const Icon = cat.icon;

            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => onToggleCategory && onToggleCategory(cat.key, !isChecked)}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-all border ${
                  isChecked
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-100 text-slate-500 border-slate-200 opacity-60 hover:opacity-100'
                }`}
              >
                <Icon size={13} className={isChecked ? 'text-white' : 'text-slate-500'} />
                <span>{cat.label}</span>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: isChecked ? style.bg : '#CBD5E1' }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


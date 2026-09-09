import { useState, useEffect } from 'react';
import { Flame, Calendar, MapPin, Navigation, Route, Loader2, Hotel, Utensils, Wallet, Users, Search, Plus, Sparkles } from 'lucide-react';
import { useDestinationsStore } from '../../store/useDestinationsStore';
import TravelModeSelector from './TravelModeSelector';

/**
 * MapControls - Ultra-compact 2-row floating control bar overlay on the interactive map.
 * Row 1: From, To, Start Date, End Date, Budget (INR), Travellers (PPL), Search Place to Add Stop.
 * Row 2: Travel Mode, Get Route, Heatmap, Hotels, Restaurants, Stops drawer, Plan Trip.
 */
export default function MapControls({
  source = 'Delhi',
  onChangeSource,
  destId = '',
  onChangeDestId,
  startDate = '2026-12-25',
  onChangeStartDate,
  endDate = '2026-12-28',
  onChangeEndDate,
  budgetInr = 20000,
  onChangeBudgetInr,
  travellers = 2,
  onChangeTravellers,
  travelMode = 'DRIVE',
  onChangeTravelMode,
  onFetchRoute,
  isFetchingRoute = false,
  heatmapVisible = false,
  onToggleHeatmap,
  showStopsPanel = false,
  onToggleStopsPanel,
  stopsCount = 0,
  visiblePlaces = { hotels: false, restaurants: false },
  onTogglePlaces,
  onSearchAddStop,
  isSearchingStop = false,
  onDirectPlanTrip,
  isPlanning = false,
  plannerStage = ''
}) {
  const destinations = useDestinationsStore((state) => state.destinations);
  const fetchDestinations = useDestinationsStore((state) => state.fetchDestinations);
  const [stopSearchQuery, setStopSearchQuery] = useState('');

  useEffect(() => {
    fetchDestinations().catch(() => {});
  }, [fetchDestinations]);

  const dropdownItems = destinations.length > 0 ? destinations.map((d) => ({
    id: d._id || d.id,
    label: d.displayName || d.name || d._id,
    state: d.state || ''
  })) : [
    { id: 'manali', label: 'Manali, Himachal Pradesh' },
    { id: 'shimla', label: 'Shimla, Himachal Pradesh' },
    { id: 'dharamshala', label: 'Dharamshala, Himachal Pradesh' },
    { id: 'charminar-hyderabad', label: 'Charminar, Hyderabad, Telangana' },
    { id: 'warangal-fort', label: 'Warangal Fort, Telangana' }
  ];

  const handleAddStopSubmit = (e) => {
    e.preventDefault();
    if (!stopSearchQuery.trim()) return;
    if (onSearchAddStop) {
      onSearchAddStop(stopSearchQuery.trim());
      setStopSearchQuery('');
    }
  };

  return (
    <div className="absolute top-3 left-1/2 z-10 flex w-[96vw] max-w-6xl -translate-x-1/2 flex-col gap-1.5 rounded-[20px] border border-white/50 bg-white/80 p-2.5 shadow-[0_20px_60px_rgba(0,0,0,.08)] backdrop-blur-2xl transition-all">
      {/* Row 1: Parameters (From, To, Dates, Budget, Travellers, Search Place Stop) */}
      <div className="flex items-center justify-between gap-1.5 text-xs overflow-x-auto no-scrollbar py-0.5">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Source */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
            <Navigation size={12} className="text-emerald-600 shrink-0" />
            <span className="font-bold text-slate-500 hidden sm:inline">From:</span>
            <input
              type="text"
              value={source}
              onChange={(e) => onChangeSource && onChangeSource(e.target.value)}
              placeholder="Origin"
              className="w-16 sm:w-20 bg-transparent font-extrabold text-slate-800 outline-none text-xs"
            />
          </div>

          {/* Destination */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
            <MapPin size={12} className="text-indigo-600 shrink-0" />
            <span className="font-bold text-slate-500 hidden sm:inline">To:</span>
            <select
              value={destId}
              onChange={(e) => onChangeDestId && onChangeDestId(e.target.value)}
              className="w-24 sm:w-32 bg-transparent font-extrabold text-slate-800 outline-none truncate text-xs"
            >
              <option value="">-- Select --</option>
              {dropdownItems.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
            <Calendar size={12} className="text-indigo-500 shrink-0" />
            <span className="font-bold text-slate-500 hidden sm:inline">Start:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onChangeStartDate && onChangeStartDate(e.target.value)}
              className="w-24 bg-transparent font-semibold text-slate-700 outline-none text-[11px]"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
            <Calendar size={12} className="text-indigo-500 shrink-0" />
            <span className="font-bold text-slate-500 hidden sm:inline">End:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onChangeEndDate && onChangeEndDate(e.target.value)}
              className="w-24 bg-transparent font-semibold text-slate-700 outline-none text-[11px]"
            />
          </div>

          {/* Budget (INR) */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
            <Wallet size={12} className="text-emerald-500 shrink-0" />
            <span className="font-bold text-slate-500 hidden sm:inline">Budget:</span>
            <input
              type="number"
              value={budgetInr}
              onChange={(e) => onChangeBudgetInr && onChangeBudgetInr(e.target.value)}
              placeholder="INR"
              step="1000"
              className="w-16 bg-transparent font-bold text-slate-800 outline-none text-xs"
            />
          </div>

          {/* Travellers */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
            <Users size={12} className="text-amber-500 shrink-0" />
            <span className="font-bold text-slate-500 hidden sm:inline">PPL:</span>
            <input
              type="number"
              min="1"
              max="20"
              value={travellers}
              onChange={(e) => onChangeTravellers && onChangeTravellers(e.target.value)}
              className="w-8 bg-transparent font-bold text-slate-800 outline-none text-xs"
            />
          </div>
        </div>

        {/* Place Search & Add Stop Input */}
        <form onSubmit={handleAddStopSubmit} className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-xl border border-slate-200 shrink-0 ml-auto">
          <Search size={12} className="text-indigo-500 shrink-0" />
          <input
            type="text"
            value={stopSearchQuery}
            onChange={(e) => setStopSearchQuery(e.target.value)}
            placeholder="Search place & add stop..."
            className="w-28 sm:w-40 bg-transparent font-medium text-slate-700 outline-none text-[11px]"
          />
          <button
            type="submit"
            disabled={isSearchingStop || !stopSearchQuery.trim()}
            className="flex items-center gap-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-2 py-0.5 text-[11px] font-bold transition shrink-0"
          >
            {isSearchingStop ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            <span>Add Stop</span>
          </button>
        </form>
      </div>

      {/* Row 2: Travel Mode & Feature Action Buttons */}
      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          <TravelModeSelector
            value={travelMode}
            onChange={(mode) => onChangeTravelMode && onChangeTravelMode(mode)}
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => onFetchRoute && onFetchRoute()}
            disabled={isFetchingRoute || !destId}
            className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isFetchingRoute ? <Loader2 size={12} className="animate-spin" /> : <Route size={12} />}
            <span>Route</span>
          </button>

          {/* Pressure Heatmap Toggle */}
          <button
            type="button"
            onClick={() => onToggleHeatmap && onToggleHeatmap(!heatmapVisible)}
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition border ${
              heatmapVisible
                ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Flame size={12} className={heatmapVisible ? 'animate-pulse' : ''} />
            <span>Heatmap</span>
          </button>

          {/* Hotels Nearby Button */}
          <button
            type="button"
            onClick={() => onTogglePlaces && onTogglePlaces('hotels', !visiblePlaces?.hotels)}
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition border ${
              visiblePlaces?.hotels
                ? 'bg-indigo-900 text-white border-indigo-900'
                : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            <Hotel size={12} />
            <span>Hotels</span>
          </button>

          {/* Restaurants Nearby Button */}
          <button
            type="button"
            onClick={() => onTogglePlaces && onTogglePlaces('restaurants', !visiblePlaces?.restaurants)}
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition border ${
              visiblePlaces?.restaurants
                ? 'bg-amber-900 text-white border-amber-900'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Utensils size={12} />
            <span>Restaurants</span>
          </button>

          {/* Custom Stops Button */}
          <button
            type="button"
            onClick={() => onToggleStopsPanel && onToggleStopsPanel(!showStopsPanel)}
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition border ${
              showStopsPanel
                ? 'bg-emerald-900 text-white border-emerald-900'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <MapPin size={12} />
            <span>Stops ({stopsCount})</span>
          </button>

          {/* Plan Trip Direct Action Button */}
          <button
            type="button"
            onClick={() => onDirectPlanTrip && onDirectPlanTrip()}
            disabled={isPlanning || !destId}
            className={`flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-extrabold text-white transition shadow-sm ${
              isPlanning || !destId
                ? 'bg-indigo-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95'
            }`}
          >
            {isPlanning ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>{plannerStage || 'Planning...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>🗺️ Plan Trip</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


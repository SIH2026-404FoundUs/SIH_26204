import { useState } from 'react';
import { X, Navigation, Clock, IndianRupee, ChevronDown, ChevronUp, ExternalLink, AlertTriangle, Loader2, Flag } from 'lucide-react';
import { TRAVEL_MODES } from '../travelModes';

// Kept in sync with the stroke colours in RoutePolylineLayer so the panel
// reads as the legend for the line on the map.
const MODE_ACCENT = {
  TRAIN: { line: '#7C3AED', chip: 'bg-violet-50 text-violet-600 ring-violet-100' },
  FLIGHT: { line: '#0284C7', chip: 'bg-sky-50 text-sky-600 ring-sky-100' },
  DEFAULT: { line: '#4F46E5', chip: 'bg-indigo-50 text-indigo-600 ring-indigo-100' },
};

const GMAPS_TRAVEL_MODE = { DRIVE: 'driving', TWO_WHEELER: 'driving', TRANSIT: 'transit', TRAIN: 'transit', WALK: 'walking' };

function formatDuration(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return null;
  const total = Math.round(Number(minutes));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins} min`;
}

function formatDistance(km) {
  if (km == null || !Number.isFinite(Number(km))) return null;
  const value = Number(km);
  if (value < 1) return `${Math.round(value * 1000)} m`;
  return `${value >= 100 ? Math.round(value).toLocaleString('en-IN') : value.toFixed(1)} km`;
}

function formatArrival(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return null;
  const arrival = new Date(Date.now() + Number(minutes) * 60000);
  const time = arrival.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const dayDiff = Math.round((new Date(arrival).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (dayDiff === 0) return time;
  if (dayDiff === 1) return `${time} tomorrow`;
  return `${time} (+${dayDiff}d)`;
}

function formatFare(fareINR, hidden) {
  if (hidden || fareINR == null) return null;
  if (Number(fareINR) === 0) return 'Free';
  return `₹${Number(fareINR).toLocaleString('en-IN')}`;
}

function shortPlace(name, fallback) {
  if (!name) return fallback;
  // Reverse-geocoded origins are full postal addresses; the first two parts
  // are what a traveller recognises, the full string stays in the tooltip.
  return name.split(',').slice(0, 2).join(',').trim();
}

function buildGoogleMapsUrl(routeInfo, stops) {
  const { originCoords, destCoords, travelMode } = routeInfo;
  if (!originCoords || !destCoords) return null;
  const params = new URLSearchParams({
    api: '1',
    origin: `${originCoords.lat},${originCoords.lng}`,
    destination: `${destCoords.lat},${destCoords.lng}`,
    travelmode: GMAPS_TRAVEL_MODE[travelMode] || 'driving',
  });
  const waypoints = stops.filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)));
  if (waypoints.length && routeInfo.hasCustomStops) {
    params.set('waypoints', waypoints.map((s) => `${s.lat},${s.lng}`).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function Metric({ icon: Icon, label, value, accent = false }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col rounded-xl border px-2.5 py-2 ${accent ? 'border-indigo-100 bg-indigo-50/70' : 'border-slate-100 bg-slate-50'}`}>
      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${accent ? 'text-indigo-500' : 'text-slate-400'}`}>
        <Icon size={11} />
        {label}
      </span>
      <span className={`mt-0.5 truncate text-sm font-extrabold ${value ? (accent ? 'text-indigo-700' : 'text-slate-800') : 'text-slate-300'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

/**
 * RouteDetailsPanel - Route card for the map's bottom-centre slot (placement
 * is owned by EverythingMap).
 * Shows the journey (origin -> stops -> destination), headline travel time,
 * distance, fare and an arrival estimate, and can collapse to a slim pill so
 * it stays out of the way while the traveller explores the map.
 *
 * Props:
 * - routeInfo: route object built by EverythingMap (null while the first fetch is running)
 * - stops: custom stops currently on the route
 * - isLoading: a route (re)calculation is in flight
 * - onClose: function()
 */
export default function RouteDetailsPanel({ routeInfo, stops = [], isLoading = false, onClose }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!routeInfo && !isLoading) return null;

  const {
    sourceName,
    destName,
    distanceKm = null,
    durationMinutes = null,
    fareINR = null,
    isEstimated = false,
    isUnavailable = false,
    estimateNote = null,
    travelMode = 'DRIVE',
    hasCustomStops = false,
  } = routeInfo || {};

  const modeConfig = TRAVEL_MODES.find((m) => m.key === travelMode) || TRAVEL_MODES[0];
  const ModeIcon = modeConfig.icon;
  const accent = MODE_ACCENT[travelMode] || MODE_ACCENT.DEFAULT;

  const duration = formatDuration(durationMinutes);
  const distance = formatDistance(distanceKm);
  const fare = formatFare(fareINR, isEstimated || isUnavailable);
  const arrival = isEstimated || isUnavailable ? null : formatArrival(durationMinutes);
  const mapsUrl = routeInfo && !isUnavailable ? buildGoogleMapsUrl(routeInfo, stops) : null;
  const routeStops = hasCustomStops ? stops : [];
  const origin = shortPlace(sourceName, 'Origin');
  const destination = shortPlace(destName, 'Destination');

  if (!routeInfo) {
    return (
      <div className={`flex w-full max-w-[400px] items-center gap-3 rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-[0_20px_60px_rgba(15,23,42,.12)] backdrop-blur-2xl`}>
        <Loader2 size={18} className="shrink-0 animate-spin text-indigo-500" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="h-2 w-1/3 animate-pulse rounded bg-slate-100" />
        </div>
        <span className="text-[11px] font-semibold text-slate-400">Finding route…</span>
      </div>
    );
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={`flex max-w-full items-center gap-2 rounded-full border border-white/70 bg-white/95 py-1.5 pl-1.5 pr-3 text-xs font-bold text-slate-700 shadow-[0_12px_40px_rgba(15,23,42,.16)] backdrop-blur-2xl hover:bg-white`}
        title="Show route details"
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ${accent.chip}`}>
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <ModeIcon size={14} />}
        </span>
        <span className="truncate">
          {duration || distance || modeConfig.label}
          {duration && distance && <span className="font-semibold text-slate-400"> · {distance}</span>}
          <span className="font-semibold text-slate-400"> to {destination}</span>
        </span>
        <ChevronUp size={14} className="shrink-0 text-slate-400" />
      </button>
    );
  }

  return (
    <div className={`w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/70 bg-white/92 shadow-[0_20px_60px_rgba(15,23,42,.14)] backdrop-blur-2xl animate-fade-up`}>
      {isLoading && <div className="h-0.5 w-full animate-pulse" style={{ backgroundColor: accent.line }} />}

      <div className="p-3.5">
        {/* Headline: mode, travel time, arrival */}
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${accent.chip}`}>
            <ModeIcon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold leading-none text-slate-900">
                {isUnavailable ? 'No route' : duration || distance || '—'}
              </span>
              {!isUnavailable && duration && distance && <span className="text-xs font-bold text-slate-400">{distance}</span>}
            </div>
            <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">
              {modeConfig.label}
              {isEstimated && ' · straight-line estimate'}
              {arrival && <> · Arrive ~<span className="text-slate-700">{arrival}</span></>}
              {isLoading && ' · updating…'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title="Minimise"
              aria-label="Minimise route details"
            >
              <ChevronDown size={16} />
            </button>
            <button
              type="button"
              onClick={() => onClose && onClose()}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title="Close route"
              aria-label="Close route details"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Journey timeline: origin -> stops -> destination */}
        <ol className="relative mt-3 space-y-1.5 pl-5">
          <span className="absolute bottom-2 left-[6px] top-2 w-0.5 rounded-full" style={{ backgroundColor: accent.line, opacity: 0.25 }} aria-hidden="true" />
          <li className="relative flex items-center text-xs" title={sourceName}>
            <span className="absolute -left-5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" aria-hidden="true" />
            <span className="truncate font-semibold text-slate-700">{origin}</span>
          </li>
          {routeStops.slice(0, 3).map((stop, idx) => (
            <li key={stop.id || idx} className="relative flex items-center text-[11px]" title={stop.name}>
              <span className="absolute -left-[17px] flex h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-400 shadow-sm" aria-hidden="true" />
              <span className="truncate font-medium text-slate-500">{shortPlace(stop.name, `Stop ${idx + 1}`)}</span>
            </li>
          ))}
          {routeStops.length > 3 && (
            <li className="text-[11px] font-medium text-slate-400">+{routeStops.length - 3} more stops</li>
          )}
          <li className="relative flex items-center text-xs" title={destName}>
            <span className="absolute -left-5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: accent.line }} aria-hidden="true">
              <Flag size={7} className="text-white" />
            </span>
            <span className="truncate font-bold text-slate-900">{destination}</span>
          </li>
        </ol>

        {estimateNote && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] font-semibold leading-snug text-amber-800">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            {estimateNote}
          </p>
        )}

        {/* Metrics */}
        {!isUnavailable && (
          <div className="mt-3 flex gap-2">
            <Metric icon={Navigation} label="Distance" value={distance} />
            <Metric icon={Clock} label="Time" value={duration} />
            <Metric icon={IndianRupee} label="Est. fare" value={fare} accent />
          </div>
        )}

        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <ExternalLink size={13} />
            Open directions in Google Maps
          </a>
        )}
      </div>
    </div>
  );
}

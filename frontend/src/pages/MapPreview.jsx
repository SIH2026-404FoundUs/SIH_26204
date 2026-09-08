import { useState } from 'react';
import { Compass } from 'lucide-react';
import EverythingMap from '../components/map/EverythingMap';
import PageHeader from '../components/ui/PageHeader';

/**
 * MapPreview - Interactive Map Preview page for "Everything on One Map".
 * Renders the full-screen canvas map with floating pressure heatmap controls,
 * category markers, travel mode selector, and route polylines.
 */
export default function MapPreview() {
  const [origin, setOrigin] = useState('Delhi');
  const [destId, setDestId] = useState('');
  const [travelMode, setTravelMode] = useState('DRIVE');

  return (
    <main className="flex-1 bg-slate-50 px-3 py-3 sm:px-4 flex flex-col h-[calc(100vh-65px)] overflow-hidden">
      <div className="mx-auto w-full max-w-[98vw] flex flex-col flex-1">
        <div className="flex items-center justify-between py-1 px-2">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-indigo-600" />
            <h1 className="text-sm font-extrabold text-slate-800 tracking-tight">Interactive Map Canvas — Everything on One Map</h1>
          </div>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">SIH 2026 PS 26204</span>
        </div>

        <div className="mt-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm p-1">
          <EverythingMap
            zoom={5}
            center={{ lat: 20.5937, lng: 78.9629 }}
            source={origin}
            destId={destId}
            travelMode={travelMode}
            defaultHeatmap={false}
            className="h-[calc(100vh-140px)] min-h-[550px] w-full rounded-xl overflow-hidden"
          />
        </div>
      </div>
    </main>
  );
}


import { Compass } from 'lucide-react';
import EverythingMap from '../components/map/EverythingMap';
import PageHeader from '../components/ui/PageHeader';

/**
 * MapPreview - Interactive Map Preview page for "Everything on One Map".
 * Renders the full-screen canvas map with floating pressure heatmap controls.
 */
export default function MapPreview() {
  return (
    <main className="flex-1 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          icon={Compass}
          title="Map Preview - Everything on One Map"
          description="Interactive map canvas displaying real-time pressure heatmaps and destination density across India."
        />

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm p-2">
          <EverythingMap
            zoom={5}
            center={{ lat: 20.5937, lng: 78.9629 }}
            defaultHeatmap={false}
            className="h-[calc(100vh-220px)] min-h-[500px] w-full rounded-xl overflow-hidden"
          />
        </div>
      </div>
    </main>
  );
}

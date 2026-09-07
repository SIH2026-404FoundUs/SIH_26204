import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, MapPin, Calendar, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { useSubstitutionStore } from '../../store/useSubstitutionStore';
import SwapCard from './SwapCard';

const POPULAR_DESTINATIONS = [
  { id: 'manali', label: 'Manali, Himachal Pradesh' },
  { id: 'shimla', label: 'Shimla, Himachal Pradesh' },
  { id: 'kasauli', label: 'Kasauli, Himachal Pradesh' },
  { id: 'dalhousie', label: 'Dalhousie, Himachal Pradesh' },
  { id: 'khajjiar', label: 'Khajjiar, Himachal Pradesh' },
  { id: 'mcleod_ganj', label: 'McLeod Ganj, Himachal Pradesh' },
  { id: 'tirthan_valley', label: 'Tirthan Valley, Himachal Pradesh' },
  { id: 'yadadri', label: 'Yadadri, Telangana' }
];

export default function SwapPage() {
  const navigate = useNavigate();
  const { result, isLoading, error, getAlternatives, reset } = useSubstitutionStore();

  const [form, setForm] = useState({
    origin: 'delhi',
    destId: 'manali',
    startDate: '2026-12-26',
    endDate: '2026-12-28',
    travellers: 2,
    budgetINR: 12000
  });

  // Automatically fetch alternatives on page load for initial preset
  useEffect(() => {
    getAlternatives(form);
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    getAlternatives(form);
  };

  const handleAcceptPlace = (place) => {
    console.log('[SwapPage] User accepted place alternative:', place);
    navigate('/trip-confirmation', {
      state: {
        type: 'place',
        requested: result?.requested || { destId: form.destId, displayName: form.destId },
        selected: place
      }
    });
  };

  const handleAcceptDate = (dateObj) => {
    console.log('[SwapPage] User accepted date alternative:', dateObj);
    navigate('/trip-confirmation', {
      state: {
        type: 'date',
        requested: result?.requested || { destId: form.destId, displayName: form.destId },
        selected: dateObj
      }
    });
  };

  const handleDecline = () => {
    console.log('[SwapPage] User declined substitution recommendations.');
    navigate('/trip-confirmation', {
      state: {
        type: 'decline',
        requested: result?.requested || { destId: form.destId, displayName: form.destId }
      }
    });
  };

  return (
    <main className="min-h-screen flex-1 bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Page Title Header */}
        <div className="flex flex-col gap-2 text-left">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
            <Sparkles size={14} />
            Substitution Engine
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Destination & Date Relief Engine
          </h1>
          <p className="text-sm text-slate-500 sm:text-base">
            Select a trip itinerary to query live overcrowding pressure and generate smart substitution options.
          </p>
        </div>

        {/* Filter / Search Control Card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Origin Input */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Origin City
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={form.origin}
                  onChange={(e) => handleChange('origin', e.target.value)}
                  placeholder="e.g. delhi"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            {/* Destination Select */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Target Destination
              </label>
              <select
                value={form.destId}
                onChange={(e) => handleChange('destId', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {POPULAR_DESTINATIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Start Date
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                Find Alternatives
              </button>
            </div>
          </form>
        </section>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 shadow-xs">
            <Loader2 size={36} className="animate-spin text-indigo-600" />
            <p className="mt-4 text-sm font-semibold text-slate-700">
              Analyzing crowd pressure & calculating substitution matrix...
            </p>
            <p className="mt-1 text-xs text-slate-400">Evaluating Similarity, Reachability, and Pressure Relief</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
            <AlertCircle size={20} className="shrink-0 text-rose-600 mt-0.5" />
            <div className="text-left">
              <h4 className="text-sm font-bold">Failed to load substitution alternatives</h4>
              <p className="mt-1 text-xs text-rose-600">{error}</p>
              <button
                type="button"
                onClick={() => getAlternatives(form)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
              >
                <RefreshCw size={12} />
                Retry Query
              </button>
            </div>
          </div>
        )}

        {/* Real Backend Results rendered via SwapCard */}
        {!isLoading && !error && result && (
          <section className="animate-in fade-in duration-300">
            <SwapCard
              data={result}
              onAcceptPlace={handleAcceptPlace}
              onAcceptDate={handleAcceptDate}
              onDecline={handleDecline}
            />
          </section>
        )}
      </div>
    </main>
  );
}

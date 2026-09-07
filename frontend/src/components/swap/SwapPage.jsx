import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, MapPin, Calendar, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import api from '../../lib/api';
import { useSubstitutionStore } from '../../store/useSubstitutionStore';
import SwapCard from './SwapCard';

const FALLBACK_DESTINATIONS = [
  {
    state: 'Himachal Pradesh',
    destinations: [
      { id: 'manali', label: 'Manali, Himachal Pradesh' },
      { id: 'shimla', label: 'Shimla, Himachal Pradesh' },
      { id: 'kasauli', label: 'Kasauli, Himachal Pradesh' },
      { id: 'dalhousie', label: 'Dalhousie, Himachal Pradesh' },
      { id: 'khajjiar', label: 'Khajjiar, Himachal Pradesh' },
      { id: 'dharamshala', label: 'Dharamshala, Himachal Pradesh' },
      { id: 'mcleodganj', label: 'McLeod Ganj, Himachal Pradesh' },
      { id: 'kasol', label: 'Kasol, Himachal Pradesh' },
      { id: 'tosh', label: 'Tosh, Himachal Pradesh' },
      { id: 'jibhi', label: 'Jibhi, Himachal Pradesh' },
      { id: 'tirthan-valley', label: 'Tirthan Valley, Himachal Pradesh' },
      { id: 'bir-billing', label: 'Bir Billing, Himachal Pradesh' },
      { id: 'palampur', label: 'Palampur, Himachal Pradesh' },
      { id: 'chail', label: 'Chail, Himachal Pradesh' },
      { id: 'kalpa', label: 'Kalpa, Kinnaur, Himachal Pradesh' },
      { id: 'chhitkul', label: 'Chhitkul, Kinnaur, Himachal Pradesh' },
      { id: 'naggar', label: 'Naggar, Himachal Pradesh' },
      { id: 'solan', label: 'Solan, Himachal Pradesh' },
      { id: 'spiti-kaza', label: 'Kaza, Spiti Valley, Himachal Pradesh' },
      { id: 'mandi', label: 'Mandi, Himachal Pradesh' }
    ]
  },
  {
    state: 'Telangana',
    destinations: [
      { id: 'yadapalli-yadadri', label: 'Yadadri, Bhuvanagiri, Telangana' },
      { id: 'ramappa-temple', label: 'Ramappa Temple, Mulugu, Telangana' },
      { id: 'thousand-pillar-temple', label: 'Thousand Pillar Temple, Hanamkonda, Telangana' },
      { id: 'warangal-fort', label: 'Warangal Fort, Telangana' },
      { id: 'bhadrachalam', label: 'Bhadrachalam, Telangana' },
      { id: 'charminar-hyderabad', label: 'Charminar, Hyderabad, Telangana' },
      { id: 'golconda-hyderabad', label: 'Golconda Fort, Hyderabad, Telangana' },
      { id: 'hussain-sagar-hyderabad', label: 'Hussain Sagar, Hyderabad, Telangana' },
      { id: 'nagarjuna-sagar', label: 'Nagarjuna Sagar, Nalgonda, Telangana' },
      { id: 'medak-church', label: 'Medak Cathedral, Medak, Telangana' },
      { id: 'alampur-jogulamba', label: 'Alampur, Jogulamba Gadwal, Telangana' },
      { id: 'ananthagiri-hills', label: 'Ananthagiri Hills, Vikarabad, Telangana' },
      { id: 'bogatha-waterfalls', label: 'Bogatha Waterfalls, Telangana' },
      { id: 'kondagattu', label: 'Kondagattu, Jagtial, Telangana' },
      { id: 'kuntala-waterfalls', label: 'Kuntala Waterfalls, Adilabad, Telangana' },
      { id: 'laknavaram-lake', label: 'Laknavaram Lake, Mulugu, Telangana' }
    ]
  }
];

/** Helper to group raw API destination objects by state (Himachal Pradesh vs Telangana) */
function formatDestinationGroups(rawList) {
  if (!Array.isArray(rawList) || rawList.length === 0) return FALLBACK_DESTINATIONS;

  const hpList = [];
  const tgList = [];

  rawList.forEach((item) => {
    const id = item._id || item.id;
    const label = item.displayName || item.name || id;
    const stateName = item.state || '';
    const obj = { id, label };

    if (stateName === 'TG' || stateName.toLowerCase().includes('telangana') || label.toLowerCase().includes('telangana')) {
      tgList.push(obj);
    } else {
      hpList.push(obj);
    }
  });

  if (hpList.length === 0 && tgList.length === 0) return FALLBACK_DESTINATIONS;

  return [
    { state: 'Himachal Pradesh', destinations: hpList },
    { state: 'Telangana', destinations: tgList }
  ];
}

export default function SwapPage() {
  const navigate = useNavigate();
  const { result, isLoading, error, getAlternatives, reset } = useSubstitutionStore();

  const [destinations, setDestinations] = useState(FALLBACK_DESTINATIONS);

  const [form, setForm] = useState({
    origin: 'delhi',
    destId: 'manali',
    startDate: '2026-12-26',
    endDate: '2026-12-28',
    travellers: 2,
    budgetINR: 12000
  });

  // Fetch dynamic destination list on component mount
  useEffect(() => {
    const fetchDestinations = async () => {
      try {
        const res = await api.get('/destinations');
        const data = res.data?.data || res.data;
        setDestinations(formatDestinationGroups(data));
      } catch {
        try {
          const res2 = await api.get('/places');
          const data2 = res2.data?.data || res2.data;
          setDestinations(formatDestinationGroups(data2));
        } catch {
          // Fallback to static 36-destination grouped dataset
          setDestinations(FALLBACK_DESTINATIONS);
        }
      }
    };

    fetchDestinations();
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
                {destinations.map((group) => (
                  <optgroup key={group.state} label={group.state}>
                    {group.destinations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </optgroup>
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

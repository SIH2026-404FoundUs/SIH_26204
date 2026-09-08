import React from 'react';
import SwapCard from './SwapCard';

/**
 * SwapCardPreview Component
 * Helper preview wrapper demonstrating SwapCard with realistic backend prop structures.
 */
export default function SwapCardPreview() {
  const sampleData = {
    requested: {
      destId: 'manali',
      displayName: 'Manali, Himachal Pradesh',
      pressure: 0.82,
      breakdown: { access: 0.8, stay: 0.9, calendar: 0.85, weather: 0.7, capacity: 0.85 }
    },
    places: [
      {
        destId: 'kasol',
        displayName: 'Kasol, Himachal Pradesh',
        distance: 0.42,
        dStar: 1.15,
        pressure: 0.54,
        travelTimeRatio: 0.9,
        savingINR: 1200,
        rank: 1
      },
      {
        destId: 'palampur',
        displayName: 'Palampur, Himachal Pradesh',
        distance: 0.68,
        dStar: 1.15,
        pressure: 0.48,
        travelTimeRatio: 1.05,
        savingINR: 2500,
        rank: 2
      },
      {
        destId: 'solan',
        displayName: 'Solan, Himachal Pradesh',
        distance: 0.81,
        dStar: 1.15,
        pressure: 0.51,
        travelTimeRatio: 0.85,
        savingINR: 1800,
        rank: 3
      }
    ],
    dates: [
      {
        startDate: '2026-12-20',
        pressure: 0.45,
        savingINR: 1500
      },
      {
        startDate: '2027-01-05',
        pressure: 0.38,
        savingINR: 3200
      }
    ],
    relaxedRelief: true
  };

  const handleAcceptPlace = (place) => {
    alert(`Accepted Swap Destination: ${place.displayName}`);
  };

  const handleAcceptDate = (dateObj) => {
    alert(`Accepted Date Shift: ${dateObj.startDate}`);
  };

  const handleDecline = () => {
    alert('Declined all substitution recommendations.');
  };

  return (
    <div className="min-h-screen bg-paper-dim p-4 sm:p-8">
      <SwapCard
        data={sampleData}
        onAcceptPlace={handleAcceptPlace}
        onAcceptDate={handleAcceptDate}
        onDecline={handleDecline}
      />
    </div>
  );
}

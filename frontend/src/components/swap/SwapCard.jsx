import React, { useState } from 'react';
import PlaceSwapVariant from './PlaceSwapVariant.jsx';
import DateSwapVariant from './DateSwapVariant.jsx';
import DeclineButton from './DeclineButton.jsx';
import styles from './SwapCard.module.css';

const mockAlternatives = {
  requested: {
    destId: 'manali',
    pressure: 0.91,
    breakdown: { access: 0.85, stay: 0.92, calendar: 0.95, weather: 0.80, capacity: 0.90 }
  },
  places: [
    {
      destId: 'tirthan-valley',
      displayName: 'Tirthan Valley',
      distance: 0.42,
      dStar: 0.65,
      pressure: 0.48,
      travelTimeRatio: 1.15,
      savingINR: 3200,
      discountSourceBusinessId: null,
      rank: 1
    },
    {
      destId: 'jibhi',
      displayName: 'Jibhi',
      distance: 0.38,
      dStar: 0.65,
      pressure: 0.35,
      travelTimeRatio: 1.08,
      savingINR: 2800,
      discountSourceBusinessId: null,
      rank: 2
    },
    {
      destId: 'kasol',
      displayName: 'Kasol',
      distance: 0.55,
      dStar: 0.65,
      pressure: 0.70,
      travelTimeRatio: 1.00,
      savingINR: 1500,
      discountSourceBusinessId: null,
      rank: 3
    }
  ],
  dates: [
    {
      startDate: '2026-12-28',
      pressure: 0.62,
      savingINR: 1800,
      attemptLevel: 1
    },
    {
      startDate: '2026-12-29',
      pressure: 0.58,
      savingINR: 2200,
      attemptLevel: 1
    }
  ],
  relaxedRelief: false
};

/**
 * SwapCard - Main substitution card centerpiece container.
 * Displays place alternatives and date shifts side-by-side with trade-offs & decline action.
 */
export default function SwapCard({
  data = mockAlternatives,
  onAcceptPlace,
  onAcceptDate,
  onDecline
}) {
  const [userState, setUserState] = useState('active'); // 'active' | 'accepted_place' | 'accepted_date' | 'declined'
  const [selectedChoice, setSelectedChoice] = useState(null);

  const { requested, places = [], dates = [], relaxedRelief } = data;

  const handleAcceptPlace = (place) => {
    console.log('✅ [STUB] User accepted place alternative:', place.displayName);
    setUserState('accepted_place');
    setSelectedChoice(place);
    if (onAcceptPlace) onAcceptPlace(place);
  };

  const handleAcceptDate = (dateOption) => {
    console.log('✅ [STUB] User accepted date alternative:', dateOption.startDate);
    setUserState('accepted_date');
    setSelectedChoice(dateOption);
    if (onAcceptDate) onAcceptDate(dateOption);
  };

  const handleDeclineAll = () => {
    console.log('❌ [STUB] User declined all alternatives');
    setUserState('declined');
    if (onDecline) onDecline();
  };

  const handleReset = () => {
    setUserState('active');
    setSelectedChoice(null);
  };

  // Accepted Place State View
  if (userState === 'accepted_place' && selectedChoice) {
    const pressureDropPct = Math.round(
      ((requested.pressure - selectedChoice.pressure) / requested.pressure) * 100
    );
    return (
      <div className={styles.swapContainer}>
        <div className={styles.stateBannerSuccess}>
          <span style={{ fontSize: '2.5rem' }}>🎉</span>
          <h2 className={styles.placeName}>Place Swap Confirmed!</h2>
          <p style={{ color: '#cbd5e1', margin: '4px 0 16px 0' }}>
            Swapped from <strong style={{ color: '#fff' }}>{requested.destId}</strong> to{' '}
            <strong style={{ color: '#34d399' }}>{selectedChoice.displayName}</strong>.
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span className={styles.similarityBadge}>
              💰 ₹{selectedChoice.savingINR.toLocaleString('en-IN')} Saved
            </span>
            <span className={styles.countBadge}>
              🍃 {pressureDropPct}% Lower Crowd Pressure
            </span>
          </div>
          <button className={styles.resetBtn} onClick={handleReset} style={{ marginTop: '16px' }}>
            🔄 View Alternatives Again
          </button>
        </div>
      </div>
    );
  }

  // Accepted Date State View
  if (userState === 'accepted_date' && selectedChoice) {
    const pressureDropPct = Math.round(
      ((requested.pressure - selectedChoice.pressure) / requested.pressure) * 100
    );
    return (
      <div className={styles.swapContainer}>
        <div className={styles.stateBannerSuccess}>
          <span style={{ fontSize: '2.5rem' }}>🗓️</span>
          <h2 className={styles.placeName}>Date Shift Confirmed!</h2>
          <p style={{ color: '#cbd5e1', margin: '4px 0 16px 0' }}>
            Trip shifted to <strong style={{ color: '#38bdf8' }}>{selectedChoice.startDate}</strong>.
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span className={styles.similarityBadge}>
              💰 ₹{selectedChoice.savingINR.toLocaleString('en-IN')} Saved
            </span>
            <span className={styles.countBadge}>
              🍃 {pressureDropPct}% Lower Crowd Pressure
            </span>
          </div>
          <button className={styles.resetBtn} onClick={handleReset} style={{ marginTop: '16px' }}>
            🔄 View Alternatives Again
          </button>
        </div>
      </div>
    );
  }

  // Declined State View
  if (userState === 'declined') {
    return (
      <div className={styles.swapContainer}>
        <div className={styles.stateBannerDeclined}>
          <span style={{ fontSize: '2.5rem' }}>📍</span>
          <h2 className={styles.placeName}>Proceeding with Original Destination</h2>
          <p style={{ color: '#fca5a5', margin: '4px 0 16px 0' }}>
            All substitution options declined. Maintaining original booking for{' '}
            <strong style={{ textTransform: 'capitalize', color: '#fff' }}>{requested.destId}</strong>.
          </p>
          <button className={styles.resetBtn} onClick={handleReset}>
            🔄 Review Alternatives Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.swapContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleGroup}>
            <span className={styles.titleIcon}>⚡</span>
            <h2 className={styles.title}>Smart Substitution Alternatives</h2>
          </div>
          <div className={styles.badgeGroup}>
            <span className={styles.countBadge}>
              {places.length} places · {dates.length} dates
            </span>
            {relaxedRelief && (
              <span className={styles.relaxedBadge}>
                ⚠️ Relaxed relief applied
              </span>
            )}
          </div>
        </div>

        {/* Requested Destination Banner */}
        <div className={styles.requestedBanner}>
          <div className={styles.reqText}>
            <span>Overcrowded Destination Requested:</span>
            <span className={styles.reqDestName}>{requested.destId}</span>
          </div>
          <div className={styles.reqPressureMeter}>
            <span className={styles.metricLabel}>Crowd Pressure:</span>
            <span className={styles.pressurePillHigh}>
              {Math.round(requested.pressure * 100)}% High Overcrowding
            </span>
          </div>
        </div>
      </div>

      {/* Side by Side Content Grid */}
      <div className={styles.contentGrid}>
        {/* Left Column: Place Swap Variants */}
        <div>
          <div className={styles.sectionTitle}>
            <span>🏔️ Alternative Destinations</span>
            <span className={styles.sectionSubtitle}>Same vibe, lower crowd</span>
          </div>
          <div className={styles.variantsList}>
            {places.slice(0, 3).map((place) => (
              <PlaceSwapVariant
                key={place.destId}
                place={place}
                requestedPressure={requested.pressure}
                onAccept={handleAcceptPlace}
              />
            ))}
          </div>
        </div>

        {/* Right Column: Date Swap Variants */}
        <div>
          <div className={styles.sectionTitle}>
            <span>📅 Alternative Travel Dates</span>
            <span className={styles.sectionSubtitle}>Off-peak timing shifts</span>
          </div>
          <div className={styles.variantsList}>
            {dates.slice(0, 2).map((dateOpt) => (
              <DateSwapVariant
                key={dateOpt.startDate}
                dateOption={dateOpt}
                requestedPressure={requested.pressure}
                onAccept={handleAcceptDate}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer / Decline Section */}
      <div className={styles.footerSection}>
        <DeclineButton onDecline={handleDeclineAll} />
      </div>
    </div>
  );
}

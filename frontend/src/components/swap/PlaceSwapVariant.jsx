import React from 'react';
import MetricDisplay from './MetricDisplay.jsx';
import styles from './SwapCard.module.css';

/**
 * PlaceSwapVariant - Single alternative destination card component.
 * Displays rank, similarity, 4 key metrics, pressure relief, and accept action.
 */
export default function PlaceSwapVariant({ place, requestedPressure = 0.91, onAccept }) {
  const rankEmojis = ['🥇', '🥈', '🥉'];
  const rankBadge = rankEmojis[(place.rank || 1) - 1] || '✨';

  // Calculate similarity percentage: (1 - distance / dStar)
  const dStar = place.dStar || 0.65;
  const similarityPct = Math.max(0, Math.round((1 - place.distance / dStar) * 100));

  // Pressure reduction percentage
  const pressureDrop = Math.max(0, requestedPressure - place.pressure);
  const pressureDropPct = Math.round((pressureDrop / requestedPressure) * 100);

  return (
    <div className={styles.placeCard}>
      <div className={styles.cardHeader}>
        <div className={styles.rankTitleGroup}>
          <span className={styles.rankBadge}>{rankBadge}</span>
          <h3 className={styles.placeName}>{place.displayName}</h3>
        </div>
        <span className={styles.similarityBadge}>{similarityPct}% similar</span>
      </div>

      <div className={styles.reliefBanner}>
        <span>🍃 Relief Indicator</span>
        <span>{pressureDropPct}% Lower Crowd Pressure</span>
      </div>

      <div className={styles.metricsGrid}>
        <MetricDisplay
          label="Attribute Dist"
          value={`d = ${place.distance}`}
          comparison={`${similarityPct}% match`}
          type="number"
          isGood={place.distance <= dStar}
        />
        <MetricDisplay
          label="Travel Time"
          value={place.travelTimeRatio}
          comparison={
            place.travelTimeRatio <= 1.0
              ? 'Shorter/Same'
              : `+${Math.round((place.travelTimeRatio - 1) * 100)}% time`
          }
          type="ratio"
          isGood={place.travelTimeRatio <= 1.15}
        />
        <MetricDisplay
          label="Crowd Pressure"
          value={place.pressure}
          comparison={`${Math.round(place.pressure * 100)}% vs ${Math.round(
            requestedPressure * 100
          )}%`}
          type="percentage"
          isGood={place.pressure < requestedPressure}
        />
        <MetricDisplay
          label="Rupee Savings"
          value={place.savingINR}
          comparison="INR Saved"
          type="currency"
          isGood={place.savingINR > 0}
        />
      </div>

      <button
        className={styles.acceptBtn}
        onClick={() => onAccept && onAccept(place)}
      >
        <span>Swap to {place.displayName}</span>
        <span>→</span>
      </button>
    </div>
  );
}

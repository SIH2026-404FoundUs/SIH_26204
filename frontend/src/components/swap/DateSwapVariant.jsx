import React from 'react';
import MetricDisplay from './MetricDisplay.jsx';
import styles from './SwapCard.module.css';

/**
 * DateSwapVariant - Single alternative travel date card component.
 * Displays date, level badge, 3 key metrics (Pressure, Savings, Date shift), and accept action.
 */
export default function DateSwapVariant({
  dateOption,
  requestedDate = '2026-12-26',
  requestedPressure = 0.91,
  onAccept
}) {
  // Format YYYY-MM-DD into readable date (e.g. "Wed, Dec 28")
  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00Z'));
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const levelBadges = {
    1: '🌟 Best Relief',
    2: '👍 Good Relief',
    3: '💡 Alternative'
  };

  const levelText = levelBadges[dateOption.attemptLevel || 1] || '🌟 Best Relief';

  // Pressure drop calculation
  const pressureDrop = Math.max(0, requestedPressure - dateOption.pressure);
  const pressureDropPct = Math.round((pressureDrop / requestedPressure) * 100);

  return (
    <div className={styles.dateCard}>
      <div className={styles.cardHeader}>
        <div className={styles.rankTitleGroup}>
          <span className={styles.dateDisplay}>{formatDate(dateOption.startDate)}</span>
        </div>
        <span className={styles.levelBadge}>{levelText}</span>
      </div>

      <div className={styles.reliefBanner}>
        <span>🗓️ Temporal Shift</span>
        <span>{pressureDropPct}% Lower Pressure</span>
      </div>

      <div className={styles.metricsGrid}>
        <MetricDisplay
          label="Crowd Pressure"
          value={dateOption.pressure}
          comparison={`${Math.round(dateOption.pressure * 100)}% vs ${Math.round(
            requestedPressure * 100
          )}%`}
          type="percentage"
          isGood={dateOption.pressure < requestedPressure}
        />
        <MetricDisplay
          label="Rupee Savings"
          value={dateOption.savingINR}
          comparison="INR Saved"
          type="currency"
          isGood={dateOption.savingINR > 0}
        />
      </div>

      <button
        className={styles.acceptBtn}
        onClick={() => onAccept && onAccept(dateOption)}
      >
        <span>Shift to {formatDate(dateOption.startDate)}</span>
        <span>→</span>
      </button>
    </div>
  );
}

import React from 'react';
import styles from './SwapCard.module.css';

/**
 * MetricDisplay - Helper component to display key metrics (Distance, Pressure, Travel Time, Savings)
 * with clear trade-off indicators and good vs bad color coding.
 */
export default function MetricDisplay({
  label,
  value,
  comparison,
  type = 'number',
  isGood = true,
  subtitle
}) {
  const formatValue = (val) => {
    if (val === undefined || val === null) return '-';
    switch (type) {
      case 'currency':
        return `₹${Number(val).toLocaleString('en-IN')}`;
      case 'percentage':
        return `${Math.round(Number(val) * 100)}%`;
      case 'ratio':
        const pct = Math.round((Number(val) - 1) * 100);
        return pct === 0 ? 'Same time' : pct > 0 ? `+${pct}%` : `${pct}%`;
      case 'date':
        return val;
      default:
        return typeof val === 'number' ? val.toFixed(2) : val;
    }
  };

  const containerClass = `${styles.metricBox} ${
    isGood ? styles.metricGood : styles.metricWarning
  }`;

  const tagClass = isGood ? styles.metricTagGood : styles.metricTagWarning;

  return (
    <div className={containerClass}>
      <span className={styles.metricLabel}>{label}</span>
      <div className={styles.metricValueRow}>
        <span className={styles.metricValue}>{formatValue(value)}</span>
        {comparison && <span className={tagClass}>{comparison}</span>}
      </div>
      {subtitle && <span className={styles.metricLabel}>{subtitle}</span>}
    </div>
  );
}

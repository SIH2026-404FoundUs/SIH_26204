import React, { useState } from 'react';
import styles from './SwapCard.module.css';

/**
 * DeclineButton - Prominent decline button with confirmation dialog before action.
 */
export default function DeclineButton({ onDecline }) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleInitialClick = () => {
    setIsConfirming(true);
  };

  const handleCancel = () => {
    setIsConfirming(false);
  };

  const handleConfirmDecline = () => {
    setIsConfirming(false);
    if (onDecline) {
      onDecline();
    }
  };

  if (isConfirming) {
    return (
      <div className={styles.confirmBox}>
        <span className={styles.confirmText}>
          Are you sure you want to decline all place & date alternatives?
        </span>
        <div className={styles.confirmActions}>
          <button className={styles.confirmYesBtn} onClick={handleConfirmDecline}>
            Yes, Decline All
          </button>
          <button className={styles.confirmCancelBtn} onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button className={styles.declineBtn} onClick={handleInitialClick}>
      <span>✖</span>
      <span>Decline All Alternatives</span>
    </button>
  );
}

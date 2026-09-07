import React, { useState } from 'react';
import { XCircle, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';

/**
 * DeclineButton component displays a prominent decline button that opens
 * a confirmation dialog before executing the decline callback stub.
 *
 * @param {Object} props
 * @param {Function} [props.onDecline] - Callback function executed when decline is confirmed
 * @param {string} [props.requestedName='Original Destination'] - Name of the requested destination
 */
export default function DeclineButton({ onDecline, requestedName = 'Original Destination' }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  const handleConfirm = () => {
    console.log('[SwapEngine] Decline all alternatives confirmed for:', requestedName);
    setIsOpen(false);
    if (typeof onDecline === 'function') {
      onDecline();
    }
  };

  return (
    <>
      {/* Prominent Decline Trigger Button */}
      <div className="flex flex-col items-center justify-center pt-4">
        <button
          type="button"
          onClick={handleOpen}
          className="group inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white py-3 px-6 text-sm font-semibold text-slate-700 shadow-2xs transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100 active:scale-[0.98]"
        >
          <XCircle size={18} className="text-slate-400 transition-colors group-hover:text-rose-500" />
          Keep Original Plan ({requestedName})
        </button>
        <p className="mt-2 text-xs text-slate-400">
          Decline overcrowding relief & continue with original itinerary
        </p>
      </div>

      {/* Confirmation Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decline-dialog-title"
          >
            {/* Modal Icon & Header */}
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
              <AlertTriangle size={24} />
            </div>

            <div className="text-center">
              <h3 id="decline-dialog-title" className="text-lg font-bold text-slate-900">
                Keep Original Itinerary?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                You are choosing to proceed to <strong className="text-slate-900">{requestedName}</strong> despite high crowd pressure warnings.
              </p>
            </div>

            {/* Warning Box */}
            <div className="mt-4 rounded-xl bg-amber-50 p-3.5 border border-amber-200/70 text-left flex items-start gap-3">
              <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 leading-normal">
                <strong>Expect delays:</strong> You may encounter longer travel wait times, heavy traffic congestion, and surge pricing for lodging.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2.5 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-rose-100"
              >
                Confirm Decline
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { create } from 'zustand';
import api, { getErrorMessage } from '../lib/api';

/**
 * useSubstitutionStore - Zustand store for managing travel substitution requests & state.
 * Connects directly to backend endpoint POST /api/alternatives.
 */
export const useSubstitutionStore = create((set) => ({
  result: null,
  isLoading: false,
  error: null,

  /**
   * Fetches destination and date substitution alternatives from backend.
   *
   * @param {Object} payload
   * @param {string} payload.origin - Travel origin city (e.g., 'delhi')
   * @param {string} payload.destId - Requested destination ID (e.g., 'manali')
   * @param {string} payload.startDate - Trip start date (YYYY-MM-DD)
   * @param {string} payload.endDate - Trip end date (YYYY-MM-DD)
   * @param {number} [payload.travellers=2] - Optional number of travellers
   * @param {number} [payload.budgetINR] - Optional budget in INR
   * @param {Array<string>} [payload.interests] - Optional interest tags
   */
  getAlternatives: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/alternatives', payload);
      set({ result: response.data, isLoading: false, error: null });
      return response.data;
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to fetch substitution alternatives.');
      set({ error: msg, isLoading: false, result: null });
      return null;
    }
  },

  /** Resets state back to initial values */
  reset: () => set({ result: null, isLoading: false, error: null })
}));

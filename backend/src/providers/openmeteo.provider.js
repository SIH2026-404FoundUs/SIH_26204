// Bring in the two helper functions we just made
import {ok,fail} from '../lib/envelope.js'

// Bring in axios, our tool for making internet requests
import axios from 'axios'
// This is the actual function other people will call.
// It needs: lat and lng (the location), and a date.
async function getForecast(lat, lng, date) {
  try {
    // FIX: the requested `date` must actually be sent to the API (previously
    // ignored entirely), and the response must be checked against it — the
    // Open-Meteo forecast API only covers a ~16-day horizon, so a date outside
    // that window silently returned today's index-0 values as if they were
    // the requested date. That's exactly the "wrong success" the provider
    // contract forbids: ok:true must mean the data really is for `date`.
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lng,
        daily: 'temperature_2m_max,precipitation_probability_max',
        timezone: 'Asia/Kolkata',
        start_date: date,
        end_date: date,
      }
    });

    const days = response.data?.daily?.time ?? [];
    const idx = days.indexOf(date);
    if (idx === -1) {
      // Outside the forecast horizon (too far future, or in the past) --
      // this adapter has no archive-API path yet. Fail honestly rather than
      // substitute a different day's data.
      return fail(`no forecast data for ${date} (outside Open-Meteo's forecast horizon)`, { source: 'openmeteo' });
    }

    const maxTemp = response.data.daily.temperature_2m_max[idx];
    const precipProb = response.data.daily.precipitation_probability_max[idx];
    if (maxTemp == null || precipProb == null) {
      return fail(`incomplete forecast data for ${date}`, { source: 'openmeteo' });
    }

    // Wrap it in our success envelope before handing it back
    return ok({ maxTemp, precipProb }, { source: 'openmeteo', confidence: 'high' });

  } catch (error) {
    // If ANYTHING above goes wrong (no internet, bad response, etc.)
    // we land here instead of crashing the whole app
    return fail(error.message, { source: 'openmeteo' });
  }
}

// Make this function usable by other files
export { getForecast };
import { ok, fail } from '../lib/envelope.js';
import axios from 'axios';

// Fetch the daily forecast for a single date at a given location.
// date is an ISO day string (YYYY-MM-DD) and is pinned as both the
// start and end of the range, so daily[...][0] is that exact day.
async function getForecast(lat, lng, date) {
  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lng,
        daily: 'temperature_2m_max,precipitation_probability_max',
        timezone: 'Asia/Kolkata',
        start_date: date,
        end_date: date
      }
    });

    const maxTemp = response.data.daily.temperature_2m_max[0];
    const precipProb = response.data.daily.precipitation_probability_max[0];

    return ok({ maxTemp, precipProb }, { source: 'openmeteo', confidence: 'high' });

  } catch (error) {
    return fail(error.message, { source: 'openmeteo' });
  }
}

export { getForecast };

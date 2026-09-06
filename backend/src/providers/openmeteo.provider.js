// Bring in the two helper functions we just made
import {ok,fail} from '../lib/envelope.js'

// Bring in axios, our tool for making internet requests
import axios from 'axios'
// This is the actual function other people will call.
// It needs: lat and lng (the location), and a date.
async function getForecast(lat, lng, date) {
  try {
    // This line actually reaches out to the internet and asks for weather data
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lng,
        daily: 'temperature_2m_max,precipitation_probability_max',
        timezone: 'Asia/Kolkata'
      }
    });

    // response.data is whatever Open-Meteo sent back — we pull out
    // just the pieces we care about
    const maxTemp = response.data.daily.temperature_2m_max[0];
    const precipProb = response.data.daily.precipitation_probability_max[0];

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
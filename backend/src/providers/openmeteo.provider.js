import { ok, fail } from '../lib/envelope.js';
import axios from 'axios';

// Open-Meteo's forecast endpoint only serves a narrow window around today
// (roughly the past 3 months plus 16 days ahead) and returns HTTP 400 --
// "Parameter 'start_date' is out of allowed range" -- for anything outside it.
// Trip planning is inherently future-dated, so before this fallback existed
// every plan more than a fortnight out silently came back with no weather at
// all, which then rendered as "Ready"/"Unavailable" on the trip card and "—"
// in the PDF.
//
// Past that horizon there is no forecast to be had, so we serve the climate
// model's value for that calendar date instead and label it as such. It is an
// expectation, not a prediction, and the response says so via `source` so the
// UI can caveat it rather than presenting it as a real forecast.
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const CLIMATE_URL = 'https://climate-api.open-meteo.com/v1/climate';

// The climate API needs an explicit model; MRI_AGCM3_2_S is Open-Meteo's
// default downscaled 20km model and covers 1950-2050.
const CLIMATE_MODEL = 'MRI_AGCM3_2_S';

function isOutOfForecastRange(error) {
  const reason = error.response?.data?.reason;
  return typeof reason === 'string' && reason.includes('out of allowed range');
}

async function getSeasonalNormal(lat, lng, date) {
  const response = await axios.get(CLIMATE_URL, {
    params: {
      latitude: lat,
      longitude: lng,
      start_date: date,
      end_date: date,
      models: CLIMATE_MODEL,
      daily: 'temperature_2m_max,precipitation_sum',
      timezone: 'Asia/Kolkata',
    },
  });

  const maxTemp = response.data.daily?.temperature_2m_max?.[0];
  const precipMm = response.data.daily?.precipitation_sum?.[0];
  if (maxTemp == null) {
    return fail(`no climate data for ${date}`, { source: 'openmeteo-climate' });
  }

  return ok(
    {
      maxTemp,
      // The climate model reports millimetres of rainfall, not a probability.
      // Reporting it as precipProb would be inventing a statistic, so that
      // field stays null and the millimetres travel in their own field.
      precipProb: null,
      precipMm,
      source: 'seasonal-normal',
    },
    { source: 'openmeteo-climate', confidence: 'low' }
  );
}

// Fetch the daily forecast for a single date at a given location.
// date is an ISO day string (YYYY-MM-DD) and is pinned as both the
// start and end of the range, so daily[...][0] is that exact day.
async function getForecast(lat, lng, date) {
  try {
    const response = await axios.get(FORECAST_URL, {
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

    return ok({ maxTemp, precipProb, precipMm: null, source: 'forecast' }, { source: 'openmeteo', confidence: 'high' });

  } catch (error) {
    if (isOutOfForecastRange(error)) {
      try {
        return await getSeasonalNormal(lat, lng, date);
      } catch (climateError) {
        return fail(climateError.message, { source: 'openmeteo-climate' });
      }
    }
    return fail(error.message, { source: 'openmeteo' });
  }
}

export { getForecast };

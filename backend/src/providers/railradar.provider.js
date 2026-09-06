import { ok, fail } from '../lib/envelope.js';
import axios from 'axios';


function parseAvailabilityStatus(status) {
  if (status.startsWith('AVAILABLE')) {
    return { waitlistDepth: 0, rawStatus: 'AVAILABLE' };
  }
  if (status.startsWith('RAC')) {
    const match = status.match(/RAC\s*(\d+)/);
    return { waitlistDepth: match ? parseInt(match[1], 10) : 0, rawStatus: 'RAC' };
  }
  const wlMatches = [...status.matchAll(/WL(\d+)/g)];
  if (wlMatches.length > 0) {
    const lastMatch = wlMatches[wlMatches.length - 1];
    return { waitlistDepth: parseInt(lastMatch[1], 10), rawStatus: 'WAITLISTED' };
  }
  return { waitlistDepth: null, rawStatus: 'UNKNOWN' };
}

async function getTrainAvailability(trainNumber, source, destination, journeyDate, classCode = '3A', quotaCode = 'GN') {
  try {
    const response = await axios.get(
      `https://api.railradar.in/v1/trains/${trainNumber}/seats`,
      {
        params: { source, destination, journeyDate, classCode, quotaCode },
        headers: { Authorization: `Bearer ${process.env.RAILRADAR_API_KEY}` }
      }
    );

    // FIXED: the real field is "calendar", not "avlDayList"
    const days = response.data.data.calendar.map(day => {
      // statusCode already tells us AVAILABLE vs RAC vs WL, but for
      // AVAILABLE we can skip parsing entirely and just use availableSeats
      if (day.statusCode === 'AVAILABLE') {
        return { date: day.date, waitlistDepth: 0, rawStatus: 'AVAILABLE', availableSeats: day.availableSeats };
      }
      // for RAC / WL cases, fall back to parsing the text status
      return { date: day.date, ...parseAvailabilityStatus(day.status) };
    });

    return ok(
      { trainNumber, trainName: response.data.data.trainName, days },
      { source: 'railradar', confidence: 'high' }
    );

  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    return fail(message, { source: 'railradar' });
  }
}


export { getTrainAvailability, parseAvailabilityStatus };
// backend/src/providers/demandML.provider.js

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 4000;

/**
 * Call the Python ML demand predictor endpoint.
 * @param {object} params  { destId, date, features }
 * @returns {Promise<{ ok: boolean, data: { predictedVisitors: number }|null, meta: object }>}
 */
export async function predictDemand({ destId, date, features }) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${AI_SERVICE_URL}/api/v1/pressure/predict-demand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destId, date, features }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text();
      console.warn(
        `[demandML.provider] Service returned HTTP ${res.status} for ${destId} on ${date}: ${errText}`
      );
      return {
        ok: false,
        data: null,
        meta: { error: `HTTP ${res.status}: ${errText}`, latencyMs, source: "ml_causal" },
      };
    }

    const payload = await res.json();
    if (!payload || payload.ok === false) {
      console.warn(
        `[demandML.provider] Service prediction failed for ${destId} on ${date}: ${
          payload?.error || "Unknown error"
        }`
      );
      return {
        ok: false,
        data: null,
        meta: { error: payload?.error || "Prediction failed", latencyMs, source: "ml_causal" },
      };
    }

    return {
      ok: true,
      data: { predictedVisitors: Number(payload.predictedVisitors) },
      meta: { latencyMs, source: "ml_causal" },
    };
  } catch (err) {
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    const isTimeout = err.name === "AbortError";
    const errorMsg = isTimeout ? "Timeout (>4000ms)" : err.message;

    console.warn(
      `[demandML.provider] Prediction request failed for ${destId} on ${date}: ${errorMsg}`
    );

    return {
      ok: false,
      data: null,
      meta: { error: errorMsg, latencyMs, source: "ml_causal" },
    };
  }
}

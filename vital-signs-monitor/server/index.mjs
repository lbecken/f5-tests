/**
 * Vital signs test server.
 *
 * Plays the role of a "device gateway": in a real deployment something like an
 * HL7/FHIR integration engine would aggregate observations coming from many
 * bedside devices into one multiplexed feed. Here we do the same with:
 *
 *   - a built-in simulator producing realistic vitals from 5 virtual devices,
 *   - POST /api/vitals        REST ingest for external producers (single or batch),
 *   - GET  /api/stream        Server-Sent Events feed consumed by the UI,
 *   - GET  /api/vitals/recent JSON snapshot of the retained buffer.
 *
 * Every sample, regardless of origin, is normalized to the same VitalSample
 * shape and broadcast to all connected SSE clients.
 */
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT ?? 8787;
const RETAIN_MS = 5 * 60 * 1000; // ring buffer: last 5 minutes

// Keep in sync with src/vitals.ts (VITALS). The server is deliberately
// schema-light: it validates type/value/timestamp and fills defaults.
const VITAL_TYPES = {
  heart_rate: { unit: "bpm" },
  spo2: { unit: "%" },
  resp_rate: { unit: "breaths/min" },
  temperature: { unit: "°C" },
  systolic_bp: { unit: "mmHg" },
  diastolic_bp: { unit: "mmHg" },
};

// ---------------------------------------------------------------------------
// Broadcast hub
// ---------------------------------------------------------------------------

/** @type {Set<import("express").Response>} */
const sseClients = new Set();
/** @type {Array<object>} */
let buffer = [];

function broadcast(samples) {
  if (samples.length === 0) return;
  const now = Date.now();
  buffer.push(...samples);
  // Prune the ring buffer occasionally rather than on every push.
  if (buffer.length > 10_000) {
    buffer = buffer.filter((s) => s.timestamp >= now - RETAIN_MS);
  }
  const frame = `event: vitals\ndata: ${JSON.stringify(samples)}\n\n`;
  for (const res of sseClients) res.write(frame);
}

// ---------------------------------------------------------------------------
// Simulator: mean-reverting random walks with occasional abnormal "episodes"
// ---------------------------------------------------------------------------

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * One simulated channel. Wanders around `baseline`; every so often it drifts
 * to an abnormal `target` for a while (tachycardia, desaturation, fever...)
 * so the UI's out-of-range handling can be exercised without external input.
 */
function makeChannel({ deviceId, type, baseline, sigma, cadenceMs, decimals, episodes }) {
  let value = baseline;
  let episode = null; // { target, until }

  return {
    cadenceMs,
    sample(now) {
      if (episode && now > episode.until) episode = null;
      if (!episode && Math.random() < cadenceMs / 45_000) {
        const pick = episodes[Math.floor(Math.random() * episodes.length)];
        episode = { target: pick.target, until: now + pick.durationMs };
      }
      const goal = episode ? episode.target : baseline;
      value += (goal - value) * 0.12 + gaussian() * sigma;
      return {
        deviceId,
        type,
        value: Number(value.toFixed(decimals)),
        unit: VITAL_TYPES[type].unit,
        timestamp: now,
      };
    },
  };
}

const channels = [
  makeChannel({
    deviceId: "sim-ecg-01", type: "heart_rate",
    baseline: 74, sigma: 1.4, cadenceMs: 1000, decimals: 0,
    episodes: [
      { target: 128, durationMs: 12_000 }, // tachycardia
      { target: 48, durationMs: 10_000 },  // bradycardia
    ],
  }),
  makeChannel({
    deviceId: "sim-spo2-01", type: "spo2",
    baseline: 97.5, sigma: 0.35, cadenceMs: 1000, decimals: 0,
    episodes: [{ target: 88, durationMs: 10_000 }], // desaturation
  }),
  makeChannel({
    deviceId: "sim-resp-01", type: "resp_rate",
    baseline: 15, sigma: 0.5, cadenceMs: 2000, decimals: 0,
    episodes: [
      { target: 26, durationMs: 14_000 }, // tachypnea
      { target: 8, durationMs: 10_000 },  // bradypnea
    ],
  }),
  makeChannel({
    deviceId: "sim-temp-01", type: "temperature",
    baseline: 36.8, sigma: 0.04, cadenceMs: 5000, decimals: 1,
    episodes: [{ target: 38.6, durationMs: 40_000 }], // fever
  }),
  makeChannel({
    deviceId: "sim-nibp-01", type: "systolic_bp",
    baseline: 118, sigma: 1.6, cadenceMs: 5000, decimals: 0,
    episodes: [{ target: 152, durationMs: 25_000 }], // hypertension
  }),
  makeChannel({
    deviceId: "sim-nibp-01", type: "diastolic_bp",
    baseline: 76, sigma: 1.2, cadenceMs: 5000, decimals: 0,
    episodes: [{ target: 98, durationMs: 25_000 }],
  }),
];

for (const ch of channels) {
  setInterval(() => broadcast([ch.sample(Date.now())]), ch.cadenceMs);
}

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  // Backfill so a freshly opened UI starts with history instead of a blank chart.
  const since = Date.now() - RETAIN_MS;
  const recent = buffer.filter((s) => s.timestamp >= since);
  res.write(`event: vitals\ndata: ${JSON.stringify(recent)}\n\n`);

  sseClients.add(res);
  const keepAlive = setInterval(() => res.write(":keep-alive\n\n"), 15_000);
  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

/**
 * REST ingest for external producers. Accepts a single sample or an array:
 *   { "type": "heart_rate", "value": 82 }
 * Optional fields: timestamp (epoch ms, default now), deviceId, unit.
 */
app.post("/api/vitals", (req, res) => {
  const body = Array.isArray(req.body) ? req.body : [req.body];
  const accepted = [];
  const errors = [];

  body.forEach((raw, i) => {
    if (raw == null || typeof raw !== "object") {
      errors.push({ index: i, error: "not an object" });
      return;
    }
    const spec = VITAL_TYPES[raw.type];
    if (!spec) {
      errors.push({ index: i, error: `unknown type '${raw.type}'. Known: ${Object.keys(VITAL_TYPES).join(", ")}` });
      return;
    }
    const value = Number(raw.value);
    if (!Number.isFinite(value)) {
      errors.push({ index: i, error: "value must be a finite number" });
      return;
    }
    const timestamp = raw.timestamp == null ? Date.now() : Number(raw.timestamp);
    if (!Number.isFinite(timestamp)) {
      errors.push({ index: i, error: "timestamp must be epoch milliseconds" });
      return;
    }
    accepted.push({
      deviceId: typeof raw.deviceId === "string" ? raw.deviceId : "external",
      type: raw.type,
      value,
      unit: typeof raw.unit === "string" ? raw.unit : spec.unit,
      timestamp,
    });
  });

  broadcast(accepted);
  res.status(errors.length > 0 && accepted.length === 0 ? 400 : 200).json({
    accepted: accepted.length,
    rejected: errors.length,
    errors,
  });
});

app.get("/api/vitals/recent", (_req, res) => {
  const since = Date.now() - RETAIN_MS;
  res.json(buffer.filter((s) => s.timestamp >= since));
});

// In production serve the built client from the same origin.
if (process.env.NODE_ENV === "production") {
  const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`vital signs server listening on http://localhost:${PORT}`);
  console.log(`  SSE stream : GET  /api/stream`);
  console.log(`  REST ingest: POST /api/vitals`);
});

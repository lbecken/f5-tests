# Patient Vital Signs Monitor

A real-time vital signs chart component (React + TypeScript + D3) plus a small
test environment that produces a continuous stream of vital sign data, the way
a bedside device gateway would.

> Demo / test harness only — **not a medical device**.

## Quick start

```bash
npm install
npm run dev        # server on :8787 + Vite client on :5173
```

Open http://localhost:5173. For a production-style single server:

```bash
npm run build
npm start          # serves the built UI + API on :8787
```

## What you get

- **Six vitals** streaming live: heart rate, SpO₂, respiratory rate,
  temperature, systolic and diastolic blood pressure — each from a simulated
  device with its own sampling cadence (HR/SpO₂ every 1 s, NIBP every 5 s, …).
- **Split view (default)**: stacked per-vital panels sharing one time axis,
  like a real patient monitor, each with its own y-scale and a shaded normal
  band.
- **Overlay view**: all vitals on one graph. Different units can't share a raw
  y-axis (and dual axes mislead), so each vital is indexed to **% of its
  normal range** — 0% = lower limit, 100% = upper limit. Correlated events
  (HR climbing while SpO₂ drops) line up visually; hover shows raw values.
- **Sliding window**: the graph continuously moves left; newest values appear
  at the right edge. Window presets: 30 s / 60 s / 2 min / 5 min. **Freeze**
  pauses the display (data keeps buffering) so you can inspect it.
- **Hover / keyboard inspection**: a crosshair snaps to the nearest samples
  and a tooltip lists every visible vital at that moment (raw value + unit +
  status). Focus the chart and use ←/→ (Shift for 10 s steps) for the same
  readout without a mouse.
- **Out-of-range handling**: abnormal points get a red ring on the chart, and
  the numeric tiles show an explicit `▲ HIGH` / `▼ LOW` chip — icon + text,
  never color alone.
- **Identity beyond color**: every vital has a fixed color *and* marker shape
  (circle, square, triangle, diamond, cross, star), mirrored in the legend and
  tiles. The palette is colorblind-validated in light and dark mode; the app
  follows `prefers-color-scheme`.
- **Numeric tiles**: monitor-style current-value tiles beside the chart.
- **Data table**: a collapsible table of recent readings, so every value is
  reachable without hovering.
- Legend items toggle series visibility; colors stay bound to the vital and
  are never reassigned.

## Data model — one stream, one type

Real deployments rarely give the UI one socket per device. Typically an
integration layer (e.g. an HL7/FHIR gateway) aggregates device observations
into a single multiplexed feed. This project mirrors that: everything is
normalized into one TypeScript type and the chart just switches on `type`:

```ts
interface VitalSample {
  deviceId: string;   // which device produced it
  type: VitalType;    // "heart_rate" | "spo2" | "resp_rate" | "temperature" | "systolic_bp" | "diastolic_bp"
  value: number;
  unit: string;
  timestamp: number;  // Unix epoch ms
}
```

Adding a new vital = adding one entry to `VITALS` in `src/vitals.ts`
(label, unit, normal range, color slot, marker shape, cadence).

## API

| Endpoint | Description |
|---|---|
| `GET /api/stream` | Server-Sent Events feed. Emits `vitals` events whose data is a JSON array of `VitalSample`s. New connections receive a backfill of the last 5 minutes. |
| `POST /api/vitals` | REST ingest for external producers. Body: a sample or an array of samples. |
| `GET /api/vitals/recent` | JSON snapshot of the retained buffer (last 5 min). |

Push data from an external source (only `type` and `value` are required):

```bash
curl -X POST http://localhost:8787/api/vitals \
  -H 'Content-Type: application/json' \
  -d '{"type": "heart_rate", "value": 132, "deviceId": "ward-3-ecg"}'

# batch
curl -X POST http://localhost:8787/api/vitals \
  -H 'Content-Type: application/json' \
  -d '[{"type":"spo2","value":91},{"type":"temperature","value":38.4}]'
```

Anything POSTed is broadcast to every connected UI instantly — an easy way to
force out-of-range values and watch the alert styling. The built-in simulator
also injects abnormal "episodes" (tachycardia, desaturation, fever, …) every
so often on its own.

## Layout

```
server/index.mjs                    device simulator + SSE hub + REST ingest (Express)
src/vitals.ts                       VitalSample type + per-vital config (single source of truth)
src/useVitalStream.ts               SSE client hook (buffering, ordering, pruning) + display clock
src/components/VitalSignsChart.tsx  the chart: scales, axes, series, crosshair, tooltip
src/components/Legend.tsx           legend + series visibility toggles
src/components/VitalTiles.tsx       current-value tiles with HIGH/LOW chips
src/components/DataTable.tsx        accessible table view of recent readings
```

The transport is isolated in `useVitalStream`; the chart component only sees
`Map<VitalType, VitalSample[]>`, so swapping SSE for WebSockets or a polling
client wouldn't touch it.

## Design decisions

- **No dual y-axis.** Vitals span incompatible scales (SpO₂ 95–100% vs HR
  40–180 bpm); dual/multi axes invite false readings. Split view gives each
  vital its own scale; overlay view indexes to a common "% of normal range"
  basis so one honest axis serves all six.
- **Split view is the default** — it matches how clinicians already read
  bedside monitors. Overlay is opt-in for cross-vital correlation.
- **SSE over WebSockets** for the demo: one-directional telemetry, automatic
  reconnection, plain HTTP (works through proxies), trivially replaceable.
- **Freeze instead of hover-chasing**: inspecting a moving chart is hard, so
  the display clock can be frozen while ingestion continues.

import { useMemo, useState } from "react";
import type { VitalType } from "./vitals";
import { VITALS } from "./vitals";
import { useClock, useVitalStream } from "./useVitalStream";
import { VitalSignsChart } from "./components/VitalSignsChart";
import type { ChartMode } from "./components/VitalSignsChart";
import { Legend } from "./components/Legend";
import { VitalTiles } from "./components/VitalTiles";
import { DataTable } from "./components/DataTable";

const RETAIN_MS = 5 * 60 * 1000;
const WINDOW_PRESETS = [
  { label: "30 s", ms: 30_000 },
  { label: "60 s", ms: 60_000 },
  { label: "2 min", ms: 120_000 },
  { label: "5 min", ms: 300_000 },
];

/** Series colors defined once from the config, for both color schemes. */
function seriesCssVars(): string {
  const light = VITALS.map((v) => `--series-${v.type}:${v.color.light};`).join("");
  const dark = VITALS.map((v) => `--series-${v.type}:${v.color.dark};`).join("");
  return `.vsm-root{${light}}@media (prefers-color-scheme: dark){.vsm-root{${dark}}}`;
}

export default function App() {
  const [windowMs, setWindowMs] = useState(60_000);
  const [mode, setMode] = useState<ChartMode>("split");
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState<ReadonlySet<VitalType>>(
    () => new Set(VITALS.map((v) => v.type)),
  );

  const { series, latest, connected } = useVitalStream("/api/stream", RETAIN_MS);
  const now = useClock(paused);
  const cssVars = useMemo(seriesCssVars, []);

  const toggleVital = (type: VitalType) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  return (
    <div className="vsm-root">
      <style>{cssVars}</style>
      <header className="app-header">
        <h1>Patient Vital Signs</h1>
        <span className={`conn-dot ${connected ? "conn-on" : "conn-off"}`} aria-hidden="true" />
        <span className="conn-label">{connected ? "live" : "reconnecting…"}</span>
      </header>

      {/* Filter row: time range first, then view controls. Scopes everything below. */}
      <div className="controls" role="toolbar" aria-label="Chart controls">
        <div className="segmented" role="group" aria-label="Time window">
          {WINDOW_PRESETS.map((p) => (
            <button
              key={p.ms}
              type="button"
              className={windowMs === p.ms ? "seg-on" : ""}
              aria-pressed={windowMs === p.ms}
              onClick={() => setWindowMs(p.ms)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Chart layout">
          <button type="button" className={mode === "split" ? "seg-on" : ""} aria-pressed={mode === "split"} onClick={() => setMode("split")}>
            Split
          </button>
          <button type="button" className={mode === "overlay" ? "seg-on" : ""} aria-pressed={mode === "overlay"} onClick={() => setMode("overlay")}>
            Overlay
          </button>
        </div>
        <button type="button" className={`pause-btn${paused ? " seg-on" : ""}`} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
          {paused ? "▶ Resume" : "⏸ Freeze"}
        </button>
        {paused && <span className="paused-note">display frozen — data keeps buffering</span>}
      </div>

      <main className="monitor">
        <section className="chart-card" aria-label="Vital signs chart">
          <Legend visible={visible} onToggle={toggleVital} />
          <VitalSignsChart series={series} now={now} windowMs={windowMs} mode={mode} visible={visible} />
          {mode === "overlay" && (
            <p className="overlay-hint">
              Overlay indexes every vital to <strong>% of its normal range</strong> (0% = lower limit, 100% = upper
              limit) so different units share one axis. Hover for raw values.
            </p>
          )}
        </section>
        <aside className="tiles-col">
          <VitalTiles latest={latest} stale={(s) => now - s.timestamp > 15_000} />
        </aside>
      </main>

      <DataTable series={series} visible={visible} />

      <footer className="app-footer">
        Simulated devices stream over SSE; external producers can{" "}
        <code>POST /api/vitals</code>. Demo only — not a medical device.
      </footer>
    </div>
  );
}

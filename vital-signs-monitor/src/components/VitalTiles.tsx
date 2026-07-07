import type { VitalSample, VitalType } from "../vitals";
import { VITALS, formatValue, rangeStatus } from "../vitals";
import { markerPath } from "./markers";

interface VitalTilesProps {
  latest: ReadonlyMap<VitalType, VitalSample>;
  stale: (sample: VitalSample) => boolean;
}

/**
 * Bedside-monitor style numeric tiles: the current value of every vital,
 * always visible without hovering. Out-of-range values get an icon + label
 * chip (never color alone). Each tile is keyed to its series by the same
 * color + marker shape used in the chart.
 */
export function VitalTiles({ latest, stale }: VitalTilesProps) {
  return (
    <div className="tiles" role="list" aria-label="Current vital sign values">
      {VITALS.map((config) => {
        const sample = latest.get(config.type);
        const status = sample ? rangeStatus(config, sample.value) : "normal";
        const isStale = sample ? stale(sample) : false;
        return (
          <div
            key={config.type}
            role="listitem"
            className={`tile${status !== "normal" ? " tile-alert" : ""}`}
            style={{ borderLeftColor: `var(--series-${config.type})` }}
          >
            <div className="tile-head">
              <svg width="12" height="12" aria-hidden="true">
                <path d={markerPath(config.symbol, 44)} transform="translate(6,6)" fill={`var(--series-${config.type})`} />
              </svg>
              <span className="tile-label">{config.shortLabel}</span>
              {status !== "normal" && (
                <span className={`status-chip status-${status}`} role="alert">
                  {status === "high" ? "▲ HIGH" : "▼ LOW"}
                </span>
              )}
            </div>
            <div className="tile-value">
              {sample ? formatValue(config, sample.value) : "––"}
              <span className="tile-unit">{config.unit}</span>
            </div>
            <div className="tile-sub">{isStale ? "no recent data" : `normal ${config.normal[0]}–${config.normal[1]}`}</div>
          </div>
        );
      })}
    </div>
  );
}

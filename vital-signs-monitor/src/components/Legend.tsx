import type { VitalType } from "../vitals";
import { VITALS } from "../vitals";
import { markerPath } from "./markers";

interface LegendProps {
  visible: ReadonlySet<VitalType>;
  onToggle: (type: VitalType) => void;
}

/**
 * Legend mirroring the chart marks: a 2px line with the series' marker shape,
 * so identity is carried by shape as well as color. Items toggle visibility;
 * colors stay bound to the vital (never reassigned when series are hidden).
 */
export function Legend({ visible, onToggle }: LegendProps) {
  return (
    <div className="legend" role="group" aria-label="Vital signs shown on the chart">
      {VITALS.map((config) => {
        const on = visible.has(config.type);
        return (
          <button
            key={config.type}
            type="button"
            className={`legend-item${on ? "" : " legend-item-off"}`}
            aria-pressed={on}
            onClick={() => onToggle(config.type)}
            title={`${on ? "Hide" : "Show"} ${config.label}`}
          >
            <svg width="26" height="12" aria-hidden="true">
              <line x1="1" y1="6" x2="25" y2="6" stroke={`var(--series-${config.type})`} strokeWidth="2" />
              <path d={markerPath(config.symbol, 44)} transform="translate(13,6)" fill={`var(--series-${config.type})`} />
            </svg>
            <span className="legend-name">{config.label}</span>
            <span className="legend-range">
              {config.normal[0]}–{config.normal[1]} {config.unit}
            </span>
          </button>
        );
      })}
    </div>
  );
}

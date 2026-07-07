import { timeFormat } from "d3";
import type { VitalSample, VitalType } from "../vitals";
import { VITAL_BY_TYPE, formatValue, rangeStatus } from "../vitals";
import type { VitalSeries } from "../useVitalStream";

const fmtTime = timeFormat("%H:%M:%S");

interface DataTableProps {
  series: VitalSeries;
  visible: ReadonlySet<VitalType>;
  rows?: number;
}

/**
 * Table view: every charted value reachable without a pointer
 * (screen readers, keyboard users, and anyone verifying exact numbers).
 */
export function DataTable({ series, visible, rows = 24 }: DataTableProps) {
  const recent: VitalSample[] = [];
  for (const [type, samples] of series) {
    if (visible.has(type)) recent.push(...samples.slice(-rows));
  }
  recent.sort((a, b) => b.timestamp - a.timestamp);
  const shown = recent.slice(0, rows);

  return (
    <details className="data-table">
      <summary>Data table (latest {rows} readings)</summary>
      <div className="data-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Vital sign</th>
              <th scope="col">Value</th>
              <th scope="col">Unit</th>
              <th scope="col">Status</th>
              <th scope="col">Device</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => {
              const config = VITAL_BY_TYPE.get(s.type)!;
              const status = rangeStatus(config, s.value);
              return (
                <tr key={`${s.type}-${s.deviceId}-${s.timestamp}`}>
                  <td>{fmtTime(new Date(s.timestamp))}</td>
                  <td>{config.label}</td>
                  <td className="num">{formatValue(config, s.value)}</td>
                  <td>{s.unit}</td>
                  <td>{status === "normal" ? "normal" : status === "high" ? "▲ high" : "▼ low"}</td>
                  <td>{s.deviceId}</td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6}>No data yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}

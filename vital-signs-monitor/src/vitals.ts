/**
 * The single data type the chart component consumes.
 *
 * Everything — simulator devices, the REST ingest endpoint, any future
 * device driver — is normalized into this discriminated shape before it
 * reaches the UI, so the component only ever deals with one stream of
 * `VitalSample`s and switches on `type`.
 */
export type VitalType =
  | "heart_rate"
  | "spo2"
  | "resp_rate"
  | "temperature"
  | "systolic_bp"
  | "diastolic_bp";

export interface VitalSample {
  deviceId: string;
  type: VitalType;
  value: number;
  unit: string;
  /** Unix epoch milliseconds */
  timestamp: number;
}

export type SymbolName = "circle" | "square" | "triangle" | "diamond" | "cross" | "star";

export interface VitalConfig {
  type: VitalType;
  label: string;
  shortLabel: string;
  unit: string;
  /** Normal adult reference range [low, high] — drives out-of-range marking. */
  normal: [number, number];
  /** Plausible display bounds, used to pad/clamp axis domains in split view. */
  bounds: [number, number];
  /** Series color per color-scheme (validated categorical palette, fixed slot order). */
  color: { light: string; dark: string };
  /** Marker shape — the color-independent identity channel. */
  symbol: SymbolName;
  /** Expected sampling cadence (ms): hover tolerance + line-gap detection. */
  cadenceMs: number;
  decimals: number;
}

/**
 * Fixed order = categorical palette slot order (the ordering is the
 * colorblind-safety mechanism — do not re-sort or cycle).
 */
export const VITALS: VitalConfig[] = [
  {
    type: "heart_rate",
    label: "Heart rate",
    shortLabel: "HR",
    unit: "bpm",
    normal: [60, 100],
    bounds: [30, 190],
    color: { light: "#2a78d6", dark: "#3987e5" },
    symbol: "circle",
    cadenceMs: 1000,
    decimals: 0,
  },
  {
    type: "spo2",
    label: "SpO₂",
    shortLabel: "SpO₂",
    unit: "%",
    normal: [95, 100],
    bounds: [70, 100],
    color: { light: "#1baf7a", dark: "#199e70" },
    symbol: "square",
    cadenceMs: 1000,
    decimals: 0,
  },
  {
    type: "resp_rate",
    label: "Respiratory rate",
    shortLabel: "RR",
    unit: "breaths/min",
    normal: [12, 20],
    bounds: [4, 40],
    color: { light: "#eda100", dark: "#c98500" },
    symbol: "triangle",
    cadenceMs: 2000,
    decimals: 0,
  },
  {
    type: "temperature",
    label: "Temperature",
    shortLabel: "Temp",
    unit: "°C",
    normal: [36.1, 37.2],
    bounds: [34, 41],
    color: { light: "#008300", dark: "#008300" },
    symbol: "diamond",
    cadenceMs: 5000,
    decimals: 1,
  },
  {
    type: "systolic_bp",
    label: "Systolic BP",
    shortLabel: "Sys",
    unit: "mmHg",
    normal: [90, 120],
    bounds: [60, 200],
    color: { light: "#4a3aa7", dark: "#9085e9" },
    symbol: "cross",
    cadenceMs: 5000,
    decimals: 0,
  },
  {
    type: "diastolic_bp",
    label: "Diastolic BP",
    shortLabel: "Dia",
    unit: "mmHg",
    normal: [60, 80],
    bounds: [30, 130],
    color: { light: "#e34948", dark: "#e66767" },
    symbol: "star",
    cadenceMs: 5000,
    decimals: 0,
  },
];

export const VITAL_BY_TYPE: ReadonlyMap<VitalType, VitalConfig> = new Map(
  VITALS.map((v) => [v.type, v]),
);

export type RangeStatus = "normal" | "high" | "low";

export function rangeStatus(config: VitalConfig, value: number): RangeStatus {
  if (value > config.normal[1]) return "high";
  if (value < config.normal[0]) return "low";
  return "normal";
}

/**
 * Index a raw value to "% of normal range": 0 = lower normal limit,
 * 100 = upper normal limit. This is what lets six vitals with incompatible
 * units share ONE y-axis in overlay mode (never a dual axis).
 */
export function toNormalIndex(config: VitalConfig, value: number): number {
  const [lo, hi] = config.normal;
  return ((value - lo) / (hi - lo)) * 100;
}

export function formatValue(config: VitalConfig, value: number): string {
  return value.toFixed(config.decimals);
}

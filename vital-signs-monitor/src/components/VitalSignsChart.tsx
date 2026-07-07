import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { scaleLinear, scaleTime, line as d3line, timeFormat } from "d3";
import type { ScaleLinear } from "d3";
import type { VitalConfig, VitalSample, VitalType } from "../vitals";
import { VITALS, formatValue, rangeStatus, toNormalIndex } from "../vitals";
import type { VitalSeries } from "../useVitalStream";
import { markerPath } from "./markers";

export type ChartMode = "overlay" | "split";

interface VitalSignsChartProps {
  series: VitalSeries;
  /** Right edge of the sliding window (epoch ms). */
  now: number;
  windowMs: number;
  mode: ChartMode;
  visible: ReadonlySet<VitalType>;
}

const MARGIN = { top: 14, right: 16, bottom: 30, left: 52 };
const OVERLAY_HEIGHT = 340;
const PANEL_HEIGHT = 96;
/** Strip at the top of each split panel reserved for its title (keeps titles off the data). */
const PANEL_TITLE_H = 18;
const PANEL_GAP = 12;
const fmtTime = timeFormat("%H:%M:%S");

interface HoverState {
  /** Time under the cursor (epoch ms). */
  t: number;
  yPx: number;
  via: "pointer" | "keyboard";
}

interface HoverRow {
  config: VitalConfig;
  sample: VitalSample;
}

/** Binary search for the sample nearest to time t. */
function nearestSample(samples: readonly VitalSample[], t: number): VitalSample | null {
  if (samples.length === 0) return null;
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].timestamp < t) lo = mid + 1;
    else hi = mid;
  }
  const after = samples[lo];
  const before = samples[lo - 1];
  if (!before) return after;
  return t - before.timestamp <= after.timestamp - t ? before : after;
}

/** Split a series into segments wherever the device went quiet (gap in data). */
function toSegments(samples: readonly VitalSample[], maxGapMs: number): VitalSample[][] {
  const segments: VitalSample[][] = [];
  let current: VitalSample[] = [];
  for (const s of samples) {
    if (current.length > 0 && s.timestamp - current[current.length - 1].timestamp > maxGapMs) {
      segments.push(current);
      current = [];
    }
    current.push(s);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

/** Render every nth marker (counted from the newest sample) to keep ≥ ~13px spacing. */
function markerStride(count: number, innerWidth: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, innerWidth / 13)));
}

export function VitalSignsChart({ series, now, windowMs, mode, visible }: VitalSignsChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hover, setHover] = useState<HoverState | null>(null);

  // Track container width (responsive chart).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth || 900);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const drawn = VITALS.filter((v) => visible.has(v.type) && (series.get(v.type)?.length ?? 0) > 0);
  const innerWidth = Math.max(50, width - MARGIN.left - MARGIN.right);
  const innerHeight =
    mode === "overlay"
      ? OVERLAY_HEIGHT
      : Math.max(1, drawn.length) * PANEL_HEIGHT + Math.max(0, drawn.length - 1) * PANEL_GAP;
  const height = innerHeight + MARGIN.top + MARGIN.bottom;

  const xScale = scaleTime()
    .domain([new Date(now - windowMs), new Date(now)])
    .range([0, innerWidth]);
  const xTicks = xScale.ticks(Math.max(2, Math.floor(innerWidth / 130)));

  // Overlay: one shared axis, each vital indexed to % of its normal range
  // (0 = lower limit, 100 = upper limit). Split: one panel + scale per vital.
  const overlayY = scaleLinear().domain([-75, 175]).range([innerHeight, 0]).clamp(true);
  const panels = useMemo(() => {
    if (mode !== "split") return new Map<VitalType, { y: ScaleLinear<number, number>; top: number }>();
    const map = new Map<VitalType, { y: ScaleLinear<number, number>; top: number }>();
    drawn.forEach((config, i) => {
      const samples = series.get(config.type) ?? [];
      let lo = config.normal[0];
      let hi = config.normal[1];
      for (const s of samples) {
        if (s.value < lo) lo = s.value;
        if (s.value > hi) hi = s.value;
      }
      const pad = (hi - lo) * 0.15 || 1;
      const top = i * (PANEL_HEIGHT + PANEL_GAP);
      const y = scaleLinear()
        .domain([Math.max(config.bounds[0], lo - pad), Math.min(config.bounds[1], hi + pad)])
        .range([top + PANEL_HEIGHT, top + PANEL_TITLE_H])
        .clamp(true);
      map.set(config.type, { y, top });
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, series, visible, innerHeight, drawn.length]);

  const yFor = (config: VitalConfig, sample: VitalSample): number =>
    mode === "overlay"
      ? overlayY(toNormalIndex(config, sample.value))
      : panels.get(config.type)?.y(sample.value) ?? 0;

  // ------------------------------------------------------------------ hover
  const hoverRows: HoverRow[] = useMemo(() => {
    if (!hover) return [];
    const rows: HoverRow[] = [];
    for (const config of drawn) {
      const sample = nearestSample(series.get(config.type) ?? [], hover.t);
      if (sample && Math.abs(sample.timestamp - hover.t) <= config.cadenceMs * 1.5 + 300) {
        rows.push({ config, sample });
      }
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, series, visible, mode]);

  // Crosshair snaps to the nearest actual sample time.
  const snapT = hoverRows.length
    ? hoverRows.reduce((best, r) =>
        Math.abs(r.sample.timestamp - hover!.t) < Math.abs(best - hover!.t) ? r.sample.timestamp : best,
      hoverRows[0].sample.timestamp)
    : hover?.t ?? null;

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - MARGIN.left;
    const py = e.clientY - rect.top - MARGIN.top;
    if (px < -8 || px > innerWidth + 8 || py < -8 || py > innerHeight + 8) {
      setHover(null);
      return;
    }
    setHover({ t: xScale.invert(px).getTime(), yPx: py, via: "pointer" });
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = (e.shiftKey ? 10 : 1) * 1000;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const base = hover?.t ?? now - 2000;
      const t = Math.min(now, Math.max(now - windowMs, base + (e.key === "ArrowLeft" ? -step : step)));
      setHover({ t, yPx: innerHeight / 3, via: "keyboard" });
    } else if (e.key === "Escape") {
      setHover(null);
    }
  };

  const clipId = useId();
  const snapX = snapT != null ? xScale(snapT) : null;
  const tooltipLeft =
    snapX == null ? 0 : snapX < innerWidth * 0.55 ? MARGIN.left + snapX + 18 : MARGIN.left + snapX - 18 - 264;
  const tooltipTop = hover ? Math.max(4, Math.min(MARGIN.top + hover.yPx - 20, height - 60)) : 0;

  // ----------------------------------------------------------------- render
  return (
    <div className="chart-container" ref={containerRef}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Vital signs over the last ${Math.round(windowMs / 1000)} seconds, ${mode} view. Use arrow keys to inspect values.`}
        tabIndex={0}
        onPointerMove={onPointerMove}
        onPointerLeave={() => hover?.via === "pointer" && setHover(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setHover(null)}
      >
        <defs>
          {/* Entering samples slide in from the left; clip them at the axis. */}
          <clipPath id={clipId}>
            <rect x={-1} y={-9} width={innerWidth + 10} height={innerHeight + 18} />
          </clipPath>
        </defs>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* normal-range band(s) */}
          {mode === "overlay" ? (
            <g>
              <rect
                x={0}
                y={overlayY(100)}
                width={innerWidth}
                height={overlayY(0) - overlayY(100)}
                className="normal-band"
              />
              <text x={innerWidth - 6} y={overlayY(100) + 14} textAnchor="end" className="band-label">
                normal range
              </text>
            </g>
          ) : (
            drawn.map((config) => {
              const p = panels.get(config.type);
              if (!p) return null;
              const [lo, hi] = config.normal;
              return (
                <rect
                  key={config.type}
                  x={0}
                  y={p.y(hi)}
                  width={innerWidth}
                  height={Math.max(0, p.y(lo) - p.y(hi))}
                  className="normal-band"
                />
              );
            })
          )}

          {/* y grid + axis */}
          {mode === "overlay" ? (
            <g>
              {[-50, 0, 50, 100, 150].map((v) => (
                <g key={v} transform={`translate(0,${overlayY(v)})`}>
                  <line x1={0} x2={innerWidth} className={v === 0 || v === 100 ? "gridline gridline-limit" : "gridline"} />
                  <text x={-8} dy="0.32em" textAnchor="end" className="axis-label">
                    {v}%
                  </text>
                </g>
              ))}
              <text transform={`translate(${-MARGIN.left + 14},${innerHeight / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">
                % of normal range
              </text>
            </g>
          ) : (
            drawn.map((config) => {
              const p = panels.get(config.type);
              if (!p) return null;
              return (
                <g key={config.type}>
                  {p.y.ticks(3).map((v) => (
                    <g key={v} transform={`translate(0,${p.y(v)})`}>
                      <line x1={0} x2={innerWidth} className="gridline" />
                      <text x={-8} dy="0.32em" textAnchor="end" className="axis-label">
                        {v}
                      </text>
                    </g>
                  ))}
                  <text x={4} y={p.top + 11} className="panel-title">
                    {config.label} ({config.unit})
                  </text>
                </g>
              );
            })
          )}

          {/* x axis */}
          <g transform={`translate(0,${innerHeight})`}>
            <line x1={0} x2={innerWidth} className="axis-baseline" />
            {xTicks.map((t) => (
              <g key={+t} transform={`translate(${xScale(t)},0)`}>
                <line y1={0} y2={-innerHeight} className="gridline gridline-x" />
                <line y1={0} y2={5} className="axis-baseline" />
                <text y={18} textAnchor="middle" className="axis-label">
                  {fmtTime(t)}
                </text>
              </g>
            ))}
          </g>

          {/* series: line + markers, out-of-range points ringed in the status color */}
          <g clipPath={`url(#${clipId})`}>
          {drawn.map((config) => {
            const samples = (series.get(config.type) ?? []).filter(
              (s) => s.timestamp >= now - windowMs - config.cadenceMs * 2 && s.timestamp <= now,
            );
            const color = `var(--series-${config.type})`;
            const gen = d3line<VitalSample>()
              .x((d) => xScale(d.timestamp))
              .y((d) => yFor(config, d));
            const stride = markerStride(samples.length, innerWidth);
            return (
              <g key={config.type}>
                {toSegments(samples, config.cadenceMs * 3.5).map((seg, i) => (
                  <path key={i} d={gen(seg) ?? undefined} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                ))}
                {samples.map((s, i) => {
                  if ((samples.length - 1 - i) % stride !== 0) return null;
                  const status = rangeStatus(config, s.value);
                  const cx = xScale(s.timestamp);
                  const cy = yFor(config, s);
                  const hovered = hoverRows.some((r) => r.sample === s);
                  return (
                    <g key={`${s.deviceId}-${s.timestamp}`} transform={`translate(${cx},${cy})`}>
                      {status !== "normal" && <circle r={7.5} className="oor-ring" />}
                      <path
                        d={markerPath(config.symbol, hovered ? 110 : 52)}
                        fill={color}
                        className="marker"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
          </g>

          {/* crosshair */}
          {snapX != null && hover && (
            <g transform={`translate(${snapX},0)`} pointerEvents="none">
              <line y1={0} y2={innerHeight} className="crosshair" />
            </g>
          )}
        </g>
      </svg>

      {drawn.length === 0 && <div className="chart-empty">Waiting for vital sign data…</div>}

      {hover && hoverRows.length > 0 && snapT != null && (
        <div className="tooltip" style={{ left: tooltipLeft, top: tooltipTop }} role="status">
          <div className="tooltip-time">{fmtTime(new Date(snapT))}</div>
          {hoverRows.map(({ config, sample }) => {
            const status = rangeStatus(config, sample.value);
            return (
              <div key={config.type} className="tooltip-row">
                <span className="tooltip-key" style={{ background: `var(--series-${config.type})` }} />
                <span className="tooltip-value">
                  {formatValue(config, sample.value)}
                  <span className="tooltip-unit"> {sample.unit}</span>
                </span>
                <span className="tooltip-label">{config.label}</span>
                {status !== "normal" && (
                  <span className={`status-chip status-${status}`}>{status === "high" ? "▲ HIGH" : "▼ LOW"}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

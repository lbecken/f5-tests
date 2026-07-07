import { useEffect, useRef, useState } from "react";
import type { VitalSample, VitalType } from "./vitals";
import { VITAL_BY_TYPE } from "./vitals";

export type VitalSeries = ReadonlyMap<VitalType, readonly VitalSample[]>;

interface StreamState {
  /** Per-vital samples, sorted by timestamp ascending, pruned to retainMs. */
  series: VitalSeries;
  /** Most recent sample per vital (for the numeric tiles). */
  latest: ReadonlyMap<VitalType, VitalSample>;
  connected: boolean;
}

/**
 * Subscribes to the multiplexed SSE feed and buckets samples per vital type.
 *
 * The transport is one stream of heterogeneous `VitalSample`s (the way a
 * device gateway would emit them); this hook is the only place that knows
 * about the wire format, so swapping SSE for a WebSocket or polling would
 * not touch the chart component.
 */
export function useVitalStream(url: string, retainMs: number): StreamState {
  const [state, setState] = useState<StreamState>({
    series: new Map(),
    latest: new Map(),
    connected: false,
  });
  // Mutable buffers; state snapshots are derived from them per batch.
  const buffers = useRef(new Map<VitalType, VitalSample[]>());

  useEffect(() => {
    const source = new EventSource(url);

    const onVitals = (event: MessageEvent<string>) => {
      let incoming: VitalSample[];
      try {
        const parsed: unknown = JSON.parse(event.data);
        incoming = (Array.isArray(parsed) ? parsed : [parsed]) as VitalSample[];
      } catch {
        return;
      }
      const cutoff = Date.now() - retainMs;
      const touched = new Set<VitalType>();
      for (const sample of incoming) {
        if (!VITAL_BY_TYPE.has(sample.type) || !Number.isFinite(sample.value)) continue;
        let bucket = buffers.current.get(sample.type);
        if (!bucket) {
          bucket = [];
          buffers.current.set(sample.type, bucket);
        }
        // Samples normally arrive in order; tolerate stragglers from
        // external producers by inserting before any newer entries.
        let i = bucket.length;
        while (i > 0 && bucket[i - 1].timestamp > sample.timestamp) i--;
        bucket.splice(i, 0, sample);
        touched.add(sample.type);
      }
      if (touched.size === 0) return;

      for (const [type, bucket] of buffers.current) {
        let drop = 0;
        while (drop < bucket.length && bucket[drop].timestamp < cutoff) drop++;
        if (drop > 0) bucket.splice(0, drop);
        if (drop > 0) touched.add(type);
      }

      setState((prev) => {
        const series = new Map(prev.series);
        const latest = new Map(prev.latest);
        for (const type of touched) {
          const bucket = buffers.current.get(type) ?? [];
          series.set(type, [...bucket]);
          const last = bucket[bucket.length - 1];
          if (last) latest.set(type, last);
        }
        return { series, latest, connected: true };
      });
    };

    const onOpen = () => setState((prev) => ({ ...prev, connected: true }));
    const onError = () => setState((prev) => ({ ...prev, connected: false }));

    source.addEventListener("vitals", onVitals);
    source.addEventListener("open", onOpen);
    source.addEventListener("error", onError);
    return () => {
      source.close();
      buffers.current = new Map();
    };
  }, [url, retainMs]);

  return state;
}

/**
 * A ticking "now" that drives the sliding window. Pausing freezes the clock
 * (data keeps buffering) so the reader can inspect the chart with the
 * pointer without the marks moving under it.
 */
export function useClock(paused: boolean, fps = 30): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (paused) return;
    setNow(Date.now());
    let raf = 0;
    let last = 0;
    const interval = 1000 / fps;
    const tick = (t: number) => {
      if (t - last >= interval) {
        last = t;
        setNow(Date.now());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, fps]);
  return now;
}

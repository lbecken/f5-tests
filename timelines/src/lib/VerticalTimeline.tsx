import type { CSSProperties } from 'react';
import { VERTICAL_PALETTE, resolveColor } from './palette';
import { useScrollFades } from './useScrollFades';
import './VerticalTimeline.css';

export interface VerticalTimelineItem {
  /** Text inside the pill badge, e.g. a year: "2006". */
  label: string;
  title?: string;
  description?: string;
  /** Optional color override. Omit to let the component pick one. */
  color?: string;
}

export interface VerticalTimelineProps {
  items: VerticalTimelineItem[];
  /** Replace the built-in palette. Item `color` still wins. */
  palette?: readonly string[];
  /**
   * Constrain the component's height (px or any CSS length). Content
   * beyond it scrolls inside the component, with edge-fade hints.
   */
  maxHeight?: number | string;
  className?: string;
  style?: CSSProperties;
}

/** Vertical center of the node circle, px from the top of its row. */
const NODE_Y = 24;

const mix = (a: string, b: string) => `color-mix(in oklab, ${a} 50%, ${b} 50%)`;

export function VerticalTimeline({
  items,
  palette = VERTICAL_PALETTE,
  maxHeight,
  className,
  style,
}: VerticalTimelineProps) {
  const { ref, fades } = useScrollFades<HTMLDivElement>('y');
  const colors = items.map((item, i) => resolveColor(item.color, i, palette));

  return (
    <div
      className={`vt${className ? ` ${className}` : ''}`}
      data-fade-start={fades.start || undefined}
      data-fade-end={fades.end || undefined}
      style={style}
    >
      <div
        className="vt-scroller"
        ref={ref}
        role="list"
        aria-label="Timeline"
        style={maxHeight != null ? { maxHeight, overflowY: 'auto' } : undefined}
        tabIndex={maxHeight != null ? 0 : undefined}
      >
        {colors.length > 0 && (
          <div className="vt-end vt-end--top" aria-hidden="true">
            <span className="vt-line" style={{ background: colors[0] }} />
          </div>
        )}
        {items.map((item, i) => {
          const color = colors[i];
          const right = i % 2 === 0;
          // The spine segment blends into the neighbours' colors so the
          // line reads as one continuous gradient across the whole timeline.
          const from = i === 0 ? color : mix(colors[i - 1], color);
          const to =
            i === items.length - 1 ? color : mix(color, colors[i + 1]);
          const gradient = `linear-gradient(to bottom, ${from} 0, ${color} ${NODE_Y}px, ${to} 100%)`;

          return (
            <section
              className={`vt-row vt-row--${right ? 'right' : 'left'}`}
              role="listitem"
              key={i}
              style={{ '--vt-c': color } as CSSProperties}
            >
              <div className="vt-spine" aria-hidden="true">
                <span className="vt-line" style={{ background: gradient }} />
                <span className="vt-node" />
              </div>
              <div className="vt-content">
                <div className="vt-leader">
                  <span className="vt-arrow" aria-hidden="true" />
                  <span className="vt-dots" aria-hidden="true" />
                  <span className="vt-badge">{item.label}</span>
                </div>
                {item.title && <h3 className="vt-title">{item.title}</h3>}
                {item.description && (
                  <p className="vt-desc">{item.description}</p>
                )}
              </div>
            </section>
          );
        })}
        {colors.length > 0 && (
          <div className="vt-end vt-end--bottom" aria-hidden="true">
            <span
              className="vt-line"
              style={{ background: colors[colors.length - 1] }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

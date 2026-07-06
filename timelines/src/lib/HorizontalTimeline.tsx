import type { CSSProperties, ReactNode } from 'react';
import { HORIZONTAL_PALETTE, resolveColor } from './palette';
import { useScrollFades } from './useScrollFades';
import './HorizontalTimeline.css';

export interface HorizontalTimelineItem {
  /** Text inside the circular node, e.g. a year: "2014". */
  label: string;
  /** Heading of the item's text block. Rendered in the item color. */
  title?: string;
  description?: string;
  /** Small icon rendered in a circled badge next to the text block. */
  icon?: ReactNode;
  /** Caption near the node. Defaults to "STEP 01", "STEP 02", … */
  step?: string;
  /** Optional color override. Omit to let the component pick one. */
  color?: string;
}

export interface HorizontalTimelineProps {
  items: HorizontalTimelineItem[];
  /** Replace the built-in palette. Item `color` still wins. */
  palette?: readonly string[];
  /** Hide the "STEP NN" captions entirely. */
  showSteps?: boolean;
  /** Width reserved per item, px. Content wraps within it. */
  itemWidth?: number;
  className?: string;
  style?: CSSProperties;
}

export function HorizontalTimeline({
  items,
  palette = HORIZONTAL_PALETTE,
  showSteps = true,
  itemWidth = 232,
  className,
  style,
}: HorizontalTimelineProps) {
  const { ref, fades } = useScrollFades<HTMLDivElement>('x');

  return (
    <div
      className={`ht${className ? ` ${className}` : ''}`}
      data-fade-start={fades.start || undefined}
      data-fade-end={fades.end || undefined}
      style={style}
    >
      <div className="ht-scroller" ref={ref} tabIndex={0} role="list" aria-label="Timeline">
        <div className="ht-cap ht-cap--start" aria-hidden="true">
          <span className="ht-cap-dot" />
        </div>
        {items.map((item, i) => {
          const color = resolveColor(item.color, i, palette);
          const below = i % 2 === 0;
          const step =
            item.step ?? `Step ${String(i + 1).padStart(2, '0')}`;
          const content = (item.title || item.description) && (
            <div className="ht-content">
              <span className="ht-branch" aria-hidden="true">
                <span className="ht-branch-ring" />
                <span className="ht-branch-line" />
              </span>
              {item.icon && (
                <span className="ht-icon" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <div className="ht-text">
                {item.title && <h4 className="ht-title">{item.title}</h4>}
                {item.description && (
                  <p className="ht-desc">{item.description}</p>
                )}
              </div>
            </div>
          );
          return (
            <div
              className={`ht-item ht-item--${below ? 'below' : 'above'}`}
              role="listitem"
              key={i}
              style={{ '--ht-c': color, width: itemWidth } as CSSProperties}
            >
              <div className="ht-cell ht-cell--top">
                {below ? showSteps && <span className="ht-step">{step}</span> : content}
              </div>
              <div className="ht-axis">
                <span className="ht-node">{item.label}</span>
              </div>
              <div className="ht-cell ht-cell--bottom">
                {below ? content : showSteps && <span className="ht-step">{step}</span>}
              </div>
            </div>
          );
        })}
        <div className="ht-cap ht-cap--end" aria-hidden="true">
          <span className="ht-cap-arrow" />
        </div>
      </div>
    </div>
  );
}

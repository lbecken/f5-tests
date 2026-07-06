import { HorizontalTimeline, VerticalTimeline } from './lib';
import type { HorizontalTimelineItem, VerticalTimelineItem } from './lib';
import {
  CheckIcon,
  DocumentIcon,
  EditIcon,
  ExportIcon,
  LayersIcon,
  LoginIcon,
  MegaphoneIcon,
  NetworkIcon,
  PillIcon,
  ShareIcon,
} from './demo/icons';
import './App.css';

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do ' +
  'eiusmod tempor incididunt ut labore et dolore magna aliqua.';

const icons = [
  DocumentIcon,
  LoginIcon,
  ShareIcon,
  EditIcon,
  MegaphoneIcon,
  PillIcon,
  NetworkIcon,
  CheckIcon,
  LayersIcon,
  ExportIcon,
];

const horizontalItems: HorizontalTimelineItem[] = Array.from(
  { length: 10 },
  (_, i) => ({
    label: String(2014 + i),
    title: 'Lorem ipsum dolor',
    description: LOREM,
    icon: icons[i % icons.length],
  }),
);

const verticalItems: VerticalTimelineItem[] = Array.from(
  { length: 8 },
  (_, i) => ({
    label: String(2006 + i * 3),
    title: 'Your Title Here',
    description:
      'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam ' +
      'nonummy nibh euismod tincidunt ut laoreet dolore magna.',
  }),
);

// Deliberately more items than the palette has colors, plus one explicit
// override, to show automatic assignment and the scroll-inside behaviour.
const manyItems: HorizontalTimelineItem[] = Array.from(
  { length: 16 },
  (_, i) => ({
    label: `Q${(i % 4) + 1} ’${18 + Math.floor(i / 4)}`,
    title: i === 5 ? 'Custom color' : 'Milestone',
    description: LOREM.slice(0, 90) + '…',
    icon: icons[i % icons.length],
    ...(i === 5 ? { color: '#e02c74' } : null),
  }),
);

export default function App() {
  return (
    <main className="page">
      <header className="page-header">
        <h1>Timeline components</h1>
        <p>
          Two React components — <code>&lt;HorizontalTimeline&gt;</code> and{' '}
          <code>&lt;VerticalTimeline&gt;</code>. Colors are assigned
          automatically from a validated palette; set <code>color</code> on an
          item to override.
        </p>
      </header>

      <section className="demo">
        <h2>Horizontal</h2>
        <HorizontalTimeline items={horizontalItems} />
      </section>

      <section className="demo">
        <h2>Vertical</h2>
        <div className="vertical-frame">
          <div className="vertical-heading">
            <h3>8-Steps Infographics</h3>
            <p>Infographics timeline</p>
          </div>
          <VerticalTimeline items={verticalItems} />
        </div>
      </section>

      <section className="demo">
        <h2>Overflow: scrolls inside the component</h2>
        <p className="demo-note">
          16 items in a constrained container — the horizontal timeline
          scrolls on its own axis with snap points and edge fades. One item
          sets an explicit <code>color</code>.
        </p>
        <HorizontalTimeline items={manyItems} itemWidth={210} />
        <p className="demo-note">
          The vertical timeline accepts <code>maxHeight</code> and scrolls
          inside once content exceeds it.
        </p>
        <div className="vertical-frame">
          <VerticalTimeline items={verticalItems} maxHeight={560} />
        </div>
      </section>
    </main>
  );
}

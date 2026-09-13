'use client';

import { useId, useMemo, useState } from 'react';
import { formatCount } from '@/lib/domain/format';
import type { ReactionTrend, TrendPoint } from '@/lib/services/timeline';

/**
 * How the two reaction totals grew over time.
 *
 * Both series share one zero-based axis. That is the honest arrangement: when
 * an artifact has forty times more Medals than Rotten Eggs, the two lines
 * should look forty times apart, and a second axis would hide exactly the fact
 * the chart exists to show. Colour is never the only difference between them —
 * Rotten Eggs are drawn solid and Medals dashed, and both lines are labelled.
 */

const VIEW_WIDTH = 720;
const VIEW_HEIGHT = 240;
const PADDING = { top: 18, right: 16, bottom: 26, left: 48 };

const PLOT_WIDTH = VIEW_WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = VIEW_HEIGHT - PADDING.top - PADDING.bottom;

export function ReactionTrendChart({ trend }: { trend: ReactionTrend }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const titleId = useId();
  const points = trend.points;

  const geometry = useMemo(() => build(points), [points]);

  if (points.length < 2 || !geometry) {
    return (
      <section className="panel p-5" aria-labelledby={titleId}>
        <Header titleId={titleId} trend={trend} />
        <p className="mt-4 text-sm leading-relaxed text-tertiary">
          Not enough history yet to draw a trend. The chart appears once this has been reacted to across more than one
          hour.
        </p>
      </section>
    );
  }

  const active = activeIndex === null ? null : points[activeIndex];
  const last = points[points.length - 1];

  const eggChange = last.cumulativeEggs - trend.openingEggs;
  const medalChange = last.cumulativeMedals - trend.openingMedals;

  return (
    <section className="panel p-5" aria-labelledby={titleId}>
      <Header titleId={titleId} trend={trend} />

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
        <Legend
          kind="egg"
          label="Rotten Eggs"
          total={last.cumulativeEggs}
          change={eggChange}
          opening={trend.openingEggs}
          value={active ? active.cumulativeEggs : null}
        />
        <Legend
          kind="medal"
          label="Medals"
          total={last.cumulativeMedals}
          change={medalChange}
          opening={trend.openingMedals}
          value={active ? active.cumulativeMedals : null}
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="h-[220px] w-full min-w-[520px] touch-pan-y"
          role="img"
          aria-label={`Rotten Eggs and Medals over time. Rotten Eggs ${formatCount(
            last.cumulativeEggs,
          )}, Medals ${formatCount(last.cumulativeMedals)}.`}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - box.left) / box.width;
            const x = ratio * VIEW_WIDTH - PADDING.left;
            const step = PLOT_WIDTH / Math.max(1, points.length - 1);
            const index = Math.round(x / step);
            setActiveIndex(Math.min(points.length - 1, Math.max(0, index)));
          }}
          onPointerLeave={() => setActiveIndex(null)}
        >
          {geometry.gridLines.map((line) => (
            <g key={line.value}>
              <line
                x1={PADDING.left}
                x2={VIEW_WIDTH - PADDING.right}
                y1={line.y}
                y2={line.y}
                stroke="var(--border-subtle)"
                strokeWidth="1"
              />
              <text
                x={PADDING.left - 8}
                y={line.y + 3.5}
                textAnchor="end"
                className="numeric"
                fontSize="10"
                fill="var(--color-tertiary)"
              >
                {formatCount(line.value)}
              </text>
            </g>
          ))}

          {geometry.ticks.map((tick) => (
            <text
              key={tick.at}
              x={tick.x}
              y={VIEW_HEIGHT - 8}
              textAnchor={tick.anchor}
              fontSize="10"
              fill="var(--color-tertiary)"
              /* Formatted in the viewer's own timezone, which the server cannot know. */
              suppressHydrationWarning
            >
              {formatBucket(tick.at, trend.resolution)}
            </text>
          ))}

          {/* Medals dashed, Rotten Eggs solid — the shapes differ, not only the colour. */}
          <path
            d={geometry.medalPath}
            fill="none"
            stroke="var(--color-medal)"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={geometry.eggPath}
            fill="none"
            stroke="var(--color-egg)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {active && activeIndex !== null && (
            <g>
              <line
                x1={geometry.x(activeIndex)}
                x2={geometry.x(activeIndex)}
                y1={PADDING.top}
                y2={PADDING.top + PLOT_HEIGHT}
                stroke="var(--border-strong)"
                strokeWidth="1"
              />
              <circle
                cx={geometry.x(activeIndex)}
                cy={geometry.y(active.cumulativeMedals)}
                r="3.5"
                fill="var(--color-medal)"
              />
              <circle
                cx={geometry.x(activeIndex)}
                cy={geometry.y(active.cumulativeEggs)}
                r="3.5"
                fill="var(--color-egg)"
              />
            </g>
          )}
        </svg>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-tertiary" suppressHydrationWarning>
        {active
          ? `${formatBucket(active.at, trend.resolution, true)} — ${formatCount(active.cumulativeEggs)} Rotten Eggs, ${formatCount(
              active.cumulativeMedals,
            )} Medals in total.`
          : 'Running totals, on one shared scale. Hover the chart to read a point.'}
      </p>

      {/* The same figures, reachable without seeing the drawing. */}
      <table className="sr-only">
        <caption>Rotten Eggs and Medals received over time</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Rotten Eggs in total</th>
            <th scope="col">Medals in total</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.at}>
              <th scope="row" suppressHydrationWarning>
                {formatBucket(point.at, trend.resolution, true)}
              </th>
              <td>{point.cumulativeEggs}</td>
              <td>{point.cumulativeMedals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Header({ titleId, trend }: { titleId: string; trend: ReactionTrend }) {
  const span = trend.points.length;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={titleId} className="text-sm font-medium text-primary">
        Reaction trend
      </h2>
      {span > 1 && (
        <p className="text-xs text-tertiary">
          {trend.resolution === 'hour' ? `Last ${span} hours` : `Last ${span} days`}
        </p>
      )}
    </div>
  );
}

function Legend({
  kind,
  label,
  total,
  change,
  opening,
  value,
}: {
  kind: 'egg' | 'medal';
  label: string;
  total: number;
  change: number;
  /** The running total as the window opened; zero when the chart covers everything. */
  opening: number;
  /** The hovered point, when the pointer is over the chart. */
  value: number | null;
}) {
  // Saying "+23,844 in this window" beside a total of 23,844 tells the reader
  // nothing they cannot already see.
  const caption =
    change === 0
      ? 'No change in this window'
      : opening === 0
        ? 'All of it in this window'
        : `+${formatCount(change)} in this window`;

  return (
    <div>
      <div className="flex items-center gap-2">
        <svg width="18" height="8" aria-hidden="true">
          <line
            x1="0"
            y1="4"
            x2="18"
            y2="4"
            stroke={kind === 'egg' ? 'var(--color-egg)' : 'var(--color-medal)'}
            strokeWidth="2"
            strokeDasharray={kind === 'medal' ? '5 4' : undefined}
          />
        </svg>
        <span className="text-xs text-secondary">
          <span className="emoji mr-1 text-[0.7rem]">{kind === 'egg' ? '🥚' : '🏅'}</span>
          {label}
        </span>
      </div>
      <p className={`numeric mt-1 text-lg font-semibold ${kind === 'egg' ? 'text-egg' : 'text-medal'}`}>
        {formatCount(value ?? total)}
      </p>
      <p className="mt-0.5 text-xs text-tertiary">{caption}</p>
    </div>
  );
}

interface Geometry {
  eggPath: string;
  medalPath: string;
  gridLines: Array<{ value: number; y: number }>;
  ticks: Array<{ at: string; x: number; anchor: 'start' | 'middle' | 'end' }>;
  x: (index: number) => number;
  y: (value: number) => number;
}

/**
 * Both series are measured against one zero-based axis, so the distance between
 * the lines is the real difference between the two totals.
 */
function build(points: TrendPoint[]): Geometry | null {
  if (points.length < 2) return null;

  const maximum = Math.max(
    1,
    ...points.map((point) => Math.max(point.cumulativeEggs, point.cumulativeMedals)),
  );
  const ceiling = niceCeiling(maximum);

  const x = (index: number) => PADDING.left + (index / (points.length - 1)) * PLOT_WIDTH;
  const y = (value: number) => PADDING.top + PLOT_HEIGHT - (value / ceiling) * PLOT_HEIGHT;

  const line = (pick: (point: TrendPoint) => number) =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(pick(point)).toFixed(1)}`).join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    value: Math.round(ceiling * fraction),
    y: PADDING.top + PLOT_HEIGHT - fraction * PLOT_HEIGHT,
  }));

  const tickIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const ticks = tickIndexes.map((index, position) => ({
    at: points[index].at,
    x: x(index),
    anchor: (position === 0 ? 'start' : position === tickIndexes.length - 1 ? 'end' : 'middle') as
      | 'start'
      | 'middle'
      | 'end',
  }));

  return {
    eggPath: line((point) => point.cumulativeEggs),
    medalPath: line((point) => point.cumulativeMedals),
    gridLines,
    ticks,
    x,
    y,
  };
}

/** Rounds the axis top up to something a person would choose. */
function niceCeiling(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

function formatBucket(iso: string, resolution: 'hour' | 'day', long = false): string {
  const date = new Date(iso);
  if (resolution === 'hour') {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      ...(long ? { minute: '2-digit', month: 'short', day: 'numeric' } : {}),
    });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(long ? { year: 'numeric' } : {}) });
}

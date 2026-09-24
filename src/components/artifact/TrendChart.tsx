'use client';

import { useId, useMemo, useState } from 'react';
import { formatCount } from '@/lib/domain/format';
import type { Trend, TrendPoint } from '@/lib/services/timeline';
import type { TrendStep } from '@/lib/domain/trend-ranges';

/**
 * One running-total chart, drawn for either kind of history.
 *
 * The component is deliberately ignorant of whether it is showing taps or
 * people: it is handed a series, the words for each line, and what a point
 * means, and it labels all three. That ignorance is the safeguard — there is no
 * code path in which a reaction series and an opinion series could end up
 * sharing an axis, because a chart only ever receives one of them.
 *
 * Within a chart both lines do share one zero-based axis, which is the honest
 * arrangement for two series of the same unit: when one is forty times the
 * other, they should look forty times apart. Colour is never the only
 * difference — the negative line is solid and heavy, the positive dashed and
 * lighter, and both are labelled.
 *
 * The axis labels are HTML positioned around the plot rather than SVG text, so
 * they stay at a fixed readable size however wide the card gets.
 */

/* The plot box, in the SVG's own units. The card scales it; text does not. */
const VIEW = { width: 1000, height: 260 };
const PLOT = { x0: 6, x1: 988, y0: 18, y1: 242 };
/** Matches the HTML gutters reserved for the axis labels around the plot. */
const AXIS = { left: 50, bottom: 26 };

export interface TrendChartProps {
  trend: Trend;
  title: string;
  /** One line on what a point counts. Required: the unit is the whole point. */
  unitNote: string;
  negativeLabel: string;
  positiveLabel: string;
  /** Live lifetime figures, so the tail lands on the numbers beside it. */
  liveNegative: number;
  livePositive: number;
  emptyNote: string;
}

export function TrendChart({
  trend,
  title,
  unitNote,
  negativeLabel,
  positiveLabel,
  liveNegative,
  livePositive,
  emptyNote,
}: TrendChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const titleId = useId();

  /*
   * The series is drawn from the server's history, but its final point is the
   * artifact's lifetime total — which the reaction store keeps current as taps
   * arrive, from this browser and from everyone else's. Rebuilding that last
   * point from the live figure keeps the line ending exactly on the number
   * printed beside it, without refetching the whole history for every tap.
   */
  const points = useMemo(
    () => withLiveTail(trend.points, liveNegative, livePositive),
    [trend.points, liveNegative, livePositive],
  );

  const geometry = useMemo(() => build(points), [points]);

  const active = activeIndex === null || !points[activeIndex] ? null : points[activeIndex];
  const last = points.length > 0 ? points[points.length - 1] : null;

  const negativeValue = active ? active.cumulativeNegative : (last?.cumulativeNegative ?? liveNegative);
  const positiveValue = active ? active.cumulativePositive : (last?.cumulativePositive ?? livePositive);

  const noun = trend.measures === 'people' ? 'people' : 'reactions';

  const readout = active
    ? `${formatBucket(active.at, trend.resolution, true)} — ${formatCount(
        active.cumulativeNegative,
      )} ${negativeLabel.toLowerCase()} / ${formatCount(active.cumulativePositive)} ${positiveLabel.toLowerCase()}`
    : unitNote;

  /** Moving the highlight with the keyboard, for anyone not using a pointer. */
  const step = (delta: number) => {
    if (points.length === 0) return;
    setActiveIndex((current) => {
      const next = (current ?? points.length - 1) + delta;
      return Math.min(points.length - 1, Math.max(0, next));
    });
  };

  return (
    <section
      className="paper min-w-[min(100%,300px)] flex-[1_1_440px] p-[clamp(18px,2.2vw,32px)]"
      aria-labelledby={titleId}
    >
      <h3 id={titleId} className="display-sm m-0 text-[clamp(19px,2.1vw,28px)]">
        {title}
      </h3>
      <div
        className="mt-2 min-h-[2.6em] text-[12.5px] font-medium leading-[1.4] text-[rgb(23_20_15_/_0.62)]"
        suppressHydrationWarning
      >
        {readout}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-[18px] gap-y-2">
        <LegendItem kind="negative" label={negativeLabel} value={negativeValue} />
        <LegendItem kind="positive" label={positiveLabel} value={positiveValue} />
        {/*
         * The grain, not the range: the range is already in the picker, and a
         * young artifact on "5Y" starts where its history does, so "last five
         * years" would describe an axis the chart is not drawing.
         */}
        {points.length > 1 && (
          <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-[rgb(23_20_15_/_0.62)]">
            {points.length} {STEP_NOUN[trend.resolution]}
            {points.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {!geometry ? (
        <p className="mt-6 max-w-[48ch] text-[13.5px] leading-relaxed text-[rgb(23_20_15_/_0.66)]">{emptyNote}</p>
      ) : (
        <div
          className="relative mt-[clamp(14px,1.8vw,22px)]"
          style={{ padding: `0 0 ${AXIS.bottom}px ${AXIS.left}px` }}
        >
          <svg
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            className="block h-auto w-full touch-pan-y overflow-visible"
            role="img"
            tabIndex={0}
            aria-label={`${title}. ${unitNote} ${negativeLabel} ${formatCount(
              last?.cumulativeNegative ?? 0,
            )}, ${positiveLabel} ${formatCount(
              last?.cumulativePositive ?? 0,
            )}. Use the left and right arrow keys to read individual points; the full figures follow in a table.`}
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const ratio = (event.clientX - box.left) / box.width;
              const x = ratio * VIEW.width - PLOT.x0;
              const width = (PLOT.x1 - PLOT.x0) / Math.max(1, points.length - 1);
              const index = Math.round(x / width);
              setActiveIndex(Math.min(points.length - 1, Math.max(0, index)));
            }}
            onPointerLeave={() => setActiveIndex(null)}
            onBlur={() => setActiveIndex(null)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                step(1);
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                step(-1);
              } else if (event.key === 'Escape') {
                setActiveIndex(null);
              }
            }}
          >
            {geometry.gridLines.map((line) => (
              <line
                key={line.value}
                x1="0"
                x2={PLOT.x1 - 6}
                y1={line.y}
                y2={line.y}
                stroke="#17140F"
                strokeWidth="1"
                opacity="0.18"
              />
            ))}

            {/* The baseline is drawn heavier than the grid — it is the zero. */}
            <line x1="0" x2={PLOT.x1 - 6} y1={PLOT.y1} y2={PLOT.y1} stroke="#17140F" strokeWidth="2" />

            {/*
             * Green for the good direction, red for the bad one, both solid.
             * Red and green are the one pair a colourblind reader is most
             * likely to confuse, so the difference is carried twice over: the
             * negative line is drawn heavier, and the readout marks it with a
             * circle against the positive line's square.
             */}
            <polyline
              points={geometry.positiveLine}
              fill="none"
              stroke="var(--color-series-positive)"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={geometry.negativeLine}
              fill="none"
              stroke="var(--color-series-negative)"
              strokeWidth="6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {active && activeIndex !== null && (
              <g>
                <line
                  x1={geometry.x(activeIndex)}
                  x2={geometry.x(activeIndex)}
                  y1={PLOT.y0}
                  y2={PLOT.y1}
                  stroke="#17140F"
                  strokeWidth="1.5"
                  opacity="0.5"
                />
                <rect
                  x={geometry.x(activeIndex) - 7}
                  y={geometry.y(active.cumulativePositive) - 7}
                  width="14"
                  height="14"
                  fill="var(--color-series-positive)"
                  stroke="#17140F"
                  strokeWidth="2.5"
                />
                <circle
                  cx={geometry.x(activeIndex)}
                  cy={geometry.y(active.cumulativeNegative)}
                  r="8"
                  fill="var(--color-series-negative)"
                  stroke="#17140F"
                  strokeWidth="2.5"
                />
              </g>
            )}
          </svg>

          {/* Axis labels live outside the SVG so they never scale with it. */}
          <div className="absolute left-0 top-0 w-[42px]" style={{ bottom: AXIS.bottom }} aria-hidden="true">
            {geometry.gridLines.map((line) => (
              <span
                key={line.value}
                className="numeric absolute right-0 -translate-y-1/2 text-[12px] font-semibold leading-none text-[rgb(23_20_15_/_0.62)]"
                style={{ top: `${((line.y / VIEW.height) * 100).toFixed(2)}%` }}
              >
                {formatCount(line.value)}
              </span>
            ))}
          </div>

          <div
            className="absolute bottom-0 right-0 flex justify-between text-[12px] font-semibold leading-none text-[rgb(23_20_15_/_0.62)]"
            style={{ left: AXIS.left }}
            aria-hidden="true"
          >
            {geometry.ticks.map((tick) => (
              <span key={tick.at} suppressHydrationWarning>
                {formatBucket(tick.at, trend.resolution)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* The same figures, reachable without seeing the drawing. */}
      <table className="sr-only">
        <caption>
          {title}. {unitNote}
        </caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">
              {negativeLabel} in total ({noun})
            </th>
            <th scope="col">
              {positiveLabel} in total ({noun})
            </th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.at}>
              <th scope="row" suppressHydrationWarning>
                {formatBucket(point.at, trend.resolution, true)}
              </th>
              <td>{point.cumulativeNegative}</td>
              <td>{point.cumulativePositive}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function LegendItem({
  kind,
  label,
  value,
}: {
  kind: 'negative' | 'positive';
  label: string;
  value: number;
}) {
  const isNegative = kind === 'negative';
  return (
    <div className="flex items-center gap-2">
      {/* The swatch matches the stroke it stands for, weight included. */}
      <span
        aria-hidden="true"
        className={`w-[26px] flex-none ${isNegative ? 'h-[6px]' : 'h-[4px]'}`}
        style={{
          background: isNegative ? 'var(--color-series-negative)' : 'var(--color-series-positive)',
        }}
      />
      <span className="whitespace-nowrap text-[11.5px] font-bold uppercase leading-none tracking-[0.06em]">
        {label} <span className="numeric">{formatCount(value)}</span>
      </span>
    </div>
  );
}

/**
 * Replaces the closing point with the totals as they stand now.
 *
 * Only the tail moves: everything before it is recorded history and does not
 * change. The difference lands in the final bucket, which is where activity
 * arriving right now genuinely belongs.
 */
function withLiveTail(points: TrendPoint[], negative: number, positive: number): TrendPoint[] {
  if (points.length === 0) return points;

  const last = points[points.length - 1];
  if (last.cumulativeNegative === negative && last.cumulativePositive === positive) return points;

  return [
    ...points.slice(0, -1),
    {
      ...last,
      negative: Math.max(0, last.negative + (negative - last.cumulativeNegative)),
      positive: Math.max(0, last.positive + (positive - last.cumulativePositive)),
      cumulativeNegative: negative,
      cumulativePositive: positive,
    },
  ];
}

interface Geometry {
  negativeLine: string;
  positiveLine: string;
  gridLines: Array<{ value: number; y: number }>;
  ticks: Array<{ at: string }>;
  x: (index: number) => number;
  y: (value: number) => number;
}

/**
 * Both series are measured against one zero-based axis, so the distance between
 * the lines is the real difference between the two totals.
 */
function build(points: TrendPoint[]): Geometry | null {
  if (points.length < 2) return null;

  const maximum = Math.max(1, ...points.map((point) => Math.max(point.cumulativeNegative, point.cumulativePositive)));
  const { ceiling, lines } = axisFor(maximum);

  const x = (index: number) => PLOT.x0 + (index / (points.length - 1)) * (PLOT.x1 - PLOT.x0);
  const y = (value: number) => PLOT.y1 - (value / ceiling) * (PLOT.y1 - PLOT.y0);

  const line = (pick: (point: TrendPoint) => number) =>
    points.map((point, index) => `${x(index).toFixed(1)},${y(pick(point)).toFixed(1)}`).join(' ');

  const gridLines = lines.map((value) => ({ value, y: y(value) }));

  /*
   * First, middle, last — deduplicated, because a two-point series makes the
   * middle the same as the first and React will not accept two children under
   * one key.
   */
  const ticks = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].map((index) => ({
    at: points[index].at,
  }));

  return {
    negativeLine: line((point) => point.cumulativeNegative),
    positiveLine: line((point) => point.cumulativePositive),
    gridLines,
    ticks,
    x,
    y,
  };
}

/**
 * The axis top and its gridlines, in whole numbers.
 *
 * Both series count whole things — people or taps — so a gridline at 0.25 of
 * a person is meaningless, and rounding it for display produced the labels
 * "0, 0, 1, 1, 1" on a chart that topped out at one person. Small maximums get
 * one line per unit; larger ones get four equal steps, each a whole, round
 * number, so every label is exactly the value its line sits at.
 */
function axisFor(maximum: number): { ceiling: number; lines: number[] } {
  if (maximum <= 4) {
    const ceiling = Math.max(1, Math.ceil(maximum));
    return { ceiling, lines: Array.from({ length: ceiling + 1 }, (_, index) => index) };
  }
  const step = Math.ceil(niceCeiling(maximum / 4));
  return { ceiling: step * 4, lines: [0, 1, 2, 3, 4].map((index) => index * step) };
}

/** Rounds a value up to something a person would choose. */
function niceCeiling(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

const STEP_NOUN: Record<TrendStep, string> = { hour: 'hour', day: 'day', week: 'week', month: 'month' };

function formatBucket(iso: string, resolution: TrendStep, long = false): string {
  const date = new Date(iso);
  if (resolution === 'hour') {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      ...(long ? { minute: '2-digit', month: 'short', day: 'numeric' } : {}),
    });
  }
  if (resolution === 'month') {
    const month = date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
    // "Sep 26" reads as the 26th of September; the apostrophe makes it a year.
    return long ? `${month} ${date.getUTCFullYear()}` : `${month} ’${String(date.getUTCFullYear()).slice(2)}`;
  }
  const label = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...(long ? { year: 'numeric' } : {}),
  });
  return long && resolution === 'week' ? `Week of ${label}` : label;
}

'use client';

import { useId, useMemo, useState } from 'react';
import { formatCount } from '@/lib/domain/format';
import { useArtifact } from '@/components/reactions/useArtifact';
import type { ReactionTrend, TrendPoint } from '@/lib/services/timeline';
import type { ArtifactTotals, ArtifactType } from '@/lib/domain/types';

/**
 * How the two reaction totals grew over time.
 *
 * Both series share one zero-based axis. That is the honest arrangement: when
 * an artifact has forty times more Medals than Rotten Eggs, the two lines
 * should look forty times apart, and a second axis would hide exactly the fact
 * the chart exists to show. Colour is never the only difference between them —
 * Rotten Eggs are drawn solid and heavy, Medals dashed and lighter, and both
 * are labelled.
 *
 * The axis labels are HTML positioned around the plot rather than SVG text, so
 * they stay at a fixed readable size however wide the card gets.
 */

/* The plot box, in the SVG's own units. The card scales it; text does not. */
const VIEW = { width: 1000, height: 270 };
const PLOT = { x0: 6, x1: 988, y0: 18, y1: 252 };
/** Matches the HTML gutters reserved for the axis labels around the plot. */
const AXIS = { left: 52, bottom: 26 };

export function ReactionTrendChart({
  trend,
  artifactType,
  artifactId,
  totals,
}: {
  trend: ReactionTrend;
  artifactType: ArtifactType;
  artifactId: string;
  totals: ArtifactTotals;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const titleId = useId();

  /*
   * The series is drawn from the server's history, but its final point is the
   * artifact's lifetime total — which the reaction store keeps current as taps
   * arrive, from this browser and from everyone else's. Rebuilding that last
   * point from the live figure keeps the line ending exactly on the number
   * printed beside it, without refetching the whole history for every tap.
   */
  const live = useArtifact(artifactType, artifactId, { totals });

  const points = useMemo(
    () => withLiveTail(trend.points, live.totals.rottenEggTotal, live.totals.medalTotal),
    [trend.points, live.totals.rottenEggTotal, live.totals.medalTotal],
  );

  const geometry = useMemo(() => build(points), [points]);

  const active = activeIndex === null || !points[activeIndex] ? null : points[activeIndex];
  const last = points.length > 0 ? points[points.length - 1] : null;

  const eggValue = active ? active.cumulativeEggs : (last?.cumulativeEggs ?? live.totals.rottenEggTotal);
  const medalValue = active ? active.cumulativeMedals : (last?.cumulativeMedals ?? live.totals.medalTotal);

  const readout = active
    ? `${formatBucket(active.at, trend.resolution, true)} — ${formatCount(active.cumulativeEggs)} eggs / ${formatCount(
        active.cumulativeMedals,
      )} medals`
    : 'hover the chart to read a point';

  return (
    <section className="paper p-[clamp(20px,2.6vw,40px)]" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id={titleId} className="display-sm m-0 text-[clamp(24px,2.8vw,40px)]">
            Reaction trend
          </h2>
          <div
            className="mt-2 text-[13px] font-medium leading-[1.5] text-[rgb(23_20_15_/_0.6)]"
            suppressHydrationWarning
          >
            Running totals on one shared scale · {readout}
          </div>
        </div>

        <div className="flex flex-none flex-wrap gap-[18px]">
          <LegendItem kind="egg" value={eggValue} />
          <LegendItem kind="medal" value={medalValue} />
          {points.length > 1 && (
            <span className="text-[11.5px] font-semibold uppercase leading-none tracking-[0.08em] text-[rgb(23_20_15_/_0.62)]">
              {trend.resolution === 'hour' ? `Last ${points.length} hours` : `Last ${points.length} days`}
            </span>
          )}
        </div>
      </div>

      {!geometry ? (
        <p className="mt-6 max-w-[60ch] text-sm leading-relaxed text-[rgb(23_20_15_/_0.66)]">
          Not enough history yet to draw a trend. The chart appears once this has been reacted to across more than one
          hour.
        </p>
      ) : (
        <div
          className="relative mt-[clamp(18px,2.2vw,28px)]"
          style={{ padding: `0 0 ${AXIS.bottom}px ${AXIS.left}px` }}
        >
          <svg
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            className="block h-auto w-full touch-pan-y overflow-visible"
            role="img"
            aria-label={`Rotten Eggs and Medals over time. Rotten Eggs ${formatCount(
              last?.cumulativeEggs ?? 0,
            )}, Medals ${formatCount(last?.cumulativeMedals ?? 0)}.`}
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const ratio = (event.clientX - box.left) / box.width;
              const x = ratio * VIEW.width - PLOT.x0;
              const step = (PLOT.x1 - PLOT.x0) / Math.max(1, points.length - 1);
              const index = Math.round(x / step);
              setActiveIndex(Math.min(points.length - 1, Math.max(0, index)));
            }}
            onPointerLeave={() => setActiveIndex(null)}
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

            {/* Medals dashed, Rotten Eggs solid — the shapes differ, not only the colour. */}
            <polyline
              points={geometry.medalLine}
              fill="none"
              stroke="var(--color-medal-line)"
              strokeWidth="4"
              strokeDasharray="14 10"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={geometry.eggLine}
              fill="none"
              stroke="var(--color-egg)"
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
                <circle
                  cx={geometry.x(activeIndex)}
                  cy={geometry.y(active.cumulativeMedals)}
                  r="7"
                  fill="var(--color-medal)"
                  stroke="#17140F"
                  strokeWidth="2.5"
                />
                <circle
                  cx={geometry.x(activeIndex)}
                  cy={geometry.y(active.cumulativeEggs)}
                  r="8"
                  fill="var(--color-egg)"
                  stroke="#17140F"
                  strokeWidth="2.5"
                />
              </g>
            )}
          </svg>

          {/* Axis labels live outside the SVG so they never scale with it. */}
          <div className="absolute left-0 top-0 w-[44px]" style={{ bottom: AXIS.bottom }} aria-hidden="true">
            {geometry.gridLines.map((line) => (
              <span
                key={line.value}
                className="numeric absolute right-0 -translate-y-1/2 text-[13px] font-semibold leading-none text-[rgb(23_20_15_/_0.62)]"
                style={{ top: `${((line.y / VIEW.height) * 100).toFixed(2)}%` }}
              >
                {formatCount(line.value)}
              </span>
            ))}
          </div>

          <div
            className="absolute right-0 bottom-0 flex justify-between text-[13px] font-semibold leading-none text-[rgb(23_20_15_/_0.62)]"
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

function LegendItem({ kind, value }: { kind: 'egg' | 'medal'; value: number }) {
  const isEgg = kind === 'egg';
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="h-[5px] w-[26px] flex-none"
        style={
          isEgg
            ? { background: 'var(--color-egg)' }
            : {
                background: 'repeating-linear-gradient(90deg, var(--color-medal-line) 0 7px, transparent 7px 12px)',
              }
        }
      />
      <span className="whitespace-nowrap text-xs font-bold uppercase leading-none tracking-[0.06em]">
        {isEgg ? 'Eggs' : 'Medals'} <span className="numeric">{formatCount(value)}</span>
      </span>
    </div>
  );
}

/**
 * Replaces the closing point with the totals as they stand now.
 *
 * Only the tail moves: everything before it is recorded history and does not
 * change. The difference lands in the final bucket, which is where reactions
 * arriving right now genuinely belong.
 */
function withLiveTail(points: TrendPoint[], eggs: number, medals: number): TrendPoint[] {
  if (points.length === 0) return points;

  const last = points[points.length - 1];
  if (last.cumulativeEggs === eggs && last.cumulativeMedals === medals) return points;

  return [
    ...points.slice(0, -1),
    {
      ...last,
      eggs: Math.max(0, last.eggs + (eggs - last.cumulativeEggs)),
      medals: Math.max(0, last.medals + (medals - last.cumulativeMedals)),
      cumulativeEggs: eggs,
      cumulativeMedals: medals,
    },
  ];
}

interface Geometry {
  eggLine: string;
  medalLine: string;
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

  const maximum = Math.max(1, ...points.map((point) => Math.max(point.cumulativeEggs, point.cumulativeMedals)));
  const ceiling = niceCeiling(maximum);

  const x = (index: number) => PLOT.x0 + (index / (points.length - 1)) * (PLOT.x1 - PLOT.x0);
  const y = (value: number) => PLOT.y1 - (value / ceiling) * (PLOT.y1 - PLOT.y0);

  const line = (pick: (point: TrendPoint) => number) =>
    points.map((point, index) => `${x(index).toFixed(1)},${y(pick(point)).toFixed(1)}`).join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    value: Math.round(ceiling * fraction),
    y: PLOT.y1 - fraction * (PLOT.y1 - PLOT.y0),
  }));

  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1].map((index) => ({
    at: points[index].at,
  }));

  return {
    eggLine: line((point) => point.cumulativeEggs),
    medalLine: line((point) => point.cumulativeMedals),
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
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(long ? { year: 'numeric' } : {}),
  });
}

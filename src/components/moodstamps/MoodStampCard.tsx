import Image from 'next/image';
import Link from 'next/link';
import { EggIcon, MedalIcon } from '@/components/ui/icons';
import { formatCount } from '@/lib/domain/format';
import {
  formatMoodStampDate,
  moodStampHref,
  reactionIntent,
  reactionLabel,
  type MoodStampSummary,
} from '@/lib/moodstamps/types';
import { ArrowRightIcon } from './icons';

/**
 * One MoodStamp on the board: a collectible, not a message row.
 *
 * The top is the stamp itself, cropped — its tone (gold for Medals, carrot
 * orange for Rotten Eggs), the feeling in display type, and how many. Real
 * artwork replaces the typeset crop once it exists. Below it, on paper, is who
 * it is from or to, when, and whether it has been opened.
 *
 * Every signal is in words as well as colour: the reaction is named, the
 * opened state is a labelled badge, and anonymity is written out.
 */
export function MoodStampCard({ stamp }: { stamp: MoodStampSummary }) {
  const tone = stamp.reaction === 'medal' ? 'tone-medal' : 'tone-egg';
  const reaction = reactionLabel(stamp.reaction, stamp.quantity);
  const received = stamp.direction === 'received';
  const counterpart = received
    ? stamp.anonymous || !stamp.counterpartName
      ? 'Anonymous'
      : stamp.counterpartName
    : (stamp.counterpartName ?? 'Someone');
  const summary = `${stamp.emotion}, ${formatCount(stamp.quantity)} ${reaction} ${received ? 'from' : 'to'} ${counterpart}`;

  return (
    <article className={`card-brutal ${tone} flex w-full flex-col bg-[var(--color-paper)] text-[color:var(--color-ink)]`}>
      <div className="ms-stamp">
        {stamp.artworkUrl ? (
          <Image
            src={stamp.artworkUrl}
            alt=""
            fill
            sizes="(min-width: 1200px) 30vw, (min-width: 640px) 45vw, 92vw"
            className="object-cover object-top"
          />
        ) : (
          <StampCrop stamp={stamp} reaction={reaction} />
        )}
      </div>

      <div className="on-paper flex flex-1 flex-col gap-3.5 border-t-2 border-[var(--color-ink)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-primary">
            {stamp.reaction === 'medal' ? <MedalIcon size={15} /> : <EggIcon size={15} />}
            {reactionIntent(stamp.reaction)}
          </span>
          <StatusBadge stamp={stamp} />
        </div>

        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="eyebrow">{received ? 'From' : 'To'}</span>
          <span className="min-w-0 truncate text-[17px] font-extrabold text-primary">{counterpart}</span>
          {stamp.anonymous && (
            <span className="border border-[var(--rule-strong)] px-1.5 py-1 text-[10.5px] font-bold uppercase leading-none tracking-[0.1em] text-secondary">
              {received ? 'Name hidden' : 'Sent anonymously'}
            </span>
          )}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--rule-subtle)] pt-3">
          <p className="text-[12.5px] font-semibold text-secondary">
            {received ? 'Received' : 'Sent'}{' '}
            <time dateTime={stamp.occurredAt}>{formatMoodStampDate(stamp.occurredAt)}</time>
          </p>
          <Link
            href={moodStampHref(stamp.id)}
            className="card-link inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-extrabold text-primary"
          >
            Open
            <span className="sr-only"> MoodStamp: {summary}</span>
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * Where a stamp stands, in words. A sent stamp that has not gone anywhere yet
 * says so plainly rather than pretending to be unopened.
 */
export function StatusBadge({ stamp }: { stamp: Pick<MoodStampSummary, 'delivery' | 'opened'> }) {
  const state =
    stamp.delivery === 'awaiting'
      ? { key: 'awaiting', label: 'Awaiting delivery' }
      : stamp.delivery === 'downloaded'
        ? { key: 'downloaded', label: 'Downloaded' }
        : stamp.opened
          ? { key: 'opened', label: 'Opened' }
          : { key: 'unopened', label: 'Unopened' };

  return (
    <span className="ms-status" data-state={state.key}>
      {state.label}
    </span>
  );
}

/** The typeset crop: the top third of a stamp, before artwork exists. */
function StampCrop({ stamp, reaction }: { stamp: MoodStampSummary; reaction: string }) {
  // Sized to the longest word in the emotion, so "Disappointed" still fits a phone card.
  const longest = Math.max(4, ...stamp.emotion.split(/\s+/).map((word) => word.length));

  return (
    <div className="absolute inset-0 flex flex-col px-[22px] pb-4 pt-[20px]">
      <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--color-ink)] pb-2">
        <span className="text-[12px] font-extrabold tracking-[-0.01em]">skewvy.com</span>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em]">MoodStamp</span>
      </div>

      <p className="mt-auto text-[10.5px] font-extrabold uppercase tracking-[0.2em]">
        {stamp.reaction === 'medal' ? 'You left me' : 'This made me feel'}
      </p>
      <h3
        className="ms-emotion mt-1.5"
        style={{ fontSize: `min(64px, calc((100cqi - 44px) / ${(longest * 0.74).toFixed(2)}))` }}
      >
        {stamp.emotion}
      </h3>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="numeric-lg text-[clamp(30px,11cqi,46px)]">{formatCount(stamp.quantity)}</span>
        <span className="text-[13px] font-extrabold uppercase tracking-[0.04em]">{reaction}</span>
      </p>
    </div>
  );
}

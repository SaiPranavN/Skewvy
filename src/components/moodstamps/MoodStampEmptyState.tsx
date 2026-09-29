'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import type { MoodStampView } from '@/lib/moodstamps/types';
import { MOODSTAMP_TAGLINE } from '@/lib/moodstamps/types';
import { MoodStampExample } from './MoodStampExample';
import { MoodStampMoments } from './MoodStampMoments';
import { ArrowRightIcon, LockIcon } from './icons';

/**
 * The board before anything is on it — for most people, their first sight of
 * MoodStamps. It is an invitation, not an error: one line of what it is, two
 * ways to start, and a real example to show what they will be collecting.
 *
 * On a phone the words and the actions come first and the example follows, so
 * the main action is where a thumb already is rather than a screen away.
 */
export function MoodStampEmptyState({ view }: { view: MoodStampView }) {
  return (
    <>
      <section
        aria-labelledby={`moodstamps-empty-${view}`}
        className="grid items-center gap-y-10 gap-x-[clamp(32px,5vw,88px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]"
      >
        <div className="max-w-[560px] lg:pb-8">
          {view === 'received' ? <ReceivedCopy /> : <SentCopy />}
        </div>
        <MoodStampExample lead={view === 'received' ? 'medals' : 'eggs'} />
      </section>
      <MoodStampMoments />
    </>
  );
}

function ReceivedCopy() {
  return (
    <>
      <h2 id="moodstamps-empty-received" className="display text-[clamp(34px,4.6vw,60px)]">
        Your board is waiting.
      </h2>
      <p className="mt-5 max-w-[46ch] text-[clamp(15.5px,1.2vw,17.5px)] leading-[1.55] text-secondary">
        MoodStamps turn appreciation and criticism into something you can actually send. Receive{' '}
        <strong className="font-bold text-[color:var(--color-medal)]">Medals</strong> when someone values what you
        did, or <strong className="font-bold text-[color:var(--color-egg)]">Rotten Eggs</strong> when something
        needs to be said.
      </p>

      <Actions
        primary={{ href: '/moodstamps/receive', label: 'Get your MoodStamp link' }}
        secondary={<SecondaryLink href="/moodstamps/send" label="Send one first" />}
      />

      <p className="ms-private-note mt-6">
        <LockIcon />
        Received MoodStamps will stay private on this board.
      </p>
    </>
  );
}

function SentCopy() {
  const [explaining, setExplaining] = useState(false);
  const explainerId = useId();

  return (
    <>
      <h2 id="moodstamps-empty-sent" className="display text-[clamp(34px,4.6vw,60px)]">
        Nothing sent yet.
      </h2>
      <p className="mt-5 max-w-[46ch] text-[clamp(15.5px,1.2vw,17.5px)] leading-[1.55] text-secondary">
        Choose an emotion, add Medals or Rotten Eggs, and explain what made you feel that way.
      </p>

      <Actions
        primary={{ href: '/moodstamps/send', label: 'Send your first MoodStamp' }}
        secondary={
          <button
            type="button"
            aria-expanded={explaining}
            aria-controls={explainerId}
            onClick={() => setExplaining((open) => !open)}
            className="btn btn-outline min-h-[52px] w-full sm:w-auto"
          >
            See how MoodStamps work
            <span aria-hidden="true" className="text-[18px] leading-none">
              {explaining ? '−' : '+'}
            </span>
          </button>
        }
      />

      <div id={explainerId} hidden={!explaining} className="mt-7 border-l-[3px] border-[var(--color-violet)] pl-5">
        <p className="text-[15px] font-bold text-primary">{MOODSTAMP_TAGLINE}</p>
        <ol className="ms-steps mt-4">
          <li>
            <span>
              <strong>Pick the feeling</strong> — proud, grateful, angry, frustrated.
            </span>
          </li>
          <li>
            <span>
              <strong>Choose Medals or Rotten Eggs</strong> — appreciation, or criticism.
            </span>
          </li>
          <li>
            <span>
              <strong>Set how many</strong> — the number is how strongly you feel it.
            </span>
          </li>
          <li>
            <span>
              <strong>Say why</strong>, then sign it with your name or send it anonymously.
            </span>
          </li>
        </ol>
      </div>
    </>
  );
}

function Actions({
  primary,
  secondary,
}: {
  primary: { href: string; label: string };
  secondary: React.ReactNode;
}) {
  return (
    <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap sm:items-center">
      <Link href={primary.href} className="ms-key ms-cta w-full sm:w-auto">
        {primary.label}
        <ArrowRightIcon />
      </Link>
      {secondary}
    </div>
  );
}

function SecondaryLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="btn btn-outline min-h-[52px] w-full sm:w-auto">
      {label}
    </Link>
  );
}

'use client';

import { useState } from 'react';
import { MoodStampBoard, type MoodStampBoardState } from '@/components/moodstamps/MoodStampBoard';
import type { MoodStampSummary, MoodStampView } from '@/lib/moodstamps/types';

/** Sample records for this bench only. Obviously invented, and never stored. */
const SAMPLE_RECEIVED: MoodStampSummary[] = [
  {
    id: 'sample-r1',
    direction: 'received',
    emotion: 'Impressed',
    reaction: 'medal',
    quantity: 45,
    counterpartName: 'Pranav',
    anonymous: false,
    occurredAt: '2026-09-23T10:00:00.000Z',
    opened: true,
    delivery: 'delivered',
    artworkUrl: null,
  },
  {
    id: 'sample-r2',
    direction: 'received',
    emotion: 'Fed up',
    reaction: 'rotten_egg',
    quantity: 12,
    counterpartName: null,
    anonymous: true,
    occurredAt: '2026-09-21T10:00:00.000Z',
    opened: false,
    delivery: 'delivered',
    artworkUrl: null,
  },
  {
    id: 'sample-r3',
    direction: 'received',
    emotion: 'Grateful',
    reaction: 'medal',
    quantity: 1,
    counterpartName: 'A very long display name that keeps going',
    anonymous: false,
    occurredAt: '2026-08-02T10:00:00.000Z',
    opened: false,
    delivery: 'delivered',
    artworkUrl: null,
  },
  {
    id: 'sample-r4',
    direction: 'received',
    emotion: 'Disappointed',
    reaction: 'rotten_egg',
    quantity: 1200,
    counterpartName: 'Mira',
    anonymous: false,
    occurredAt: '2026-07-14T10:00:00.000Z',
    opened: true,
    delivery: 'delivered',
    artworkUrl: null,
  },
];

const SAMPLE_SENT: MoodStampSummary[] = [
  {
    id: 'sample-s1',
    direction: 'sent',
    emotion: 'Proud',
    reaction: 'medal',
    quantity: 30,
    counterpartName: 'Aarav',
    anonymous: false,
    occurredAt: '2026-09-20T10:00:00.000Z',
    opened: true,
    delivery: 'delivered',
    artworkUrl: null,
  },
  {
    id: 'sample-s2',
    direction: 'sent',
    emotion: 'Frustrated',
    reaction: 'rotten_egg',
    quantity: 8,
    counterpartName: 'Dev',
    anonymous: true,
    occurredAt: '2026-09-18T10:00:00.000Z',
    opened: false,
    delivery: 'awaiting',
    artworkUrl: null,
  },
  {
    id: 'sample-s3',
    direction: 'sent',
    emotion: 'Grateful',
    reaction: 'medal',
    quantity: 60,
    counterpartName: 'Meera',
    anonymous: false,
    occurredAt: '2026-09-12T10:00:00.000Z',
    opened: false,
    delivery: 'downloaded',
    artworkUrl: null,
  },
];

type Bench = 'received' | 'sent' | 'empty-received' | 'empty-sent' | 'loading' | 'error' | 'offline';

const BENCHES: { key: Bench; label: string }[] = [
  { key: 'received', label: 'Populated · Received' },
  { key: 'sent', label: 'Populated · Sent' },
  { key: 'empty-received', label: 'Empty · Received' },
  { key: 'empty-sent', label: 'Empty · Sent' },
  { key: 'loading', label: 'Loading' },
  { key: 'error', label: 'Error' },
  { key: 'offline', label: 'Offline' },
];

function stateFor(bench: Bench): { view: MoodStampView; state: MoodStampBoardState } {
  switch (bench) {
    case 'received':
      return { view: 'received', state: { status: 'ready', items: SAMPLE_RECEIVED } };
    case 'sent':
      return { view: 'sent', state: { status: 'ready', items: SAMPLE_SENT } };
    case 'empty-received':
      return { view: 'received', state: { status: 'ready', items: [] } };
    case 'empty-sent':
      return { view: 'sent', state: { status: 'ready', items: [] } };
    case 'loading':
      return { view: 'received', state: { status: 'loading' } };
    case 'error':
      return { view: 'received', state: { status: 'error' } };
    case 'offline':
      return { view: 'received', state: { status: 'offline' } };
  }
}

export function MoodStampStates() {
  const [bench, setBench] = useState<Bench>('received');
  const { view, state } = stateFor(bench);

  return (
    <div className="rail pb-20 pt-8">
      <p className="flag">Development bench · sample data</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {BENCHES.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={bench === option.key}
            onClick={() => setBench(option.key)}
            className={`min-h-11 border-2 px-3 text-[13px] font-bold ${
              bench === option.key
                ? 'border-[var(--color-paper)] bg-[var(--color-paper)] text-[color:var(--color-ink)]'
                : 'border-[var(--border-strong)] text-secondary'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="mt-10">
        <MoodStampBoard view={view} state={state} onRetry={() => setBench('received')} />
      </div>
    </div>
  );
}

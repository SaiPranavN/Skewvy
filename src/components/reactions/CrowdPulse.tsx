'use client';

import { useEffect, useRef, useState } from 'react';
import { useArtifact } from './useArtifact';
import { CROWD_PULSE_LINES } from '@/lib/domain/copy';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactTotals, ArtifactType, UserContribution } from '@/lib/domain/types';

/**
 * Remote activity is shown as an occasional grouped pulse rather than a particle
 * per reaction — at real traffic a particle per remote tap would bury the page.
 */
export function CrowdPulse({
  artifactType,
  artifactId,
  totals,
  contribution,
}: {
  artifactType: ArtifactType;
  artifactId: string;
  totals: ArtifactTotals;
  contribution?: UserContribution | null;
}) {
  const state = useArtifact(artifactType, artifactId, { totals, contribution });
  const [message, setMessage] = useState<{ text: string; tone: 'egg' | 'medal'; key: number } | null>(null);
  const lastShownRef = useRef(0);

  useEffect(() => {
    const remote = state.lastRemote;
    if (!remote || remote.at === lastShownRef.current) return;
    lastShownRef.current = remote.at;

    const lines = CROWD_PULSE_LINES[remote.reactionType];
    const line = lines[remote.at % lines.length].replace('{n}', formatCount(remote.quantity));
    setMessage({ text: line, tone: remote.reactionType === 'rotten_egg' ? 'egg' : 'medal', key: remote.at });

    const timer = setTimeout(() => setMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [state.lastRemote]);

  if (!message) return null;

  return (
    <div
      key={message.key}
      className={`remote-pulse pointer-events-none inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        message.tone === 'egg' ? 'border-egg/30 bg-egg/12 text-egg' : 'border-medal/30 bg-medal/12 text-medal'
      }`}
    >
      <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {message.text}
    </div>
  );
}

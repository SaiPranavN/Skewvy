'use client';

import { useEffect, useRef, useState } from 'react';
import { useArtifact } from './useArtifact';
import { crowdSignal } from '@/lib/domain/copy';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactTotals, ArtifactType, UserContribution } from '@/lib/domain/types';

/**
 * Remote activity, reported as an occasional grouped signal rather than a
 * particle per reaction — at real traffic, animating every remote tap would
 * bury the page. The wording is factual; the totals above have already moved.
 */
export function CrowdSignal({
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

    setMessage({
      text: crowdSignal(remote.reactionType, formatCount(remote.quantity)),
      tone: remote.reactionType === 'rotten_egg' ? 'egg' : 'medal',
      key: remote.at,
    });

    const timer = setTimeout(() => setMessage(null), 2400);
    return () => clearTimeout(timer);
  }, [state.lastRemote]);

  if (!message) return null;

  return (
    <span
      key={message.key}
      className={`signal-in numeric shrink-0 text-xs ${message.tone === 'egg' ? 'text-egg' : 'text-medal'}`}
    >
      {message.text}
    </span>
  );
}

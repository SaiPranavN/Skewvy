'use client';

import { reactionStore } from '@/lib/client/reaction-store';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * Seeds the reaction store with server-rendered totals before the cards below
 * it render, so the very first tap on a freshly loaded page already has state.
 */
export function HydrateArtifacts({ cards }: { cards: ArtifactCard[] }) {
  if (typeof window !== 'undefined') {
    reactionStore.hydrate(cards.map((card) => ({ totals: card.totals, contribution: card.contribution })));
  }
  return null;
}

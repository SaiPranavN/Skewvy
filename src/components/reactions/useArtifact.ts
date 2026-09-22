'use client';

import { useSyncExternalStore } from 'react';
import { reactionStore, artifactKey, type ArtifactState } from '@/lib/client/reaction-store';
import type { ArtifactTotals, ArtifactType, UserContribution } from '@/lib/domain/types';

/**
 * Subscribes one component to one artifact's live state. Only components bound
 * to the tapped artifact re-render, so a rapid burst stays cheap.
 */
export function useArtifact(
  artifactType: ArtifactType,
  artifactId: string,
  fallback: { totals: ArtifactTotals; contribution?: UserContribution | null },
): ArtifactState {
  const key = artifactKey(artifactType, artifactId);

  const state = useSyncExternalStore(
    reactionStore.subscribe,
    () => reactionStore.getSnapshot()[key],
    () => undefined,
  );

  return (
    state ?? {
      totals: fallback.totals,
      contribution: fallback.contribution ?? { rottenEggCount: 0, medalCount: 0, stance: null },
      selectedStance: fallback.contribution?.stance ?? null,
      pendingRottenEggs: 0,
      pendingMedals: 0,
      syncState: 'idle' as const,
      lastRemote: null,
    }
  );
}

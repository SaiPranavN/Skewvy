'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { reactionStore } from '@/lib/client/reaction-store';
import type { ArtifactTotals, ArtifactType, ReactionType, UserContribution } from '@/lib/domain/types';
import { AuthSheet } from '@/components/auth/AuthSheet';

interface ReactionContextValue {
  isAuthenticated: boolean;
  requestSignIn: () => void;
}

const ReactionContext = createContext<ReactionContextValue>({
  isAuthenticated: false,
  requestSignIn: () => {},
});

export function useReactionContext(): ReactionContextValue {
  return useContext(ReactionContext);
}

export interface HydrationItem {
  totals: ArtifactTotals;
  contribution?: UserContribution | null;
}

/**
 * Wires the reaction store to React: hydrates server data, keeps the sign-in
 * sheet ready for anonymous tappers, and subscribes to crowd updates.
 */
export function ReactionProvider({
  children,
  isAuthenticated,
  hydrate = [],
  subscribeToRealtime = true,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  hydrate?: HydrationItem[];
  subscribeToRealtime?: boolean;
}) {
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const hydrateRef = useRef(hydrate);
  hydrateRef.current = hydrate;

  // Hydrate synchronously on first render so the very first tap has state.
  if (typeof window !== 'undefined') {
    reactionStore.hydrate(hydrate);
    reactionStore.setAuthenticated(isAuthenticated);
  }

  useEffect(() => {
    reactionStore.hydrate(hydrateRef.current);
  }, [hydrate]);

  useEffect(() => {
    reactionStore.setAuthenticated(isAuthenticated);
  }, [isAuthenticated]);

  const requestSignIn = useCallback(() => setAuthSheetOpen(true), []);

  useEffect(() => {
    if (isAuthenticated) return;
    reactionStore.setAuthRequiredHandler(() => setAuthSheetOpen(true));
    return () => reactionStore.setAuthRequiredHandler(null);
  }, [isAuthenticated]);

  // Crowd updates over server-sent events.
  useEffect(() => {
    if (!subscribeToRealtime) return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      source = new EventSource('/api/realtime/stream');
      source.addEventListener('reaction', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as {
            artifactType: ArtifactType;
            artifactId: string;
            reactionType: ReactionType;
            quantity: number;
            totals: ArtifactTotals;
          };
          reactionStore.applyRemote(payload);
        } catch {
          // Ignore malformed frames.
        }
      });
      source.onerror = () => {
        source?.close();
        if (closed) return;
        retry = setTimeout(connect, 4000);
      };
    };

    connect();
    return () => {
      closed = true;
      source?.close();
      if (retry) clearTimeout(retry);
    };
  }, [subscribeToRealtime]);

  const value = useMemo(
    () => ({ isAuthenticated, requestSignIn }),
    [isAuthenticated, requestSignIn],
  );

  return (
    <ReactionContext.Provider value={value}>
      {children}
      <AuthSheet
        open={authSheetOpen}
        onClose={() => setAuthSheetOpen(false)}
        pendingCount={reactionStore.pendingAnonymousReactions().reduce((sum, item) => sum + item.quantity, 0)}
      />
    </ReactionContext.Provider>
  );
}

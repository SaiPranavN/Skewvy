'use client';

import { useCallback, useEffect, useState } from 'react';
import { REACTION_VOICES } from '@/lib/moodstamps/catalog';
import type { MoodStampReaction } from '@/lib/moodstamps/types';

/** The form's working copy. `reaction` starts unset: the sender has to choose a side. */
export interface DraftState {
  reaction: MoodStampReaction | null;
  emotion: string;
  quantity: number;
  reasonWhat: string;
  reasonImpact: string;
  reasonRequest: string;
  recipientName: string;
  anonymous: boolean;
}

export const EMPTY_DRAFT: DraftState = {
  reaction: null,
  emotion: '',
  quantity: 10,
  reasonWhat: '',
  reasonImpact: '',
  reasonRequest: '',
  recipientName: '',
  anonymous: false,
};

const STORAGE_KEY = 'skewvy:moodstamp-draft';

/**
 * The draft, kept in this tab's session storage as it is written.
 *
 * Only a convenience: a reload or an accidental Back does not throw away a
 * paragraph someone struggled to write. It lives in this browser tab alone,
 * is cleared once the stamp is sent, and the form works the same without it.
 */
export function useMoodStampDraft() {
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  // Until the saved draft has been read, the form does not know which step it can show.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) setDraft({ ...EMPTY_DRAFT, ...(JSON.parse(saved) as Partial<DraftState>) });
    } catch {
      // Private mode or blocked storage: start fresh.
    }
    setLoaded(true);
  }, []);

  // Saving waits for a render in which `loaded` is true — by then the restored draft is
  // the state. Saving any earlier would write the empty form over the one being restored.
  useEffect(() => {
    if (!loaded) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Nothing to do; the draft simply is not kept.
    }
  }, [draft, loaded]);

  const update = useCallback(<K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      // A suggested feeling from the other side does not follow a change of side.
      if (key === 'reaction' && current.reaction && value !== current.reaction) {
        const previous = REACTION_VOICES[current.reaction].emotions;
        if (previous.includes(current.emotion)) next.emotion = '';
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // As above.
    }
  }, []);

  return { draft, update, clear, loaded };
}

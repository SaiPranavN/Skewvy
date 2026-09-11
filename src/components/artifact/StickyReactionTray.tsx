'use client';

import { useEffect, useState } from 'react';
import { ReactionControl } from '@/components/reactions/ReactionControl';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * Mobile reaction tray. It slides in once the main controls have scrolled off
 * the top, keeping both totals within thumb reach without covering the content
 * behind it.
 *
 * Position is read directly on scroll rather than inferred from an
 * IntersectionObserver entry: a long jump — an anchor link, a restored scroll
 * position — can skip the observer's thresholds entirely.
 */
export function StickyReactionTray({ card, watchTargetId }: { card: ArtifactCard; watchTargetId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame: number | null = null;

    const measure = () => {
      frame = null;
      const target = document.getElementById(watchTargetId);
      if (!target) return;
      setVisible(target.getBoundingClientRect().bottom < 0);
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [watchTargetId]);

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-default)] bg-ground px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 transition-transform duration-[var(--duration-surface)] ease-[var(--ease-standard)] lg:hidden ${
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      }`}
    >
      <div className="grid grid-cols-2 gap-2">
        <ReactionControl
          artifactType={card.type}
          artifactId={card.id}
          artifactTitle={card.title}
          reactionType="rotten_egg"
          totals={card.totals}
          contribution={card.contribution}
          size="sm"
        />
        <ReactionControl
          artifactType={card.type}
          artifactId={card.id}
          artifactTitle={card.title}
          reactionType="medal"
          totals={card.totals}
          contribution={card.contribution}
          size="sm"
        />
      </div>
    </div>
  );
}

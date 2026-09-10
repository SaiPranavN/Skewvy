'use client';

import { useEffect, useState } from 'react';
import { ReactionZone } from '@/components/reactions/ReactionZone';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * Mobile-only reaction tray. It slides in once the main reaction zones have
 * scrolled off the top, so the counters and the controls stay within thumb
 * reach for the whole page.
 *
 * Position is read directly on scroll rather than inferred from an
 * IntersectionObserver entry: a long jump (an anchor link, a restored scroll
 * position) can skip the observer's thresholds entirely.
 */
export function StickyReactionTray({ card, watchTargetId }: { card: ArtifactCard; watchTargetId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame: number | null = null;

    const measure = () => {
      frame = null;
      const target = document.getElementById(watchTargetId);
      if (!target) return;
      // Show once the zones have passed above the top of the viewport.
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
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-900/92 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl transition-transform duration-300 lg:hidden ${
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      }`}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <ReactionZone
          artifactType={card.type}
          artifactId={card.id}
          artifactTitle={card.title}
          reactionType="rotten_egg"
          totals={card.totals}
          contribution={card.contribution}
          size="compact"
        />
        <ReactionZone
          artifactType={card.type}
          artifactId={card.id}
          artifactTitle={card.title}
          reactionType="medal"
          totals={card.totals}
          contribution={card.contribution}
          size="compact"
        />
      </div>
    </div>
  );
}

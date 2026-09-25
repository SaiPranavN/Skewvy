import { ArtifactCard } from './ArtifactCard';
import { EntityCard } from './EntityCard';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';

/**
 * The card grid. Entities and Flash News use different cards — a standing
 * record and an event are not the same object — so the grid picks per card
 * rather than making one card serve both badly.
 */
export function CardGrid({
  cards,
  columns = 4,
  priorityCount = 0,
}: {
  cards: ArtifactCardModel[];
  columns?: 2 | 3 | 4 | 5;
  priorityCount?: number;
}) {
  const wide = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  }[columns];

  return (
    <div className={`grid grid-cols-1 gap-4 ${wide}`}>
      {cards.map((card, index) =>
        card.type === 'entity' ? (
          <EntityCard key={`${card.type}:${card.id}`} card={card} priority={index < priorityCount} />
        ) : (
          <ArtifactCard key={`${card.type}:${card.id}`} card={card} priority={index < priorityCount} />
        ),
      )}
    </div>
  );
}

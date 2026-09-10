import { ArtifactCard } from './ArtifactCard';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';

export function CardGrid({
  cards,
  columns = 3,
  priorityCount = 0,
}: {
  cards: ArtifactCardModel[];
  columns?: 2 | 3;
  priorityCount?: number;
}) {
  return (
    <div
      className={`grid gap-5 sm:grid-cols-2 ${columns === 3 ? 'lg:grid-cols-3' : ''}`}
    >
      {cards.map((card, index) => (
        <ArtifactCard key={`${card.type}:${card.id}`} card={card} priority={index < priorityCount} />
      ))}
    </div>
  );
}

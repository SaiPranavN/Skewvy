import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard, Entity } from '@/lib/domain/types';

/**
 * The entity this story is about, on the ground beside the article.
 *
 * The lifetime totals underneath are the reason it is here: they are the
 * standing score, and this story is one contribution to it. The note says so
 * outright, because a reader comparing the two sets of numbers will otherwise
 * assume they should match.
 */
export function RelatedEntityAside({
  entities,
  cards,
  id,
}: {
  entities: Entity[];
  cards: ArtifactCard[];
  id?: string;
}) {
  if (entities.length === 0) return null;

  return (
    <aside
      id={id}
      aria-labelledby="related-entity-heading"
      className="min-w-[min(100%,280px)] max-w-[420px] flex-[1_1_300px] border border-[var(--border-default)] p-[clamp(18px,2vw,26px)]"
    >
      <h2 id="related-entity-heading" className="eyebrow mb-[18px] text-[color:var(--color-indigo-soft)]">
        {entities.length > 1 ? 'Related entities' : 'Related entity'}
      </h2>

      <div className="flex flex-col gap-5">
        {entities.map((entity, index) => {
          const card = cards.find((candidate) => candidate.id === entity.id);
          return (
            <div key={entity.id} className={index > 0 ? 'border-t border-[var(--border-subtle)] pt-5' : undefined}>
              <Link href={`/entities/${entity.slug}`} className="media-hover flex items-start gap-3.5 text-primary">
                <Media
                  src={entity.imageUrl}
                  alt=""
                  fallbackLabel={initialsFor(entity.name)}
                  fallbackKind="initials"
                  sizes="68px"
                  className="h-[68px] w-[68px] flex-none border border-[var(--border-strong)]"
                />
                <span className="min-w-0">
                  <span className="display-sm block text-[clamp(20px,1.8vw,25px)]">{entity.name}</span>
                  <span className="mt-1.5 block text-[11px] font-semibold uppercase leading-none tracking-[0.12em] text-tertiary">
                    {entity.category}
                  </span>
                  <span className="mt-[9px] block text-[14.5px] leading-[1.45] text-secondary">
                    {entity.description}
                  </span>
                </span>
              </Link>

              {card && (
                <div className="mt-[18px] flex flex-wrap gap-6 border-t border-[var(--border-subtle)] pt-4">
                  <LifetimeStat
                    value={card.totals.rottenEggTotal}
                    label="Lifetime eggs"
                    emoji="🥚"
                    className="text-brand"
                  />
                  <LifetimeStat
                    value={card.totals.medalTotal}
                    label="Lifetime medals"
                    emoji="🏅"
                    className="text-medal"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="m-0 mt-4 text-[12.5px] leading-[1.5] text-tertiary">
        Lifetime totals cover every item for {entities.length > 1 ? 'these entities' : entities[0].name}, not this story
        on its own.
      </p>
    </aside>
  );
}

function LifetimeStat({
  value,
  label,
  emoji,
  className,
}: {
  value: number;
  label: string;
  emoji: string;
  className: string;
}) {
  return (
    <div>
      <div className={`numeric text-[22px] font-extrabold leading-none ${className}`}>{formatCount(value)}</div>
      <div className="mt-[5px] text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-tertiary">
        {label} <span className="emoji">{emoji}</span>
      </div>
    </div>
  );
}

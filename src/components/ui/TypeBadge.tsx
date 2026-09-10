import type { ArtifactType } from '@/lib/domain/types';

export function TypeBadge({ type, className = '' }: { type: ArtifactType; className?: string }) {
  const isEntity = type === 'entity';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-black/45 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-chalk-dim backdrop-blur ${className}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${isEntity ? 'bg-brand' : 'bg-medal'}`} />
      {isEntity ? 'Entity' : 'Flash News'}
    </span>
  );
}

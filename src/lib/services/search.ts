import { listEntities, listFlashNews, toCards } from './content';
import type { ArtifactCard } from '@/lib/domain/types';

export interface SearchResults {
  query: string;
  entities: ArtifactCard[];
  flashNews: ArtifactCard[];
  total: number;
}

export async function searchArtifacts(term: string, viewerId?: string | null): Promise<SearchResults> {
  const trimmed = term.trim();
  if (!trimmed) return { query: '', entities: [], flashNews: [], total: 0 };

  const [entities, flashNews] = await Promise.all([
    listEntities({ search: trimmed, limit: 20 }),
    listFlashNews({ search: trimmed, limit: 20 }),
  ]);

  const cards = await toCards({ entities, flashNews }, { viewerId, withVelocity: true });

  return {
    query: trimmed,
    entities: cards.filter((card) => card.type === 'entity'),
    flashNews: cards.filter((card) => card.type === 'flash_news'),
    total: cards.length,
  };
}

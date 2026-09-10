/** The two things a person can react to. Never called a "Moment". */
export type ArtifactType = 'entity' | 'flash_news';

/** Every individual tap is one Reaction of one of these kinds. */
export type ReactionType = 'rotten_egg' | 'medal';

/** A person's single overall position on an artifact. */
export type Stance = 'positive' | 'negative';

export type ContentStatus = 'draft' | 'published' | 'archived';

export const CATEGORIES = [
  'Technology',
  'Entertainment',
  'Sports',
  'Gaming',
  'Culture',
  'Business',
  'Good News',
  'Controversy',
  'Community',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface ArtifactTotals {
  artifactType: ArtifactType;
  artifactId: string;
  rottenEggTotal: number;
  medalTotal: number;
  positiveOpinionTotal: number;
  negativeOpinionTotal: number;
  uniqueParticipantTotal: number;
  updatedAt: string;
}

/** What the signed-in person personally contributed to one artifact. */
export interface UserContribution {
  rottenEggCount: number;
  medalCount: number;
  stance: Stance | null;
}

export interface Entity {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  accent: string | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FlashNews {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  body: string;
  category: string;
  imageUrl: string | null;
  accent: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
}

/** An Entity or Flash News item flattened into the shape every card and page renders. */
export interface ArtifactCard {
  type: ArtifactType;
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  imageUrl: string | null;
  accent: string;
  publishedAt: string | null;
  totals: ArtifactTotals;
  contribution?: UserContribution | null;
  relatedEntities?: Array<Pick<Entity, 'id' | 'slug' | 'name'>>;
  relatedFlashNewsCount?: number;
  /** Reactions received in the trailing velocity window; drives trending ranking. */
  recentRottenEggs?: number;
  recentMedals?: number;
}

export interface PublicUser {
  id: string;
  displayName: string;
  email: string;
  emailVerifiedAt: string | null;
  isAdmin: boolean;
  createdAt: string;
}

export function emptyTotals(artifactType: ArtifactType, artifactId: string): ArtifactTotals {
  return {
    artifactType,
    artifactId,
    rottenEggTotal: 0,
    medalTotal: 0,
    positiveOpinionTotal: 0,
    negativeOpinionTotal: 0,
    uniqueParticipantTotal: 0,
    updatedAt: new Date().toISOString(),
  };
}

/** Rotten Eggs mean frustration; Medals mean appreciation. */
export function stanceForReaction(reactionType: ReactionType): Stance {
  return reactionType === 'rotten_egg' ? 'negative' : 'positive';
}

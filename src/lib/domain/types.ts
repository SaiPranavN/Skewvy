import type { ArtifactDetail } from './details';
/** The two things a person can react to. Never called a "Moment". */
export type ArtifactType = 'entity' | 'flash_news';

/** Every individual tap is one Reaction of one of these kinds. */
export type ReactionType = 'rotten_egg' | 'medal';

/** A person's single overall position on an artifact. */
export type Stance = 'positive' | 'negative';

export type ContentStatus = 'draft' | 'published' | 'archived';

/**
 * Flash News is filed by subject matter — what the event was about.
 */
export const FLASH_NEWS_CATEGORIES = [
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

/**
 * An Entity is filed by what it *is*, not what it is about. "Technology" says
 * nothing useful about a regulator, a footballer and a phone all at once, and
 * those are the things people come here to hold to account.
 */
export const ENTITY_CATEGORIES = [
  'People',
  'Companies',
  'Institutions',
  'Governments',
  'Products',
  'Media',
  'Sports Teams',
  'Organisations',
] as const;

/** Retained for anything that still wants the union of both. */
export const CATEGORIES = FLASH_NEWS_CATEGORIES;

export type FlashNewsCategory = (typeof FLASH_NEWS_CATEGORIES)[number];
export type EntityCategory = (typeof ENTITY_CATEGORIES)[number];
export type Category = FlashNewsCategory | EntityCategory;

/** The list that belongs to one artifact type. */
export function categoriesFor(artifactType: ArtifactType): readonly string[] {
  return artifactType === 'entity' ? ENTITY_CATEGORIES : FLASH_NEWS_CATEGORIES;
}

/**
 * Everything the crowd has done to one artifact, in two separate currencies.
 *
 * Taps (`rottenEggTotal`, `medalTotal`) measure intensity and are unbounded per
 * person. People (`positiveOpinionTotal`, `negativeOpinionTotal`) measure the
 * verdict and are one per person, permanently. The contributor totals say how
 * many people are behind each tap total, which is the only honest way to read
 * "100 Rotten Eggs" — it may be one person, or a hundred.
 *
 * Nothing in the interface may derive a verdict from the tap totals.
 */
export interface ArtifactTotals {
  artifactType: ArtifactType;
  artifactId: string;
  rottenEggTotal: number;
  medalTotal: number;
  positiveOpinionTotal: number;
  negativeOpinionTotal: number;
  uniqueParticipantTotal: number;
  /** Distinct people who have sent at least one Rotten Egg here. */
  rottenEggContributorTotal: number;
  /** Distinct people who have given at least one Medal here. */
  medalContributorTotal: number;
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
  details: ArtifactDetail[];
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
  details: ArtifactDetail[];
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
  publishedAt: string | null;
  totals: ArtifactTotals;
  contribution?: UserContribution | null;
  relatedEntities?: Array<Pick<Entity, 'id' | 'slug' | 'name'>>;
  relatedFlashNewsCount?: number;
  /** Editor-entered facts; the card shows a line of them. */
  details?: ArtifactDetail[];
  /** Where a Story comes from, e.g. "Reuters · September 22". */
  sourceLabel?: string | null;
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
    rottenEggContributorTotal: 0,
    medalContributorTotal: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Whether a person may move their position once it is recorded.
 *
 * A Flash News item is one event, and a reaction to it is a reaction to that
 * moment — so the first side taken stays. An Entity is a standing record that
 * keeps accumulating, and holding someone to what they thought of a company
 * five years ago would make its opinion count describe the past, not the
 * present. Only Entities allow a change.
 */
export function canChangeSide(artifactType: ArtifactType): boolean {
  return artifactType === 'entity';
}

/** Rotten Eggs mean frustration; Medals mean appreciation. */
export function stanceForReaction(reactionType: ReactionType): Stance {
  return reactionType === 'rotten_egg' ? 'negative' : 'positive';
}

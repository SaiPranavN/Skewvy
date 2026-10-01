/**
 * The AI review of a MoodStamp's wording, as the form and the API share it.
 *
 * Kept apart from the reviewer itself so the browser can import the shape
 * without importing anything that talks to the model.
 */

/** The fields a review can point at. `senderName` is the name typed on someone's link. */
export const REVIEW_FIELDS = ['emotion', 'reasonWhat', 'reasonImpact', 'reasonRequest', 'recipientName', 'senderName'] as const;
export type ReviewField = (typeof REVIEW_FIELDS)[number];

export const REVIEW_CATEGORIES = [
  'abuse',
  'threat',
  'manipulation',
  'trapping',
  'sexual',
  'hate',
  'private_info',
  'scam',
  'self_harm',
] as const;
export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ReviewCategory, string> = {
  abuse: 'Abuse or insults',
  threat: 'Threats or intimidation',
  manipulation: 'Manipulation',
  trapping: 'Pressure or baiting',
  sexual: 'Sexual content',
  hate: 'Hate or harassment',
  private_info: 'Private details',
  scam: 'Scams or links',
  self_harm: 'Self-harm',
};

/**
 * - allow: send it.
 * - rewrite: it crosses a line softly — guilt, pressure, a jab. The sender is
 *   shown why and a better wording, and may still send it as written.
 * - block: it cannot be sent — a threat, sexual content, a scam, someone's
 *   private details, hate.
 * - unchecked: the reviewer was not available. The word checks still applied.
 */
export type ReviewVerdict = 'allow' | 'rewrite' | 'block' | 'unchecked';

export interface ReviewNote {
  field: ReviewField;
  /** What is wrong with this part, to the sender, in a sentence. */
  issue: string;
  /** The same thing said acceptably, when there is a way to say it. */
  suggestion: string | null;
}

export interface MoodStampReview {
  verdict: ReviewVerdict;
  categories: ReviewCategory[];
  /** One or two sentences to the sender. Empty when allowed. */
  message: string;
  notes: ReviewNote[];
}

export const ALLOWED: MoodStampReview = { verdict: 'allow', categories: [], message: '', notes: [] };
export const UNCHECKED: MoodStampReview = { ...ALLOWED, verdict: 'unchecked' };

/**
 * Why someone flagged a comment.
 *
 * A short fixed list rather than free text alone: it lets the review queue
 * sort a pile of reports at a glance, and it keeps a report about what was
 * written — never about which side the writer took. Disagreeing with a
 * comment is what the dislike button is for.
 */
export const REPORT_REASONS = ['harassment', 'hate', 'spam', 'misinformation', 'other'] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, { label: string; hint: string }> = {
  harassment: { label: 'Harassment or bullying', hint: 'Targets a person with abuse or threats.' },
  hate: { label: 'Hate speech', hint: 'Attacks people for who they are.' },
  spam: { label: 'Spam or advertising', hint: 'Off-topic promotion, links or repeated posts.' },
  misinformation: { label: 'False or misleading', hint: 'States something untrue as fact.' },
  other: { label: 'Something else', hint: 'Tell us what is wrong in a few words.' },
};

export const REPORT_DETAILS_MAX_LENGTH = 300;

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === 'string' && (REPORT_REASONS as readonly string[]).includes(value);
}

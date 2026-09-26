/** Why someone used the public report form. Order is the order shown. */
export const SITE_REPORT_REASONS = [
  'harassment',
  'private_information',
  'impersonation',
  'false_claim',
  'copyright',
  'spam',
  'other',
] as const;

export type SiteReportReason = (typeof SITE_REPORT_REASONS)[number];

export const SITE_REPORT_REASON_LABELS: Record<SiteReportReason, string> = {
  harassment: 'Harassment or threat',
  private_information: 'Private information',
  impersonation: 'Impersonation',
  false_claim: 'False or misleading factual claim',
  copyright: 'Copyright or trademark concern',
  spam: 'Spam or manipulation',
  other: 'Other',
};

/** Editorial state an editor can put on a Story. Absent means nothing to flag. */
export const EDITORIAL_STATUSES = ['developing', 'disputed', 'corrected', 'resolved'] as const;
export type EditorialStatus = (typeof EDITORIAL_STATUSES)[number];

export const EDITORIAL_STATUS_LABELS: Record<EditorialStatus, string> = {
  developing: 'Developing',
  disputed: 'Disputed',
  corrected: 'Corrected',
  resolved: 'Resolved',
};

export function isEditorialStatus(value: unknown): value is EditorialStatus {
  return typeof value === 'string' && (EDITORIAL_STATUSES as readonly string[]).includes(value);
}

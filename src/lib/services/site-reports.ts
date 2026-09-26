import { execute, query, queryOne } from '@/lib/db';
import { hashIp, newId } from './crypto';
import type { SiteReportReason } from '@/lib/domain/site-reports';

/**
 * Reports from the public report form.
 *
 * A report is a request for a person to look. It changes nothing on its own —
 * no total moves, nothing is hidden — and the reporter is told only that it
 * arrived: never whether anyone else reported the same thing, and never what
 * was decided about it.
 */

export interface SiteReportInput {
  targetUrl: string;
  reason: SiteReportReason;
  details: string;
  evidenceUrl?: string | null;
  contactEmail?: string | null;
  reporterId?: string | null;
  ip?: string | null;
}

export async function createSiteReport(input: SiteReportInput): Promise<void> {
  await execute(
    `INSERT INTO site_reports (id, target_url, reason, details, evidence_url, contact_email, reporter_id, ip_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      newId(),
      input.targetUrl.trim(),
      input.reason,
      input.details.trim(),
      input.evidenceUrl?.trim() || null,
      input.contactEmail?.trim() || null,
      input.reporterId ?? null,
      hashIp(input.ip ?? null),
      new Date().toISOString(),
    ],
  );
}

export interface SiteReportView {
  id: string;
  targetUrl: string;
  reason: SiteReportReason;
  details: string;
  evidenceUrl: string | null;
  contactEmail: string | null;
  reporterName: string | null;
  createdAt: string;
}

/** Open reports, newest first, for the admin queue. */
export async function listOpenSiteReports(limit = 100): Promise<SiteReportView[]> {
  const rows = await query<{
    id: string;
    target_url: string;
    reason: SiteReportReason;
    details: string;
    evidence_url: string | null;
    contact_email: string | null;
    display_name: string | null;
    created_at: string;
  }>(
    `SELECT r.id, r.target_url, r.reason, r.details, r.evidence_url, r.contact_email, u.display_name, r.created_at
       FROM site_reports r
       LEFT JOIN users u ON u.id = r.reporter_id
      WHERE r.resolved_at IS NULL
      ORDER BY r.created_at DESC
      LIMIT $1`,
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    targetUrl: row.target_url,
    reason: row.reason,
    details: row.details,
    evidenceUrl: row.evidence_url,
    contactEmail: row.contact_email,
    reporterName: row.display_name,
    createdAt: row.created_at,
  }));
}

export async function countOpenSiteReports(): Promise<number> {
  const row = await queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM site_reports WHERE resolved_at IS NULL');
  return Number(row?.total ?? 0);
}

/** Marks a report as dealt with. What was done is the admin's to record elsewhere. */
export async function resolveSiteReport(id: string, adminId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    'UPDATE site_reports SET resolved_at = $2, resolved_by = $3 WHERE id = $1 AND resolved_at IS NULL RETURNING id',
    [id, new Date().toISOString(), adminId],
  );
  return rows.length > 0;
}

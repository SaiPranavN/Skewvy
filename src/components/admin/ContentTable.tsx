import Link from 'next/link';
import Image from 'next/image';
import { StatusControls } from './StatusControls';
import { LeadStoryControl } from './LeadStoryControl';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactTotals, ArtifactType, ContentStatus } from '@/lib/domain/types';
import { EggIcon, MedalIcon } from '@/components/ui/icons';

export interface ContentRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  imageUrl: string | null;
  status: ContentStatus;
  totals: ArtifactTotals;
  meta?: string;
}

/**
 * Admin content list. Cards rather than a dense table — it stays readable on a
 * phone, and each row shows the reaction and opinion totals for that item.
 */
export function ContentTable({
  type,
  rows,
  editHrefPrefix,
  publicHrefPrefix,
  leadId,
}: {
  type: ArtifactType;
  rows: ContentRow[];
  editHrefPrefix: string;
  publicHrefPrefix: string;
  /** Stories only: the Story an editor pinned as the lead, if any. */
  leadId?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="panel rounded-[var(--radius-card)] px-6 py-12 text-center">
        <p className="text-sm text-secondary">Nothing matches. Try a different search, or create something new.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="panel rounded-[var(--radius-card)] p-4">
          <div className="flex flex-wrap items-start gap-4">
            <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
              {row.imageUrl && <Image src={row.imageUrl} alt="" fill sizes="96px" className="cover-image" />}
            </span>

            <div className="min-w-0 flex-1">
              <Link href={`${editHrefPrefix}/${row.id}/edit`} className="block text-sm font-semibold text-primary hover:underline">
                {row.title}
              </Link>
              <p className="mt-1 text-xs text-tertiary">
                {row.category} · /{row.slug}
                {row.meta ? ` · ${row.meta}` : ''}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <StatusControls type={type} id={row.id} status={row.status} />
                {type === 'flash_news' && (
                  <LeadStoryControl id={row.id} isLead={row.id === leadId} published={row.status === 'published'} />
                )}
              </div>
            </div>

            <div className="shrink-0 text-right text-xs">
              <p className="font-semibold text-egg">
                {formatCount(row.totals.rottenEggTotal)} <EggIcon />
              </p>
              <p className="mt-1 font-semibold text-medal">
                {formatCount(row.totals.medalTotal)} <MedalIcon />
              </p>
              <p className="mt-1.5 text-tertiary">
                {formatCount(row.totals.negativeOpinionTotal)} / {formatCount(row.totals.positiveOpinionTotal)} opinions
              </p>
              <p className="mt-0.5 text-tertiary">
                {row.totals.uniqueParticipantTotal === 1
                  ? '1 person'
                  : `${formatCount(row.totals.uniqueParticipantTotal)} people`}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3 text-xs">
            <Link href={`${editHrefPrefix}/${row.id}/edit`} className="text-secondary hover:text-primary">
              Edit
            </Link>
            <span className="text-tertiary">·</span>
            <Link
              href={`${publicHrefPrefix}/${row.slug}`}
              className="text-secondary hover:text-primary"
              target="_blank"
              rel="noreferrer"
            >
              {row.status === 'published' ? 'View live' : 'Preview'} ↗
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

'use client';

import { useState } from 'react';
import {
  DETAILS_MAX,
  DETAIL_LABEL_MAX,
  DETAIL_VALUE_MAX,
  type ArtifactDetail,
} from '@/lib/domain/details';

const inputClass =
  'w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-elevated px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-[var(--border-strong)] focus:outline-none';

/**
 * Label/value rows for the facts about a subject. The rows travel to the
 * server as one JSON field; blank rows are dropped there, so an editor can
 * leave a suggested field empty without it being saved.
 */
export function DetailsEditor({
  defaultValue,
  suggestions,
  error,
}: {
  defaultValue: ArtifactDetail[];
  /** Labels offered for the current category. */
  suggestions: string[];
  error?: string;
}) {
  const [rows, setRows] = useState<ArtifactDetail[]>(
    defaultValue.length > 0 ? defaultValue : suggestions.map((label) => ({ label, value: '' })),
  );

  const update = (index: number, patch: Partial<ArtifactDetail>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const missing = suggestions.filter(
    (label) => !rows.some((row) => row.label.trim().toLowerCase() === label.toLowerCase()),
  );

  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-medium text-secondary">Details</legend>
      <p className="text-xs text-tertiary">
        Facts about the subject — shown on its page, and the first two on its card. Links show as links. Leave a row
        empty to skip it.
      </p>

      <input type="hidden" name="details" value={JSON.stringify(rows)} />

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2">
            <input
              aria-label={`Detail ${index + 1} label`}
              value={row.label}
              maxLength={DETAIL_LABEL_MAX}
              onChange={(event) => update(index, { label: event.target.value })}
              placeholder="Label"
              className={inputClass}
            />
            <input
              aria-label={`Detail ${index + 1} value`}
              value={row.value}
              maxLength={DETAIL_VALUE_MAX}
              onChange={(event) => update(index, { value: event.target.value })}
              placeholder="Value"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              aria-label={`Remove detail ${index + 1}`}
              className="min-h-9 rounded-[var(--radius-control)] border border-[var(--border-default)] px-3 text-sm text-secondary hover:border-[var(--border-strong)] hover:text-primary"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={rows.length >= DETAILS_MAX}
          onClick={() => setRows((current) => [...current, { label: '', value: '' }])}
          className="min-h-9 rounded-[var(--radius-control)] border border-[var(--border-default)] px-3 py-2 text-xs text-primary hover:border-[var(--border-strong)] disabled:opacity-50"
        >
          + Add detail
        </button>
        {missing.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setRows((current) =>
                [...current, ...missing.map((label) => ({ label, value: '' }))].slice(0, DETAILS_MAX),
              )
            }
            className="min-h-9 rounded-[var(--radius-control)] border border-[var(--border-default)] px-3 py-2 text-xs text-secondary hover:border-[var(--border-strong)] hover:text-primary"
          >
            Add suggested: {missing.join(', ')}
          </button>
        )}
      </div>

      {error && <p className="text-xs font-medium text-brand">{error}</p>}
    </fieldset>
  );
}

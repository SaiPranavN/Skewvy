'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { deleteArtifactAction } from '@/app/admin/actions';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactTotals } from '@/lib/domain/types';

/**
 * The danger zone on an edit page.
 *
 * Deleting takes every reaction, opinion, chart point and comment with it and
 * cannot be undone, so the dialog says what will go, in numbers, and asks for
 * the slug to be typed back. Archiving is offered as the reversible option.
 */
export function DeleteArtifact({
  type,
  id,
  slug,
  title,
  totals,
  comments,
}: {
  type: 'entity' | 'flash_news';
  id: string;
  slug: string;
  title: string;
  totals: ArtifactTotals;
  comments: number;
}) {
  const router = useRouter();
  const headingId = useId();
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const noun = type === 'entity' ? 'Profile' : 'Story';
  const people = totals.positiveOpinionTotal + totals.negativeOpinionTotal;

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteArtifactAction(type, id, typed);
      if (!result.ok) {
        setError(result.message ?? 'That did not work.');
        return;
      }
      setOpen(false);
      router.push(result.redirectTo ?? '/admin');
      router.refresh();
    });
  };

  return (
    <section className="rounded-[var(--radius-card)] border border-[color:var(--color-egg-deep)] p-5">
      <h3 className="text-sm font-semibold text-primary">Delete this {noun.toLowerCase()} permanently</h3>
      <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-secondary">
        Removes it and everything recorded against it: reactions, opinions, its history charts and its whole
        discussion. This cannot be undone. To hide it but keep its record, archive it instead.
      </p>
      <button
        type="button"
        onClick={() => {
          setTyped('');
          setError(null);
          setOpen(true);
        }}
        className="mt-3.5 min-h-10 rounded-[var(--radius-control)] border border-[color:var(--color-egg-deep)] px-4 text-sm font-semibold text-[color:var(--color-egg)] transition-colors hover:bg-[color:var(--color-egg-deep)] hover:text-[color:var(--color-ink)]"
      >
        Delete permanently…
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={headingId}
        initialFocus={inputRef}
        dismissible={!pending}
      >
        <p className="eyebrow-ink m-0">Cannot be undone</p>
        <h2 id={headingId} className="display-sm m-0 mt-2.5 text-[clamp(22px,2.4vw,28px)]">
          Delete “{title}”?
        </h2>

        <ul className="m-0 mt-4 list-disc space-y-1 pl-5 text-[14px] leading-[1.5] text-[rgb(23_20_15_/_0.78)]">
          <li>
            {formatCount(people)} {people === 1 ? 'opinion' : 'opinions'}, {formatCount(totals.medalTotal)} Medals and{' '}
            {formatCount(totals.rottenEggTotal)} Rotten Eggs
          </li>
          <li>
            {formatCount(comments)} {comments === 1 ? 'comment' : 'comments'}, with their votes and reports
          </li>
          <li>The history charts, and the public page at /{type === 'entity' ? 'entities' : 'flash-news'}/{slug}</li>
        </ul>

        <label htmlFor={fieldId} className="mt-5 block text-[13px] font-bold">
          Type <span className="numeric bg-[rgb(23_20_15_/_0.08)] px-1.5 py-0.5">{slug}</span> to confirm
        </label>
        <input
          ref={inputRef}
          id={fieldId}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mt-2 block w-full border-2 border-ink bg-transparent p-2.5 text-[14px] outline-none focus-visible:shadow-[3px_3px_0_var(--color-ink)]"
        />

        {error && (
          <p role="alert" className="m-0 mt-3 text-[13.5px] font-bold text-[color:var(--color-negative-deep)]">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="btn btn-ink min-h-11 px-4 py-3 text-[14px]"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending || typed.trim() !== slug}
            className="btn btn-negative min-h-11 w-auto px-4 py-3 text-[14px] font-extrabold disabled:opacity-40"
          >
            {pending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </Modal>
    </section>
  );
}

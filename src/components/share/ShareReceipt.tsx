'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FORMATS,
  receiptToBlob,
  receiptToDataUrl,
  receiptVariant,
  type ReceiptFormat,
  type ReceiptInput,
} from '@/lib/client/receipt';
import { useArtifact } from '@/components/reactions/useArtifact';
import { Overlay } from '@/components/ui/Overlay';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * Share sheet with a live preview of the receipt.
 *
 * The preview *is* the exported image — the same canvas render, scaled down —
 * so what someone approves is exactly what lands in their camera roll. Totals
 * are snapshotted when the sheet opens and the poster is stamped "as of" that
 * moment, so a saved receipt never pretends to be a live counter.
 */
export function ShareReceipt({ card, url }: { card: ArtifactCard; url: string }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ReceiptFormat>('story');
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });

  /*
   * Frozen for the life of the sheet. Re-rendering on every incoming tap would
   * make the preview flicker, and could hand someone a file whose numbers
   * moved between seeing it and saving it.
   */
  const [snapshot, setSnapshot] = useState<ReceiptInput | null>(null);

  useEffect(() => {
    if (!open) {
      setSnapshot(null);
      setPreview(null);
      setStatus(null);
      return;
    }
    setSnapshot({
      title: card.title,
      artifactType: card.type,
      category: card.category,
      imageUrl: card.imageUrl,
      totals: state.totals,
      contribution: state.contribution,
      url,
    });
    // Snapshots on open only, deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const variant = receiptVariant(snapshot?.contribution ?? state.contribution);

  useEffect(() => {
    if (!open || !snapshot) return;
    let cancelled = false;

    setPreview(null);
    receiptToDataUrl(snapshot, format).then((data) => {
      if (!cancelled) setPreview(data);
    });

    return () => {
      cancelled = true;
    };
  }, [open, snapshot, format]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus();
    };
  }, [open]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied.');
    } catch {
      setStatus('Could not copy — select the link and copy it manually.');
    }
  }, [url]);

  const download = useCallback(async () => {
    if (!snapshot) return;
    setBusy(true);
    setStatus(null);
    try {
      const blob = await receiptToBlob(snapshot, format);
      if (!blob) {
        setStatus('The receipt could not be generated in this browser.');
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `skewvy-${card.slug}-${format}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setStatus('Receipt saved.');
    } finally {
      setBusy(false);
    }
  }, [card.slug, format, snapshot]);

  const share = async () => {
    if (!snapshot) return;
    setBusy(true);
    setStatus(null);
    try {
      const blob = await receiptToBlob(snapshot, format);
      const file = blob ? new File([blob], `skewvy-${card.slug}-${format}.png`, { type: 'image/png' }) : null;

      // The artifact URL rides along, so recipients land on the item itself.
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: card.title, url });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: card.title, url });
        return;
      }
      await download();
    } catch {
      // A cancelled share is not an error.
    } finally {
      setBusy(false);
    }
  };

  const activeFormat = FORMATS.find((option) => option.id === format) ?? FORMATS[0];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-outline">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 3v12" />
          <path d="M7 8l5-5 5 5" />
          <path d="M4 15v5h16v-5" />
        </svg>
        <span>Share</span>
      </button>

      {open && (
        <Overlay>
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
            <button
              type="button"
              aria-label="Close share"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/80"
            />

            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-title"
              className="pop-in on-paper relative max-h-[94dvh] w-full overflow-y-auto border-2 border-ink bg-paper p-5 pb-8 text-ink sm:max-w-[460px] sm:p-7"
              style={{ boxShadow: 'var(--shadow-overlay)' }}
            >
              <div aria-hidden="true" className="mx-auto mb-4 h-1 w-9 bg-[rgb(23_20_15_/_0.2)] sm:hidden" />

              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="share-title" className="display-sm m-0 text-[clamp(21px,2.4vw,27px)]">
                  {variant === 'public' ? 'Public status card' : 'Your reaction receipt'}
                </h2>
                <span className="text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-[rgb(23_20_15_/_0.6)]">
                  {activeFormat.hint}
                </span>
              </div>

              <p className="mt-2 text-sm leading-[1.5] text-[rgb(23_20_15_/_0.68)]">
                {variant === 'public'
                  ? 'You have not reacted to this yet, so the card reports where the crowd stands and claims nothing on your behalf.'
                  : 'What you did, what you reacted to, and where the crowd stands — stamped with the moment it was made.'}
              </p>

              {/* Both formats carry the same information, in the same order. */}
              <div className="seg mt-4 flex w-full">
                {FORMATS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFormat(option.id)}
                    aria-pressed={format === option.id}
                    className="seg-opt flex-1 justify-center"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex justify-center border border-[var(--rule-default)] bg-[rgb(23_20_15_/_0.06)] p-4">
                {preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={preview}
                    alt={`${variant === 'public' ? 'Public status card' : 'Reaction receipt'} for ${card.title}: ${card.totals.rottenEggTotal} rotten eggs and ${card.totals.medalTotal} medals.`}
                    className="border border-[var(--rule-default)]"
                    style={{ maxHeight: '44dvh', width: 'auto', maxWidth: '100%' }}
                  />
                ) : (
                  <div
                    className="skeleton w-full"
                    style={{ aspectRatio: String(activeFormat.ratio), maxHeight: '44dvh' }}
                  />
                )}
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={share}
                  disabled={busy || !preview}
                  className="btn min-h-12 w-full justify-center border-2 border-ink bg-egg px-4 py-3 text-[15px] font-extrabold text-ink disabled:opacity-50"
                >
                  {busy ? 'Preparing…' : 'Share'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={download}
                    disabled={busy || !preview}
                    className="btn btn-ink min-h-11 justify-center px-4 py-3 text-sm disabled:opacity-50"
                  >
                    Save image
                  </button>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="btn btn-ink min-h-11 justify-center px-4 py-3 text-sm"
                  >
                    Copy link
                  </button>
                </div>
              </div>

              <p role="status" className="mt-3 min-h-5 text-center text-xs text-[rgb(23_20_15_/_0.62)]">
                {status}
              </p>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
}

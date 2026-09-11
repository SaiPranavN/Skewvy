'use client';

import { useEffect, useRef, useState } from 'react';
import { buildReceiptSvg, renderReceiptPng, type ReceiptInput } from '@/lib/client/receipt';
import { useArtifact } from '@/components/reactions/useArtifact';
import { pickFrom, RECEIPT_CAPTIONS } from '@/lib/domain/copy';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * Share sheet with a live "sentiment receipt" preview. Copy the link, save the
 * image, or hand it to the native share sheet where the device offers one.
 */
export function ShareReceipt({ card, url }: { card: ArtifactCard; url: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });

  const receipt: ReceiptInput = {
    title: card.title,
    artifactType: card.type,
    category: card.category,
    imageUrl: card.imageUrl,
    totals: state.totals,
    contribution: state.contribution,
    caption: pickFrom(RECEIPT_CAPTIONS, card.slug),
  };

  useEffect(() => {
    if (!open) return;
    let revoked: string | null = null;
    let cancelled = false;

    buildReceiptSvg(receipt).then((svg) => {
      if (cancelled) return;
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      revoked = URL.createObjectURL(blob);
      setPreview(revoked);
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKeyDown);
      if (revoked) URL.revokeObjectURL(revoked);
    };
    // The preview intentionally snapshots the totals at the moment it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied.');
    } catch {
      setStatus('Could not copy — select the link and copy it manually.');
    }
  };

  const download = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await renderReceiptPng(receipt);
      if (!blob) {
        setStatus('The receipt could not be generated in this browser.');
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `skewvy-${card.slug}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setStatus('Receipt saved.');
    } finally {
      setBusy(false);
    }
  };

  const nativeShare = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await renderReceiptPng(receipt);
      const file = blob ? new File([blob], `skewvy-${card.slug}.png`, { type: 'image/png' }) : null;

      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: card.title, text: receipt.caption, url });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: card.title, text: receipt.caption, url });
        return;
      }
      await copyLink();
    } catch {
      // A cancelled share is not an error.
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-default)] px-3.5 py-2 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 10.5V2m0 0L5 5m3-3 3 3M3 9.5v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Share
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close share"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70"
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            className="signal-in relative max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border-t border-[var(--border-default)] bg-elevated p-5 pb-8 sm:max-w-sm sm:rounded-xl sm:border sm:p-6"
            style={{ boxShadow: 'var(--shadow-overlay)' }}
          >
            <div aria-hidden="true" className="mx-auto mb-4 h-1 w-9 rounded-full bg-surface-3 sm:hidden" />

            <h2 id="share-title" className="text-base font-medium text-primary">
              Sentiment receipt
            </h2>
            <p className="mt-1.5 text-sm text-secondary">The current totals, stamped and ready to share.</p>

            <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-ground">
              {preview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={preview}
                  alt={`Sentiment receipt for ${card.title}: ${state.totals.rottenEggTotal} Rotten Eggs and ${state.totals.medalTotal} Medals.`}
                  className="w-full"
                />
              ) : (
                <div className="skeleton aspect-[4/5] w-full rounded-none" />
              )}
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={nativeShare}
                disabled={busy}
                className="min-h-11 w-full rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Preparing…' : 'Share'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={download}
                  disabled={busy}
                  className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 py-2.5 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)] disabled:opacity-50"
                >
                  Save image
                </button>
                <button
                  type="button"
                  onClick={copyLink}
                  className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 py-2.5 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
                >
                  Copy link
                </button>
              </div>
            </div>

            <p role="status" className="mt-3 min-h-5 text-center text-xs text-tertiary">
              {status}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

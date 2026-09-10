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
    accent: card.accent,
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
        className="inline-flex items-center gap-2 rounded-full border border-white/14 px-4 py-2.5 text-sm font-medium text-chalk-dim transition-colors hover:border-white/30 hover:text-chalk"
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
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            className="glass-strong relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] p-5 pb-8 sm:max-w-sm sm:rounded-[28px] sm:p-6"
          >
            <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" />

            <h2 id="share-title" className="text-lg font-bold text-chalk">
              Sentiment receipt
            </h2>
            <p className="mt-1 text-sm text-haze">The numbers, stamped and ready to post.</p>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/12 bg-black/40">
              {preview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={preview}
                  alt={`Sentiment receipt for ${card.title}: ${state.totals.rottenEggTotal} Rotten Eggs and ${state.totals.medalTotal} Medals.`}
                  className="w-full"
                />
              ) : (
                <div className="skeleton aspect-[4/5] w-full" />
              )}
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={nativeShare}
                disabled={busy}
                className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-bright disabled:opacity-60"
              >
                {busy ? 'Preparing…' : 'Share'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={download}
                  disabled={busy}
                  className="rounded-xl border border-white/14 px-4 py-3 text-sm font-medium text-chalk-dim transition-colors hover:border-white/30 disabled:opacity-60"
                >
                  Save image
                </button>
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-xl border border-white/14 px-4 py-3 text-sm font-medium text-chalk-dim transition-colors hover:border-white/30"
                >
                  Copy link
                </button>
              </div>
            </div>

            <p role="status" className="mt-3 min-h-5 text-center text-xs text-haze">
              {status}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

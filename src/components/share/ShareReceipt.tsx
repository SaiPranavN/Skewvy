'use client';

import { useEffect, useRef, useState } from 'react';
import { buildReceiptSvg, renderReceiptPng, type ReceiptInput } from '@/lib/client/receipt';
import { useArtifact } from '@/components/reactions/useArtifact';
import { Overlay } from '@/components/ui/Overlay';
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
  const state = useArtifact(card.type, card.id, {
    totals: card.totals,
    contribution: card.contribution,
  });

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
        await navigator.share({
          files: [file],
          title: card.title,
          text: receipt.caption,
          url,
        });
        return;
      }
      if (navigator.share) {
        await navigator.share({
          title: card.title,
          text: receipt.caption,
          url,
        });
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
              className="absolute inset-0 bg-black/70"
            />

            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-title"
              className="pop-in relative max-h-[92dvh] w-full overflow-y-auto border-2 border-ink on-paper bg-paper p-5 pb-8 text-ink sm:max-w-sm sm:p-6"
              style={{ boxShadow: 'var(--shadow-overlay)' }}
            >
              <div aria-hidden="true" className="mx-auto mb-4 h-1 w-9 bg-[rgb(23_20_15_/_0.2)] sm:hidden" />

              <h2 id="share-title" className="display-sm m-0 text-xl">
                Sentiment receipt
              </h2>
              <p className="mt-1.5 text-sm text-[rgb(23_20_15_/_0.66)]">
                The current totals, stamped and ready to share.
              </p>

              <div className="mt-4 overflow-hidden border border-[var(--rule-default)] bg-ground">
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
                  className="btn min-h-11 w-full justify-center bg-egg px-4 py-3 text-sm font-extrabold text-ink disabled:opacity-50"
                >
                  {busy ? 'Preparing…' : 'Share'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={download}
                    disabled={busy}
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

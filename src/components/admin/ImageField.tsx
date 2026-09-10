'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { uploadImageAction } from '@/app/admin/actions';

/**
 * Image chooser: upload a file, or paste a URL. Both write the same single
 * `imageUrl` field, and the preview shows exactly what the card will use.
 */
export function ImageField({ name, defaultValue }: { name: string; defaultValue: string | null }) {
  const [url, setUrl] = useState(defaultValue ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const upload = (file: File) => {
    const formData = new FormData();
    formData.set('file', file);
    setMessage(null);
    startTransition(async () => {
      const result = await uploadImageAction({ ok: false }, formData);
      if (result.ok && result.url) {
        setUrl(result.url);
        setMessage('Image uploaded.');
      } else {
        setMessage(result.message ?? 'Upload failed.');
      }
    });
  };

  return (
    <div className="space-y-2.5">
      <label htmlFor={`${name}-url`} className="block text-sm font-medium text-chalk-dim">
        Cover image
      </label>

      <div className="flex flex-wrap gap-3">
        <span className="relative h-24 w-40 shrink-0 overflow-hidden rounded-xl border border-white/12 bg-black/40">
          {url ? (
            <Image src={url} alt="Cover preview" fill sizes="160px" className="cover-image" />
          ) : (
            <span className="grid h-full place-items-center text-xs text-haze-dim">No image</span>
          )}
        </span>

        <div className="min-w-[240px] flex-1 space-y-2">
          <input
            id={`${name}-url`}
            name={name}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="/covers/example.svg or https://…"
            className="w-full rounded-xl border border-white/12 bg-black/35 px-4 py-2.5 text-sm text-chalk placeholder:text-haze-dim focus:border-white/30 focus:outline-none"
          />

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload(file);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className="rounded-lg border border-white/14 px-3 py-2 text-xs font-medium text-chalk-dim transition-colors hover:border-white/30 disabled:opacity-60"
            >
              {pending ? 'Uploading…' : 'Upload image'}
            </button>
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="rounded-lg px-3 py-2 text-xs font-medium text-haze transition-colors hover:text-chalk"
              >
                Clear
              </button>
            )}
          </div>

          <p role="status" className="min-h-4 text-xs text-haze-dim">
            {message ?? 'PNG, JPEG, WebP, AVIF or SVG, up to 6 MB. An external URL works too.'}
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders its children into `document.body`.
 *
 * Anything `position: fixed` on this site has to go through here. The page
 * wrapper carries the entrance animation, and an element with a transform —
 * even the identity matrix a finished, filled animation leaves behind —
 * becomes the containing block for every fixed descendant. Without the portal,
 * the reaction tray, the flying particles and the share sheet all anchor
 * themselves to the top of the document instead of the viewport.
 */
export function Overlay({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}

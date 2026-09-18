import { notFound } from 'next/navigation';
import { ReceiptGallery } from './ReceiptGallery';

/**
 * A visual bench for the share receipt.
 *
 * The poster is drawn on a canvas from live data, so the only honest way to
 * check a long headline, a missing image or a seven-figure total is to render
 * them and look. Development only — it never reaches a deployed build.
 */
export const dynamic = 'force-dynamic';

export default function ReceiptDevPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ReceiptGallery />;
}

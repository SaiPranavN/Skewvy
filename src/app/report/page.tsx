import type { Metadata } from 'next';
import { PolicyPage } from '@/components/legal/PolicyPage';
import { ReportForm } from '@/components/legal/ReportForm';
import { turnstileConfigured, turnstileDisabled, turnstileSiteKey } from '@/lib/services/turnstile';
import { absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Report a concern',
  description: 'Tell us about content that breaks the rules or gets the facts wrong.',
  alternates: { canonical: '/report' },
};

export const dynamic = 'force-dynamic';

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  // A link from a page can pre-fill its own address, but only our own.
  const defaultUrl = url && url.startsWith(absoluteUrl('/')) ? url : '';

  return (
    <PolicyPage
      current="/report"
      title="Report a concern"
      intro={
        <p>
          Tell us what happened and where to find it. Reports are reviewed privately and do not change public totals
          automatically.
        </p>
      }
    >
      <ReportForm
        siteKey={turnstileSiteKey()}
        turnstileDisabled={turnstileDisabled()}
        turnstileRequired={turnstileConfigured()}
        defaultUrl={defaultUrl}
      />
    </PolicyPage>
  );
}

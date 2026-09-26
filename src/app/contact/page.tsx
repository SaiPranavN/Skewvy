import Link from 'next/link';
import type { Metadata } from 'next';
import { MailLink, PolicyPage } from '@/components/legal/PolicyPage';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach Skewvy.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <PolicyPage current="/contact" title="Contact">
      <div className="mt-6">
        <p>
          Questions, feedback or account help: <MailLink />
        </p>
        <p>
          To flag content that breaks the rules, the{' '}
          <Link href="/report" className="policy-link">
            Report page
          </Link>{' '}
          is the quickest route — it goes straight to review.
        </p>
      </div>
    </PolicyPage>
  );
}

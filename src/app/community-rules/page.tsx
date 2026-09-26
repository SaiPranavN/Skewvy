import Link from 'next/link';
import type { Metadata } from 'next';
import { PolicyPage, PolicySection } from '@/components/legal/PolicyPage';

export const metadata: Metadata = {
  title: 'Community Rules',
  description: 'Strong criticism is allowed. Abuse is not.',
  alternates: { canonical: '/community-rules' },
};

export default function CommunityRulesPage() {
  return (
    <PolicyPage
      current="/community-rules"
      title="Community Rules"
      intro={
        <p>
          Skewvy exists for expressive but responsible public sentiment. <strong>Strong criticism is allowed. Abuse is
          not.</strong>
        </p>
      }
    >
      <PolicySection title="Aim at actions">
        <p>Criticize actions, decisions, products and public conduct — not someone’s identity or private life.</p>
      </PolicySection>

      <PolicySection title="Do not use Skewvy to">
        <ul>
          <li>Threaten, intimidate or encourage harm.</li>
          <li>Repeatedly harass or target another person.</li>
          <li>Attack people because of protected characteristics.</li>
          <li>Publish private contact, location, family, health or financial information.</li>
          <li>Impersonate another person or organisation.</li>
          <li>Present rumours or unverified accusations as established facts.</li>
          <li>Manipulate totals using bots, scripts, coordinated fake accounts or technical exploits.</li>
          <li>Post spam, scams or malicious links.</li>
          <li>Upload material you do not have the right to use.</li>
          <li>Target private individuals who do not have a legitimate public role.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Where the line is">
        <p>
          Disagreement, humour and sharp criticism are permitted when directed at public actions and decisions.
          Threats, dehumanisation, doxxing and targeted abuse are not.
        </p>
        <p>
          Content or accounts that violate these rules may be limited or removed. Serious or repeated violations may
          result in account suspension.
        </p>
      </PolicySection>

      <PolicySection title="If something is wrong">
        <p>
          If something crosses the line, use the{' '}
          <Link href="/report" className="policy-link">
            Report page
          </Link>
          . If information on a Story or Profile is inaccurate or outdated, report it there too and choose “False or
          misleading factual claim”.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}

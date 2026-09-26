import Link from 'next/link';
import type { Metadata } from 'next';
import { MailLink, PolicyPage, PolicySection } from '@/components/legal/PolicyPage';
import { LEGAL_OPERATOR_NAME, POLICY_VERSIONS, formatPolicyDate } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'The terms for using Skewvy, in plain language.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <PolicyPage current="/terms" title="Terms of Use" effective={formatPolicyDate(POLICY_VERSIONS.terms)}>
      <PolicySection title="About Skewvy">
        <p>
          Skewvy is an independently operated public-sentiment platform
          {LEGAL_OPERATOR_NAME ? <>, run by {LEGAL_OPERATOR_NAME}</> : null}. It allows people to express appreciation
          or criticism about public Stories and Profiles by choosing a position and sending reactions.
        </p>
        <p>
          Skewvy is not affiliated with, sponsored by, or endorsed by the people, companies, organisations,
          governments, products or services displayed on the platform unless we clearly state otherwise.
        </p>
      </PolicySection>

      <PolicySection title="Using Skewvy">
        <p>
          You may browse public content without an account. An account may be required to submit reactions, record an
          opinion, post a comment or use certain sharing features.
        </p>
        <p>
          You are responsible for activity performed through your account and for keeping your sign-in credentials
          secure. Do not impersonate another person, create misleading accounts or attempt to gain access to another
          user’s account.
        </p>
        <p>You must be at least 18 years old to create an account.</p>
      </PolicySection>

      <PolicySection title="Understanding the numbers">
        <p>
          Opinions count unique participating accounts. Reactions count taps and measure intensity. One person can
          send multiple reactions, so reaction totals must not be interpreted as the number of people who agree.
        </p>
        <p>
          Skewvy rankings and sentiment totals are not scientific polls, representative surveys, professional ratings
          or factual findings. They do not prove popularity, quality, wrongdoing or public consensus.
        </p>
        <p>We may remove fraudulent, automated, duplicated or abusive activity and correct totals when necessary.</p>
      </PolicySection>

      <PolicySection title="Stories and Profiles">
        <p>
          Stories are summaries created from publicly available information and linked sources. They may not include
          every fact or later development. Profiles are unofficial pages used to organise public sentiment over time.
        </p>
        <p>
          You should review original sources before relying on a Story. Content on Skewvy is provided for public
          discussion and general information, not as legal, financial, medical or professional advice.
        </p>
      </PolicySection>

      <PolicySection title="User content">
        <p>
          You remain responsible for comments and anything else you submit. You must not post unlawful content,
          threats, harassment, hate, private information, impersonation, spam, copyright-infringing material or claims
          you know to be false.
        </p>
        <p>
          You give Skewvy permission to store, display, format and distribute content you submit only as needed to
          operate and promote the platform. You retain ownership of your original content.
        </p>
      </PolicySection>

      <PolicySection title="Moderation">
        <p>
          We may review, restrict or remove content or accounts that violate these Terms or the{' '}
          <Link href="/community-rules" className="policy-link">
            Community Rules
          </Link>
          . We may also act to protect users, the platform or third parties.
        </p>
        <p>
          Moderation decisions may involve judgment, and we cannot guarantee that every objectionable item will be
          identified immediately. Use the{' '}
          <Link href="/report" className="policy-link">
            Report page
          </Link>{' '}
          to bring a concern to our attention.
        </p>
      </PolicySection>

      <PolicySection title="Intellectual property">
        <p>
          The Skewvy name, design and original platform content belong to Skewvy. Third-party names, logos and
          trademarks belong to their respective owners.
        </p>
        <p>
          Displaying a third-party name or logo does not imply endorsement or affiliation. If you believe material on
          Skewvy infringes your rights, submit a report with enough information for us to review it.
        </p>
      </PolicySection>

      <PolicySection title="Availability">
        <p>
          We aim to keep Skewvy accurate and available, but we cannot promise uninterrupted operation or perfectly
          accurate totals at all times. Features, content and these Terms may change as the platform develops.
        </p>
        <p>
          To the extent permitted by applicable law, Skewvy is provided without guarantees beyond those that cannot
          legally be excluded.
        </p>
      </PolicySection>

      <PolicySection title="Account restriction">
        <p>
          We may restrict or close accounts involved in abuse, manipulation, unlawful activity, security threats or
          repeated rule violations. You may request account deletion by writing to <MailLink />.
        </p>
      </PolicySection>

      <PolicySection title="Changes">
        <p>
          We may update these Terms as Skewvy evolves. Material changes will be reflected by changing the effective
          date and, where appropriate, notifying registered users.
        </p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>
          Questions about these Terms may be sent to <MailLink />.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}

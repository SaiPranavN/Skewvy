import type { Metadata } from 'next';
import { MailLink, PolicyPage, PolicySection } from '@/components/legal/PolicyPage';
import { BROWSER_STORAGE, POLICY_VERSIONS, SERVICE_PROVIDERS, formatPolicyDate } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy Notice',
  description: 'What Skewvy collects, why, and what you can do about it.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <PolicyPage current="/privacy" title="Privacy Notice" effective={formatPolicyDate(POLICY_VERSIONS.privacy)}>
      <PolicySection title="What Skewvy collects">
        <p>
          When you create or use an account, Skewvy may collect your display name, email address, securely hashed PIN,
          verification status, reactions, opinions, comments and content you choose to submit.
        </p>
        <p>
          We may also process session information, approximate device and browser information, security logs,
          IP-derived anti-abuse information and identifiers needed to prevent duplicate or fraudulent activity. IP
          addresses are stored only in hashed form.
        </p>
        <p>We do not store your PIN in readable form.</p>
      </PolicySection>

      <PolicySection title="How the information is used">
        <p>We use this information to:</p>
        <ul>
          <li>Create and secure your account.</li>
          <li>Verify your email address.</li>
          <li>Record opinions and reactions.</li>
          <li>Display content you choose to make public.</li>
          <li>Restore sessions and recover accounts.</li>
          <li>Prevent spam, manipulation and abuse.</li>
          <li>Diagnose errors and improve Skewvy.</li>
          <li>Respond to reports, corrections and support requests.</li>
        </ul>
      </PolicySection>

      <PolicySection title="What becomes public">
        <p>Your display name, comments and activity intentionally presented as public may be visible to other visitors.</p>
        <p>Your email address, PIN hash, session tokens and security information are not displayed publicly.</p>
        <p>Reaction and opinion totals may be shown publicly in aggregated form.</p>
      </PolicySection>

      <PolicySection title="Service providers">
        <p>
          Skewvy uses a small number of service providers. They process limited information on Skewvy’s behalf only to
          deliver their services:
        </p>
        <ul>
          {SERVICE_PROVIDERS.map((provider) => (
            <li key={provider.name}>
              <strong>{provider.name}</strong> — {provider.purpose}.
            </li>
          ))}
        </ul>
        <p>Skewvy does not sell personal information.</p>
      </PolicySection>

      <PolicySection title="Cookies and local storage">
        <p>
          Skewvy uses only essential storage — to keep you signed in and protect accounts. There are no advertising or
          analytics cookies.
        </p>
        <ul>
          {BROWSER_STORAGE.map((item) => (
            <li key={item.name}>
              <strong>{item.name}</strong> — {item.purpose}.
            </li>
          ))}
        </ul>
        <p>If non-essential tracking is ever introduced, this notice will change and you will be asked first.</p>
      </PolicySection>

      <PolicySection title="Retention">
        <p>
          We retain account information while an account remains active and for a reasonable period when needed for
          security, fraud prevention, dispute handling or legal obligations.
        </p>
        <p>
          Verification and PIN-reset links expire within an hour and cannot be reused. Signing out revokes your session.
        </p>
      </PolicySection>

      <PolicySection title="Your choices">
        <p>
          You may request access, correction or deletion of your account information by writing to <MailLink />.
        </p>
        <p>
          Deleting an account may not immediately remove anonymised totals, security records that must temporarily be
          retained, or content that has already been lawfully de-identified.
        </p>
      </PolicySection>

      <PolicySection title="Security">
        <p>
          Skewvy uses reasonable technical and organisational safeguards to protect account information. No online
          service can guarantee absolute security.
        </p>
      </PolicySection>

      <PolicySection title="Age">
        <p>Skewvy accounts are intended for people aged 18 or older.</p>
      </PolicySection>

      <PolicySection title="Changes">
        <p>We may update this Privacy Notice as Skewvy changes. The effective date identifies the latest version.</p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>
          Privacy questions or requests may be sent to <MailLink />.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}

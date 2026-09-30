import { REACTION_VOICES } from '@/lib/moodstamps/catalog';
import { verifiedBadge, type MoodStampArtworkData } from '@/lib/moodstamps/types';
import { EggMark, MedalMark } from './MoodStampMarks';

const STATE_BADGE: Record<MoodStampArtworkData['state'], string> = {
  preview: 'Preview',
  sent: 'Sent',
  unopened: 'Unopened',
  opened: 'Opened',
};

export function formatStampDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso),
  );
}

export function stampDateLine(data: Pick<MoodStampArtworkData, 'state' | 'date'>): string {
  const verb = data.state === 'preview' ? 'Drafted' : data.state === 'sent' ? 'Sent' : 'Delivered';
  return `${verb} ${formatStampDate(data.date)}`;
}

/**
 * A MoodStamp, drawn in the page.
 *
 * Laid out in container units, so the same component is right at any width —
 * the preview, the stamp's own page, a thumbnail. Below a phone's width the
 * reasons stack and the small type holds a readable minimum instead of
 * shrinking with the poster: on a phone the stamp is for reading, and the
 * poster proportions belong to the downloaded image.
 *
 * The edges are perforated with masks and the hard shadow comes from a
 * drop-shadow, which follows the perforation rather than the box.
 */
export function MoodStampArtwork({ data, className = '' }: { data: MoodStampArtworkData; className?: string }) {
  const voice = REACTION_VOICES[data.reaction];
  const tone = data.reaction === 'medal' ? 'var(--color-medal)' : 'var(--color-egg)';
  const unit = data.quantity === 1 ? voice.singular : voice.plural;
  const longest = Math.max(4, ...data.emotion.split(/\s+/).map((word) => word.length));
  const emotionSize = `min(14.5cqi, calc(88cqi / ${(longest * 0.72).toFixed(2)}))`;
  const from = data.anonymous ? 'Anonymous' : data.senderName;
  const badge = STATE_BADGE[data.state];
  const verified = data.senderVerified !== false;

  return (
    <div className={`msa-root ${className}`} style={{ '--tone': tone } as React.CSSProperties}>
      <div className="msa-shadow">
        <div className="msa-perf">
          <article
            className="msa"
            aria-label={`MoodStamp: ${voice.lead} ${data.emotion}. ${data.quantity} ${unit} from ${from} to ${data.recipientName}.`}
          >
            <div className="msa-inner">
              <header className="msa-head">
                <span className="msa-site">skewvy.com</span>
                <span className="msa-brand">MoodStamp</span>
              </header>

              <ul className="msa-badges" aria-label="Status">
                <li>Private</li>
                <li data-solid="">{badge}</li>
                <li>{verifiedBadge(data)}</li>
              </ul>

              <p className="msa-lead">{voice.lead}</p>
              <p className="msa-emotion" style={{ fontSize: emotionSize }}>
                {data.emotion}
              </p>

              <div className="msa-count">
                <span className="msa-number">{data.quantity}</span>
                <span className="msa-unit">
                  <span className="msa-unit-word">{unit}</span>
                  <span className="msa-tag">Delivered to you!!!</span>
                </span>
                <span className="msa-tile" aria-hidden="true">
                  {data.reaction === 'medal' ? <MedalMark /> : <EggMark />}
                </span>
              </div>

              <div className="msa-people">
                <p className="msa-person">
                  <span className="msa-person-label">From:</span>
                  <span className="msa-person-name">{from}</span>
                  {data.anonymous && verified && (
                    <span className="msa-verified">
                      <span aria-hidden="true">✓</span> Identity verified by Skewvy
                    </span>
                  )}
                  {!data.anonymous && !verified && <span className="msa-verified">Name given by the sender</span>}
                </p>
                <p className="msa-person msa-person-to">
                  <span className="msa-person-label">To:</span>
                  <span className="msa-person-name">{data.recipientName}</span>
                </p>
              </div>

              <section className="msa-reasons" aria-label={voice.intent}>
                <header className="msa-reasons-head">
                  <span className="msa-intent">{voice.intent}</span>
                  <span className="msa-intent-aside">{voice.intentAside}</span>
                </header>
                {voice.reasons.map((prompt, index) => (
                  <div key={prompt.label} className={`msa-row ${index === 2 ? 'msa-row-lead' : ''}`}>
                    <span className="msa-row-label">
                      <span className="msa-row-number">{String(index + 1).padStart(2, '0')}</span> {prompt.label}
                    </span>
                    <q className="msa-row-text">{data.reasons[index]}</q>
                  </div>
                ))}
              </section>

              <footer className="msa-foot">
                <div>
                  <p className="msa-foot-strong">
                    {data.receiptCode ? `Receipt ${data.receiptCode}` : 'Receipt number assigned when sent'}
                  </p>
                  <p className="msa-foot-small">A feeling, counted and delivered by skewvy.com</p>
                </div>
                <div className="msa-foot-right">
                  <p className="msa-foot-strong">{stampDateLine(data)}</p>
                  <span className="msa-seal">Private · {badge}</span>
                </div>
              </footer>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

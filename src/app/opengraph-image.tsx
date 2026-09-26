import { ImageResponse } from 'next/og';

/**
 * The picture shown when a Skewvy link is shared and the page has no image of
 * its own: the wordmark and the promise, in the house colours.
 */
export const alt = 'Skewvy — throw eggs at what deserves it, hand medals to what earned it.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#14110f',
          color: '#f7f2e7',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 900, letterSpacing: '-0.03em' }}>
          skewvy<span style={{ color: '#ff6b45' }}>.com</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 84, fontWeight: 900, lineHeight: 1.02 }}>
          <span>Throw eggs at what deserves it.</span>
          <span style={{ color: '#ffcb2f' }}>Hand medals to what earned it.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 30, color: '#b9b2a4' }}>
          <div style={{ display: 'flex', width: 360, height: 18, border: '3px solid #f7f2e7' }}>
            <div style={{ width: '62%', background: '#ffcb2f' }} />
            <div style={{ width: '38%', background: '#ff6b45' }} />
          </div>
          Public sentiment, counted.
        </div>
      </div>
    ),
    size,
  );
}

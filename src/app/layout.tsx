import type { Metadata, Viewport } from 'next';
import { Archivo, Archivo_Black } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ReactionProvider } from '@/components/reactions/ReactionProvider';
import { getCurrentUser } from '@/lib/auth/current-user';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';

/*
 * Archivo carries the interface; Archivo Black carries every display size —
 * the headline, the counters, the section titles. The variable face covers
 * 400–800, so `font-synthesis-weight: none` never has anything to fake.
 */
const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-archivo',
});

const archivoBlack = Archivo_Black({
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
  variable: '--font-archivo-black',
});

/*
 * Site-wide defaults. Each page sets its own title, description and canonical
 * address on top of these; the canonical is deliberately not set here, or
 * every page that forgot its own would claim to be the home page.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'Skewvy',
    'skewvy.com',
    'public sentiment',
    'public opinion',
    'rotten eggs',
    'medals',
    'react to news',
    'opinion poll',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'news',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  // Set GOOGLE_SITE_VERIFICATION to the code Search Console gives for the
  // "HTML tag" method; nothing is emitted until it is.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: '#14110f',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${archivo.variable} ${archivoBlack.variable}`}>
      <body className="overflow-x-clip pb-24">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-ground"
        >
          Skip to content
        </a>

        <ReactionProvider isAuthenticated={Boolean(user)}>
          {/* The masthead sticks rather than floats, so nothing sits under it. */}
          <SiteHeader user={user} />
          <main id="main">{children}</main>
          <SiteFooter />
        </ReactionProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { Archivo, Archivo_Black } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ReactionProvider } from '@/components/reactions/ReactionProvider';
import { getCurrentUser } from '@/lib/auth/current-user';

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

export const metadata: Metadata = {
  title: {
    default: 'Skewvy — Public sentiment, counted',
    template: '%s · Skewvy',
  },
  description:
    'React to the stories, decisions and entities shaping the moment. Send Rotten Eggs when something deserves criticism. Award Medals when it deserves recognition.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Skewvy — Public sentiment, counted',
    description: 'Every tap adds to the reaction total. Every person counts once in the public opinion.',
    siteName: 'Skewvy',
    type: 'website',
  },
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

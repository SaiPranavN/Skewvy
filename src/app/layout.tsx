import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ReactionProvider } from '@/components/reactions/ReactionProvider';
import { getCurrentUser } from '@/lib/auth/current-user';

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
  themeColor: '#08090b',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-ground"
        >
          Skip to content
        </a>

        <ReactionProvider isAuthenticated={Boolean(user)}>
          <SiteHeader user={user} />
          {/* The masthead is fixed; the hero pulls back up under it. */}
          <main id="main" className="pt-[68px]">
            {children}
          </main>
          <SiteFooter />
        </ReactionProvider>
      </body>
    </html>
  );
}

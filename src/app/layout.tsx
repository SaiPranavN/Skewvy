import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ReactionProvider } from '@/components/reactions/ReactionProvider';
import { getCurrentUser } from '@/lib/auth/current-user';

export const metadata: Metadata = {
  title: {
    default: 'Skewvy — No press release survives the crowd',
    template: '%s · Skewvy',
  },
  description:
    'Send Rotten Eggs when the internet deserves an explanation. Give Medals when someone actually gets it right. Every tap turns public mood into a number nobody can spin.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Skewvy — No press release survives the crowd',
    description: 'A global sentiment playground. 🥚 or 🏅 — the counter is unforgiving.',
    siteName: 'Skewvy',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#07070d',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <div className="ambient-ground" aria-hidden="true" />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-brand focus:px-5 focus:py-3 focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>

        <ReactionProvider isAuthenticated={Boolean(user)}>
          <SiteHeader user={user} />
          <main id="main">{children}</main>
          <SiteFooter />
        </ReactionProvider>
      </body>
    </html>
  );
}

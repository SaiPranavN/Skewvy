import Image from 'next/image';
import Link from 'next/link';
import { isVectorSource } from '@/components/ui/Media';

/**
 * Landing hero: a full-bleed photograph, a single centred statement, one
 * action.
 *
 * It sits under the fixed masthead (hence the negative offset) so the image
 * runs to the very top of the window, and carries a neutral black scrim — the
 * only job of which is keeping the headline legible over the picture.
 */
export function Hero({ imageUrl, isAuthenticated }: { imageUrl: string; isAuthenticated: boolean }) {
  return (
    <section className="relative -mt-[68px] flex min-h-[min(100svh,860px)] flex-col justify-center overflow-hidden pt-[68px]">
      <div className="absolute inset-0">
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          unoptimized={isVectorSource(imageUrl)}
          className="object-cover object-[62%_center]"
        />
        {/* Neutral darkening for legibility — no colour wash. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(8_9_11/0.72)_0%,rgb(8_9_11/0.5)_38%,rgb(8_9_11/0.8)_100%)]"
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
        <h1 className="max-w-[17ch] text-balance text-[2.5rem] font-medium leading-[1.06] tracking-[-0.035em] text-primary sm:text-[3.5rem] lg:text-[4.5rem]">
          Express your emotion with eggs or medals
        </h1>

        <p className="mt-6 max-w-[52ch] text-pretty text-[0.9375rem] leading-relaxed text-secondary sm:text-lg">
          React to the people, products, decisions and headlines that matter. Send Rotten Eggs when they disappoint.
          Award Medals when they deserve recognition.
        </p>

        {/*
          * Straight into the catalogue, signed in or not. Signing in belongs to
          * the masthead; the hero's only job is getting someone to the reactions.
          */}
        <Link
          href="/flash-news"
          className="mt-10 inline-flex min-h-[52px] items-center rounded-md bg-primary px-9 text-sm font-medium uppercase tracking-[0.06em] text-ground transition-opacity duration-150 hover:opacity-90"
        >
          Get started
        </Link>

        <p className="mt-6 text-sm text-tertiary">
          {isAuthenticated ? 'Every tap counts. You count once.' : 'Browse freely. Sign in when you want to react.'}
        </p>
      </div>
    </section>
  );
}

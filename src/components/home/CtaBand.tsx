import Link from 'next/link';

/**
 * The closing band. One flat field of indigo — the only place on the site where
 * a colour is used at full width, which is what makes it read as an ending
 * rather than another section.
 */
export function CtaBand() {
  return (
    <section className="rail">
      <div className="flex flex-wrap items-center gap-[clamp(24px,4vw,64px)] bg-[color:var(--color-indigo)] p-[clamp(26px,4vw,64px)]">
        <div className="min-w-[min(100%,280px)] flex-[1_1_460px]">
          <h2 className="display m-0 text-[clamp(32px,4.4vw,62px)] text-paper">Somebody is being wrong right now.</h2>
          <p className="mt-4 max-w-[44ch] text-[clamp(15px,1.25vw,19px)] leading-[1.5] text-paper/85">
            Go see what the crowd is reacting to. Bring eggs, or bring medals. Bring both and pick one.
          </p>
        </div>

        <div className="flex flex-none flex-col gap-3">
          <Link href="/flash-news" className="btn justify-start bg-ink px-6 py-4 text-[14px] font-extrabold text-paper">
            Browse Stories →
          </Link>
          <Link
            href="/entities"
            className="btn justify-start border-2 border-paper px-6 py-4 text-[14px] font-extrabold text-paper"
          >
            Browse Profiles →
          </Link>
        </div>
      </div>
    </section>
  );
}

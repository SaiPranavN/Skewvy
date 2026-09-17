/**
 * The masthead of a listing page: an indigo eyebrow, the title at display
 * scale, and a narrow description.
 *
 * The description is deliberately held to a short measure rather than run to
 * the full rail — beside a headline this large, a full-width paragraph reads as
 * a second, competing block.
 */
export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="pt-[clamp(24px,3.2vw,52px)]">
      <p className="eyebrow text-[color:var(--color-indigo-soft)]">{eyebrow}</p>

      <h1 className="display mt-3.5 text-[clamp(38px,5.4vw,80px)]">{title}</h1>

      {description && (
        <p className="mt-[clamp(14px,1.8vw,22px)] max-w-[44ch] text-[clamp(15px,1.15vw,17px)] leading-[1.5] text-secondary">
          {description}
        </p>
      )}

      {children}
    </div>
  );
}

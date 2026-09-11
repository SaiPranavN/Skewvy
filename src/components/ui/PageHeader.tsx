/**
 * Listing page identity. Deliberately compact so the first content row is
 * visible without scrolling at a normal laptop viewport.
 */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-[1.75rem] font-semibold tracking-[-0.025em] text-primary sm:text-[2rem]">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">{description}</p>
      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}

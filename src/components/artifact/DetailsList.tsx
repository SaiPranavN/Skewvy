import { isLinkDetail, linkHost, type ArtifactDetail } from '@/lib/domain/details';

/**
 * The facts about a subject, as a two-column list: label, then value. A value
 * that is a web address shows as its site name and opens in a new tab.
 *
 * Colours come from the semantic tokens, so the same list reads correctly on
 * the dark ground and inside a paper panel.
 */
export function DetailsList({ details, className = '' }: { details: ArtifactDetail[]; className?: string }) {
  if (details.length === 0) return null;

  return (
    <dl className={`grid grid-cols-[minmax(84px,max-content)_minmax(0,1fr)] gap-x-5 gap-y-2.5 ${className}`}>
      {details.map((detail, index) => (
        <div key={`${detail.label}-${index}`} className="contents">
          <dt className="pt-[3px] text-[11px] font-bold uppercase leading-[1.3] tracking-[0.08em] text-tertiary">
            {detail.label}
          </dt>
          <dd className="m-0 min-w-0 break-words text-[14.5px] font-semibold leading-[1.45] text-primary">
            {isLinkDetail(detail) ? (
              <a
                href={detail.value}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline decoration-2 underline-offset-4 hover:text-brand"
              >
                {linkHost(detail.value)} ↗
              </a>
            ) : (
              detail.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

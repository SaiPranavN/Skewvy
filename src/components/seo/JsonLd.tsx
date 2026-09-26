/**
 * Structured data for search engines, as a JSON-LD script.
 *
 * `<` is escaped so nothing inside a headline or a description can close the
 * script tag early.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

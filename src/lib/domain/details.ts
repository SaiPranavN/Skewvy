/**
 * Facts about a Profile or Story — "Profession: Cricketer", "Headquarters:
 * Mumbai" — entered by an editor alongside the description.
 *
 * An ordered list of label/value pairs rather than fixed columns: what is worth
 * knowing about a cricketer, a central bank and a video game has almost
 * nothing in common, and a column per possibility would be mostly empty. The
 * order is the editor's, and it is the order the page shows.
 */
export interface ArtifactDetail {
  label: string;
  value: string;
}

export const DETAILS_MAX = 12;
export const DETAIL_LABEL_MAX = 40;
export const DETAIL_VALUE_MAX = 300;

/** The fields an editor is offered for each Profile category. All optional. */
export const SUGGESTED_DETAILS: Record<string, string[]> = {
  People: ['Profession', 'Country', 'Known for', 'Reference'],
  Companies: ['Industry', 'Headquarters', 'Parent company', 'Website'],
  Institutions: ['Type', 'Jurisdiction', 'Headquarters', 'Website'],
  Governments: ['Level', 'Jurisdiction', 'Capital', 'Website'],
  Products: ['Type', 'Made by', 'Release date', 'Platforms'],
  Media: ['Type', 'Owner', 'Website'],
  'Sports Teams': ['Sport', 'Country', 'Governing body', 'Website'],
  Organisations: ['Type', 'Headquarters', 'Founded', 'Website'],
};

/** Stories are events; these are the facts most of them have. */
export const SUGGESTED_STORY_DETAILS = ['Where', 'When', 'Who is involved'];

/** Reads the stored JSON, tolerating anything malformed as "no details". */
export function parseDetails(raw: unknown): ArtifactDetail[] {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ArtifactDetail =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as ArtifactDetail).label === 'string' &&
          typeof (item as ArtifactDetail).value === 'string',
      )
      .map((item) => ({ label: item.label.trim(), value: item.value.trim() }))
      .filter((item) => item.label && item.value)
      .slice(0, DETAILS_MAX);
  } catch {
    return [];
  }
}

export function serializeDetails(details: ArtifactDetail[]): string | null {
  const clean = details
    .map((item) => ({ label: item.label.trim(), value: item.value.trim() }))
    .filter((item) => item.label && item.value)
    .slice(0, DETAILS_MAX);
  return clean.length > 0 ? JSON.stringify(clean) : null;
}

export function isLinkDetail(detail: ArtifactDetail): boolean {
  return /^https?:\/\//i.test(detail.value);
}

/** "https://www.rbi.org.in/path" → "rbi.org.in", for showing a link compactly. */
export function linkHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

/** Labels that describe the record rather than the subject; kept off cards. */
const BOOKKEEPING = /^(verified|last checked|updated)/i;

/**
 * The one line a card has room for: the first couple of plain facts, values
 * only. Links and bookkeeping ("Verified as of") are for the full page.
 */
export function cardDetailLine(details: ArtifactDetail[] | undefined, count = 2): string | null {
  const values = (details ?? [])
    .filter((detail) => !isLinkDetail(detail) && !BOOKKEEPING.test(detail.label))
    .slice(0, count)
    .map((detail) => detail.value);
  return values.length > 0 ? values.join(' · ') : null;
}

const LABEL_OVERRIDES: Record<string, string> = {
  official_url: 'Website',
  reference_url: 'Reference',
  institution_type: 'Type',
  government_level: 'Level',
  organisation_type: 'Type',
  media_type: 'Type',
  product_type: 'Type',
};

/**
 * Turns an imported `{ snake_case_key: value }` object into details, for data
 * that arrives from outside the admin form.
 */
export function detailsFromObject(object: Record<string, unknown> | null | undefined): ArtifactDetail[] {
  if (!object) return [];
  const details: ArtifactDetail[] = [];
  for (const [key, raw] of Object.entries(object)) {
    const value = Array.isArray(raw) ? raw.map(String).join(', ') : raw === null || raw === undefined ? '' : String(raw);
    if (!value.trim()) continue;
    const label =
      LABEL_OVERRIDES[key] ?? key.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
    details.push({ label, value: value.trim() });
  }
  return details.slice(0, DETAILS_MAX);
}

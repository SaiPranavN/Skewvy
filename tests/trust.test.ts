import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, truncateAll, registerFully, createVerifiedUser } from './helpers';
import { queryOne } from '@/lib/db';
import { POLICY_VERSIONS } from '@/lib/legal';
import { createSiteReport, listOpenSiteReports, resolveSiteReport, countOpenSiteReports } from '@/lib/services/site-reports';
import { siteReportSchema } from '@/lib/validation/schemas';
import { createFlashNews, getFlashNewsById, updateFlashNews } from '@/lib/services/content';

beforeAll(setupTestDatabase);
afterAll(teardownTestDatabase);
beforeEach(truncateAll);

describe('policy acceptance at sign-up', () => {
  it('records the Terms and Privacy versions shown when Continue was clicked', async () => {
    const result = await registerFully({ email: 'new@example.test', pin: 'correct-horse-9' });
    expect(result.status).toBe('signed_in');

    const row = await queryOne<{ terms_version: string; privacy_version: string; policies_accepted_at: string }>(
      'SELECT terms_version, privacy_version, policies_accepted_at FROM users WHERE email_normalized = $1',
      ['new@example.test'],
    );
    expect(row?.terms_version).toBe(POLICY_VERSIONS.terms);
    expect(row?.privacy_version).toBe(POLICY_VERSIONS.privacy);
    expect(row?.policies_accepted_at).toBeTruthy();
  });
});

describe('the public report form', () => {
  const valid = {
    targetUrl: 'https://skewvy.com/flash-news/example',
    reason: 'false_claim',
    details: 'The date in this summary is a year out.',
    turnstileToken: 'token',
  };

  it('accepts a report with the optional fields left blank', () => {
    expect(siteReportSchema.safeParse({ ...valid, evidenceUrl: '', contactEmail: '' }).success).toBe(true);
  });

  it('refuses a missing reason, a non-web address and a one-word complaint', () => {
    expect(siteReportSchema.safeParse({ ...valid, reason: 'dislike' }).success).toBe(false);
    expect(siteReportSchema.safeParse({ ...valid, targetUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(siteReportSchema.safeParse({ ...valid, details: 'bad' }).success).toBe(false);
    expect(siteReportSchema.safeParse({ ...valid, contactEmail: 'not-an-email' }).success).toBe(false);
  });

  it('stores reports privately and closes them once reviewed', async () => {
    const reporter = await createVerifiedUser();
    const admin = await createVerifiedUser('admin@example.test');
    await createSiteReport({
      targetUrl: valid.targetUrl,
      reason: 'harassment',
      details: 'Threatening comment near the bottom.',
      contactEmail: 'me@example.test',
      reporterId: reporter,
      ip: '203.0.113.9',
    });

    const [report] = await listOpenSiteReports();
    expect(report.reason).toBe('harassment');
    expect(report.contactEmail).toBe('me@example.test');
    // The address is kept hashed, never as typed.
    const stored = await queryOne<{ ip_hash: string }>('SELECT ip_hash FROM site_reports');
    expect(stored?.ip_hash).not.toContain('203.0.113.9');

    expect(await resolveSiteReport(report.id, admin)).toBe(true);
    expect(await resolveSiteReport(report.id, admin)).toBe(false);
    expect(await countOpenSiteReports()).toBe(0);
  });
});

describe('editorial status on a Story', () => {
  const story = (status: string | null) => ({
    headline: 'A story whose facts are moving',
    slug: 'moving-story',
    summary: '',
    body: '',
    category: 'Business',
    status: 'published' as const,
    editorialStatus: status as never,
    entityIds: [],
  });

  it('is absent unless an editor sets it, and can be changed or cleared', async () => {
    const created = await createFlashNews(story(null));
    expect(created.editorialStatus).toBeNull();

    await updateFlashNews(created.id, story('developing'));
    expect((await getFlashNewsById(created.id))?.editorialStatus).toBe('developing');

    await updateFlashNews(created.id, story(''));
    expect((await getFlashNewsById(created.id))?.editorialStatus).toBeNull();
  });
});

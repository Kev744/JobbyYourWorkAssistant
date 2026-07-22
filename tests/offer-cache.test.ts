import { buildOfferQueryHash, getCacheExpiresAt, stableStringify } from '@/lib/offers/cache';

describe('offer cache helpers', () => {
  it('hashes equivalent query objects deterministically', () => {
    const first = buildOfferQueryHash('adzuna', {
      what: 'Developpeur',
      where: 'Paris',
      salary_min: '45000',
    });
    const second = buildOfferQueryHash('adzuna', {
      salary_min: '45000',
      where: 'Paris',
      what: 'Developpeur',
    });

    expect(first).toBe(second);
  });

  it('includes provider source in the cache hash', () => {
    const query = { what: 'Developpeur', where: 'Paris' };

    expect(buildOfferQueryHash('adzuna', query)).not.toBe(
      buildOfferQueryHash('france_travail', query),
    );
  });

  it('keeps nested object keys stable', () => {
    expect(stableStringify({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  it('sets cache expiration to 24 hours', () => {
    const now = new Date('2026-05-05T08:00:00.000Z');

    expect(getCacheExpiresAt(now).toISOString()).toBe('2026-05-06T08:00:00.000Z');
  });
});

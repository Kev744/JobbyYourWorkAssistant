import { buildAdzunaQuery, searchAdzunaOffers } from '@/lib/adzuna/offers';

describe('buildAdzunaQuery', () => {
  it('maps profession, city, radius and salary filters', () => {
    const query = buildAdzunaQuery({
      requirements: {
        id: 'req-1',
        professionKeywords: 'Développeur React',
        city: { code: '75056', name: 'Paris' },
        radiusKm: 25,
        contractTypes: [],
        disabledAccepted: false,
        salaryMinAnnualGrossEur: 45_000,
        experienceLevel: '',
        availability: '',
        remotePreference: '',
        companyName: '',
        providerNotes: [],
        createdAt: '',
        updatedAt: '',
      },
      limit: 12,
    });

    expect(query.what).toBe('Développeur React');
    expect(query.where).toBe('Paris');
    expect(query.distance).toBe('25');
    expect(query.salary_min).toBe('45000');
    expect(query.results_per_page).toBe('12');
  });

  it('maps full-time, permanent and company filters', () => {
    const query = buildAdzunaQuery({
      requirements: {
        id: 'req-1',
        professionKeywords: '',
        department: { code: '75', name: 'Paris' },
        radiusKm: 10,
        contractTypes: [],
        disabledAccepted: false,
        fullTime: true,
        permanent: true,
        experienceLevel: '',
        availability: '',
        remotePreference: '',
        companyName: 'Acme',
        providerNotes: [],
        createdAt: '',
        updatedAt: '',
      },
      profession: 'Data analyst',
    });

    expect(query.what).toBe('Data analyst');
    expect(query.where).toBe('Paris');
    expect(query.full_time).toBe('1');
    expect(query.permanent).toBe('1');
    expect(query.company).toBe('Acme');
  });

  it('fetches Adzuna pages until the last upstream result', async () => {
    const originalFetch = global.fetch;
    const originalAppId = process.env.ADZUNA_API_ID;
    const originalAppKey = process.env.ADZUNA_API_KEY;
    process.env.ADZUNA_API_ID = 'app-id';
    process.env.ADZUNA_API_KEY = 'app-key';
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            count: 3,
            results: [adzunaOffer('1', 'Developpeur React'), adzunaOffer('2', 'Developpeur Node')],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            count: 3,
            results: [adzunaOffer('3', 'Developpeur Next.js')],
          }),
          { status: 200 },
        ),
      );

    try {
      const result = await searchAdzunaOffers({
        profession: 'Developpeur',
        pageSize: 2,
      });

      expect(result.offers.map((offer) => offer.sourceOfferId)).toEqual(['1', '2', '3']);
      expect(result.upstreamQuery.results_per_page).toBe('2');
      expect(jest.mocked(global.fetch).mock.calls.map((call) => String(call[0]))).toEqual([
        expect.stringContaining('/search/1?'),
        expect.stringContaining('/search/2?'),
      ]);
    } finally {
      global.fetch = originalFetch;
      process.env.ADZUNA_API_ID = originalAppId;
      process.env.ADZUNA_API_KEY = originalAppKey;
    }
  });
});

function adzunaOffer(id: string, title: string) {
  return {
    id,
    title,
    description: `${title} en CDI`,
    created: '2026-05-01T10:00:00Z',
    redirect_url: `https://example.test/jobs/${id}`,
    location: {
      display_name: 'Paris',
      area: ['France', 'Ile-de-France', 'Paris'],
    },
  };
}

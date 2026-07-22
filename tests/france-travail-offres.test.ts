import { buildFranceTravailQuery, searchFranceTravailOffers } from '@/lib/france-travail/offres';

describe('buildFranceTravailQuery', () => {
  it('uses ROME code before keywords when available', () => {
    const query = buildFranceTravailQuery({
      romeCode: 'M1805',
      profession: 'Développeur',
      limit: 10,
    });

    expect(query.codeROME).toBe('M1805');
    expect(query.motsCles).toBeUndefined();
    expect(query.range).toBe('0-9');
  });

  it('maps saved city, radius, contract types and accessibility filters', () => {
    const query = buildFranceTravailQuery({
      requirements: {
        id: 'req-1',
        professionKeywords: 'Développeur',
        city: { code: '75056', name: 'Paris' },
        radiusKm: 20,
        contractTypes: ['CDI', 'CDD', 'INTERIM'],
        disabledAccepted: true,
        experienceLevel: '2',
        availability: '',
        remotePreference: '',
        companyName: '',
        providerNotes: [],
        createdAt: '',
        updatedAt: '',
      },
    });

    expect(query.motsCles).toBe('Développeur');
    expect(query.commune).toBe('75056');
    expect(query.rayon).toBe('20');
    expect(query.typeContrat).toBe('CDI,CDD,MIS');
    expect(query.accessibleTH).toBe('true');
  });

  it('maps France Travail contract natures for stage, apprenticeship and POE', () => {
    const query = buildFranceTravailQuery({
      requirements: {
        id: 'req-1',
        professionKeywords: 'DÃ©veloppeur',
        radiusKm: 20,
        contractTypes: ['STAGE', 'APPRENTISSAGE', 'POE'],
        disabledAccepted: false,
        experienceLevel: '',
        availability: '',
        remotePreference: '',
        companyName: '',
        providerNotes: [],
        createdAt: '',
        updatedAt: '',
      },
    });

    expect(query.typeContrat).toBeUndefined();
    expect(query.natureContrat).toBe('FA,E2,FV');
  });

  it('keeps legacy alternance values compatible with apprenticeship searches', () => {
    const query = buildFranceTravailQuery({
      requirements: {
        id: 'req-1',
        professionKeywords: 'DÃ©veloppeur',
        radiusKm: 20,
        contractTypes: ['ALTERNANCE'],
        disabledAccepted: false,
        experienceLevel: '',
        availability: '',
        remotePreference: '',
        companyName: '',
        providerNotes: [],
        createdAt: '',
        updatedAt: '',
      },
    });

    expect(query.natureContrat).toBe('E2');
  });

  it('fetches France Travail pages until the last upstream result', async () => {
    const originalFetch = global.fetch;
    const originalClientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
    const originalClientKey = process.env.FRANCE_TRAVAIL_CLIENT_KEY;
    process.env.FRANCE_TRAVAIL_CLIENT_ID = 'client-id';
    process.env.FRANCE_TRAVAIL_CLIENT_KEY = 'client-key';
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token', expires_in: 300 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            resultats: [
              franceTravailOffer('1', 'Developpeur React'),
              franceTravailOffer('2', 'Developpeur Node'),
            ],
          }),
          { status: 200, headers: { 'content-range': '0-1/3' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ resultats: [franceTravailOffer('3', 'Developpeur Next.js')] }), {
          status: 200,
          headers: { 'content-range': '2-2/3' },
        }),
      );

    try {
      const result = await searchFranceTravailOffers({
        profession: 'Developpeur',
        pageSize: 2,
      });

      expect(result.offers.map((offer) => offer.sourceOfferId)).toEqual(['1', '2', '3']);
      expect(result.upstreamQuery.range).toBe('0-3');
      expect(jest.mocked(global.fetch).mock.calls.map((call) => String(call[0]))).toEqual([
        expect.stringContaining('access_token'),
        expect.stringContaining('range=0-1'),
        expect.stringContaining('range=2-3'),
      ]);
    } finally {
      global.fetch = originalFetch;
      process.env.FRANCE_TRAVAIL_CLIENT_ID = originalClientId;
      process.env.FRANCE_TRAVAIL_CLIENT_KEY = originalClientKey;
    }
  });
});

function franceTravailOffer(id: string, title: string) {
  return {
    id,
    intitule: title,
    description: `${title} en CDI`,
    dateCreation: '2026-05-01T10:00:00Z',
    lieuTravail: {
      libelle: 'Paris',
      codePostal: '75001',
      commune: '75056',
    },
    typeContrat: 'CDI',
  };
}

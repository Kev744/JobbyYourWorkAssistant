import { scoreOffersWithOpenAI } from '@/lib/match/openai-scoring';
import type { CandidateResume, JobOffer } from '@/types';

const originalFetch = global.fetch;
const originalOpenAiKey = process.env.OPENAI_KEY;
const originalOpenAiMatchModel = process.env.OPENAI_MATCH_MODEL;
const originalOpenAiModel = process.env.OPENAI_MODEL;

const candidate: CandidateResume = {
  candidateId: 'candidate-1',
  headline: 'Developpeur full-stack TypeScript',
  location: {
    city: 'Paris',
    remotePreference: 'hybrid',
  },
  titles: [{ raw: 'Developpeur full-stack', canonicalRomeCode: 'M1805' }],
  experiences: [
    {
      titleRaw: 'Developpeur full-stack',
      canonicalRomeCode: 'M1805',
      startDate: '2020-01',
      endDate: '2024-01',
      summary: 'Applications React et Node.js',
      skills: [{ raw: 'TypeScript' }, { raw: 'React' }, { raw: 'Node.js' }],
    },
  ],
  skills: [{ raw: 'TypeScript' }, { raw: 'React' }, { raw: 'Node.js' }],
  education: [{ degreeLabel: 'Master informatique', rncpLevel: 7 }],
  certifications: [],
  languages: [{ code: 'en', cecrl: 'B2' }],
  softSkills: ['communication'],
  keywords: ['agile'],
};

const offer: JobOffer = {
  offerId: 'france_travail:1',
  source: 'france_travail',
  sourceOfferId: '1',
  title: 'Developpeur full-stack TypeScript',
  description: 'React Node.js TypeScript PostgreSQL.',
  location: { city: 'Paris' },
  remoteMode: 'hybrid',
  contract: { type: 'CDI' },
  jobTarget: {
    rawTitle: 'Developpeur full-stack TypeScript',
    canonicalRomeCode: 'M1805',
  },
  skills: [
    { raw: 'TypeScript', importance: 'must' },
    { raw: 'React', importance: 'must' },
    { raw: 'PostgreSQL', importance: 'should' },
  ],
  experienceRequirement: { minYears: 3 },
  educationRequirements: [{ rncpLevel: 7, mandatory: true }],
  languageRequirements: [{ code: 'en', minCecrl: 'B2', mandatory: true }],
  keywords: ['agile'],
};

describe('OpenAI match scoring', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_KEY = originalOpenAiKey;
    process.env.OPENAI_MATCH_MODEL = originalOpenAiMatchModel;
    process.env.OPENAI_MODEL = originalOpenAiModel;
  });

  it('requests gpt-5.4-mini with the configured 30/20 ATS weighting and returns normalized scored offers', async () => {
    process.env.OPENAI_KEY = 'test-key';
    delete process.env.OPENAI_MATCH_MODEL;
    delete process.env.OPENAI_MODEL;
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  scoredOffers: [
                    {
                      offerId: 'france_travail:1',
                      finalScore: 86,
                      breakdown: {
                        requiredCriteria: 27,
                        skillsAndTools: 16,
                        experienceRelevance: 18,
                        roleTitleSeniorityDomain: 9,
                        educationCertificationsLanguages: 8,
                        logisticsFit: 4,
                        evidenceQuality: 4,
                        capsApplied: [],
                      },
                      matchedFeatures: {
                        exactSkills: ['TypeScript', 'React'],
                        semanticSkills: ['Node.js backend'],
                        missingMustHave: [],
                        strengths: ['Experience full-stack proche'],
                        risks: ['PostgreSQL non confirme'],
                      },
                      explanation: 'Bon alignement ATS global.',
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
    );
    global.fetch = fetchMock;

    const scored = await scoreOffersWithOpenAI({ cv: candidate, offers: [offer] });
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      model?: string;
      instructions?: string;
    };

    expect(requestBody.model).toBe('gpt-5.4-mini');
    expect(requestBody.instructions).toContain('requiredCriteria: 30');
    expect(requestBody.instructions).toContain('skillsAndTools: 20');
    expect(scored).toHaveLength(1);
    expect(scored[0]?.offer).toBe(offer);
    expect(scored[0]?.breakdown.finalScore).toBe(86);
    expect(scored[0]?.breakdown.requiredCriteria).toBe(27);
    expect(scored[0]?.breakdown.skillsAndTools).toBe(16);
    expect(scored[0]?.breakdown.skills).toBe(0.8);
    expect(scored[0]?.matchedFeatures.exactSkills).toEqual(['TypeScript', 'React']);
  });

  it('uses OPENAI_MATCH_MODEL when configured', async () => {
    process.env.OPENAI_KEY = 'test-key';
    process.env.OPENAI_MATCH_MODEL = 'custom-match-model';
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  scoredOffers: [
                    {
                      offerId: 'france_travail:1',
                      finalScore: 75,
                      breakdown: {
                        requiredCriteria: 22,
                        skillsAndTools: 14,
                        experienceRelevance: 15,
                        roleTitleSeniorityDomain: 8,
                        educationCertificationsLanguages: 8,
                        logisticsFit: 4,
                        evidenceQuality: 4,
                        capsApplied: [],
                      },
                      matchedFeatures: {
                        exactSkills: [],
                        semanticSkills: [],
                        missingMustHave: [],
                        strengths: [],
                        risks: [],
                      },
                      explanation: 'Alignement partiel.',
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
    );

    await scoreOffersWithOpenAI({ cv: candidate, offers: [offer] });
    const requestBody = JSON.parse(String(jest.mocked(fetch).mock.calls[0]?.[1]?.body)) as {
      model?: string;
    };

    expect(requestBody.model).toBe('custom-match-model');
  });

  it('rejects scoring when no OpenAI key is configured', async () => {
    delete process.env.OPENAI_KEY;
    delete process.env.OPENAI_MATCH_MODEL;

    await expect(scoreOffersWithOpenAI({ cv: candidate, offers: [offer] })).rejects.toThrow(
      'OPENAI_KEY is missing.',
    );
  });
});

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

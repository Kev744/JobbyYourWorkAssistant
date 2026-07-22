import { POST } from '@/app/api/match/route';
import { requireAuthenticatedUser } from '@/lib/auth';
import { createServerDbClient } from '@/lib/db/server';
import { scoreOffersWithOpenAI } from '@/lib/match/openai-scoring';
import type { CandidateProfile, JobOffer, ScoredOffer } from '@/types';

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/db/server', () => ({
  createServerDbClient: jest.fn(),
}));

jest.mock('@/lib/match/openai-scoring', () => ({
  scoreOffersWithOpenAI: jest.fn(),
}));

const mockedRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser);
const mockedCreateServerDbClient = jest.mocked(createServerDbClient);
const mockedScoreOffersWithOpenAI = jest.mocked(scoreOffersWithOpenAI);

const offer: JobOffer = {
  offerId: 'france_travail:1',
  source: 'france_travail',
  sourceOfferId: '1',
  title: 'Developpeur full-stack TypeScript',
  description: 'React Node.js TypeScript.',
  location: { city: 'Paris' },
  remoteMode: 'hybrid',
  contract: { type: 'CDI' },
  jobTarget: {
    rawTitle: 'Developpeur full-stack TypeScript',
    canonicalRomeCode: 'M1805',
  },
  skills: [{ raw: 'TypeScript', importance: 'must' }],
};

const profile: CandidateProfile = {
  id: 'profile-1',
  resumeVersionId: 'version-1',
  summary: 'Developpeur full-stack',
  profession: 'Developpeur full-stack',
  education: [],
  professionalExperiences: [],
  hobbies: [],
  certifications: [],
  skills: [{ raw: 'TypeScript' }],
  languages: [],
  achievements: [],
  identityContact: {},
  scoringPayload: {
    candidateId: 'profile-1',
    headline: 'Developpeur full-stack',
    titles: [{ raw: 'Developpeur full-stack', canonicalRomeCode: 'M1805' }],
    experiences: [],
    skills: [{ raw: 'TypeScript' }],
    education: [],
  },
  romeCode: 'M1805',
  romePredictionScore: null,
  generationWarnings: [],
  confirmationStatus: 'confirmed',
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
};

describe('/api/match OpenAI scoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      response: null,
    } as never);
  });

  it('scores offers with OpenAI and persists the returned scoring rows', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    mockedCreateServerDbClient.mockResolvedValue(buildDbMock(upsert) as never);
    mockedScoreOffersWithOpenAI.mockResolvedValue([
      {
        offer,
        breakdown: {
          skills: 0.8,
          title: 0.9,
          experience: 0.9,
          education: 0.8,
          certifications: 0.8,
          languages: 0.8,
          keywords: 0.8,
          softSkills: 0.8,
          location: 0.8,
          salary: 0.8,
          remote: 0.8,
          mustHaveCoverage: 0.9,
          finalScore: 86,
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
          exactSkills: ['TypeScript'],
          fuzzySkills: [],
          semanticSkills: ['React ecosystem'],
          missingMustHave: [],
        },
        explanation: 'Bon alignement ATS.',
      },
    ] satisfies ScoredOffer[]);

    const response = await POST(
      new Request('http://localhost/api/match', {
        method: 'POST',
        body: JSON.stringify({ queryId: 'query-1', openAiApiKey: 'sk-session-test' }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockedScoreOffersWithOpenAI).toHaveBeenCalledWith({
      cv: expect.objectContaining({ candidateId: 'profile-1' }),
      offers: [offer],
      openAiApiKey: 'sk-session-test',
    });
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          user_id: 'user-1',
          candidate_profile_id: 'profile-1',
          job_offer_id: 'job-offer-row-1',
          final_score: 86,
          score_breakdown: expect.objectContaining({
            requiredCriteria: 27,
            skillsAndTools: 16,
          }),
          matched_features: expect.objectContaining({
            exactSkills: ['TypeScript'],
          }),
          missing_must_haves: [],
          explanation: 'Bon alignement ATS.',
        }),
      ],
      { onConflict: 'user_id,candidate_profile_id,job_offer_id' },
    );
    expect(payload.scoredOffers[0].breakdown.requiredCriteria).toBe(27);
  });

  it('reuses cached scoring rows without calling OpenAI again', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    mockedCreateServerDbClient.mockResolvedValue(
      buildDbMock(upsert, {
        scoredRows: [
          {
            job_offer_id: 'job-offer-row-1',
            final_score: 91,
            score_breakdown: {
              skills: 0.9,
              title: 0.9,
              experience: 0.9,
              education: 0.8,
              certifications: 0.8,
              languages: 0.8,
              keywords: 0.9,
              softSkills: 0.8,
              location: 0.8,
              salary: 0.8,
              remote: 0.8,
              mustHaveCoverage: 1,
              finalScore: 91,
              requiredCriteria: 30,
              skillsAndTools: 20,
              experienceRelevance: 18,
              roleTitleSeniorityDomain: 9,
              educationCertificationsLanguages: 8,
              logisticsFit: 3,
              evidenceQuality: 3,
              capsApplied: [],
            },
            matched_features: {
              exactSkills: ['TypeScript'],
              fuzzySkills: [],
              semanticSkills: ['React ecosystem'],
              missingMustHave: [],
            },
            missing_must_haves: [],
            explanation: 'Score deja calcule.',
          },
        ],
      }) as never,
    );

    const response = await POST(
      new Request('http://localhost/api/match', {
        method: 'POST',
        body: JSON.stringify({ queryId: 'query-1' }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockedScoreOffersWithOpenAI).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(payload.scoredOffers).toHaveLength(1);
    expect(payload.scoredOffers[0]).toEqual(
      expect.objectContaining({
        offer,
        explanation: 'Score deja calcule.',
        breakdown: expect.objectContaining({
          finalScore: 91,
          requiredCriteria: 30,
          skillsAndTools: 20,
        }),
        matchedFeatures: {
          exactSkills: ['TypeScript'],
          fuzzySkills: [],
          semanticSkills: ['React ecosystem'],
          missingMustHave: [],
        },
      }),
    );
  });
});

function buildDbMock(
  upsert: jest.Mock,
  options: {
    scoredRows?: unknown[];
  } = {},
) {
  return {
    from(tableName: string) {
      if (tableName === 'candidate_profiles') {
        return queryBuilder({
          maybeSingle: {
            data: toCandidateProfileRow(profile),
            error: null,
          },
        });
      }

      if (tableName === 'job_offer_search_results') {
        return queryBuilder({
          many: {
            data: [
              {
                job_offer_id: 'job-offer-row-1',
                job_offers: {
                  id: 'job-offer-row-1',
                  normalized_offer: offer,
                },
              },
            ],
            error: null,
          },
        });
      }

      if (tableName === 'scored_offers') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          upsert,
          then(resolve: (value: unknown) => void) {
            return Promise.resolve({
              data: options.scoredRows ?? [],
              error: null,
            }).then(resolve);
          },
        };
      }

      throw new Error(`Unexpected table ${tableName}`);
    },
  };
}

function queryBuilder(result: {
  maybeSingle?: unknown;
  many?: unknown;
}) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result.maybeSingle),
    then(resolve: (value: unknown) => void) {
      return Promise.resolve(result.many).then(resolve);
    },
  };
}

function toCandidateProfileRow(value: CandidateProfile) {
  return {
    id: value.id,
    resume_version_id: value.resumeVersionId,
    summary: value.summary,
    profession: value.profession,
    education: value.education,
    professional_experiences: value.professionalExperiences,
    hobbies: value.hobbies,
    certifications: value.certifications,
    skills: value.skills,
    languages: value.languages,
    achievements: value.achievements,
    identity_contact: value.identityContact,
    scoring_payload: value.scoringPayload,
    rome_code: value.romeCode,
    rome_prediction_score: value.romePredictionScore,
    generation_warnings: value.generationWarnings,
    confirmation_status: value.confirmationStatus,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
  };
}

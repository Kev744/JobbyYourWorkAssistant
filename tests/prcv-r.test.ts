import {
  computeRelevantExperienceYears,
  normalizeToken,
  rankOffers,
  scoreOfferAgainstCv,
} from '@/lib/match/prcv-r';
import type { CandidateResume, JobOffer } from '@/types';

const baseCv: CandidateResume = {
  candidateId: 'candidate-1',
  headline: 'Développeuse full-stack TypeScript',
  location: {
    city: 'Paris',
    remotePreference: 'hybrid',
  },
  targetSalary: {
    minAnnualGrossEur: 50_000,
    maxAnnualGrossEur: 58_000,
  },
  titles: [{ raw: 'Développeuse full-stack', canonicalRomeCode: 'M1805' }],
  experiences: [
    {
      titleRaw: 'Développeuse full-stack',
      canonicalRomeCode: 'M1805',
      startDate: '2020-01',
      endDate: '2024-01',
      skills: [{ raw: 'TypeScript' }, { raw: 'React.js' }, { raw: 'Node.js' }],
    },
  ],
  skills: [
    { raw: 'TypeScript' },
    { raw: 'React.js' },
    { raw: 'Node.js' },
    { raw: 'PostgreSQL' },
  ],
  education: [{ degreeLabel: 'Master informatique', rncpLevel: 7, field: 'informatique' }],
  certifications: [{ label: 'AWS Cloud Practitioner', expiryDate: null }],
  languages: [{ code: 'en', cecrl: 'B2' }],
  softSkills: ['communication'],
  keywords: ['agile'],
};

function offer(overrides: Partial<JobOffer> = {}): JobOffer {
  return {
    offerId: 'france_travail:1',
    source: 'france_travail',
    sourceOfferId: '1',
    publishedAt: '2026-05-01T00:00:00.000Z',
    title: 'Développeur full-stack TypeScript',
    description: 'Développement TypeScript React Node.js en équipe agile.',
    company: { name: 'Acme' },
    location: { city: 'Paris' },
    remoteMode: 'hybrid',
    contract: { type: 'CDI' },
    salary: {
      minAnnualGrossEur: 52_000,
      maxAnnualGrossEur: 56_000,
    },
    jobTarget: {
      rawTitle: 'Développeur full-stack TypeScript',
      canonicalRomeCode: 'M1805',
    },
    skills: [
      { raw: 'TypeScript', importance: 'must' },
      { raw: 'React', importance: 'must' },
      { raw: 'Node.js', importance: 'should' },
    ],
    experienceRequirement: { minYears: 3 },
    educationRequirements: [{ rncpLevel: 7, field: 'informatique', mandatory: true }],
    certificationRequirements: [{ label: 'AWS Cloud Practitioner', mandatory: false }],
    languageRequirements: [{ code: 'en', minCecrl: 'B2', mandatory: true }],
    keywords: ['agile'],
    softSkills: ['communication'],
    ...overrides,
  };
}

describe('PRCV-R v1 scoring', () => {
  it('normalizes accents and preserves technical tokens', () => {
    expect(normalizeToken('Développement React.js + C#')).toBe('developpement react c#');
  });

  it('matches accent-insensitive and technical skill variants', () => {
    const scored = scoreOfferAgainstCv(baseCv, offer());

    expect(scored.matchedFeatures.exactSkills).toEqual(
      expect.arrayContaining(['TypeScript', 'React', 'Node.js']),
    );
    expect(scored.breakdown.mustHaveCoverage).toBe(1);
  });

  it('applies the must-have coverage cap below 50 percent', () => {
    const scored = scoreOfferAgainstCv(
      { ...baseCv, skills: [{ raw: 'TypeScript' }] },
      offer({
        skills: [
          { raw: 'TypeScript', importance: 'must' },
          { raw: 'Kubernetes', importance: 'must' },
          { raw: 'Go', importance: 'must' },
        ],
      }),
    );

    expect(scored.breakdown.mustHaveCoverage).toBeCloseTo(1 / 3, 2);
    expect(scored.breakdown.finalScore).toBeLessThanOrEqual(59);
    expect(scored.matchedFeatures.missingMustHave).toEqual(
      expect.arrayContaining(['Kubernetes', 'Go']),
    );
  });

  it('applies CECRL mandatory language cap when two levels below', () => {
    const scored = scoreOfferAgainstCv(
      { ...baseCv, languages: [{ code: 'en', cecrl: 'A2' }] },
      offer({ languageRequirements: [{ code: 'en', minCecrl: 'B2', mandatory: true }] }),
    );

    expect(scored.breakdown.languages).toBe(0);
    expect(scored.breakdown.finalScore).toBeLessThanOrEqual(49);
  });

  it('scores native language as C2 while preserving the native label', () => {
    const scored = scoreOfferAgainstCv(
      { ...baseCv, languages: [{ code: 'en', cecrl: 'langue maternelle' }] },
      offer({ languageRequirements: [{ code: 'en', minCecrl: 'C1', mandatory: true }] }),
    );

    expect(scored.breakdown.languages).toBe(1);
  });

  it('orders RNCP levels monotonically', () => {
    const rncp7 = scoreOfferAgainstCv(baseCv, offer()).breakdown.education;
    const rncp5 = scoreOfferAgainstCv(
      { ...baseCv, education: [{ degreeLabel: 'BTS informatique', rncpLevel: 5, field: 'informatique' }] },
      offer(),
    ).breakdown.education;

    expect(rncp7).toBeGreaterThan(rncp5);
  });

  it('normalizes salary overlap and missing salary neutrally', () => {
    const overlap = scoreOfferAgainstCv(baseCv, offer()).breakdown.salary;
    const missing = scoreOfferAgainstCv(baseCv, offer({ salary: undefined })).breakdown.salary;
    const below = scoreOfferAgainstCv(
      baseCv,
      offer({ salary: { minAnnualGrossEur: 35_000, maxAnnualGrossEur: 40_000 } }),
    ).breakdown.salary;

    expect(overlap).toBeGreaterThan(below);
    expect(missing).toBe(0.6);
  });

  it('computes overlapping relevant experience intervals from dates', () => {
    expect(computeRelevantExperienceYears(baseCv, offer())).toBeGreaterThan(3.9);
  });

  it('ignores expired certifications and blocks missing legal certifications', () => {
    const scored = scoreOfferAgainstCv(
      {
        ...baseCv,
        certifications: [{ label: 'Carte professionnelle', expiryDate: '2020-01-01' }],
      },
      offer({
        certificationRequirements: [{ label: 'Carte professionnelle', mandatory: true }],
      }),
    );

    expect(scored.breakdown.finalScore).toBe(0);
    expect(scored.breakdown.hardBlocker).toContain('Carte professionnelle');
  });

  it('keeps stable sorted output with deterministic tie-breakers', () => {
    const older = offer({ offerId: 'france_travail:older', sourceOfferId: 'older', publishedAt: '2026-04-01' });
    const newer = offer({ offerId: 'france_travail:newer', sourceOfferId: 'newer', publishedAt: '2026-05-01' });

    expect(rankOffers(baseCv, [older, newer]).map((score) => score.offer.offerId)).toEqual([
      'france_travail:newer',
      'france_travail:older',
    ]);
  });

  it('keeps score bounds', () => {
    const scored = scoreOfferAgainstCv(baseCv, offer());

    expect(scored.breakdown.finalScore).toBeGreaterThanOrEqual(0);
    expect(scored.breakdown.finalScore).toBeLessThanOrEqual(100);
  });
});

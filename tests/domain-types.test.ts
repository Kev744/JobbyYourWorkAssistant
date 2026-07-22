import type { CandidateResume, JobOffer, ScoredOffer } from '@/types';

describe('domain types', () => {
  it('supports the PRCV-R v1 core data shapes', () => {
    const candidate: CandidateResume = {
      candidateId: 'candidate-1',
      headline: 'Développeuse full-stack TypeScript',
      titles: [{ raw: 'Développeuse full-stack', canonicalRomeCode: 'M1805' }],
      experiences: [],
      skills: [{ raw: 'TypeScript', level: 'advanced' }],
      education: [{ degreeLabel: 'Master informatique', rncpLevel: 7 }],
      languages: [{ code: 'fr', cecrl: 'C2' }],
    };

    const offer: JobOffer = {
      offerId: 'offer-1',
      source: 'france_travail',
      sourceOfferId: '206WCDB',
      title: 'Développeur full-stack Next.js',
      description: 'CDI à Paris avec TypeScript et Next.js.',
      location: { city: 'Paris', inseeCode: '75056' },
      jobTarget: { rawTitle: 'Développeur full-stack', canonicalRomeCode: 'M1805' },
      skills: [{ raw: 'TypeScript', importance: 'must' }],
    };

    const scoredOffer: ScoredOffer = {
      offer,
      breakdown: {
        skills: 1,
        title: 1,
        experience: 0,
        education: 1,
        certifications: 0.6,
        languages: 1,
        keywords: 0.5,
        softSkills: 0,
        location: 1,
        salary: 0.6,
        remote: 0.5,
        mustHaveCoverage: 1,
        hardBlocker: null,
        finalScore: 74,
      },
      matchedFeatures: {
        exactSkills: ['TypeScript'],
        fuzzySkills: [],
        semanticSkills: [],
        missingMustHave: [],
      },
    };

    expect(candidate.skills[0]?.raw).toBe('TypeScript');
    expect(scoredOffer.offer.offerId).toBe('offer-1');
    expect(scoredOffer.breakdown.finalScore).toBeGreaterThanOrEqual(0);
    expect(scoredOffer.breakdown.finalScore).toBeLessThanOrEqual(100);
  });
});

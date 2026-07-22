import { getOfferPageCount, paginateOffers, sortOffersByScore } from '@/lib/offers/display';
import type { JobOffer, ScoredOffer } from '@/types';

describe('offers display helpers', () => {
  it('sorts scored offers by final score in descending order', () => {
    const offers = [offer('low'), offer('unscored'), offer('high'), offer('mid')];

    expect(
      sortOffersByScore(offers, {
        low: score('low', 35),
        high: score('high', 92),
        mid: score('mid', 70),
      }).map((item) => item.offerId),
    ).toEqual(['high', 'mid', 'low', 'unscored']);
  });

  it('paginates offers by 15 results', () => {
    const offers = Array.from({ length: 32 }, (_, index) => offer(`offer-${index + 1}`));

    expect(getOfferPageCount(offers.length)).toBe(3);
    expect(paginateOffers(offers, 1).map((item) => item.offerId)).toHaveLength(15);
    expect(paginateOffers(offers, 2)[0]?.offerId).toBe('offer-16');
    expect(paginateOffers(offers, 3).map((item) => item.offerId)).toHaveLength(2);
  });
});

function offer(id: string): JobOffer {
  return {
    offerId: id,
    source: 'adzuna',
    sourceOfferId: id,
    title: `Offer ${id}`,
    description: 'Description',
    location: { city: 'Paris' },
    jobTarget: { rawTitle: `Offer ${id}` },
    skills: [],
  };
}

function score(offerId: string, finalScore: number): ScoredOffer {
  return {
    offer: offer(offerId),
    breakdown: {
      skills: 0,
      title: 0,
      experience: 0,
      education: 0,
      certifications: 0,
      languages: 0,
      keywords: 0,
      softSkills: 0,
      location: 0,
      salary: 0,
      remote: 0,
      mustHaveCoverage: 0,
      finalScore,
    },
    matchedFeatures: {
      exactSkills: [],
      fuzzySkills: [],
      semanticSkills: [],
      missingMustHave: [],
    },
  };
}

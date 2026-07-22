import type { JobOffer, ScoredOffer } from '@/types';

export const OFFERS_PER_PAGE = 15;

export function sortOffersByScore(
  offers: JobOffer[],
  scoresByOfferId: Record<string, ScoredOffer>,
): JobOffer[] {
  return offers
    .map((offer, index) => ({ offer, index, score: scoresByOfferId[offer.offerId]?.breakdown.finalScore }))
    .sort((left, right) => {
      const leftHasScore = left.score !== undefined;
      const rightHasScore = right.score !== undefined;

      if (leftHasScore && rightHasScore) {
        return (right.score ?? 0) - (left.score ?? 0) || left.index - right.index;
      }

      if (leftHasScore) return -1;
      if (rightHasScore) return 1;

      return left.index - right.index;
    })
    .map((item) => item.offer);
}

export function paginateOffers<T>(items: T[], page: number, pageSize = OFFERS_PER_PAGE): T[] {
  const currentPage = clampPage(page, getOfferPageCount(items.length, pageSize));
  const start = (currentPage - 1) * pageSize;

  return items.slice(start, start + pageSize);
}

export function getOfferPageCount(totalItems: number, pageSize = OFFERS_PER_PAGE): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;

  return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, pageCount));
}

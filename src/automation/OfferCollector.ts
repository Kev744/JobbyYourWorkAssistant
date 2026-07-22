import type { JobOffer } from '@/types';

import {
  SKIPPED_AUTO_APPLY_STATUSES,
  type AutoApplyOffer,
  type AutoApplyOfferStatus,
} from './types';

export function collectEligibleOffers(offers: AutoApplyOffer[]): AutoApplyOffer[] {
  return offers.filter((offer) => isEligibleOffer(offer));
}

export function isEligibleOffer(offer: AutoApplyOffer): boolean {
  if (!offer.applicationUrl) {
    return false;
  }

  if (offer.currentStatus && SKIPPED_AUTO_APPLY_STATUSES.has(offer.currentStatus)) {
    return false;
  }

  return true;
}

export function toAutoApplyOffer(offer: JobOffer, currentStatus?: AutoApplyOfferStatus): AutoApplyOffer {
  return {
    offerId: offer.offerId,
    title: offer.title,
    company: offer.company?.name,
    location: offer.location.city,
    sourceWebsite: offer.source,
    applicationUrl: offer.applicationUrl,
    currentStatus,
    rawOffer: offer,
  };
}

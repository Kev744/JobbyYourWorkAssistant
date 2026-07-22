import { buildAutoApplyRunPlan } from '../ApplicationPlanner';
import type { AutoApplyOffer, AutoApplyRunRequest } from '../types';

export const LOCAL_AUTO_APPLY_HELPER_URL = 'http://127.0.0.1:43789';

export interface LocalAutoApplyOfferPayload {
  offerId: string;
  title: string;
  company?: string;
  sourceWebsite: string;
  applicationUrl: string;
}

export interface LocalAutoApplyRunPayload {
  request: AutoApplyRunRequest;
  offers: LocalAutoApplyOfferPayload[];
}

export interface LocalAutoApplyHealthResponse {
  status: 'ok';
  service: 'matchingcv-auto-apply-helper';
  version: 1;
}

export function buildLocalAutoApplyRunPayload(
  request: AutoApplyRunRequest,
  offers: AutoApplyOffer[],
): LocalAutoApplyRunPayload {
  const plan = buildAutoApplyRunPlan(request, offers);
  const eligibleOffers = new Map(offers.map((offer) => [offer.offerId, offer]));

  return {
    request,
    offers: plan.eligibleOfferIds
      .slice(0, plan.maxAttempts)
      .map((offerId) => eligibleOffers.get(offerId))
      .filter((offer): offer is AutoApplyOffer & { applicationUrl: string } => Boolean(offer?.applicationUrl))
      .map(toLocalAutoApplyOfferPayload),
  };
}

function toLocalAutoApplyOfferPayload(
  offer: AutoApplyOffer & { applicationUrl: string },
): LocalAutoApplyOfferPayload {
  return {
    offerId: offer.offerId,
    title: offer.title,
    company: offer.company,
    sourceWebsite: offer.sourceWebsite,
    applicationUrl: offer.applicationUrl,
  };
}

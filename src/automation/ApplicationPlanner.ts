import { collectEligibleOffers } from './OfferCollector';
import type { AutoApplyOffer, AutoApplyRunPlan, AutoApplyRunRequest } from './types';

export const PRODUCT_MAX_DAILY_APPLICATION_LIMIT = 20;

export class AutoApplyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AutoApplyValidationError';
  }
}

export function buildAutoApplyRunPlan(
  request: AutoApplyRunRequest,
  offers: AutoApplyOffer[],
): AutoApplyRunPlan {
  validateAutoApplyRunRequest(request);

  const eligibleOffers = collectEligibleOffers(offers);
  const eligibleOfferIds = eligibleOffers.map((offer) => offer.offerId);
  const skippedOfferIds = offers
    .filter((offer) => !eligibleOfferIds.includes(offer.offerId))
    .map((offer) => offer.offerId);

  return {
    request,
    eligibleOfferIds,
    skippedOfferIds,
    maxAttempts: Math.min(request.dailyApplicationLimit, eligibleOffers.length),
  };
}

export function validateAutoApplyRunRequest(request: AutoApplyRunRequest): void {
  if (
    !Number.isInteger(request.dailyApplicationLimit) ||
    request.dailyApplicationLimit < 1 ||
    request.dailyApplicationLimit > PRODUCT_MAX_DAILY_APPLICATION_LIMIT
  ) {
    throw new AutoApplyValidationError(
      `Le nombre de candidatures doit être compris entre 1 et ${PRODUCT_MAX_DAILY_APPLICATION_LIMIT}.`,
    );
  }

  if (!isEmailLike(request.emailAddress)) {
    throw new AutoApplyValidationError("L'adresse e-mail doit être valide.");
  }

  if (!request.resumeProfileId.trim()) {
    throw new AutoApplyValidationError('Sélectionnez un profil candidat avant de démarrer.');
  }

  if (!request.siteConsent) {
    throw new AutoApplyValidationError('Confirmez que les candidatures respectent les règles des sites.');
  }

  if (request.applicationMode === 'auto-submit-approved-sites-only') {
    throw new AutoApplyValidationError(
      'La soumission automatique sans revue finale est désactivée pour cette version.',
    );
  }
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

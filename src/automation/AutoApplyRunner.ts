import { randomUUID } from 'node:crypto';

import { buildAutoApplyRunPlan } from './ApplicationPlanner';
import { AutoApplyLogger } from './Logger';
import { shouldStopForDailyLimit } from './RateLimiter';
import { ATSStrategyRegistry } from './strategies/ATSStrategyRegistry';
import type {
  AutoApplyApplicationResult,
  AutoApplyOffer,
  AutoApplyRunRequest,
  AutoApplyRunSummary,
} from './types';

export class AutoApplyRunner {
  constructor(
    private readonly registry = new ATSStrategyRegistry(),
    private readonly logger = new AutoApplyLogger(),
  ) {}

  async planOnly(request: AutoApplyRunRequest, offers: AutoApplyOffer[]): Promise<AutoApplyRunSummary> {
    const runId = randomUUID();
    const plan = buildAutoApplyRunPlan(request, offers);
    const results: AutoApplyApplicationResult[] = [];

    for (const offerId of plan.eligibleOfferIds) {
      if (shouldStopForDailyLimit(results, request.dailyApplicationLimit)) {
        break;
      }

      const offer = offers.find((item) => item.offerId === offerId);

      if (!offer?.applicationUrl) {
        continue;
      }

      const strategy = await this.registry.resolve({
        url: offer.applicationUrl,
        website: offer.sourceWebsite,
      });
      const now = new Date().toISOString();

      this.logger.log({
        runId,
        offerId,
        strategyId: strategy.id,
        stepName: 'planned_review_before_submit',
        status: 'info',
        url: offer.applicationUrl,
      });

      results.push({
        offerId,
        status: 'Error',
        reason: 'FORM_FIELD_UNMAPPED',
        website: offer.sourceWebsite,
        finalUrl: offer.applicationUrl,
        emailUsed: request.emailAddress,
        strategyId: strategy.id,
        startedAt: now,
        finishedAt: now,
        lastSuccessfulStep: 'planned_review_before_submit',
        requiresManualAction: true,
        userVisibleMessage:
          'La candidature est préparée pour une exécution supervisée. La revue finale reste obligatoire.',
      });
    }

    return {
      runId,
      successCount: results.filter((result) => result.status === 'Success').length,
      errorCount: results.filter((result) => result.status === 'Error').length,
      stoppedReason: results.length === 0 ? 'NO_ELIGIBLE_OFFERS' : 'BLOCKED',
      results,
    };
  }
}

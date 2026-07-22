import {
  buildAutoApplyRunPlan,
  PRODUCT_MAX_DAILY_APPLICATION_LIMIT,
} from '@/automation/ApplicationPlanner';
import { AutoApplyRunner } from '@/automation/AutoApplyRunner';
import {
  buildLocalAutoApplyRunPayload,
  LOCAL_AUTO_APPLY_HELPER_URL,
} from '@/automation/local-helper/client';
import { collectEligibleOffers, toAutoApplyOffer } from '@/automation/OfferCollector';
import { shouldStopForDailyLimit } from '@/automation/RateLimiter';
import { redactSensitiveText } from '@/automation/security/Redaction';
import { ATSStrategyRegistry } from '@/automation/strategies/ATSStrategyRegistry';
import { GenericApplyStrategy } from '@/automation/strategies/GenericApplyStrategy';
import { GreenhouseStrategy } from '@/automation/strategies/GreenhouseStrategy';
import type { AutoApplyApplicationResult, AutoApplyOffer, AutoApplyRunRequest } from '@/automation/types';
import type { JobOffer } from '@/types';

describe('auto-apply foundation', () => {
  it('collects only eligible offers with application URLs and non-skipped statuses', () => {
    const offers: AutoApplyOffer[] = [
      { offerId: '1', title: 'A', sourceWebsite: 'site', applicationUrl: 'https://example.test/a' },
      {
        offerId: '2',
        title: 'B',
        sourceWebsite: 'site',
        applicationUrl: 'https://example.test/b',
        currentStatus: 'Applied',
      },
      { offerId: '3', title: 'C', sourceWebsite: 'site' },
    ];

    expect(collectEligibleOffers(offers).map((offer) => offer.offerId)).toEqual(['1']);
  });

  it('builds a daily-limit plan and tracks skipped offers', () => {
    const plan = buildAutoApplyRunPlan(validRunRequest({ dailyApplicationLimit: 2 }), [
      { offerId: '1', title: 'A', sourceWebsite: 'site', applicationUrl: 'https://example.test/a' },
      { offerId: '2', title: 'B', sourceWebsite: 'site', applicationUrl: 'https://example.test/b' },
      { offerId: '3', title: 'C', sourceWebsite: 'site', currentStatus: 'Manual only' },
    ]);

    expect(plan.eligibleOfferIds).toEqual(['1', '2']);
    expect(plan.skippedOfferIds).toEqual(['3']);
    expect(plan.maxAttempts).toBe(2);
  });

  it('rejects auto-submit mode until approved-site automation is implemented', () => {
    expect(() =>
      buildAutoApplyRunPlan(
        validRunRequest({ applicationMode: 'auto-submit-approved-sites-only' }),
        [],
      ),
    ).toThrow('désactivée');
  });

  it('validates the product daily limit', () => {
    expect(() =>
      buildAutoApplyRunPlan(validRunRequest({ dailyApplicationLimit: PRODUCT_MAX_DAILY_APPLICATION_LIMIT + 1 }), []),
    ).toThrow('compris entre');
  });

  it('stops when the successful application count reaches the daily limit', () => {
    const results: AutoApplyApplicationResult[] = [
      result('a', 'Success'),
      result('b', 'Error'),
      result('c', 'Success'),
    ];

    expect(shouldStopForDailyLimit(results, 2)).toBe(true);
    expect(shouldStopForDailyLimit(results, 3)).toBe(false);
  });

  it('redacts common secrets and contact values from logs', () => {
    const redacted = redactSensitiveText(
      'Contact kevin@example.test avec +33 6 12 34 56 78 et sk-testSECRET123456789.',
    );

    expect(redacted).toContain('[email]');
    expect(redacted).toContain('[phone]');
    expect(redacted).toContain('[secret]');
    expect(redacted).not.toContain('kevin@example.test');
  });

  it('selects a matching ATS strategy before the generic fallback', async () => {
    const registry = new ATSStrategyRegistry([new GreenhouseStrategy()], new GenericApplyStrategy());

    await expect(
      registry.resolve({ url: 'https://boards.greenhouse.io/acme/jobs/123', website: 'Greenhouse' }),
    ).resolves.toMatchObject({ id: 'greenhouse' });
    await expect(
      registry.resolve({ url: 'https://careers.example.test/jobs/123', website: 'Example' }),
    ).resolves.toMatchObject({ id: 'generic' });
  });

  it('normalizes a project job offer into an auto-apply offer', () => {
    const jobOffer: JobOffer = {
      offerId: 'offer-1',
      source: 'adzuna',
      sourceOfferId: 'source-1',
      title: 'Développeur TypeScript',
      description: 'Mission',
      company: { name: 'Acme' },
      location: { city: 'Paris' },
      jobTarget: { rawTitle: 'Développeur TypeScript' },
      skills: [],
      applicationUrl: 'https://example.test/apply',
    };

    expect(toAutoApplyOffer(jobOffer)).toMatchObject({
      offerId: 'offer-1',
      company: 'Acme',
      location: 'Paris',
      sourceWebsite: 'adzuna',
      applicationUrl: 'https://example.test/apply',
    });
  });

  it('creates supervised manual results in plan-only runner mode', async () => {
    const runner = new AutoApplyRunner();

    const summary = await runner.planOnly(validRunRequest({ dailyApplicationLimit: 1 }), [
      {
        offerId: 'greenhouse-1',
        title: 'Développeur',
        sourceWebsite: 'Greenhouse',
        applicationUrl: 'https://boards.greenhouse.io/acme/jobs/123',
      },
    ]);

    expect(summary.results).toHaveLength(1);
    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.results[0]).toMatchObject({
      offerId: 'greenhouse-1',
      status: 'Error',
      strategyId: 'generic',
      requiresManualAction: true,
    });
  });

  it('builds a minimized payload for the local Playwright helper', () => {
    const payload = buildLocalAutoApplyRunPayload(validRunRequest({ dailyApplicationLimit: 1 }), [
      {
        offerId: 'eligible-1',
        title: 'Développeur',
        company: 'Acme',
        sourceWebsite: 'Greenhouse',
        applicationUrl: 'https://boards.greenhouse.io/acme/jobs/123',
        rawOffer: {
          offerId: 'raw-1',
          source: 'adzuna',
          sourceOfferId: 'raw-1',
          title: 'Raw',
          description: 'Full offer text must not be sent to the helper.',
          location: {},
          jobTarget: { rawTitle: 'Raw' },
          skills: [],
        },
      },
      {
        offerId: 'skipped-1',
        title: 'Sans lien',
        sourceWebsite: 'Example',
      },
    ]);

    expect(LOCAL_AUTO_APPLY_HELPER_URL).toBe('http://127.0.0.1:43789');
    expect(payload.offers).toEqual([
      {
        offerId: 'eligible-1',
        title: 'Développeur',
        company: 'Acme',
        sourceWebsite: 'Greenhouse',
        applicationUrl: 'https://boards.greenhouse.io/acme/jobs/123',
      },
    ]);
    expect(JSON.stringify(payload)).not.toContain('Full offer text');
  });
});

function validRunRequest(
  override: Partial<AutoApplyRunRequest> = {},
): AutoApplyRunRequest {
  return {
    dailyApplicationLimit: 3,
    emailAddress: 'kevin@example.test',
    applicationMode: 'review-before-submit',
    resumeProfileId: 'profile-1',
    coverLetterMode: 'template',
    siteConsent: true,
    ...override,
  };
}

function result(offerId: string, status: AutoApplyApplicationResult['status']): AutoApplyApplicationResult {
  return {
    offerId,
    status,
    website: 'example.test',
    emailUsed: 'kevin@example.test',
    strategyId: 'generic',
    startedAt: '2026-06-18T00:00:00.000Z',
    finishedAt: '2026-06-18T00:00:01.000Z',
    requiresManualAction: status === 'Error',
    userVisibleMessage: 'Test',
  };
}

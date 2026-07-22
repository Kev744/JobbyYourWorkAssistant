import type { AutoApplyApplicationResult } from './ApplicationResult';

export type AutoApplyApplicationMode = 'review-before-submit' | 'auto-submit-approved-sites-only';
export type AutoApplyCoverLetterMode = 'none' | 'template' | 'ask-me';

export interface AutoApplyRunRequest {
  dailyApplicationLimit: number;
  emailAddress: string;
  applicationMode: AutoApplyApplicationMode;
  resumeProfileId: string;
  coverLetterMode: AutoApplyCoverLetterMode;
  siteConsent: boolean;
}

export interface AutoApplyRunPlan {
  request: AutoApplyRunRequest;
  eligibleOfferIds: string[];
  skippedOfferIds: string[];
  maxAttempts: number;
}

export interface AutoApplyRunSummary {
  runId: string;
  successCount: number;
  errorCount: number;
  stoppedReason: 'DAILY_LIMIT_REACHED' | 'NO_ELIGIBLE_OFFERS' | 'USER_STOPPED' | 'BLOCKED';
  results: AutoApplyApplicationResult[];
}

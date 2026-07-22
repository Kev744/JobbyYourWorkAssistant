import type { AutoApplyErrorReason } from './ApplicationResult';

export interface StrategyInput {
  url: string;
  website: string;
}

export interface BlockingIssue {
  reason: AutoApplyErrorReason;
  userVisibleMessage: string;
}

export interface StrategyResult {
  status: 'Success' | 'Error';
  reason?: AutoApplyErrorReason;
  lastSuccessfulStep?: string;
  requiresManualAction: boolean;
  userVisibleMessage: string;
}

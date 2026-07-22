import type { AutoApplyApplicationResult } from './types';

export function countSuccessfulApplications(results: AutoApplyApplicationResult[]): number {
  return results.filter((result) => result.status === 'Success').length;
}

export function shouldStopForDailyLimit(
  results: AutoApplyApplicationResult[],
  dailyApplicationLimit: number,
): boolean {
  return countSuccessfulApplications(results) >= dailyApplicationLimit;
}

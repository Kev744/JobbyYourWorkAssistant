import type { AutoApplyApplicationResult } from './types';

export function createManualHandoffResult(
  result: AutoApplyApplicationResult,
  userVisibleMessage: string,
): AutoApplyApplicationResult {
  return {
    ...result,
    status: 'Error',
    requiresManualAction: true,
    userVisibleMessage,
  };
}

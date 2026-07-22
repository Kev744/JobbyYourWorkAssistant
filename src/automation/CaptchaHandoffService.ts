import type { AutoApplyApplicationResult } from './types';

export function createCaptchaBlockedResult(
  input: Omit<AutoApplyApplicationResult, 'status' | 'reason' | 'requiresManualAction' | 'userVisibleMessage'>,
): AutoApplyApplicationResult {
  return {
    ...input,
    status: 'Error',
    reason: 'CAPTCHA_OR_CHALLENGE_BLOCKED',
    requiresManualAction: true,
    userVisibleMessage: 'Un contrôle anti-robot doit être résolu manuellement avant de continuer.',
  };
}

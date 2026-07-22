import type { AutoApplyRunRequest } from '../types';

export function hasAutoApplyConsent(request: AutoApplyRunRequest): boolean {
  return request.siteConsent === true && request.applicationMode === 'review-before-submit';
}

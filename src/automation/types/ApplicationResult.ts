export type AutoApplyApplicationStatus = 'Success' | 'Error';

export type AutoApplyErrorReason =
  | 'EXPIRED_JOB'
  | 'LOGIN_REQUIRED_NO_CREDENTIALS'
  | 'REGISTRATION_REQUIRES_EMAIL_CONFIRMATION'
  | 'CAPTCHA_OR_CHALLENGE_BLOCKED'
  | 'WEBSITE_POLICY_BLOCKED'
  | 'RATE_LIMITED'
  | 'FORM_FIELD_UNMAPPED'
  | 'FILE_UPLOAD_FAILED'
  | 'FINAL_CONFIRMATION_NOT_DETECTED'
  | 'USER_STOPPED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_AUTOMATION_ERROR';

export interface AutoApplyApplicationResult {
  offerId: string;
  status: AutoApplyApplicationStatus;
  reason?: AutoApplyErrorReason;
  website: string;
  finalUrl?: string;
  emailUsed: string;
  strategyId: string;
  startedAt: string;
  finishedAt: string;
  lastSuccessfulStep?: string;
  traceId?: string;
  requiresManualAction: boolean;
  userVisibleMessage: string;
}

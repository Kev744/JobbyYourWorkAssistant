import type { JobOffer } from '@/types';

export type AutoApplyOfferStatus =
  | 'Applied'
  | 'Withdrawn'
  | 'Archived'
  | 'Do not apply'
  | 'Manual only'
  | 'Ready';

export interface AutoApplyOffer {
  offerId: string;
  title: string;
  company?: string;
  location?: string;
  sourceWebsite: string;
  applicationUrl?: string;
  currentStatus?: AutoApplyOfferStatus | string | null;
  savedAt?: string;
  tags?: string[];
  userNotes?: string;
  rawOffer?: JobOffer;
}

export const SKIPPED_AUTO_APPLY_STATUSES = new Set([
  'Applied',
  'Withdrawn',
  'Archived',
  'Do not apply',
  'Manual only',
]);

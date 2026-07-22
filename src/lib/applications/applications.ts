import type { ApplicationRecord, ApplicationStatus, ApplicationStatusEvent, JobOffer } from '@/types';

export const APPLICATION_STATUSES: ApplicationStatus[] = ['accepted', 'pending', 'refused'];

export const APPLICATION_SELECT =
  'id, generated_resume_id, job_offer_id, offer_snapshot, generated_resume_pdf_path, generated_resume_docx_path, application_url, current_status, created_at, updated_at';

export const APPLICATION_STATUS_EVENT_SELECT =
  'id, application_id, from_status, to_status, note, created_at';

interface ApplicationRow {
  id: string;
  generated_resume_id: string;
  job_offer_id: string;
  offer_snapshot: unknown;
  generated_resume_pdf_path: string | null;
  generated_resume_docx_path: string | null;
  application_url: string | null;
  current_status: string;
  created_at: string;
  updated_at: string;
}

interface ApplicationStatusEventRow {
  id: string;
  application_id: string;
  from_status: string | null;
  to_status: string;
  note: string;
  created_at: string;
}

export class ApplicationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplicationValidationError';
  }
}

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && APPLICATION_STATUSES.includes(value as ApplicationStatus);
}

export function normalizeApplicationStatus(value: unknown, fallback: ApplicationStatus): ApplicationStatus {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (!isApplicationStatus(value)) {
    throw new ApplicationValidationError('Statut de candidature invalide.');
  }

  return value;
}

export function normalizeApplicationUrl(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (typeof value !== 'string') {
    throw new ApplicationValidationError('URL de candidature invalide.');
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('unsupported protocol');
    }

    return url.toString();
  } catch {
    throw new ApplicationValidationError('URL de candidature invalide.');
  }
}

export function normalizeStatusNote(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 500) : '';
}

export function mapApplicationRow(
  row: ApplicationRow,
  statusHistory: ApplicationStatusEvent[] = [],
): ApplicationRecord {
  return {
    id: row.id,
    generatedResumeId: row.generated_resume_id,
    jobOfferId: row.job_offer_id,
    offerSnapshot: asOfferSnapshot(row.offer_snapshot),
    generatedResumePdfPath: row.generated_resume_pdf_path,
    generatedResumeDocxPath: row.generated_resume_docx_path,
    applicationUrl: row.application_url,
    currentStatus: isApplicationStatus(row.current_status) ? row.current_status : 'pending',
    statusHistory,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapApplicationStatusEventRow(row: ApplicationStatusEventRow): ApplicationStatusEvent {
  return {
    id: row.id,
    applicationId: row.application_id,
    fromStatus: isApplicationStatus(row.from_status) ? row.from_status : null,
    toStatus: isApplicationStatus(row.to_status) ? row.to_status : 'pending',
    note: row.note,
    createdAt: row.created_at,
  };
}

function asOfferSnapshot(value: unknown): JobOffer {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JobOffer;
  }

  return {
    offerId: 'unknown',
    source: 'france_travail',
    sourceOfferId: 'unknown',
    title: 'Offre inconnue',
    description: '',
    location: {},
    jobTarget: { rawTitle: 'Offre inconnue' },
    skills: [],
  };
}

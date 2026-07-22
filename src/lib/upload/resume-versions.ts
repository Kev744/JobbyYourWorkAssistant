import type { ResumeVersionRecord } from '@/types';

export const CV_VERSIONS_BUCKET = 'cv-versions';
export const MAX_CORPUS_CONTENT_LENGTH = 50_000;

interface ResumeVersionRow {
  id: string;
  resume_file_id: string | null;
  version_number: number;
  title: string;
  corpus_content: string;
  pdf_storage_path: string | null;
  docx_storage_path: string | null;
  created_at: string;
  updated_at: string;
}

export class ResumeVersionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumeVersionValidationError';
  }
}

export function mapResumeVersionRow(row: ResumeVersionRow): ResumeVersionRecord {
  return {
    id: row.id,
    resumeFileId: row.resume_file_id,
    versionNumber: row.version_number,
    title: row.title,
    corpusContent: row.corpus_content,
    pdfStoragePath: row.pdf_storage_path,
    docxStoragePath: row.docx_storage_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function validateCorpusContent(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ResumeVersionValidationError('Le contenu du corpus est obligatoire.');
  }

  const normalized = value.trim();

  if (normalized.length > MAX_CORPUS_CONTENT_LENGTH) {
    throw new ResumeVersionValidationError('Le contenu du corpus dépasse la limite autorisée.');
  }

  return normalized;
}

export function validateVersionTitle(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Version du CV';
  }

  return value.trim().slice(0, 120);
}

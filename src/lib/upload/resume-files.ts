import { createHash, randomUUID } from 'node:crypto';

import type { LocalDatabaseClient } from '@/lib/db/local-client';

import type { ResumeFileRecord } from '@/types';

export const CV_ORIGINALS_BUCKET = 'cv-originals';
export const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_RESUME_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/markdown',
] as const;

type ResumeMimeType = (typeof SUPPORTED_RESUME_MIME_TYPES)[number];

const MARKDOWN_MIME_TYPES = new Set(['text/markdown', 'text/x-markdown', 'application/markdown']);

interface ResumeFileRow {
  id: string;
  original_file_name: string;
  mime_type: string;
  file_size_bytes: number;
  checksum_sha256: string;
  storage_bucket: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
}

export interface PreparedResumeFile {
  originalFileName: string;
  mimeType: ResumeMimeType;
  fileSizeBytes: number;
  checksumSha256: string;
  storagePath: string;
  bytes: Buffer;
}

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

export function mapResumeFileRow(row: ResumeFileRow): ResumeFileRecord {
  return {
    id: row.id,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    checksumSha256: row.checksum_sha256,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function prepareResumeFile(file: File, userId: string): Promise<PreparedResumeFile> {
  if (!file.name) {
    throw new UploadValidationError('Nom de fichier manquant.');
  }

  const mimeType = resolveResumeMimeType(file);

  if (!mimeType) {
    throw new UploadValidationError(
      'Format non pris en charge. Ajoutez un fichier PDF, DOCX, PNG, JPG, WEBP, Markdown ou TXT.',
    );
  }

  if (file.size <= 0) {
    throw new UploadValidationError('Le fichier est vide.');
  }

  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    throw new UploadValidationError('Le fichier dépasse la limite de 10 Mo.');
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
  const originalFileName = sanitizeFileName(file.name);
  const extension = getStorageExtension(mimeType);
  const storagePath = `${userId}/${randomUUID()}.${extension}`;

  return {
    originalFileName,
    mimeType,
    fileSizeBytes: file.size,
    checksumSha256,
    storagePath,
    bytes,
  };
}

function getStorageExtension(mimeType: ResumeMimeType): string {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'docx';
  }
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'text/plain') return 'txt';
  if (mimeType === 'text/markdown') return 'md';

  return 'jpg';
}

export async function removeStoredResumeFile(
  db: LocalDatabaseClient,
  storagePath: string,
): Promise<void> {
  const { error } = await db.storage.from(CV_ORIGINALS_BUCKET).remove([storagePath]);

  if (error) {
    // Database changes have already committed when this cleanup is called. A
    // storage failure must not make a successful replacement/delete look like a
    // failed request, but it remains visible for operational follow-up.
    console.error('Unable to remove an unreferenced resume file from storage.', error);
  }
}

function resolveResumeMimeType(file: File): ResumeMimeType | null {
  const extension = getFileExtension(file.name);

  if (extension === 'md' || extension === 'markdown') return 'text/markdown';
  if (extension === 'txt') return 'text/plain';
  if (MARKDOWN_MIME_TYPES.has(file.type)) return 'text/markdown';
  if (isSupportedResumeMimeType(file.type)) return file.type;

  return null;
}

function isSupportedResumeMimeType(mimeType: string): mimeType is ResumeMimeType {
  return SUPPORTED_RESUME_MIME_TYPES.includes(mimeType as ResumeMimeType);
}

function getFileExtension(fileName: string): string {
  const extensionMatch = /\.([^.]+)$/.exec(fileName.trim().toLowerCase());

  return extensionMatch?.[1] ?? '';
}

function sanitizeFileName(fileName: string): string {
  const normalized = fileName.normalize('NFKD').replace(/[^\w.\- ]/g, '');
  const compact = normalized.trim().replace(/\s+/g, '-');
  return compact || 'cv';
}

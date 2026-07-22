export interface ResumeFileRecord {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  storageBucket: string;
  storagePath: string;
  createdAt: string;
  updatedAt: string;
  signedUrl?: string | null;
}

export interface ResumeVersionRecord {
  id: string;
  resumeFileId: string | null;
  versionNumber: number;
  title: string;
  corpusContent: string;
  pdfStoragePath?: string | null;
  docxStoragePath?: string | null;
  createdAt: string;
  updatedAt: string;
}

'use client';

import { type ChangeEvent, type FormEvent, useRef, useState } from 'react';

import type { ResumeFileRecord } from '@/types';

interface UploadResponse {
  file?: ResumeFileRecord;
  files?: ResumeFileRecord[];
  error?: string;
  deleted?: boolean;
}

interface ResumeUploadPanelProps {
  initialFiles: ResumeFileRecord[];
  onFilesChange?: (files: ResumeFileRecord[]) => void;
}

export function ResumeUploadPanel({ initialFiles, onFilesChange }: ResumeUploadPanelProps) {
  const [files, setFiles] = useState<ResumeFileRecord[]>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError('Ajoutez un fichier PDF, DOCX, PNG, JPG, WEBP, Markdown ou TXT.');
      return;
    }

    const formData = new FormData();
    formData.set('file', selectedFile);

    if (replaceTargetId) {
      formData.set('id', replaceTargetId);
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(replaceTargetId ? 'Remplacement du CV...' : 'Import du CV...');

    try {
      const response = await fetch('/api/upload', {
        method: replaceTargetId ? 'PUT' : 'POST',
        body: formData,
      });
      const payload = (await response.json()) as UploadResponse;

      if (!response.ok || !payload.file) {
        throw new Error(payload.error ?? 'Impossible d’importer le CV.');
      }

      setFiles((currentFiles) => {
        if (replaceTargetId) {
          const nextFiles = currentFiles.map((file) =>
            file.id === replaceTargetId ? payload.file! : file,
          );
          onFilesChange?.(nextFiles);
          return nextFiles;
        }

        const nextFiles = [payload.file!, ...currentFiles];
        onFilesChange?.(nextFiles);
        return nextFiles;
      });
      setSelectedFile(null);
      setReplaceTargetId(null);
      setMessage(replaceTargetId ? 'CV remplacé avec succès.' : 'Fichier envoyé avec succès.');

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (submitError) {
      setMessage(null);
      setError(submitError instanceof Error ? submitError.message : 'Impossible d’importer le CV.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(file: ResumeFileRecord) {
    const confirmed = window.confirm(`Supprimer le CV « ${file.originalFileName} » ?`);

    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage('Suppression du CV...');

    try {
      const response = await fetch(`/api/upload?id=${encodeURIComponent(file.id)}`, {
        method: 'DELETE',
      });
      const payload = (await response.json()) as UploadResponse;

      if (!response.ok || !payload.deleted) {
        throw new Error(payload.error ?? 'Impossible de supprimer le CV.');
      }

      setFiles((currentFiles) => {
        const nextFiles = currentFiles.filter((currentFile) => currentFile.id !== file.id);
        onFilesChange?.(nextFiles);
        return nextFiles;
      });
      setMessage('CV supprimé.');
    } catch (deleteError) {
      setMessage(null);
      setError(deleteError instanceof Error ? deleteError.message : 'Impossible de supprimer le CV.');
    }
  }

  function startReplace(file: ResumeFileRecord) {
    setReplaceTargetId(file.id);
    setSelectedFile(null);
    setMessage(`Sélectionnez le nouveau fichier pour remplacer « ${file.originalFileName} ».`);
    setError(null);

    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <form onSubmit={handleSubmit} className="rounded-md border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Importez votre CV</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Déposez un fichier PDF, DOCX, PNG, JPG, WEBP, Markdown ou TXT. La limite est de
            10 Mo.
          </p>
        </div>

        <label className="mt-5 grid gap-2 text-sm font-medium text-slate-800">
          Fichier
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp,text/plain,text/markdown,text/x-markdown,application/markdown,.pdf,.docx,.png,.jpg,.jpeg,.webp,.txt,.md,.markdown"
            onChange={handleFileChange}
            className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-sm"
          />
        </label>

        {replaceTargetId ? (
          <button
            type="button"
            onClick={() => {
              setReplaceTargetId(null);
              setMessage(null);
              setSelectedFile(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="mt-3 text-sm font-medium text-slate-700 underline"
          >
            Annuler le remplacement
          </button>
        ) : null}

        {error ? <p className="mt-4 text-sm font-medium text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 text-sm font-medium text-blue-700">{message}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-5 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {replaceTargetId ? 'Remplacer le fichier' : 'Envoyer le fichier'}
        </button>
      </form>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">CV importés</h2>

        {files.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Aucun CV importé pour le moment.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3">
          {files.map((file) => (
            <article key={file.id} className="rounded-md border border-slate-200 p-4">
              <div>
                <h3 className="break-words text-sm font-semibold text-slate-950">
                  {file.originalFileName}
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  {formatFileSize(file.fileSizeBytes)} · {formatDate(file.createdAt)}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startReplace(file)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:border-blue-400 hover:text-blue-800"
                >
                  Remplacer
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(file)}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:border-red-400"
                >
                  Supprimer
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

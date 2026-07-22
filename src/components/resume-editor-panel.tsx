'use client';

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

import {
  plainTextToRichTextHtml,
  richTextHtmlToMarkdown,
  richTextHtmlToPlainText,
} from '@/lib/rich-text/html';
import type { ResumeFileRecord, ResumeVersionRecord } from '@/types';

interface ResumeEditorPanelProps {
  files: ResumeFileRecord[];
}

interface PreviewResponse {
  signedUrl?: string;
  mimeType?: string;
  error?: string;
}

interface ExtractTextResponse {
  text?: string;
  warnings?: string[];
  error?: string;
}

interface VersionsResponse {
  versions?: ResumeVersionRecord[];
  version?: ResumeVersionRecord;
  error?: string;
}

interface GenerateProfileResponse {
  profile?: { id: string };
  error?: string;
}

interface ExtractSectionsResponse {
  extractionId?: string;
  richTextContent?: string;
  warnings?: string[];
  error?: string;
}

export function ResumeEditorPanel({ files }: ResumeEditorPanelProps) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [selectedResumeFileId, setSelectedResumeFileId] = useState(files[0]?.id ?? '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [versions, setVersions] = useState<ResumeVersionRecord[]>([]);
  const [title, setTitle] = useState(files[0]?.originalFileName.replace(/\.[^.]+$/, '') ?? 'Corpus manuel');
  const [corpusContent, setCorpusContent] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const selectedFile = useMemo(
    () => files.find((file) => file.id === selectedResumeFileId) ?? null,
    [files, selectedResumeFileId],
  );

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor || document.activeElement === editor) return;

    editor.innerHTML = toEditorHtml(corpusContent);
  }, [corpusContent]);

  async function loadResumeWorkspace() {
    setIsLoading(true);
    setError(null);
    setMessage(selectedResumeFileId ? 'Chargement du CV...' : 'Chargement des corpus...');

    try {
      const versionsUrl = selectedResumeFileId
        ? `/api/resume-versions?resumeFileId=${encodeURIComponent(selectedResumeFileId)}`
        : '/api/resume-versions';
      const previewResponse = selectedResumeFileId
        ? await fetch(`/api/upload/${encodeURIComponent(selectedResumeFileId)}/preview`)
        : null;
      const versionsResponse = await fetch(versionsUrl);
      const previewPayload = previewResponse
        ? ((await previewResponse.json()) as PreviewResponse)
        : null;
      const versionsPayload = (await versionsResponse.json()) as VersionsResponse;

      if (previewResponse && !previewResponse.ok) {
        throw new Error(previewPayload?.error ?? 'Impossible de charger l’aperçu.');
      }

      if (!versionsResponse.ok) {
        throw new Error(versionsPayload.error ?? 'Impossible de charger les versions.');
      }

      const loadedVersions = versionsPayload.versions ?? [];
      setPreviewUrl(previewPayload?.signedUrl ?? null);
      setPreviewMimeType(previewPayload?.mimeType ?? null);
      setVersions(loadedVersions);

      if (loadedVersions[0]) {
        setSelectedVersionId(loadedVersions[0].id);
        setTitle(loadedVersions[0].title);
        setCorpusContent(loadedVersions[0].corpusContent);
        setMessage(selectedResumeFileId ? 'CV chargé.' : 'Corpus chargé.');
        return;
      }

      if (selectedResumeFileId) {
        const textExtraction = await extractSourceText(selectedResumeFileId);
        setSelectedVersionId(null);
        setTitle(selectedFile?.originalFileName.replace(/\.[^.]+$/, '') ?? 'Version éditée du CV');
        setCorpusContent(textExtraction.text);
        setMessage(
          textExtraction.text
            ? textExtraction.warnings.length > 0
              ? `CV chargé. Texte extrait avec ${textExtraction.warnings.length} point à vérifier.`
              : 'CV chargé. Texte extrait dans le corpus.'
            : 'CV chargé. Collez le texte dans le corpus pour préparer une version.',
        );
        return;
      }

      setSelectedVersionId(null);
      setTitle('Corpus manuel');
      setCorpusContent('');
      setMessage('Aucun corpus enregistré. Collez votre contenu pour créer une version.');
    } catch (loadError) {
      setMessage(null);
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger le CV.');
    } finally {
      setIsLoading(false);
    }
  }

  async function extractSourceText(resumeFileId: string): Promise<{ text: string; warnings: string[] }> {
    const response = await fetch(`/api/upload/${encodeURIComponent(resumeFileId)}/extract-text`);
    const payload = (await response.json()) as ExtractTextResponse;

    if (!response.ok) {
      return { text: '', warnings: [payload.error ?? 'Extraction du texte indisponible.'] };
    }

    return {
      text: payload.text ?? '',
      warnings: payload.warnings ?? [],
    };
  }

  async function saveVersion(): Promise<ResumeVersionRecord | null> {
    if (!richTextHtmlToPlainText(corpusContent).trim()) {
      setError('Collez ou chargez un corpus avant de l’enregistrer.');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setMessage('Enregistrement de la version...');

    try {
      const response = await fetch('/api/resume-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeFileId: selectedResumeFileId || null,
          title,
          corpusContent,
        }),
      });
      const payload = (await response.json()) as VersionsResponse;

      if (!response.ok || !payload.version) {
        throw new Error(payload.error ?? 'Impossible d’enregistrer la version.');
      }

      setVersions((currentVersions) => [payload.version!, ...currentVersions]);
      setSelectedVersionId(payload.version.id);
      setMessage('Version enregistrée.');
      return payload.version;
    } catch (saveError) {
      setMessage(null);
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer la version.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  async function extractSectionsForVersion(resumeVersionId: string): Promise<string | null> {
    const plainCorpusContent = richTextHtmlToPlainText(corpusContent);

    if (!plainCorpusContent.trim()) {
      setError('Collez le texte du CV dans le corpus avant d’extraire les sections.');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setMessage('Extraction des sections...');

    try {
      const response = await fetch('/api/profile/extract-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          corpusContent: plainCorpusContent,
          resumeFileId: selectedResumeFileId || null,
          resumeVersionId,
        }),
      });
      const payload = (await response.json()) as ExtractSectionsResponse;

      if (!response.ok || !payload.richTextContent) {
        throw new Error(payload.error ?? 'Impossible d’extraire les sections du CV.');
      }

      setCorpusContent(payload.richTextContent);
      setMessage(
        payload.warnings?.length
          ? `Sections extraites et enregistrées avec ${payload.warnings.length} point à vérifier.`
          : 'Sections extraites. Relisez puis enregistrez la version.',
      );
      return payload.richTextContent;
    } catch (extractError) {
      setMessage(null);
      setError(
        extractError instanceof Error
          ? extractError.message
          : 'Impossible d’extraire les sections du CV.',
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  async function generateProfile() {
    const savedVersion = await saveVersion();

    if (!savedVersion) return;

    const extractedRichText = await extractSectionsForVersion(savedVersion.id);

    if (!extractedRichText) return;

    setIsLoading(true);
    setError(null);
    setMessage('Génération du profil...');

    try {
      const response = await fetch('/api/profile/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeVersionId: savedVersion.id,
          title: savedVersion.title,
          corpusContent: richTextHtmlToPlainText(extractedRichText),
        }),
      });
      const payload = (await response.json()) as GenerateProfileResponse;

      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? 'Impossible de générer le profil.');
      }

      setMessage('Profil généré.');
      router.push('/profile' as Route);
      router.refresh();
    } catch (generateError) {
      setMessage(null);
      setError(
        generateError instanceof Error ? generateError.message : 'Impossible de générer le profil.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  function selectVersion(event: ChangeEvent<HTMLSelectElement>) {
    const version = versions.find((item) => item.id === event.target.value);

    if (!version) {
      setSelectedVersionId(null);
      return;
    }

    setSelectedVersionId(version.id);
    setTitle(version.title);
    setCorpusContent(version.corpusContent);
    setMessage(`Version ${version.versionNumber} sélectionnée.`);
    setError(null);
  }

  function updateCorpusFromEditor(event: FormEvent<HTMLDivElement>) {
    setCorpusContent(event.currentTarget.innerHTML);
  }

  function runEditorCommand(command: 'bold' | 'italic' | 'formatBlock', value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);

    if (editorRef.current) {
      setCorpusContent(editorRef.current.innerHTML);
    }
  }

  function insertHeading() {
    const editor = editorRef.current;

    if (!editor) return;

    editor.focus();

    if (!window.getSelection()?.toString()) {
      document.execCommand('insertText', false, 'Titre');
    }

    runEditorCommand('formatBlock', 'h2');
  }

  function exportLocalCorpus(format: 'markdown' | 'text') {
    const content =
      format === 'markdown'
        ? richTextHtmlToMarkdown(corpusContent)
        : richTextHtmlToPlainText(corpusContent);

    if (!content.trim()) {
      setError('Collez ou chargez un corpus avant de l’exporter.');
      return;
    }

    const extension = format === 'markdown' ? 'md' : 'txt';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${safeFileName(title || 'corpus')}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setError(null);
    setMessage(format === 'markdown' ? 'Export Markdown prêt.' : 'Export texte prêt.');
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(280px,0.7fr)_minmax(520px,1.3fr)]">
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">CV source facultatif</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Formats acceptés : PDF, DOCX, PNG, JPG, WEBP, Markdown et TXT.
        </p>
        <p
          className="mt-1 text-sm leading-6 text-slate-600"
          title="Vous pouvez importer un CV ou coller directement votre corpus à droite."
        >
          L’import sert à préremplir le corpus. Vous pouvez aussi coller directement votre corpus.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            value={selectedResumeFileId}
            onChange={(event) => {
              const nextFileId = event.target.value;

              setSelectedResumeFileId(nextFileId);
              setPreviewUrl(null);
              setPreviewMimeType(null);
              setVersions([]);
              setSelectedVersionId(null);
              setTitle(
                files.find((file) => file.id === nextFileId)?.originalFileName.replace(/\.[^.]+$/, '') ??
                  'Corpus manuel',
              );
              setMessage(null);
              setError(null);
            }}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Corpus manuel</option>
            {files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.originalFileName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadResumeWorkspace()}
            disabled={isLoading}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            title="Charge le CV sélectionné ou vos corpus enregistrés."
          >
            Charger
          </button>
        </div>

        <div className="mt-5 min-h-[360px] overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          {previewUrl && previewMimeType === 'application/pdf' ? (
            <iframe src={previewUrl} title="Aperçu PDF du CV" className="h-[520px] w-full" />
          ) : null}
          {previewUrl &&
          previewMimeType ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? (
            <div className="p-5 text-sm leading-6 text-slate-700">
              Aperçu direct du DOCX non disponible dans le navigateur. Utilisez le corpus éditable à
              droite pour préparer une version propre.
            </div>
          ) : null}
          {previewUrl && previewMimeType?.startsWith('image/') ? (
            <div className="relative h-[520px] w-full">
              <Image
                src={previewUrl}
                alt="Aperçu du CV importé"
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          ) : null}
          {previewUrl && isTextPreviewMimeType(previewMimeType) ? (
            <div className="p-5 text-sm leading-6 text-slate-700">
              Fichier texte chargé. Utilisez le corpus éditable à droite pour préparer une
              version propre.
            </div>
          ) : null}
          {!previewUrl ? (
            <div className="p-5 text-sm leading-6 text-slate-600">
              Sélectionnez un CV pour l’aperçu, ou utilisez directement le corpus éditable.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Corpus éditable</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Reprenez uniquement les faits exacts de votre parcours. Vous pouvez corriger ce corpus ici,
          puis modifier les sections dans le profil généré.
        </p>

        {versions.length > 0 ? (
          <label className="mt-4 grid gap-2 text-sm font-medium text-slate-800">
            Version enregistrée
            <select
              value={selectedVersionId ?? ''}
              onChange={selectVersion}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  Version {version.versionNumber} · {version.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="mt-4 grid gap-2 text-sm font-medium text-slate-800">
          Titre
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runEditorCommand('bold')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
            title="Gras"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runEditorCommand('italic')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm italic"
            title="Italique"
          >
            I
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={insertHeading}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
            title="Titre de section"
          >
            Titre
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runEditorCommand('formatBlock', 'p')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
            title="Texte normal"
          >
            Texte
          </button>
        </div>

        <div className="mt-4 grid gap-2 text-sm font-medium text-slate-800">
          Contenu
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Contenu du corpus"
            onInput={updateCorpusFromEditor}
            className="min-h-[430px] resize-y overflow-auto rounded-md border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] [&_em]:italic [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-950 [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-1 [&_strong]:font-semibold [&_ul]:my-2"
            data-placeholder="Collez directement votre corpus : profil, expériences, formation, compétences..."
            title="Vous pouvez coller un corpus sans importer de CV. Les sections restent modifiables dans le profil."
          />
        </div>

        {error ? <p className="mt-4 text-sm font-medium text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 text-sm font-medium text-blue-700">{message}</p> : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void saveVersion()}
            disabled={isLoading || !richTextHtmlToPlainText(corpusContent).trim()}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Enregistrer la version
          </button>
          <button
            type="button"
            onClick={() => exportLocalCorpus('markdown')}
            disabled={isLoading || !richTextHtmlToPlainText(corpusContent).trim()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Exporter Markdown
          </button>
          <button
            type="button"
            onClick={() => exportLocalCorpus('text')}
            disabled={isLoading || !richTextHtmlToPlainText(corpusContent).trim()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Exporter texte
          </button>
          <button
            type="button"
            onClick={() => void generateProfile()}
            disabled={isLoading || !richTextHtmlToPlainText(corpusContent).trim()}
            className="rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
            title="Enregistre le corpus, extrait les sections, puis génère un profil modifiable."
          >
            Générer le profil
          </button>
        </div>
      </section>
    </section>
  );
}

function toEditorHtml(value: string): string {
  return /<\/?(?:div|p|h[1-6]|li|ul|ol|br)\b[^>]*>/i.test(value)
    ? value
    : plainTextToRichTextHtml(value);
}

function safeFileName(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-zA-Z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 80) || 'corpus'
  );
}

function isTextPreviewMimeType(mimeType: string | null): boolean {
  return (
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    mimeType === 'text/x-markdown' ||
    mimeType === 'application/markdown'
  );
}

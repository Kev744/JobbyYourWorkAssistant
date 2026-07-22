'use client';

import { useState } from 'react';

import { readJsonResponse } from '@/lib/http/json-response';
import type { CandidateProfile, GeneratedResumeRecord } from '@/types';

type GenerationKind = 'resume' | 'cover_letter';

interface ProfileResponse {
  profile?: CandidateProfile | null;
  error?: string;
}

interface GenerateResponse {
  generatedResume?: GeneratedResumeRecord;
  signedUrls?: {
    pdf?: string;
    docx?: string;
  };
  warnings?: string[];
  error?: string;
}

interface GeneratedDocuments {
  title?: string;
  pdf?: string;
  docx?: string;
  warnings?: string[];
}

export function PastedOfferGenerator({ openAiApiKey }: { openAiApiKey: string }) {
  const [offerText, setOfferText] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState<GenerationKind | null>(null);
  const [documents, setDocuments] = useState<Partial<Record<GenerationKind, GeneratedDocuments>>>({});
  const [error, setError] = useState<string | null>(null);

  async function generate(kind: GenerationKind) {
    if (offerText.trim().length < 40) {
      setError('Collez une offre suffisamment détaillée pour générer un document ciblé.');
      return;
    }

    setIsGenerating(kind);
    setError(null);

    try {
      const profileResponse = await fetch('/api/profile');
      const profilePayload = await readJsonResponse<ProfileResponse>(profileResponse);

      if (!profileResponse.ok || !profilePayload.profile) {
        throw new Error(profilePayload.error ?? 'Créez ou confirmez votre profil avant de générer un document.');
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationType: kind === 'resume' ? 'resume' : 'cover_letter',
          pastedOfferText: offerText,
          pastedOfferUrl: applicationUrl.trim() || undefined,
          candidateProfileId: profilePayload.profile.id,
          resumeVersionId: profilePayload.profile.resumeVersionId,
          openAiApiKey: openAiApiKey.trim() || undefined,
        }),
      });
      const payload = await readJsonResponse<GenerateResponse>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? 'Impossible de générer le document ciblé.');
      }

      setDocuments((current) => ({
        ...current,
        [kind]: {
          title: payload.generatedResume?.title,
          pdf: payload.signedUrls?.pdf,
          docx: payload.signedUrls?.docx,
          warnings: payload.warnings,
        },
      }));
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Impossible de générer le document ciblé.',
      );
    } finally {
      setIsGenerating(null);
    }
  }

  return (
    <section className="mb-5 grid gap-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Générer depuis une offre web</h2>
        <p className="mt-1 text-sm leading-6 text-slate-700">
          Copiez une offre depuis Indeed, LinkedIn ou tout autre site. Elle est comparée à votre profil
          actuel pour générer un CV ciblé ou une lettre de motivation.
        </p>
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-900">
        Offre d’emploi copiée
        <textarea
          value={offerText}
          onChange={(event) => setOfferText(event.target.value)}
          rows={10}
          placeholder="Collez ici le titre, la description, les missions et les compétences demandées…"
          className="min-h-52 rounded-md border border-slate-300 bg-white p-3 text-sm font-normal leading-6 text-slate-900"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-900">
        Lien de candidature (facultatif)
        <input
          type="url"
          value={applicationUrl}
          onChange={(event) => setApplicationUrl(event.target.value)}
          placeholder="https://fr.indeed.com/viewjob?..."
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void generate('resume')}
          disabled={isGenerating !== null}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isGenerating === 'resume' ? 'Génération du CV…' : 'Générer un CV ciblé'}
        </button>
        <button
          type="button"
          onClick={() => void generate('cover_letter')}
          disabled={isGenerating !== null}
          className="rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-100 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {isGenerating === 'cover_letter'
            ? 'Génération de la lettre…'
            : 'Générer une lettre de motivation'}
        </button>
      </div>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <GeneratedDocumentLinks label="CV ciblé" documents={documents.resume} />
      <GeneratedDocumentLinks label="Lettre de motivation" documents={documents.cover_letter} />
    </section>
  );
}

function GeneratedDocumentLinks({
  label,
  documents,
}: {
  label: string;
  documents: GeneratedDocuments | undefined;
}) {
  if (!documents) return null;

  return (
    <div className="grid gap-2 rounded-md border border-emerald-200 bg-white p-3 text-sm text-slate-700">
      <p className="font-medium text-emerald-800">{label} généré{documents.title ? ` : ${documents.title}` : '.'}</p>
      <div className="flex flex-wrap gap-3">
        {documents.pdf ? (
          <a className="text-blue-800 underline" href={documents.pdf} target="_blank" rel="noreferrer">
            Télécharger le PDF
          </a>
        ) : null}
        {documents.docx ? (
          <a className="text-blue-800 underline" href={documents.docx} target="_blank" rel="noreferrer">
            Télécharger le DOCX
          </a>
        ) : null}
      </div>
      {(documents.warnings ?? []).map((warning) => (
        <p key={warning} className="text-amber-800">
          {warning}
        </p>
      ))}
    </div>
  );
}

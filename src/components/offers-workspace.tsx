'use client';

import { useMemo, useState } from 'react';

import { buildAutoApplyRunPlan, PRODUCT_MAX_DAILY_APPLICATION_LIMIT } from '@/automation/ApplicationPlanner';
import {
  buildLocalAutoApplyRunPayload,
  LOCAL_AUTO_APPLY_HELPER_URL,
} from '@/automation/local-helper/client';
import { toAutoApplyOffer } from '@/automation/OfferCollector';
import type { AutoApplyCoverLetterMode } from '@/automation/types';
import {
  clampPage,
  getOfferPageCount,
  OFFERS_PER_PAGE,
  paginateOffers,
  sortOffersByScore,
} from '@/lib/offers/display';
import { readJsonResponse } from '@/lib/http/json-response';
import { PastedOfferGenerator } from '@/components/pasted-offer-generator';
import type { ApplicationRecord, GeneratedResumeRecord, JobOffer, ScoredOffer } from '@/types';

type ProviderKey = 'france_travail' | 'adzuna';

interface ProviderConfig {
  key: ProviderKey;
  label: string;
  description: string;
  endpoint: string;
  emptyText: string;
  sourceBadge: string;
}

interface ProviderResponse {
  offers?: JobOffer[];
  warnings?: string[];
  error?: string;
  cache?: {
    status: 'hit' | 'miss' | 'refresh';
    queryId?: string;
    expiresAt?: string;
  };
}

interface MatchResponse {
  scoredOffers?: ScoredOffer[];
  candidateProfileId?: string;
  resumeVersionId?: string;
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

interface ApplicationResponse {
  application?: ApplicationRecord;
  error?: string;
}

interface MatchContext {
  candidateProfileId: string;
  resumeVersionId: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    key: 'france_travail',
    label: 'Offres publiques',
    description: 'Offres France Travail normalisées depuis vos critères de recherche.',
    endpoint: '/api/offers/france-travail',
    emptyText: 'Aucune offre publique chargée pour le moment.',
    sourceBadge: 'France Travail',
  },
  {
    key: 'adzuna',
    label: 'Offres privées',
    description: 'Offres Adzuna normalisées depuis vos critères compatibles.',
    endpoint: '/api/offers/adzuna',
    emptyText: 'Aucune offre privée chargée pour le moment.',
    sourceBadge: 'Adzuna',
  },
];

export function OffersWorkspace() {
  const [activeProvider, setActiveProvider] = useState<ProviderKey>('france_travail');
  const [offersByProvider, setOffersByProvider] = useState<Record<ProviderKey, JobOffer[]>>({
    france_travail: [],
    adzuna: [],
  });
  const [pageByProvider, setPageByProvider] = useState<Record<ProviderKey, number>>({
    france_travail: 1,
    adzuna: 1,
  });
  const [warningsByProvider, setWarningsByProvider] = useState<Record<ProviderKey, string[]>>({
    france_travail: [],
    adzuna: [],
  });
  const [cacheByProvider, setCacheByProvider] = useState<Record<ProviderKey, ProviderResponse['cache']>>({
    france_travail: undefined,
    adzuna: undefined,
  });
  const [scoresByProvider, setScoresByProvider] = useState<Record<ProviderKey, Record<string, ScoredOffer>>>({
    france_travail: {},
    adzuna: {},
  });
  const [matchContextByProvider, setMatchContextByProvider] = useState<
    Record<ProviderKey, MatchContext | undefined>
  >({
    france_travail: undefined,
    adzuna: undefined,
  });
  const [generatedUrlsByOffer, setGeneratedUrlsByOffer] = useState<
    Record<
      string,
      {
        pdf?: string;
        docx?: string;
        title?: string;
        content?: string;
        warnings?: string[];
        generatedResumeId?: string;
        applicationCreated?: boolean;
      }
    >
  >({});
  const [generatedCoverLetterUrlsByOffer, setGeneratedCoverLetterUrlsByOffer] = useState<
    Record<
      string,
      {
        pdf?: string;
        docx?: string;
        title?: string;
        content?: string;
        warnings?: string[];
        generatedResumeId?: string;
      }
    >
  >({});
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<ProviderKey | null>(null);
  const [matchingProvider, setMatchingProvider] = useState<ProviderKey | null>(null);
  const [generatingOfferId, setGeneratingOfferId] = useState<string | null>(null);
  const [generatingCoverLetterOfferId, setGeneratingCoverLetterOfferId] = useState<string | null>(null);
  const [creatingApplicationOfferId, setCreatingApplicationOfferId] = useState<string | null>(null);
  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [isAutoApplyModalOpen, setIsAutoApplyModalOpen] = useState(false);
  const [autoApplyDailyLimit, setAutoApplyDailyLimit] = useState(3);
  const [autoApplyEmail, setAutoApplyEmail] = useState('');
  const [autoApplyCoverLetterMode, setAutoApplyCoverLetterMode] =
    useState<AutoApplyCoverLetterMode>('template');
  const [autoApplyConsent, setAutoApplyConsent] = useState(false);
  const [autoApplyMessage, setAutoApplyMessage] = useState<string | null>(null);
  const [isAutoApplyStarting, setIsAutoApplyStarting] = useState(false);
  const [editingDocument, setEditingDocument] = useState<{
    offerId: string;
    kind: 'resume' | 'cover_letter';
  } | null>(null);
  const provider = PROVIDERS.find((item) => item.key === activeProvider) ?? PROVIDERS[0];
  const offers = offersByProvider[activeProvider];
  const warnings = warningsByProvider[activeProvider];
  const cache = cacheByProvider[activeProvider];
  const scores = scoresByProvider[activeProvider];
  const currentPage = pageByProvider[activeProvider];
  const sortedOffers = useMemo(() => sortOffersByScore(offers, scores), [offers, scores]);
  const pageCount = getOfferPageCount(sortedOffers.length);
  const visiblePage = clampPage(currentPage, pageCount);
  const paginatedOffers = useMemo(
    () => paginateOffers(sortedOffers, visiblePage, OFFERS_PER_PAGE),
    [sortedOffers, visiblePage],
  );
  const firstVisibleOffer = sortedOffers.length === 0 ? 0 : (visiblePage - 1) * OFFERS_PER_PAGE + 1;
  const lastVisibleOffer = Math.min(visiblePage * OFFERS_PER_PAGE, sortedOffers.length);
  const isLoading = loadingProvider === activeProvider;
  const isMatching = matchingProvider === activeProvider;

  async function loadOffers(config: ProviderConfig, refresh = false) {
    setLoadingProvider(config.key);
    setError(null);
    setWarningsByProvider((current) => ({ ...current, [config.key]: [] }));

    try {
      const response = await fetch(refresh ? `${config.endpoint}?refresh=true` : config.endpoint);
      const payload = (await readJsonResponse<ProviderResponse>(response)) as ProviderResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Impossible de charger les offres.');
      }

      const loadedOffers = payload.offers ?? [];

      setOffersByProvider((current) => ({ ...current, [config.key]: loadedOffers }));
      setWarningsByProvider((current) => ({ ...current, [config.key]: payload.warnings ?? [] }));
      setCacheByProvider((current) => ({ ...current, [config.key]: payload.cache }));
      setScoresByProvider((current) => ({ ...current, [config.key]: {} }));
      setMatchContextByProvider((current) => ({ ...current, [config.key]: undefined }));
      setPageByProvider((current) => ({ ...current, [config.key]: 1 }));

      if (loadedOffers.length > 0) {
        await matchOffers(config, payload.cache?.queryId);
      }
    } catch (loadError) {
      setOffersByProvider((current) => ({ ...current, [config.key]: [] }));
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les offres.');
    } finally {
      setLoadingProvider(null);
    }
  }

  async function matchOffers(config: ProviderConfig, queryIdOverride?: string) {
    const queryId = queryIdOverride ?? cacheByProvider[config.key]?.queryId;

    setMatchingProvider(config.key);
    setError(null);

    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: config.key,
          queryId,
          openAiApiKey: openAiApiKey.trim() || undefined,
        }),
      });
      const payload = (await readJsonResponse<MatchResponse>(response)) as MatchResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Impossible de classer les offres.');
      }

      setScoresByProvider((current) => ({
        ...current,
        [config.key]: Object.fromEntries(
          (payload.scoredOffers ?? []).map((score) => [score.offer.offerId, score]),
        ),
      }));
      setPageByProvider((current) => ({ ...current, [config.key]: 1 }));
      if (payload.candidateProfileId && payload.resumeVersionId) {
        setMatchContextByProvider((current) => ({
          ...current,
          [config.key]: {
            candidateProfileId: payload.candidateProfileId ?? '',
            resumeVersionId: payload.resumeVersionId ?? '',
          },
        }));
      }
    } catch (matchError) {
      setError(matchError instanceof Error ? matchError.message : 'Impossible de classer les offres.');
    } finally {
      setMatchingProvider(null);
    }
  }

  async function generateResume(offer: JobOffer) {
    const context = matchContextByProvider[activeProvider];

    if (!context) {
      setError('Classez les offres avant de générer un CV ciblé.');
      return;
    }

    setGeneratingOfferId(offer.offerId);
    setError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generationType: 'resume',
          offerId: offer.offerId,
          candidateProfileId: context.candidateProfileId,
          resumeVersionId: context.resumeVersionId,
          openAiApiKey: openAiApiKey.trim() || undefined,
        }),
      });
      const payload = (await readJsonResponse<GenerateResponse>(response)) as GenerateResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Impossible de générer le CV ciblé.');
      }

      setGeneratedUrlsByOffer((current) => ({
        ...current,
        [offer.offerId]: {
          pdf: payload.signedUrls?.pdf,
          docx: payload.signedUrls?.docx,
          title: payload.generatedResume?.title,
          content: payload.generatedResume?.content,
          warnings: payload.warnings,
          generatedResumeId: payload.generatedResume?.id,
        },
      }));
      if (
        payload.generatedResume?.content &&
        window.confirm('Voulez-vous modifier le CV généré avant de le télécharger ?')
      ) {
        setEditingDocument({ offerId: offer.offerId, kind: 'resume' });
      }
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : 'Impossible de générer le CV ciblé.',
      );
    } finally {
      setGeneratingOfferId(null);
    }
  }

  async function generateCoverLetter(offer: JobOffer) {
    const context = matchContextByProvider[activeProvider];

    if (!context) {
      setError('Classez les offres avant de générer une lettre de motivation.');
      return;
    }

    setGeneratingCoverLetterOfferId(offer.offerId);
    setError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generationType: 'cover_letter',
          offerId: offer.offerId,
          candidateProfileId: context.candidateProfileId,
          resumeVersionId: context.resumeVersionId,
          openAiApiKey: openAiApiKey.trim() || undefined,
        }),
      });
      const payload = (await readJsonResponse<GenerateResponse>(response)) as GenerateResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Impossible de générer la lettre de motivation.');
      }

      setGeneratedCoverLetterUrlsByOffer((current) => ({
        ...current,
        [offer.offerId]: {
          pdf: payload.signedUrls?.pdf,
          docx: payload.signedUrls?.docx,
          title: payload.generatedResume?.title,
          content: payload.generatedResume?.content,
          warnings: payload.warnings,
          generatedResumeId: payload.generatedResume?.id,
        },
      }));
      if (
        payload.generatedResume?.content &&
        window.confirm('Voulez-vous modifier la lettre de motivation avant de la télécharger ?')
      ) {
        setEditingDocument({ offerId: offer.offerId, kind: 'cover_letter' });
      }
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : 'Impossible de générer la lettre de motivation.',
      );
    } finally {
      setGeneratingCoverLetterOfferId(null);
    }
  }

  async function createApplication(offer: JobOffer) {
    const generatedResumeId = generatedUrlsByOffer[offer.offerId]?.generatedResumeId;

    if (!generatedResumeId) {
      setError('Générez un CV ciblé avant de créer la candidature.');
      return;
    }

    setCreatingApplicationOfferId(offer.offerId);
    setError(null);

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generatedResumeId,
          applicationUrl: offer.applicationUrl,
          status: 'pending',
        }),
      });
      const payload = (await readJsonResponse<ApplicationResponse>(response)) as ApplicationResponse;

      if (!response.ok && response.status !== 409) {
        throw new Error(payload.error ?? 'Impossible de créer la candidature.');
      }

      setGeneratedUrlsByOffer((current) => ({
        ...current,
        [offer.offerId]: {
          ...current[offer.offerId],
          applicationCreated: true,
        },
      }));
    } catch (applicationError) {
      setError(
        applicationError instanceof Error
          ? applicationError.message
          : 'Impossible de créer la candidature.',
      );
    } finally {
      setCreatingApplicationOfferId(null);
    }
  }

  async function prepareAutoApplyRun() {
    const context = matchContextByProvider[activeProvider];

    if (!context) {
      setAutoApplyMessage(null);
      setError("Classez les offres avant de préparer l'auto-candidature.");
      return;
    }

    try {
      setIsAutoApplyStarting(true);
      const request = {
        dailyApplicationLimit: autoApplyDailyLimit,
        emailAddress: autoApplyEmail,
        applicationMode: 'review-before-submit' as const,
        resumeProfileId: context.candidateProfileId,
        coverLetterMode: autoApplyCoverLetterMode,
        siteConsent: autoApplyConsent,
      };
      const autoApplyOffers = sortedOffers.map((offer) => toAutoApplyOffer(offer));
      const plan = buildAutoApplyRunPlan(request, autoApplyOffers);
      const response = await fetch(`${LOCAL_AUTO_APPLY_HELPER_URL}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildLocalAutoApplyRunPayload(request, autoApplyOffers)),
      });

      if (!response.ok) {
        throw new Error('Le helper local a refusé la session.');
      }

      setError(null);
      setAutoApplyMessage(
        `${plan.maxAttempts} candidature(s) envoyée(s) au helper local. ${plan.skippedOfferIds.length} offre(s) ignorée(s). Chromium doit être ouvert sur votre machine.`,
      );
    } catch (autoApplyError) {
      setAutoApplyMessage(null);
      setError(
        autoApplyError instanceof Error
          ? `${autoApplyError.message} Démarrez le helper avec : pnpm automation:helper`
          : "Impossible de préparer l'auto-candidature.",
      );
    } finally {
      setIsAutoApplyStarting(false);
    }
  }

  return (
    <section className="grid gap-5">
      <div className="flex gap-2 border-b border-slate-200" role="tablist" aria-label="Sources d'offres">
        {PROVIDERS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={activeProvider === item.key}
            onClick={() => {
              setActiveProvider(item.key);
              setError(null);
              setPageByProvider((current) => ({
                ...current,
                [item.key]: clampPage(current[item.key], getOfferPageCount(offersByProvider[item.key].length)),
              }));
            }}
            className={
              activeProvider === item.key
                ? 'border-b-2 border-blue-700 px-4 py-2 text-sm font-medium text-blue-800'
                : 'px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-5">
        <div className="mb-5 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-4">
          <label className="grid gap-2 text-sm font-medium text-slate-900">
            Clé API OpenAI
            <input
              type="password"
              value={openAiApiKey}
              onChange={(event) => setOpenAiApiKey(event.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              spellCheck={false}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
            />
          </label>
          <p className="text-xs leading-5 text-slate-600">
            Non enregistrée. Utilisée uniquement pour générer le CV ou la lettre de motivation.
          </p>
        </div>

        <PastedOfferGenerator openAiApiKey={openAiApiKey} />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{provider.label}</h2>
            <p className="mt-2 text-sm text-slate-600">{provider.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadOffers(provider)}
              disabled={isLoading}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isMatching ? 'Classement...' : isLoading ? 'Recherche...' : 'Charger les offres'}
            </button>
            <button
              type="button"
              onClick={() => void loadOffers(provider, true)}
              disabled={isLoading || isMatching}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {isMatching ? 'Classement...' : isLoading ? 'Actualisation...' : 'Actualiser'}
            </button>
            <button
              type="button"
              onClick={() => void matchOffers(provider)}
              disabled={isLoading || isMatching || offers.length === 0}
              className="rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {isMatching ? 'Classement...' : 'Classer'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAutoApplyMessage(null);
                setIsAutoApplyModalOpen(true);
              }}
              disabled={offers.length === 0 || isLoading || isMatching}
              className="rounded-md border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Démarrer l&apos;auto-candidature
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm font-medium text-red-700">{error}</p> : null}
        {cache ? (
          <p className="mt-4 text-sm text-slate-600">
            {cache.status === 'hit'
              ? 'Résultat servi depuis le cache.'
              : 'Résultat actualisé depuis le fournisseur.'}
            {cache.expiresAt ? ` Expiration : ${formatDate(cache.expiresAt)}.` : ''}
          </p>
        ) : null}
        {warnings.map((warning) => (
          <p key={warning} className="mt-4 text-sm font-medium text-amber-700">
            {warning}
          </p>
        ))}

        {!isLoading && !error && offers.length === 0 ? (
          <p className="mt-5 text-sm leading-6 text-slate-600">{provider.emptyText}</p>
        ) : null}

        {offers.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">
              {scores && Object.keys(scores).length > 0
                ? 'Offres triées par score décroissant.'
                : 'Classez les offres pour activer le tri par score.'}{' '}
              {firstVisibleOffer}-{lastVisibleOffer} sur {sortedOffers.length} offres, {OFFERS_PER_PAGE} par page.
            </p>
            <PaginationControls
              currentPage={visiblePage}
              pageCount={pageCount}
              onPageChange={(page) =>
                setPageByProvider((current) => ({
                  ...current,
                  [activeProvider]: clampPage(page, pageCount),
                }))
              }
            />
          </div>
        ) : null}

        <div className="mt-5 grid gap-4">
          {paginatedOffers.map((offer) => (
            <OfferCard
              key={offer.offerId}
              offer={offer}
              score={scores[offer.offerId]}
              sourceBadge={provider.sourceBadge}
              generatedUrls={generatedUrlsByOffer[offer.offerId]}
              generatedCoverLetterUrls={generatedCoverLetterUrlsByOffer[offer.offerId]}
              editingDocumentKind={
                editingDocument?.offerId === offer.offerId ? editingDocument.kind : undefined
              }
              isGenerating={generatingOfferId === offer.offerId}
              isGeneratingCoverLetter={generatingCoverLetterOfferId === offer.offerId}
              isCreatingApplication={creatingApplicationOfferId === offer.offerId}
              onGenerate={() => void generateResume(offer)}
              onGenerateCoverLetter={() => void generateCoverLetter(offer)}
              onEditGeneratedDocument={(kind) => setEditingDocument({ offerId: offer.offerId, kind })}
              onCreateApplication={() => void createApplication(offer)}
            />
          ))}
        </div>

        {offers.length > OFFERS_PER_PAGE ? (
          <div className="mt-5 flex justify-end">
            <PaginationControls
              currentPage={visiblePage}
              pageCount={pageCount}
              onPageChange={(page) =>
                setPageByProvider((current) => ({
                  ...current,
                  [activeProvider]: clampPage(page, pageCount),
                }))
              }
            />
          </div>
        ) : null}
      </div>

      {isAutoApplyModalOpen ? (
        <AutoApplyStartModal
          dailyLimit={autoApplyDailyLimit}
          emailAddress={autoApplyEmail}
          coverLetterMode={autoApplyCoverLetterMode}
          consent={autoApplyConsent}
          message={autoApplyMessage}
          eligibleOfferCount={sortedOffers.filter((offer) => Boolean(offer.applicationUrl)).length}
          onDailyLimitChange={setAutoApplyDailyLimit}
          onEmailAddressChange={setAutoApplyEmail}
          onCoverLetterModeChange={setAutoApplyCoverLetterMode}
          onConsentChange={setAutoApplyConsent}
          onPrepare={prepareAutoApplyRun}
          isStarting={isAutoApplyStarting}
          onClose={() => setIsAutoApplyModalOpen(false)}
        />
      ) : null}
    </section>
  );
}

function AutoApplyStartModal({
  dailyLimit,
  emailAddress,
  coverLetterMode,
  consent,
  message,
  eligibleOfferCount,
  onDailyLimitChange,
  onEmailAddressChange,
  onCoverLetterModeChange,
  onConsentChange,
  onPrepare,
  isStarting,
  onClose,
}: {
  dailyLimit: number;
  emailAddress: string;
  coverLetterMode: AutoApplyCoverLetterMode;
  consent: boolean;
  message: string | null;
  eligibleOfferCount: number;
  onDailyLimitChange: (value: number) => void;
  onEmailAddressChange: (value: string) => void;
  onCoverLetterModeChange: (value: AutoApplyCoverLetterMode) => void;
  onConsentChange: (value: boolean) => void;
  onPrepare: () => void;
  isStarting: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-xl rounded-md bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Auto-candidature supervisée</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Préparez une session Playwright en mode visible. Le système s&apos;arrête sur les contrôles
              anti-robot, les champs sensibles et la revue finale.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Fermer
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-800">
            Nombre de candidatures aujourd&apos;hui
            <input
              type="number"
              min={1}
              max={PRODUCT_MAX_DAILY_APPLICATION_LIMIT}
              value={dailyLimit}
              onChange={(event) => onDailyLimitChange(Number(event.target.value))}
              className="rounded-md border border-slate-300 px-3 py-2 text-base font-normal"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-800">
            Adresse e-mail à utiliser
            <input
              type="email"
              value={emailAddress}
              onChange={(event) => onEmailAddressChange(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-base font-normal"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-800">
            Lettre de motivation
            <select
              value={coverLetterMode}
              onChange={(event) => onCoverLetterModeChange(event.target.value as AutoApplyCoverLetterMode)}
              className="rounded-md border border-slate-300 px-3 py-2 text-base font-normal"
            >
              <option value="template">Utiliser le modèle généré</option>
              <option value="ask-me">Me demander si nécessaire</option>
              <option value="none">Ne pas joindre de lettre</option>
            </select>
          </label>

          <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => onConsentChange(event.target.checked)}
              className="mt-1"
            />
            <span>
              Je confirme utiliser des informations exactes et respecter les règles de chaque site.
            </span>
          </label>

          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            Offres avec lien de candidature détecté : {eligibleOfferCount}. Lancez le helper local avec{' '}
            <code className="rounded bg-white px-1 py-0.5">pnpm automation:helper</code>. La soumission
            automatique sans revue finale est désactivée dans cette version.
          </p>

          {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onPrepare}
            disabled={isStarting}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {isStarting ? 'Lancement...' : 'Préparer la session'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaginationControls({
  currentPage,
  pageCount,
  onPageChange,
}: {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return (
      <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
        Page 1 / 1
      </span>
    );
  }

  return (
    <nav className="flex items-center gap-2" aria-label="Pagination des offres">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="min-w-24 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        Précédent
      </button>
      <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
        Page {currentPage} / {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= pageCount}
        className="min-w-24 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        Suivant
      </button>
    </nav>
  );
}

export function OfferCard({
  offer,
  score,
  sourceBadge,
  generatedUrls,
  generatedCoverLetterUrls,
  editingDocumentKind,
  isGenerating,
  isGeneratingCoverLetter,
  isCreatingApplication,
  onGenerate,
  onGenerateCoverLetter,
  onEditGeneratedDocument,
  onCreateApplication,
}: {
  offer: JobOffer;
  score?: ScoredOffer;
  sourceBadge: string;
  generatedUrls?: {
    pdf?: string;
    docx?: string;
    title?: string;
    content?: string;
    warnings?: string[];
    generatedResumeId?: string;
    applicationCreated?: boolean;
  };
  generatedCoverLetterUrls?: {
    pdf?: string;
    docx?: string;
    title?: string;
    content?: string;
    warnings?: string[];
    generatedResumeId?: string;
  };
  editingDocumentKind?: 'resume' | 'cover_letter';
  isGenerating: boolean;
  isGeneratingCoverLetter: boolean;
  isCreatingApplication: boolean;
  onGenerate: () => void;
  onGenerateCoverLetter: () => void;
  onEditGeneratedDocument?: (kind: 'resume' | 'cover_letter') => void;
  onCreateApplication: () => void;
}) {
  return (
    <article className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">{offer.title}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {[offer.company?.name, offer.location.city, offer.contract?.type].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {sourceBadge}
        </span>
      </div>

      {score ? <ScorePanel score={score} /> : null}

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-700">
        {stripHtml(offer.description)}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {offer.skills.slice(0, 6).map((skill) => (
          <span key={skill.raw} className="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-800">
            {skill.raw}
          </span>
        ))}
        {(offer.keywords ?? []).slice(0, 4).map((keyword) => (
          <span key={keyword} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
            {keyword}
          </span>
        ))}
      </div>

      {score ? <MatchDetails score={score} /> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        {offer.applicationUrl ? (
          <a
            href={offer.applicationUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800"
          >
            Voir l&apos;offre
          </a>
        ) : null}
        <button
          type="button"
          onClick={onGenerate}
          disabled={!score || isGenerating}
          className="rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-800"
        >
          {isGenerating ? 'Génération...' : 'Générer un CV'}
        </button>
        <button
          type="button"
          onClick={onGenerateCoverLetter}
          disabled={!score || isGeneratingCoverLetter}
          className="rounded-md border border-purple-200 px-3 py-2 text-sm font-medium text-purple-800 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {isGeneratingCoverLetter ? 'Génération...' : 'Générer une lettre de motivation'}
        </button>
      </div>
      {generatedUrls ? (
        <div className="mt-4 grid gap-2 text-sm text-slate-700">
          <p className="font-medium text-green-800">CV ciblé généré.</p>
          <div className="flex flex-wrap gap-3">
            {generatedUrls.pdf ? (
              <a className="text-blue-800 underline" href={generatedUrls.pdf} target="_blank" rel="noreferrer">
                PDF
              </a>
            ) : null}
            {generatedUrls.docx ? (
              <a className="text-blue-800 underline" href={generatedUrls.docx} target="_blank" rel="noreferrer">
                DOCX
              </a>
            ) : null}
          </div>
          {generatedUrls.content ? (
            <GeneratedDocumentEditor
              title={generatedUrls.title ?? 'CV cible'}
              content={generatedUrls.content}
              isOpen={editingDocumentKind === 'resume'}
              onOpen={() => onEditGeneratedDocument?.('resume')}
            />
          ) : null}
          {(generatedUrls.warnings ?? []).map((warning) => (
            <p key={warning} className="text-amber-800">
              {warning}
            </p>
          ))}
          {generatedUrls.applicationCreated ? (
            <p className="font-medium text-green-800">Candidature ajoutée.</p>
          ) : (
            <button
              type="button"
              onClick={onCreateApplication}
              disabled={!generatedUrls.generatedResumeId || isCreatingApplication}
              className="w-fit rounded-md border border-green-200 px-3 py-2 text-sm font-medium text-green-800 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {isCreatingApplication ? 'Ajout...' : 'Ajouter aux candidatures'}
            </button>
          )}
        </div>
      ) : null}
      {generatedCoverLetterUrls ? (
        <div className="mt-4 grid gap-2 text-sm text-slate-700">
          <p className="font-medium text-green-800">Lettre de motivation générée.</p>
          <div className="flex flex-wrap gap-3">
            {generatedCoverLetterUrls.pdf ? (
              <a
                className="text-blue-800 underline"
                href={generatedCoverLetterUrls.pdf}
                target="_blank"
                rel="noreferrer"
              >
                PDF
              </a>
            ) : null}
            {generatedCoverLetterUrls.docx ? (
              <a
                className="text-blue-800 underline"
                href={generatedCoverLetterUrls.docx}
                target="_blank"
                rel="noreferrer"
              >
                DOCX
              </a>
            ) : null}
          </div>
          {generatedCoverLetterUrls.content ? (
            <GeneratedDocumentEditor
              title={generatedCoverLetterUrls.title ?? 'Lettre de motivation'}
              content={generatedCoverLetterUrls.content}
              isOpen={editingDocumentKind === 'cover_letter'}
              onOpen={() => onEditGeneratedDocument?.('cover_letter')}
            />
          ) : null}
          {(generatedCoverLetterUrls.warnings ?? []).map((warning) => (
            <p key={warning} className="text-amber-800">
              {warning}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function GeneratedDocumentEditor({
  title,
  content,
  isOpen,
  onOpen,
}: {
  title: string;
  content: string;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const [editedContent, setEditedContent] = useState(content);
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportEditedDocument(format: ExportFormat) {
    setIsExporting(format);
    setExportError(null);

    try {
      const response = await fetch('/api/generate/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content: editedContent,
          format,
        }),
      });

      if (!response.ok) {
        const payload = await readJsonResponse<{ error?: string }>(response);
        throw new Error(payload.error ?? 'Impossible de préparer le téléchargement.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${slugify(title || 'document-genere')}.${format}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Impossible de préparer le téléchargement.',
      );
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      {!isOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="w-fit rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          Modifier avant téléchargement
        </button>
      ) : (
        <>
          <label className="grid gap-2 text-sm font-medium text-slate-800">
            Contenu à exporter
            <textarea
              value={editedContent}
              onChange={(event) => setEditedContent(event.target.value)}
              rows={12}
              className="min-h-72 rounded-md border border-slate-300 bg-white p-3 font-mono text-sm leading-6 text-slate-900"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void exportEditedDocument('pdf')}
              disabled={isExporting !== null}
              className="rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {isExporting === 'pdf' ? 'Préparation...' : 'Télécharger le PDF modifié'}
            </button>
            <button
              type="button"
              onClick={() => void exportEditedDocument('docx')}
              disabled={isExporting !== null}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {isExporting === 'docx' ? 'Préparation...' : 'Télécharger le DOCX modifié'}
            </button>
          </div>
          {exportError ? <p className="text-sm font-medium text-red-700">{exportError}</p> : null}
        </>
      )}
    </div>
  );
}

type ExportFormat = 'pdf' | 'docx';

function ScorePanel({ score }: { score: ScoredOffer }) {
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xl font-semibold text-slate-950">
          {score.breakdown.finalScore}/100
        </span>
        {score.breakdown.hardBlocker ? (
          <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
            Bloqueur
          </span>
        ) : score.matchedFeatures.missingMustHave.length > 0 ? (
          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
            Plafond possible
          </span>
        ) : null}
      </div>
      {score.explanation ? (
        <p className="mt-2 text-sm leading-6 text-slate-700">{score.explanation}</p>
      ) : null}
      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
        {score.breakdown.requiredCriteria !== undefined ? (
          <>
            <p>Critères obligatoires : {score.breakdown.requiredCriteria}/30</p>
            <p>Compétences et outils : {score.breakdown.skillsAndTools}/20</p>
            <p>Expérience pertinente : {score.breakdown.experienceRelevance}/20</p>
            <p>Intitulé, séniorité, domaine : {score.breakdown.roleTitleSeniorityDomain}/10</p>
            <p>Formation, certifications, langues : {score.breakdown.educationCertificationsLanguages}/10</p>
            <p>Compatibilité logistique : {score.breakdown.logisticsFit}/5</p>
            <p>Qualité des preuves : {score.breakdown.evidenceQuality}/5</p>
          </>
        ) : (
          <>
            <p>Compétences : {score.breakdown.skills}</p>
            <p>Expérience : {score.breakdown.experience}</p>
            <p>Intitulé : {score.breakdown.title}</p>
            <p>Langues : {score.breakdown.languages}</p>
          </>
        )}
      </div>
    </div>
  );
}

function MatchDetails({ score }: { score: ScoredOffer }) {
  return (
    <div className="mt-4 grid gap-2 text-sm text-slate-700">
      {score.matchedFeatures.exactSkills.length > 0 ? (
        <p>Compétences reconnues : {score.matchedFeatures.exactSkills.join(', ')}</p>
      ) : null}
      {score.matchedFeatures.fuzzySkills.length > 0 ? (
        <p>Correspondances approximatives : {score.matchedFeatures.fuzzySkills.join(', ')}</p>
      ) : null}
      {score.matchedFeatures.missingMustHave.length > 0 ? (
        <p className="text-amber-800">
          Compétences indispensables manquantes : {score.matchedFeatures.missingMustHave.join(', ')}
        </p>
      ) : null}
      {score.breakdown.hardBlocker ? (
        <p className="text-red-800">{score.breakdown.hardBlocker}</p>
      ) : null}
    </div>
  );
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'document-genere'
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

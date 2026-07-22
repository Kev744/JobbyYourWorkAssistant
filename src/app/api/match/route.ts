import { requireAuthenticatedUser } from '@/lib/auth';
import { CANDIDATE_PROFILE_SELECT, mapCandidateProfileRow } from '@/lib/profile/candidate-profiles';
import { compareScoredOffers } from '@/lib/match/prcv-r';
import { scoreOffersWithOpenAI } from '@/lib/match/openai-scoring';
import { createServerDbClient } from '@/lib/db/server';
import type { CandidateProfile, CandidateResume, JobOffer, ScoredOffer } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OfferSource = Extract<JobOffer['source'], 'france_travail' | 'adzuna'>;

interface MatchPayload {
  source?: string;
  queryId?: string;
  openAiApiKey?: string;
}

interface SearchResultRow {
  job_offer_id: string;
  job_offers?: { id: string; normalized_offer?: unknown } | Array<{ id: string; normalized_offer?: unknown }>;
}

interface CachedScoredOfferRow {
  job_offer_id: string;
  final_score: number;
  score_breakdown: unknown;
  matched_features: unknown;
  missing_must_haves?: unknown;
  explanation?: string | null;
}

const OFFER_SOURCES = new Set<OfferSource>(['france_travail', 'adzuna']);

export async function GET(request: Request) {
  const url = new URL(request.url);

  return handleMatch({
    source: url.searchParams.get('source') ?? undefined,
    queryId: url.searchParams.get('queryId') ?? undefined,
  });
}

export async function POST(request: Request) {
  const payload = await readPayload(request);

  return handleMatch({
    source: typeof payload.source === 'string' ? payload.source : undefined,
    queryId: typeof payload.queryId === 'string' ? payload.queryId : undefined,
    openAiApiKey: typeof payload.openAiApiKey === 'string' ? payload.openAiApiKey.slice(0, 500) : undefined,
  });
}

async function handleMatch(payload: MatchPayload): Promise<Response> {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  if (payload.source && !isOfferSource(payload.source)) {
    return Response.json({ error: 'Source d offres invalide.' }, { status: 400 });
  }

  const source = payload.source && isOfferSource(payload.source) ? payload.source : undefined;
  const db = await createServerDbClient();
  const profile = await loadLatestCandidateProfile(db, auth.user.id);

  if (!profile) {
    return Response.json(
      { error: 'Générez et confirmez votre profil avant de classer les offres.' },
      { status: 400 },
    );
  }

  const queryId = payload.queryId ?? (await loadLatestQueryId(db, auth.user.id, source));

  if (!queryId) {
    return Response.json(
      { error: 'Chargez des offres avant de lancer le classement.' },
      { status: 400 },
    );
  }

  const offerRows = await loadOffersForQuery(db, auth.user.id, queryId);

  if (offerRows.length === 0) {
    return Response.json(
      { error: 'Aucune offre en cache pour cette recherche.' },
      { status: 404 },
    );
  }

  let cachedScores: Array<{ jobOfferId: string; score: ScoredOffer }>;

  try {
    cachedScores = await loadCachedScores(db, {
      userId: auth.user.id,
      candidateProfileId: profile.id,
      offerRows,
    });
  } catch {
    return Response.json(
      { error: 'Impossible de charger les scores en cache.' },
      { status: 500 },
    );
  }

  const cachedJobOfferIds = new Set(cachedScores.map((cachedScore) => cachedScore.jobOfferId));
  const missingOfferRows = offerRows.filter((row) => !cachedJobOfferIds.has(row.jobOfferId));
  let newScores: ScoredOffer[] = [];

  try {
    if (missingOfferRows.length > 0) {
      newScores = await scoreOffersWithOpenAI({
        cv: toScoringResume(profile),
        offers: missingOfferRows.map((row) => row.offer),
        openAiApiKey: payload.openAiApiKey,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    console.log(message);

    if (message === 'OPENAI_KEY is missing.') {
      return Response.json(
        { error: 'Clé OpenAI manquante. Configurez OPENAI_KEY côté serveur avant de classer les offres.' },
        { status: 500 },
      );
    }

    return Response.json(
      { error: 'Impossible de classer les offres avec OpenAI.' },
      { status: 500 },
    );
  }

  const jobOfferIdByOfferId = new Map(missingOfferRows.map((row) => [row.offer.offerId, row.jobOfferId]));

  await persistScores(db, {
    userId: auth.user.id,
    candidateProfileId: profile.id,
    scores: newScores,
    jobOfferIdByOfferId,
  });

  const scores = [...cachedScores.map((cachedScore) => cachedScore.score), ...newScores].sort(compareScoredOffers);

  return Response.json({
    queryId,
    candidateProfileId: profile.id,
    resumeVersionId: profile.resumeVersionId,
    scoredOffers: scores,
  });
}

async function loadLatestCandidateProfile(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  userId: string,
): Promise<CandidateProfile | null> {
  const { data } = await db
    .from('candidate_profiles')
    .select(CANDIDATE_PROFILE_SELECT)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapCandidateProfileRow(data) : null;
}

async function loadLatestQueryId(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  userId: string,
  source?: OfferSource,
): Promise<string | null> {
  let query = db
    .from('job_search_queries')
    .select('id')
    .eq('user_id', userId)
    .order('fetched_at', { ascending: false })
    .limit(1);

  if (source) {
    query = query.eq('source', source);
  }

  const { data } = await query.maybeSingle();

  return data?.id ?? null;
}

async function loadOffersForQuery(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  userId: string,
  queryId: string,
): Promise<Array<{ jobOfferId: string; offer: JobOffer }>> {
  const { data, error } = await db
    .from('job_offer_search_results')
    .select('job_offer_id, job_offers(id, normalized_offer)')
    .eq('user_id', userId)
    .eq('query_id', queryId)
    .order('rank', { ascending: true });

  if (error) {
    throw new Error('Offer search results loading failed');
  }

  return ((data ?? []) as SearchResultRow[])
    .map((row) => {
      const joined = Array.isArray(row.job_offers) ? row.job_offers[0] : row.job_offers;
      const offer = joined?.normalized_offer as JobOffer | undefined;

      return offer ? { jobOfferId: row.job_offer_id, offer } : null;
    })
    .filter((row): row is { jobOfferId: string; offer: JobOffer } => Boolean(row));
}

async function loadCachedScores(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  input: {
    userId: string;
    candidateProfileId: string;
    offerRows: Array<{ jobOfferId: string; offer: JobOffer }>;
  },
): Promise<Array<{ jobOfferId: string; score: ScoredOffer }>> {
  const jobOfferIds = input.offerRows.map((row) => row.jobOfferId);

  if (jobOfferIds.length === 0) {
    return [];
  }

  const { data, error } = await db
    .from('scored_offers')
    .select('job_offer_id, final_score, score_breakdown, matched_features, missing_must_haves, explanation')
    .eq('user_id', input.userId)
    .eq('candidate_profile_id', input.candidateProfileId)
    .in('job_offer_id', jobOfferIds);

  if (error) {
    throw new Error('Scored offer cache loading failed');
  }

  const offerByJobOfferId = new Map(input.offerRows.map((row) => [row.jobOfferId, row.offer]));

  return ((data ?? []) as CachedScoredOfferRow[])
    .map((row) => {
      const offer = offerByJobOfferId.get(row.job_offer_id);
      const score = offer ? mapCachedScore(row, offer) : null;

      return score ? { jobOfferId: row.job_offer_id, score } : null;
    })
    .filter((row): row is { jobOfferId: string; score: ScoredOffer } => Boolean(row));
}

function mapCachedScore(row: CachedScoredOfferRow, offer: JobOffer): ScoredOffer | null {
  if (!isScoreBreakdown(row.score_breakdown)) {
    return null;
  }

  return {
    offer,
    breakdown: {
      ...row.score_breakdown,
      finalScore: Number.isFinite(row.final_score) ? row.final_score : row.score_breakdown.finalScore,
    },
    matchedFeatures: toMatchedFeatures(row.matched_features, row.missing_must_haves),
    explanation: row.explanation ?? undefined,
  };
}

async function persistScores(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  input: {
    userId: string;
    candidateProfileId: string;
    scores: ScoredOffer[];
    jobOfferIdByOfferId: Map<string, string>;
  },
): Promise<void> {
  const rows = input.scores
    .map((score) => ({
      user_id: input.userId,
      candidate_profile_id: input.candidateProfileId,
      job_offer_id: input.jobOfferIdByOfferId.get(score.offer.offerId),
      source: score.offer.source,
      final_score: score.breakdown.finalScore,
      score_breakdown: score.breakdown,
      matched_features: score.matchedFeatures,
      missing_must_haves: score.matchedFeatures.missingMustHave,
      explanation: score.explanation ?? '',
    }))
    .filter(
      (row): row is Omit<typeof row, 'job_offer_id'> & { job_offer_id: string } =>
        Boolean(row.job_offer_id),
    );

  if (rows.length === 0) {
    return;
  }

  const { error } = await db
    .from('scored_offers')
    .upsert(rows, { onConflict: 'user_id,candidate_profile_id,job_offer_id' });

  if (error) {
    throw new Error('Scored offer persistence failed');
  }
}

function toScoringResume(profile: CandidateProfile): CandidateResume {
  const payload = profile.scoringPayload;

  return {
    candidateId: payload.candidateId || profile.id,
    headline: payload.headline || profile.profession,
    location: payload.location,
    targetSalary: payload.targetSalary,
    titles:
      payload.titles?.length > 0
        ? payload.titles
        : [{ raw: profile.profession, canonicalRomeCode: profile.romeCode === 'Inconnu' ? undefined : profile.romeCode }],
    experiences:
      payload.experiences?.length > 0
        ? payload.experiences
        : profile.professionalExperiences.map((experience) => ({
            titleRaw: experience.titleRaw,
            location: experience.location,
            summary: experience.summary,
            startDate: experience.startDate,
            endDate: experience.endDate,
            skills: experience.skills,
          })),
    skills: payload.skills?.length > 0 ? payload.skills : profile.skills,
    education: payload.education?.length > 0 ? payload.education : profile.education,
    certifications:
      payload.certifications && payload.certifications.length > 0
        ? payload.certifications
        : profile.certifications,
    languages: payload.languages && payload.languages.length > 0 ? payload.languages : profile.languages,
    softSkills: payload.softSkills ?? [],
    keywords: payload.keywords ?? [],
  };
}

function isOfferSource(value: string): value is OfferSource {
  return OFFER_SOURCES.has(value as OfferSource);
}

function isScoreBreakdown(value: unknown): value is ScoredOffer['breakdown'] {
  return isRecord(value) && typeof value.finalScore === 'number';
}

function toMatchedFeatures(
  matchedFeatures: unknown,
  missingMustHaves: unknown,
): ScoredOffer['matchedFeatures'] {
  if (isRecord(matchedFeatures)) {
    return {
      exactSkills: toStringArray(matchedFeatures.exactSkills),
      fuzzySkills: toStringArray(matchedFeatures.fuzzySkills),
      semanticSkills: toStringArray(matchedFeatures.semanticSkills),
      missingMustHave: toStringArray(matchedFeatures.missingMustHave),
    };
  }

  return {
    exactSkills: [],
    fuzzySkills: [],
    semanticSkills: [],
    missingMustHave: toStringArray(missingMustHaves),
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readPayload(request: Request): Promise<Record<string, unknown>> {
  try {
    const payload = (await request.json()) as unknown;

    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export { compareScoredOffers };

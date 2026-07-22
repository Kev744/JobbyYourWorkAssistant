import { createHash } from 'node:crypto';

import type { LocalDatabaseClient } from '@/lib/db/local-client';

import { buildAdzunaQuery, searchAdzunaOffers } from '@/lib/adzuna/offers';
import {
  buildFranceTravailQuery,
  searchFranceTravailOffers,
} from '@/lib/france-travail/offres';
import type { CandidateProfile, JobOffer, ProfileRequirements } from '@/types';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type OfferSource = Extract<JobOffer['source'], 'france_travail' | 'adzuna'>;
export type CacheStatus = 'hit' | 'miss' | 'refresh';

interface SearchOffersWithCacheInput {
  db: LocalDatabaseClient;
  userId: string;
  source: OfferSource;
  requirements: ProfileRequirements | null;
  profile: CandidateProfile | null;
  refresh?: boolean;
  limit?: number;
}

interface ProviderSearchResult {
  offers: JobOffer[];
  upstreamQuery: Record<string, string>;
  warnings: string[];
}

export interface CachedOfferSearchResult extends ProviderSearchResult {
  cache: {
    status: CacheStatus;
    queryHash: string;
    queryId?: string;
    expiresAt?: string;
  };
}

interface JobSearchQueryRow {
  id: string;
  query_hash: string;
  query_payload: Record<string, string>;
  warnings: string[];
  result_count: number;
  cache_status: 'miss' | 'refresh';
  fetched_at: string;
  expires_at: string;
}

interface JobOfferLookupRow {
  id: string;
  source: OfferSource;
  source_offer_id: string;
}

export async function searchOffersWithCache(
  input: SearchOffersWithCacheInput,
): Promise<CachedOfferSearchResult> {
  const providerQuery = buildProviderQuery(input);
  const queryHash = buildOfferQueryHash(input.source, providerQuery);

  if (!input.refresh) {
    const cached = await readCachedOffers(input.db, {
      userId: input.userId,
      source: input.source,
      queryHash,
    });

    if (cached) {
      return cached;
    }
  }

  const fresh = await fetchFreshOffers(input);
  const queryId = await persistOfferSearch(input.db, {
    userId: input.userId,
    source: input.source,
    queryHash,
    queryPayload: fresh.upstreamQuery,
    offers: fresh.offers,
    warnings: fresh.warnings,
    refresh: Boolean(input.refresh),
  });

  return {
    ...fresh,
    cache: {
      status: input.refresh ? 'refresh' : 'miss',
      queryHash,
      queryId,
      expiresAt: getCacheExpiresAt().toISOString(),
    },
  };
}

export function buildOfferQueryHash(source: OfferSource, query: Record<string, string>): string {
  return createHash('sha256').update(stableStringify({ source, query })).digest('hex');
}

export function getCacheExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + CACHE_TTL_MS);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const objectValue = value as Record<string, unknown>;

  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(',')}}`;
}

async function readCachedOffers(
  db: LocalDatabaseClient,
  input: { userId: string; source: OfferSource; queryHash: string },
): Promise<CachedOfferSearchResult | null> {
  const now = new Date().toISOString();
  const { data: queryRow, error: queryError } = await db
    .from('job_search_queries')
    .select('id, query_hash, query_payload, warnings, result_count, cache_status, fetched_at, expires_at')
    .eq('user_id', input.userId)
    .eq('source', input.source)
    .eq('query_hash', input.queryHash)
    .gt('expires_at', now)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (queryError || !queryRow) {
    return null;
  }

  const cachedQuery = queryRow as JobSearchQueryRow;
  const { data: resultRows, error: resultError } = await db
    .from('job_offer_search_results')
    .select('rank, job_offers(normalized_offer)')
    .eq('user_id', input.userId)
    .eq('query_id', cachedQuery.id)
    .order('rank', { ascending: true });

  if (resultError) {
    return null;
  }

  return {
    offers: (resultRows ?? []).map(readNestedOffer).filter((offer): offer is JobOffer => Boolean(offer)),
    upstreamQuery: cachedQuery.query_payload,
    warnings: cachedQuery.warnings ?? [],
    cache: {
      status: 'hit',
      queryHash: cachedQuery.query_hash,
      queryId: cachedQuery.id,
      expiresAt: cachedQuery.expires_at,
    },
  };
}

async function fetchFreshOffers(input: SearchOffersWithCacheInput): Promise<ProviderSearchResult> {
  if (input.source === 'france_travail') {
    return searchFranceTravailOffers({
      requirements: input.requirements,
      profession: input.profile?.profession,
      romeCode: input.profile?.romeCode,
      limit: input.limit,
    });
  }

  return searchAdzunaOffers({
    requirements: input.requirements,
    profession: input.profile?.profession,
    limit: input.limit,
  });
}

function buildProviderQuery(input: SearchOffersWithCacheInput): Record<string, string> {
  if (input.source === 'france_travail') {
    return buildFranceTravailQuery({
      requirements: input.requirements,
      profession: input.profile?.profession,
      romeCode: input.profile?.romeCode,
      limit: input.limit,
    });
  }

  return buildAdzunaQuery({
    requirements: input.requirements,
    profession: input.profile?.profession,
    limit: input.limit,
  });
}

async function persistOfferSearch(
  db: LocalDatabaseClient,
  input: {
    userId: string;
    source: OfferSource;
    queryHash: string;
    queryPayload: Record<string, string>;
    offers: JobOffer[];
    warnings: string[];
    refresh: boolean;
  },
): Promise<string | undefined> {
  const now = new Date();
  const expiresAt = getCacheExpiresAt(now).toISOString();
  const offerRows = await upsertJobOffers(db, input.userId, input.offers);
  const { data: queryRow, error: queryError } = await db
    .from('job_search_queries')
    .insert({
      user_id: input.userId,
      source: input.source,
      query_hash: input.queryHash,
      query_payload: input.queryPayload,
      warnings: input.warnings,
      result_count: input.offers.length,
      cache_status: input.refresh ? 'refresh' : 'miss',
      fetched_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (queryError || !queryRow) {
    throw new Error('Offer search query persistence failed');
  }

  const queryId = String((queryRow as { id: string }).id);
  const offerIdBySourceId = new Map(
    offerRows.map((row) => [`${row.source}:${row.source_offer_id}`, row.id]),
  );
  const resultRows = input.offers
    .map((offer, index) => ({
      user_id: input.userId,
      query_id: queryId,
      job_offer_id: offerIdBySourceId.get(`${offer.source}:${offer.sourceOfferId}`),
      rank: index + 1,
    }))
    .filter((row): row is { user_id: string; query_id: string; job_offer_id: string; rank: number } =>
      Boolean(row.job_offer_id),
    );

  if (resultRows.length > 0) {
    const { error: resultError } = await db.from('job_offer_search_results').insert(resultRows);

    if (resultError) {
      throw new Error('Offer search result persistence failed');
    }
  }

  return queryId;
}

async function upsertJobOffers(
  db: LocalDatabaseClient,
  userId: string,
  offers: JobOffer[],
): Promise<JobOfferLookupRow[]> {
  if (offers.length === 0) {
    return [];
  }

  const source = offers[0]?.source;
  const sourceOfferIds = offers.map((offer) => offer.sourceOfferId);
  const { error } = await db
    .from('job_offers')
    .upsert(
      offers.map((offer) => ({
        source: offer.source,
        source_offer_id: offer.sourceOfferId,
        created_by: userId,
        offer_id: offer.offerId,
        title: offer.title,
        description: offer.description,
        company_name: offer.company?.name ?? null,
        location: offer.location,
        normalized_offer: offer,
        published_at: toIsoOrNull(offer.publishedAt),
        application_url: offer.applicationUrl ?? null,
      })),
      { onConflict: 'source,source_offer_id', ignoreDuplicates: true },
    );

  if (error) {
    throw new Error('Job offer persistence failed');
  }

  const { data, error: selectError } = await db
    .from('job_offers')
    .select('id, source, source_offer_id')
    .eq('source', source)
    .in('source_offer_id', sourceOfferIds);

  if (selectError) {
    throw new Error('Job offer lookup failed');
  }

  return (data ?? []) as JobOfferLookupRow[];
}

function readNestedOffer(row: unknown): JobOffer | null {
  const nested = (row as { job_offers?: { normalized_offer?: unknown } | Array<{ normalized_offer?: unknown }> })
    .job_offers;
  const offerRow = Array.isArray(nested) ? nested[0] : nested;

  return offerRow?.normalized_offer ? (offerRow.normalized_offer as JobOffer) : null;
}

function toIsoOrNull(value?: string): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

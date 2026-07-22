import { requireAuthenticatedUser } from '@/lib/auth';
import type { OfferSource } from '@/lib/offers/cache';
import { searchOffersWithCache } from '@/lib/offers/cache';
import { hasOfferSearchContext, loadOfferSearchContext } from '@/lib/offers/search-context';
import { createServerDbClient } from '@/lib/db/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OFFER_SOURCES = new Set<OfferSource>(['france_travail', 'adzuna']);

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const source = new URL(request.url).searchParams.get('source');
  const db = await createServerDbClient();
  let query = db
    .from('job_search_queries')
    .select('id, source, query_hash, query_payload, warnings, result_count, cache_status, fetched_at, expires_at')
    .eq('user_id', auth.user.id)
    .order('fetched_at', { ascending: false })
    .limit(20);

  if (source) {
    if (!isOfferSource(source)) {
      return Response.json({ error: 'Source d offres invalide.' }, { status: 400 });
    }

    query = query.eq('source', source);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json(
      { error: "Impossible de lire l'historique des recherches." },
      { status: 500 },
    );
  }

  return Response.json({
    queries: (data ?? []).map((row) => ({
      id: row.id,
      source: row.source,
      queryHash: row.query_hash,
      query: row.query_payload,
      warnings: row.warnings,
      resultCount: row.result_count,
      cacheStatus: row.cache_status,
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const payload = await readPayload(request);
  const source = typeof payload.source === 'string' ? payload.source : '';

  if (!isOfferSource(source)) {
    return Response.json({ error: 'Source d offres invalide.' }, { status: 400 });
  }

  const db = await createServerDbClient();
  const context = await loadOfferSearchContext(db, auth.user.id);

  if (!hasOfferSearchContext(context)) {
    return Response.json(
      { error: 'Configurez votre profil avant de rechercher des offres.' },
      { status: 400 },
    );
  }

  try {
    const result = await searchOffersWithCache({
      db,
      userId: auth.user.id,
      source,
      requirements: context.requirements,
      profile: context.profile,
      refresh: Boolean(payload.refresh),
      limit: 20,
    });

    return Response.json({
      source,
      offers: result.offers,
      warnings: result.warnings,
      query: result.upstreamQuery,
      cache: result.cache,
    });
  } catch {
    return Response.json(
      { error: 'Impossible de mettre a jour le cache des offres.' },
      { status: 502 },
    );
  }
}

function isOfferSource(value: string): value is OfferSource {
  return OFFER_SOURCES.has(value as OfferSource);
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

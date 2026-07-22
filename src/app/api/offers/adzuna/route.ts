import { requireAuthenticatedUser } from '@/lib/auth';
import { searchOffersWithCache } from '@/lib/offers/cache';
import { hasOfferSearchContext, loadOfferSearchContext } from '@/lib/offers/search-context';
import { createServerDbClient } from '@/lib/db/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
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
      source: 'adzuna',
      requirements: context.requirements,
      profile: context.profile,
      refresh: new URL(request.url).searchParams.get('refresh') === 'true',
    });

    return Response.json({
      source: 'adzuna',
      offers: result.offers,
      warnings: result.warnings,
      query: result.upstreamQuery,
      cache: result.cache,
    });
  } catch {
    return Response.json(
      { error: 'Impossible de récupérer les offres Adzuna.' },
      { status: 502 },
    );
  }
}

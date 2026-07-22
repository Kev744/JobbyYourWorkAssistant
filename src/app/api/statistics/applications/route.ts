import { requireAuthenticatedUser } from '@/lib/auth';
import {
  APPLICATION_STATISTICS_SELECT,
  buildApplicationStatistics,
} from '@/lib/statistics/applications';
import { createServerDbClient } from '@/lib/db/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const db = await createServerDbClient();
  const { data, error } = await db
    .from('applications')
    .select(APPLICATION_STATISTICS_SELECT)
    .eq('user_id', auth.user.id)
    .in('current_status', ['accepted', 'refused']);

  if (error) {
    return Response.json({ error: 'Impossible de charger les statistiques.' }, { status: 500 });
  }

  return Response.json({
    statistics: buildApplicationStatistics(data ?? []),
  });
}

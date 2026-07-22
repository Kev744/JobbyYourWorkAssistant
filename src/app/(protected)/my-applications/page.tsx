import { ApplicationsWorkspace } from '@/components/applications-workspace';
import {
  APPLICATION_SELECT,
  APPLICATION_STATUS_EVENT_SELECT,
  mapApplicationRow,
  mapApplicationStatusEventRow,
} from '@/lib/applications/applications';
import {
  APPLICATION_STATISTICS_SELECT,
  buildApplicationStatistics,
} from '@/lib/statistics/applications';
import { getAuthenticatedUser } from '@/lib/auth';
import { createServerDbClient } from '@/lib/db/server';
import { redirect } from 'next/navigation';

export default async function MyApplicationsPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/sign-in');
  }

  const [{ applications, error }, statistics] = await Promise.all([
    loadApplications(user.id),
    loadStatistics(user.id),
  ]);

  return (
    <main className="w-full">
      <h1 className="text-2xl font-semibold text-slate-950">Mes candidatures</h1>
      <p className="mt-3 text-sm text-slate-600">
        Suivez les CV générés, les liens d&apos;offre et l&apos;évolution de chaque candidature.
      </p>
      <div className="mt-6">
        <ApplicationsWorkspace
          initialApplications={applications}
          initialStatistics={statistics}
          initialError={error}
        />
      </div>
    </main>
  );
}

async function loadApplications(userId: string) {
  const db = await createServerDbClient();
  const { data: applicationRows, error } = await db
    .from('applications')
    .select(APPLICATION_SELECT)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    return {
      applications: [],
      error: 'Impossible de charger les candidatures.',
    };
  }

  const applicationIds = (applicationRows ?? []).map((row) => row.id);
  const statusHistory = await loadStatusHistory(applicationIds);

  return {
    applications: (applicationRows ?? []).map((row) =>
      mapApplicationRow(row, statusHistory.get(row.id) ?? []),
    ),
    error: null,
  };
}

async function loadStatistics(userId: string) {
  const db = await createServerDbClient();
  const { data } = await db
    .from('applications')
    .select(APPLICATION_STATISTICS_SELECT)
    .eq('user_id', userId)
    .in('current_status', ['accepted', 'refused']);

  return buildApplicationStatistics(data ?? []);
}

async function loadStatusHistory(applicationIds: string[]) {
  if (applicationIds.length === 0) {
    return new Map<string, ReturnType<typeof mapApplicationStatusEventRow>[]>();
  }

  const db = await createServerDbClient();
  const { data } = await db
    .from('application_status_events')
    .select(APPLICATION_STATUS_EVENT_SELECT)
    .in('application_id', applicationIds)
    .order('created_at', { ascending: false });
  const map = new Map<string, ReturnType<typeof mapApplicationStatusEventRow>[]>();

  for (const row of data ?? []) {
    const event = mapApplicationStatusEventRow(row);
    const events = map.get(event.applicationId) ?? [];
    events.push(event);
    map.set(event.applicationId, events);
  }

  return map;
}

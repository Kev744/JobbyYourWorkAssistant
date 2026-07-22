'use client';

import { useMemo, useState } from 'react';

import type {
  ApplicationRecord,
  ApplicationStatistics,
  ApplicationStatus,
  ApplicationStatusStatistics,
} from '@/types';

interface ApplicationsResponse {
  applications?: ApplicationRecord[];
  error?: string;
}

interface ApplicationResponse {
  application?: ApplicationRecord;
  deleted?: boolean;
  error?: string;
}

interface StatisticsResponse {
  statistics?: ApplicationStatistics;
  error?: string;
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  accepted: 'Acceptée',
  pending: 'En attente',
  refused: 'Refusée',
};

const STATUS_OPTIONS: ApplicationStatus[] = ['pending', 'accepted', 'refused'];

export function ApplicationsWorkspace({
  initialApplications,
  initialStatistics,
  initialError = null,
}: {
  initialApplications: ApplicationRecord[];
  initialStatistics: ApplicationStatistics;
  initialError?: string | null;
}) {
  const [applications, setApplications] = useState<ApplicationRecord[]>(initialApplications);
  const [statistics, setStatistics] = useState<ApplicationStatistics>(initialStatistics);
  const [error, setError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStatistics, setIsLoadingStatistics] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const counts = useMemo(
    () =>
      applications.reduce<Record<ApplicationStatus, number>>(
        (accumulator, application) => ({
          ...accumulator,
          [application.currentStatus]: accumulator[application.currentStatus] + 1,
        }),
        { accepted: 0, pending: 0, refused: 0 },
      ),
    [applications],
  );
  const manualApplications = useMemo(
    () => applications.filter((application) => application.currentStatus === 'pending'),
    [applications],
  );

  async function loadApplications() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/applications');
      const payload = (await response.json()) as ApplicationsResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Impossible de charger les candidatures.');
      }

      setApplications(payload.applications ?? []);
      await loadStatistics();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les candidatures.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStatistics() {
    setIsLoadingStatistics(true);

    try {
      const response = await fetch('/api/statistics/applications');
      const payload = (await response.json()) as StatisticsResponse;

      if (!response.ok || !payload.statistics) {
        throw new Error(payload.error ?? 'Impossible de charger les statistiques.');
      }

      setStatistics(payload.statistics);
    } catch (statisticsError) {
      setError(
        statisticsError instanceof Error
          ? statisticsError.message
          : 'Impossible de charger les statistiques.',
      );
    } finally {
      setIsLoadingStatistics(false);
    }
  }

  async function updateStatus(application: ApplicationRecord, status: ApplicationStatus) {
    if (status === application.currentStatus) {
      return;
    }

    setUpdatingId(application.id);
    setError(null);

    try {
      const response = await fetch(`/api/applications/${application.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          note: 'Statut modifié depuis le tableau de suivi.',
        }),
      });
      const payload = (await response.json()) as ApplicationResponse;

      if (!response.ok || !payload.application) {
        throw new Error(payload.error ?? 'Impossible de mettre à jour la candidature.');
      }

      setApplications((current) =>
        current.map((item) => (item.id === payload.application?.id ? payload.application : item)),
      );
      await loadStatistics();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Impossible de mettre à jour la candidature.',
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteApplication(application: ApplicationRecord) {
    if (!window.confirm('Supprimer cette candidature ?')) {
      return;
    }

    setDeletingId(application.id);
    setError(null);

    try {
      const response = await fetch(`/api/applications/${application.id}`, {
        method: 'DELETE',
      });
      const payload = (await response.json()) as ApplicationResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Impossible de supprimer la candidature.');
      }

      setApplications((current) => current.filter((item) => item.id !== application.id));
      await loadStatistics();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Impossible de supprimer la candidature.',
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {STATUS_OPTIONS.map((status) => (
          <div key={status} className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-600">{STATUS_LABELS[status]}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{counts[status]}</p>
          </div>
        ))}
      </div>

      <StatisticsPanel
        statistics={statistics}
        isLoading={isLoadingStatistics}
        onRefresh={() => void loadStatistics()}
      />

      <div>
        <button
          type="button"
          onClick={() => void loadApplications()}
          disabled={isLoading}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {isLoading ? 'Actualisation...' : 'Actualiser'}
        </button>
      </div>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      {isLoading ? (
        <p className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Chargement des candidatures...
        </p>
      ) : null}

      {!isLoading && applications.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Aucune candidature suivie pour le moment.
        </p>
      ) : null}

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Résultats d&apos;auto-candidature</h2>
          <p className="mt-1 text-sm text-slate-600">
            Candidatures suivies après génération ou préparation depuis les offres.
          </p>
        </div>
        {applications.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            isUpdating={updatingId === application.id}
            isDeleting={deletingId === application.id}
            onStatusChange={(status) => void updateStatus(application, status)}
            onDelete={() => void deleteApplication(application)}
          />
        ))}
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Candidatures à finaliser manuellement</h2>
          <p className="mt-1 text-sm text-slate-600">
            Éléments en attente de revue, de saisie manuelle ou de confirmation finale.
          </p>
        </div>
        {manualApplications.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Aucune candidature manuelle en attente.
          </p>
        ) : (
          manualApplications.map((application) => (
            <ApplicationCard
              key={`manual-${application.id}`}
              application={application}
              isUpdating={updatingId === application.id}
              isDeleting={deletingId === application.id}
              onStatusChange={(status) => void updateStatus(application, status)}
              onDelete={() => void deleteApplication(application)}
            />
          ))
        )}
      </section>
    </section>
  );
}

function StatisticsPanel({
  statistics,
  isLoading,
  onRefresh,
}: {
  statistics: ApplicationStatistics;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Statistiques</h2>
          <p className="mt-1 text-sm text-slate-600">
            Compétences les plus présentes dans vos candidatures acceptées et refusées.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {isLoading ? 'Calcul...' : 'Recalculer'}
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SkillStatistics title="Candidatures acceptées" data={statistics.accepted} />
        <SkillStatistics title="Candidatures refusées" data={statistics.refused} />
      </div>
      <p className="mt-4 text-xs text-slate-500">Dernier calcul : {formatDate(statistics.generatedAt)}</p>
    </section>
  );
}

function SkillStatistics({
  title,
  data,
}: {
  title: string;
  data: ApplicationStatusStatistics;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{data.totalApplications} candidature(s)</p>
      {data.topSkills.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-slate-600">{data.emptyState}</p>
      ) : (
        <ol className="mt-3 grid gap-2 text-sm text-slate-700">
          {data.topSkills.map((skill) => (
            <li key={skill.skill} className="flex items-center justify-between gap-3">
              <span>{skill.skill}</span>
              <span className="text-slate-500">
                {skill.count} · {skill.percentage} %
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ApplicationCard({
  application,
  isUpdating,
  isDeleting,
  onStatusChange,
  onDelete,
}: {
  application: ApplicationRecord;
  isUpdating: boolean;
  isDeleting: boolean;
  onStatusChange: (status: ApplicationStatus) => void;
  onDelete: () => void;
}) {
  const offer = application.offerSnapshot;

  return (
    <article className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{offer.title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {[offer.company?.name, offer.location.city, offer.contract?.type].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {offer.source === 'france_travail'
            ? 'France Travail'
            : offer.source === 'adzuna'
              ? 'Adzuna'
              : 'Offre web importée'}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Statut
          <select
            value={application.currentStatus}
            onChange={(event) => onStatusChange(event.target.value as ApplicationStatus)}
            disabled={isUpdating || isDeleting}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        {application.applicationUrl ? (
          <a
            href={application.applicationUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800"
          >
            Ouvrir l&apos;offre
          </a>
        ) : null}

        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-800 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {isDeleting ? 'Suppression...' : 'Supprimer'}
        </button>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <p>
          CV généré : {application.generatedResumePdfPath ? 'PDF enregistré' : 'PDF non disponible'}
          {application.generatedResumeDocxPath ? ' · DOCX enregistré' : ''}
        </p>
        <p>Créée le {formatDate(application.createdAt)}</p>
      </div>

      {application.statusHistory.length > 0 ? (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-950">Historique</h3>
          <ol className="mt-2 grid gap-2 text-sm text-slate-700">
            {application.statusHistory.map((event) => (
              <li key={event.id}>
                {STATUS_LABELS[event.toStatus]} le {formatDate(event.createdAt)}
                {event.note ? ` · ${event.note}` : ''}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </article>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

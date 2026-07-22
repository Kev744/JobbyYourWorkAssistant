import type { ApplicationStatistics, ApplicationStatus, JobOffer } from '@/types';

export const APPLICATION_STATISTICS_SELECT = 'id, current_status, offer_snapshot';

export interface ApplicationStatisticsRow {
  id: string;
  current_status: string;
  offer_snapshot: unknown;
}

const EMPTY_ACCEPTED =
  'Données insuffisantes pour résumer les compétences des candidatures acceptées.';
const EMPTY_REFUSED =
  'Données insuffisantes pour résumer les compétences des candidatures refusées.';

export function buildApplicationStatistics(
  rows: ApplicationStatisticsRow[],
  generatedAt = new Date().toISOString(),
): ApplicationStatistics {
  return {
    accepted: buildStatusStatistics(rows, 'accepted', EMPTY_ACCEPTED),
    refused: buildStatusStatistics(rows, 'refused', EMPTY_REFUSED),
    generatedAt,
  };
}

function buildStatusStatistics(
  rows: ApplicationStatisticsRow[],
  status: Extract<ApplicationStatus, 'accepted' | 'refused'>,
  emptyState: string,
) {
  const applications = rows.filter((row) => row.current_status === status);
  const counts = new Map<string, { skill: string; count: number; order: number }>();
  let order = 0;

  for (const application of applications) {
    const offer = asOffer(application.offer_snapshot);
    const uniqueSkills = new Map<string, string>();

    for (const skill of offer?.skills ?? []) {
      const label = skill.raw.trim();

      if (!label) {
        continue;
      }

      const normalized = normalizeSkill(label);

      if (!uniqueSkills.has(normalized)) {
        uniqueSkills.set(normalized, label);
      }
    }

    for (const [key, label] of uniqueSkills) {
      const current = counts.get(key);
      counts.set(key, {
        skill: current?.skill ?? label,
        count: (current?.count ?? 0) + 1,
        order: current?.order ?? order,
      });

      if (!current) {
        order += 1;
      }
    }
  }

  const totalApplications = applications.length;
  const topSkills = [...counts.values()]
    .sort(
      (left, right) =>
        right.count - left.count || left.order - right.order || left.skill.localeCompare(right.skill, 'fr'),
    )
    .slice(0, 3)
    .map((item) => ({
      skill: item.skill,
      count: item.count,
      percentage: totalApplications === 0 ? 0 : Math.round((item.count / totalApplications) * 100),
    }));

  return {
    totalApplications,
    topSkills,
    emptyState,
  };
}

function asOffer(value: unknown): JobOffer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as JobOffer;
}

function normalizeSkill(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/\s+/g, ' ')
    .trim();
}

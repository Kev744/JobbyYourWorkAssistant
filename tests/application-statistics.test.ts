import { buildApplicationStatistics } from '@/lib/statistics/applications';
import type { JobOffer } from '@/types';

const baseOffer: JobOffer = {
  offerId: 'france_travail:1',
  source: 'france_travail',
  sourceOfferId: '1',
  title: 'Développeur TypeScript',
  description: 'TypeScript React PostgreSQL',
  location: { city: 'Paris' },
  jobTarget: { rawTitle: 'Développeur TypeScript' },
  skills: [],
};

describe('buildApplicationStatistics', () => {
  it('returns top 3 accepted and refused skills with application percentages', () => {
    const statistics = buildApplicationStatistics(
      [
        row('accepted', skills('TypeScript', 'React', 'PostgreSQL')),
        row('accepted', skills('typescript', 'React')),
        row('accepted', skills('Node.js')),
        row('refused', skills('Java', 'Spring')),
        row('refused', skills('Java', 'SQL')),
      ],
      '2026-05-05T10:00:00.000Z',
    );

    expect(statistics.generatedAt).toBe('2026-05-05T10:00:00.000Z');
    expect(statistics.accepted.totalApplications).toBe(3);
    expect(statistics.accepted.topSkills).toEqual([
      { skill: 'TypeScript', count: 2, percentage: 67 },
      { skill: 'React', count: 2, percentage: 67 },
      { skill: 'PostgreSQL', count: 1, percentage: 33 },
    ]);
    expect(statistics.refused.totalApplications).toBe(2);
    expect(statistics.refused.topSkills).toEqual([
      { skill: 'Java', count: 2, percentage: 100 },
      { skill: 'Spring', count: 1, percentage: 50 },
      { skill: 'SQL', count: 1, percentage: 50 },
    ]);
  });

  it('deduplicates repeated skills within a single application', () => {
    const statistics = buildApplicationStatistics([
      row('accepted', skills('React', 'React', 'react')),
      row('accepted', skills('React')),
    ]);

    expect(statistics.accepted.topSkills).toEqual([
      { skill: 'React', count: 2, percentage: 100 },
    ]);
  });

  it('returns French empty states when there is insufficient data', () => {
    const statistics = buildApplicationStatistics([]);

    expect(statistics.accepted.topSkills).toEqual([]);
    expect(statistics.accepted.emptyState).toBe(
      'Données insuffisantes pour résumer les compétences des candidatures acceptées.',
    );
    expect(statistics.refused.topSkills).toEqual([]);
    expect(statistics.refused.emptyState).toBe(
      'Données insuffisantes pour résumer les compétences des candidatures refusées.',
    );
  });
});

function row(currentStatus: string, offerSnapshot: JobOffer) {
  return {
    id: crypto.randomUUID(),
    current_status: currentStatus,
    offer_snapshot: offerSnapshot,
  };
}

function skills(...values: string[]): JobOffer {
  return {
    ...baseOffer,
    skills: values.map((raw) => ({ raw })),
  };
}

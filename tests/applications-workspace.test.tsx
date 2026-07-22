import { renderToStaticMarkup } from 'react-dom/server';

import { ApplicationsWorkspace } from '@/components/applications-workspace';
import type { ApplicationStatistics } from '@/types';

describe('ApplicationsWorkspace', () => {
  it('renders auto-apply results and manual follow-up sections', () => {
    const html = renderToStaticMarkup(
      <ApplicationsWorkspace initialApplications={[]} initialStatistics={statistics} />,
    );

    expect(html).toContain("Résultats d&#x27;auto-candidature");
    expect(html).toContain('Candidatures à finaliser manuellement');
  });
});

const statistics: ApplicationStatistics = {
  accepted: {
    totalApplications: 0,
    topSkills: [],
    emptyState: 'Aucune donnée.',
  },
  refused: {
    totalApplications: 0,
    topSkills: [],
    emptyState: 'Aucune donnée.',
  },
  generatedAt: '2026-06-18T00:00:00.000Z',
};

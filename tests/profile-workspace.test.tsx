import { renderToStaticMarkup } from 'react-dom/server';

import { ProfileWorkspace } from '@/components/profile-form';
import type { CandidateProfile } from '@/types';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const baseProfile: CandidateProfile = {
  id: 'profile-1',
  resumeVersionId: 'version-1',
  summary: 'Developpeur full-stack.',
  profession: 'Developpeur TypeScript',
  education: [],
  professionalExperiences: [],
  hobbies: [],
  certifications: [],
  skills: [],
  languages: [],
  achievements: [],
  identityContact: {
    fullName: 'Kevin Esteves',
  },
  scoringPayload: {
    candidateId: 'version-1',
    headline: 'Developpeur TypeScript',
    location: { city: 'Paris' },
    titles: [{ raw: 'Developpeur TypeScript', canonicalRomeCode: 'M1805' }],
    experiences: [],
    skills: [],
    education: [],
  },
  romeCode: 'M1805',
  romePredictionScore: 0.9,
  generationWarnings: [],
  confirmationStatus: 'draft',
  createdAt: '2026-05-20T08:00:00Z',
  updatedAt: '2026-05-20T08:00:00Z',
};

describe('ProfileWorkspace', () => {
  it('does not reuse the same React key for profile and requirements siblings', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    renderToStaticMarkup(
      <ProfileWorkspace
        initialProfiles={[baseProfile]}
        initialRequirements={null}
        cities={[]}
        departments={[]}
        regions={[]}
      />,
    );

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Encountered two children with the same key'),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });

  it('renders a selector for multiple generated profiles by name and profession', () => {
    const html = renderToStaticMarkup(
      <ProfileWorkspace
        initialProfiles={[
          baseProfile,
          {
            ...baseProfile,
            id: 'profile-2',
            profession: 'Product Owner',
            identityContact: { fullName: 'Camille Martin' },
            updatedAt: '2026-05-21T08:00:00Z',
          },
        ]}
        initialRequirements={null}
        cities={[]}
        departments={[]}
        regions={[]}
      />,
    );

    expect(html).toContain('Profil actif');
    expect(html).toContain('Kevin Esteves');
    expect(html).toContain('Developpeur TypeScript');
    expect(html).toContain('Camille Martin');
    expect(html).toContain('Product Owner');
  });
});

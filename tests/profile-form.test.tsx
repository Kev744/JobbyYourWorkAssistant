import { renderToStaticMarkup } from 'react-dom/server';

import { ProfileForm } from '@/components/profile-form';
import type { CandidateProfile } from '@/types';

const profile: CandidateProfile = {
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
    email: 'kevin.esteves@example.test',
    phone: '06 12 34 56 78',
    additionalInformation: 'https://www.linkedin.com/in/kevin-esteves',
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
  createdAt: '',
  updatedAt: '',
};

describe('ProfileForm', () => {
  it('shows extracted contact information on the profile page', () => {
    const html = renderToStaticMarkup(<ProfileForm initialProfile={profile} />);

    expect(html).toContain('Coordonn');
    expect(html).toContain('Nom complet');
    expect(html).toContain('Kevin Esteves');
    expect(html).toContain('Email');
    expect(html).toContain('kevin.esteves@example.test');
    expect(html).toContain('T');
    expect(html).toContain('06 12 34 56 78');
    expect(html).toContain('Informations complémentaires (facultatif)');
    expect(html).toContain('https://www.linkedin.com/in/kevin-esteves');
    expect(html).toContain('Ville');
    expect(html).toContain('Paris');
  });

  it('renders optional project dates from the saved project period', () => {
    const html = renderToStaticMarkup(
      <ProfileForm
        initialProfile={{
          ...profile,
          achievements: [
            'Portfolio MatchingCV — Interface de recherche d’emploi — Période : début : 02/2024; fin : 2024',
          ],
        }}
      />,
    );

    expect(html).toContain('Début (facultatif)');
    expect(html).toContain('Fin (facultatif)');
    expect(html).toContain('value="2024-02"');
    expect(html).toContain('value="2024"');
  });
});

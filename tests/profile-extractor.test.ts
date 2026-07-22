import { generateCandidateProfileDraft } from '@/lib/profile/profile-extractor';

describe('generateCandidateProfileDraft', () => {
  it('extracts only explicit corpus sections into a draft profile', () => {
    const draft = generateCandidateProfileDraft({
      resumeVersionId: 'version-1',
      title: 'Developpeur TypeScript',
      romeCode: 'M1805',
      romePredictionScore: 0.82,
      corpusContent: `
Profil
Developpeur full-stack oriente produit.

Competences
TypeScript, Next.js, PostgreSQL

Formation
Master informatique

Langues
Francais C2
Anglais B2
`,
    });

    expect(draft.profession).toBe('Developpeur TypeScript');
    expect(draft.summary).toBe('Developpeur full-stack oriente produit.');
    expect(draft.skills.map((skill) => skill.raw)).toEqual([
      'TypeScript',
      'Next.js',
      'PostgreSQL',
    ]);
    expect(draft.education).toEqual([{ degreeLabel: 'Master informatique' }]);
    expect(draft.languages).toEqual([
      { code: expect.stringMatching(/^Fran/), cecrl: 'C2' },
      { code: 'Anglais', cecrl: 'B2' },
    ]);
    expect(draft.scoringPayload.identity).toBeUndefined();
    expect(draft.scoringPayload.titles[0]?.canonicalRomeCode).toBe('M1805');
  });

  it('adds warnings when sections are unsupported by the corpus', () => {
    const draft = generateCandidateProfileDraft({
      resumeVersionId: 'version-1',
      title: 'Version editee',
      romeCode: 'Inconnu',
      romePredictionScore: 0,
      corpusContent: 'Profil\nCandidate motivee.',
    });

    expect(draft.skills).toEqual([]);
    expect(draft.education).toEqual([]);
    expect(
      draft.generationWarnings.some(
        (warning) =>
          warning.includes('laiss') &&
          warning.includes('vides') &&
          warning.includes('liste explicite'),
      ),
    ).toBe(true);
    expect(draft.scoringPayload.titles[0]?.canonicalRomeCode).toBeUndefined();
  });

  it('recognizes profession and language heading variants from extracted sections', () => {
    const draft = generateCandidateProfileDraft({
      resumeVersionId: 'version-1',
      title: 'Version editee',
      romeCode: 'M1805',
      romePredictionScore: 0.82,
      corpusContent: `
Objectif professionnel
Developpeur full-stack TypeScript

Competences linguistiques
Francais C2
Anglais B2
`,
    });

    expect(draft.profession).toBe('Developpeur full-stack TypeScript');
    expect(draft.languages).toEqual([
      { code: expect.stringMatching(/^Fran/), cecrl: 'C2' },
      { code: 'Anglais', cecrl: 'B2' },
    ]);
  });

  it('normalizes non-CEFR language levels from profile sections', () => {
    const draft = generateCandidateProfileDraft({
      resumeVersionId: 'version-1',
      title: 'Version editee',
      romeCode: 'M1805',
      romePredictionScore: 0.82,
      corpusContent: `
Langues
Italien debutant
Espagnol avance
Francais langue maternelle
Allemand intermediaire
Anglais courant
`,
    });

    expect(draft.languages).toEqual([
      { code: expect.stringMatching(/^Fran/), cecrl: 'langue maternelle' },
      { code: 'Anglais', cecrl: 'C1' },
      { code: 'Espagnol', cecrl: 'B2' },
      { code: 'Allemand', cecrl: 'B1' },
      { code: 'Italien', cecrl: 'A1' },
    ]);
  });

  it('uses verified OpenAI structured items before parsing section text', () => {
    const draft = generateCandidateProfileDraft({
      resumeVersionId: 'version-1',
      title: 'Version editee',
      romeCode: 'M1805',
      romePredictionScore: 0.82,
      corpusContent: 'Contenu source',
      extractedSections: {
        profile: 'Developpeur full-stack oriente produit.',
        profession: 'Developpeur TypeScript',
        education: 'Master informatique\nUniversite Paris Cite\n2022',
        educationItems: [
          {
            degreeLabel: 'Master informatique',
            schoolName: 'Universite Paris Cite',
            graduationDate: '2022',
            sourceText: 'Master informatique\nUniversite Paris Cite\n2022',
          },
        ],
        professionalExperiences: 'Developpeur full-stack\nAcme\n2021 - 2024',
        professionalExperienceItems: [
          {
            titleRaw: 'Developpeur full-stack',
            companyName: 'Acme',
            location: 'Paris',
            summary: 'Missions : developpement Next.js',
            startDate: '01/2021',
            endDate: '12/2024',
            sourceText: 'Developpeur full-stack\nAcme\n2021 - 2024',
          },
        ],
        skills: 'TypeScript\nNext.js',
        languages: 'Francais C2',
        certifications: '',
        hobbies: '',
        warnings: ['Formation verifiee.'],
      },
    });

    expect(draft.education).toEqual([
      {
        degreeLabel: 'Master informatique',
        schoolName: 'Universite Paris Cite',
        graduationDate: '2022',
      },
    ]);
    expect(draft.professionalExperiences).toEqual([
      {
        titleRaw: 'Developpeur full-stack',
        companyName: 'Acme',
        location: 'Paris',
        summary: 'Missions : developpement Next.js',
        startDate: '01/2021',
        endDate: '12/2024',
      },
    ]);
    expect(draft.generationWarnings).toContain('Formation verifiee.');
  });

  it('extracts confidential contact information from the original corpus instead of rich text headings', () => {
    const draft = generateCandidateProfileDraft({
      resumeVersionId: 'version-1',
      title: 'Version editee',
      romeCode: 'M1805',
      romePredictionScore: 0.82,
      corpusContent: `
Profile
Developpeur full-stack oriente produit.

Profession
Developpeur TypeScript
`,
      identityCorpusContent: `
Kevin Esteves
kevin.esteves@example.test
06 12 34 56 78
Ville : Paris
`,
    });

    expect(draft.identityContact).toEqual({
      fullName: 'Kevin Esteves',
      email: 'kevin.esteves@example.test',
      phone: '06 12 34 56 78',
    });
    expect(draft.identityContact.fullName).not.toBe('Profile');
    expect(draft.scoringPayload.location?.city).toBe('Paris');
  });

  it('uses contact information preserved on section extraction when profile text is already segmented', () => {
    const draft = generateCandidateProfileDraft({
      resumeVersionId: 'version-1',
      title: 'Version editee',
      romeCode: 'M1805',
      romePredictionScore: 0.82,
      corpusContent: `
Profile
Developpeur full-stack oriente produit.

Profession
Developpeur TypeScript
`,
      extractedSections: {
        profile: 'Developpeur full-stack oriente produit.',
        profession: 'Developpeur TypeScript',
        education: '',
        educationItems: [],
        professionalExperiences: '',
        professionalExperienceItems: [],
        skills: '',
        languages: '',
        certifications: '',
        hobbies: '',
        warnings: [],
        identityContact: {
          fullName: 'Kévin ESTEVES',
          email: 'kevin.esteves@example.test',
          phone: '06 12 34 56 78',
          city: 'Paris',
          postalCode: '75000',
        },
      },
    });

    expect(draft.identityContact).toEqual({
      fullName: 'Kévin ESTEVES',
      email: 'kevin.esteves@example.test',
      phone: '06 12 34 56 78',
    });
    expect(draft.scoringPayload.location).toEqual({
      city: 'Paris',
      postalCode: '75000',
    });
  });
});

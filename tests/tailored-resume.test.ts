import {
  generateTailoredResumeDraft,
  generateTailoredResumeDraftWithOpenAI,
} from '@/lib/generate/tailored-resume';
import type { CandidateProfile, JobOffer, ResumeVersionRecord } from '@/types';

const profile: CandidateProfile = {
  id: 'profile-1',
  resumeVersionId: 'version-1',
  summary: 'Développeur full-stack orienté produit.',
  profession: 'Développeur TypeScript',
  education: [{ degreeLabel: 'Master informatique', rncpLevel: 7 }],
  professionalExperiences: [
    {
      titleRaw: 'Développeur full-stack',
      summary: 'Applications React et API Node.js.',
      skills: [{ raw: 'React' }, { raw: 'Node.js' }],
    },
    {
      titleRaw: 'Support informatique',
      summary: 'Gestion de tickets et assistance utilisateurs.',
      skills: [{ raw: 'Support' }],
    },
  ],
  hobbies: [],
  certifications: [{ label: 'AWS Cloud Practitioner' }],
  skills: [{ raw: 'TypeScript' }, { raw: 'React' }, { raw: 'PostgreSQL' }],
  languages: [{ code: 'en', cecrl: 'B2' }],
  achievements: [],
  identityContact: {
    fullName: 'Camille Martin',
    email: 'camille@example.test',
    additionalInformation: 'https://github.com/camille-martin\nhttps://camille-martin.dev',
  },
  scoringPayload: {
    candidateId: 'version-1',
    headline: 'Développeur TypeScript',
    titles: [{ raw: 'Développeur TypeScript', canonicalRomeCode: 'M1805' }],
    experiences: [],
    skills: [{ raw: 'TypeScript' }, { raw: 'React' }],
    education: [],
  },
  romeCode: 'M1805',
  romePredictionScore: 0.9,
  generationWarnings: [],
  confirmationStatus: 'confirmed',
  createdAt: '',
  updatedAt: '',
};

const offer: JobOffer = {
  offerId: 'france_travail:123',
  source: 'france_travail',
  sourceOfferId: '123',
  title: 'Développeur React TypeScript',
  description: 'React TypeScript Node.js',
  location: { city: 'Paris' },
  jobTarget: { rawTitle: 'Développeur React TypeScript', canonicalRomeCode: 'M1805' },
  skills: [
    { raw: 'TypeScript', importance: 'must' },
    { raw: 'React', importance: 'must' },
  ],
};

const resumeVersion: ResumeVersionRecord = {
  id: 'version-1',
  resumeFileId: 'file-1',
  versionNumber: 1,
  title: 'CV source confirmé',
  corpusContent: 'Profil\nDéveloppeur full-stack orienté produit.',
  createdAt: '',
  updatedAt: '',
};

describe('generateTailoredResumeDraft', () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_KEY;
  const originalOpenAiModel = process.env.OPENAI_MODEL;
  const originalOpenAiGenerateModel = process.env.OPENAI_GENERATE_MODEL;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_KEY = originalOpenAiKey;
    process.env.OPENAI_MODEL = originalOpenAiModel;
    process.env.OPENAI_GENERATE_MODEL = originalOpenAiGenerateModel;
  });

  it('builds a compact French CV with evidence for generated facts', () => {
    const draft = generateTailoredResumeDraft({ profile, offer, resumeVersion });

    expect(draft.title).toContain('Développeur React TypeScript');
    expect(draft.content).toContain('Camille Martin');
    expect(draft.content).toContain('TypeScript | React');
    expect(draft.content).not.toContain('Profile');
    expect(draft.content).not.toMatch(/^Profil$/m);
    expect(draft.content.split('\n').length).toBeLessThanOrEqual(46);
    expect(draft.evidenceMap.length).toBeGreaterThan(0);
    expect(draft.evidenceMap.every((evidence) => draft.content.includes(evidence.generatedText))).toBe(
      true,
    );
  });

  it('records unsupported user instructions as warnings without injecting new facts', () => {
    const draft = generateTailoredResumeDraft({
      profile,
      offer,
      resumeVersion,
      userInstructions: 'Ajoute 10 ans chez Space Corp.',
    });

    expect(draft.content).not.toContain('Space Corp');
    expect(draft.warnings).toContain(
      'Les consignes utilisateur ont été enregistrées, mais seules les informations confirmées ou sourcées ont été générées.',
    );
  });

  it('sorts resume languages by proficiency before rendering', () => {
    const draft = generateTailoredResumeDraft({
      profile: {
        ...profile,
        languages: [
          { code: 'it', cecrl: 'A1' },
          { code: 'en', cecrl: 'B2' },
          { code: 'fr', cecrl: 'langue maternelle' },
        ],
      },
      offer,
      resumeVersion,
    });

    expect(draft.content.indexOf('Fran')).toBeLessThan(draft.content.indexOf('Anglais'));
    expect(draft.content.indexOf('Anglais')).toBeLessThan(draft.content.indexOf('Italien'));
  });

  it('removes internal Profile labels from generated resume content', async () => {
    process.env.OPENAI_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  title: 'CV cible',
                  content:
                    '### Objectif professionnel\nProfessional Profile: internal label\n\n### Competences cles\nProfessional Profile: internal label\n- TypeScript\n\n### Experience professionnelle\n- Profile: internal label\n- Applications React et API Node.js.',
                  evidenceMap: [],
                  warnings: [],
                }),
              },
            ],
          },
        ],
      }),
    } as unknown as Response);

    const draft = await generateTailoredResumeDraftWithOpenAI({
      profile,
      offer,
      resumeVersion,
    });

    expect(draft.content).not.toContain('Profile');
  });

  it('renders at most three associations and interests from the confirmed profile', async () => {
    process.env.OPENAI_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  title: 'CV cible',
                  content:
                    '### Objectif professionnel\nContribution ciblée.\n\n### Compétences clés\n- TypeScript\n\n### Expérience professionnelle\n- Applications React et API Node.js.',
                  evidenceMap: [],
                  warnings: [],
                }),
              },
            ],
          },
        ],
      }),
    } as unknown as Response);

    const draft = await generateTailoredResumeDraftWithOpenAI({
      profile: {
        ...profile,
        hobbies: ['Bénévolat associatif', 'Course à pied', 'Veille technologique', 'Photographie'],
      },
      offer,
      resumeVersion,
    });

    expect(draft.content).toContain("### Associations et centres d'intérêt");
    expect(draft.content).toContain('- Bénévolat associatif');
    expect(draft.content).toContain('- Course à pied');
    expect(draft.content).toContain('- Veille technologique');
    expect(draft.content).not.toContain('- Photographie');
  });

  it('renders all profile languages sorted by strongest proficiency in the final resume', async () => {
    process.env.OPENAI_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  title: 'CV cible',
                  content:
                    '### Objectif professionnel\nContribution ciblée.\n\n### Compétences clés\n- TypeScript\n\n### Expérience professionnelle\n- Applications React et API Node.js.',
                  evidenceMap: [],
                  warnings: [],
                }),
              },
            ],
          },
        ],
      }),
    } as unknown as Response);

    const draft = await generateTailoredResumeDraftWithOpenAI({
      profile: {
        ...profile,
        languages: [
          { code: 'it', cecrl: 'A1' },
          { code: 'en', cecrl: 'B2' },
          { code: 'es', cecrl: 'C1' },
          { code: 'fr', cecrl: 'langue maternelle' },
        ],
      },
      offer,
      resumeVersion,
    });

    expect(draft.content).toContain('### Langues');
    expect(draft.content).toContain('- Français : langue maternelle');
    expect(draft.content).toContain('- Espagnol : C1');
    expect(draft.content).toContain('- Anglais : B2');
    expect(draft.content).toContain('- Italien : A1');
    expect(draft.content.indexOf('Français')).toBeLessThan(draft.content.indexOf('Espagnol'));
    expect(draft.content.indexOf('Espagnol')).toBeLessThan(draft.content.indexOf('Anglais'));
    expect(draft.content.indexOf('Anglais')).toBeLessThan(draft.content.indexOf('Italien'));
  });

  it('keeps the AI-written professional objective instead of replacing it with a local template', async () => {
    process.env.OPENAI_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  title: 'CV ciblé - Développeur React TypeScript',
                  content:
                    '### Objectif professionnel\nTransformer les besoins produit en interfaces React fiables et maintenables, en m’appuyant sur TypeScript et une pratique full-stack pour accélérer la livraison du poste ciblé.\n\n### Compétences clés\n- TypeScript\n- React\n\n### Expérience professionnelle\n- Développeur full-stack : Applications React et API Node.js.',
                  evidenceMap: [],
                  warnings: [],
                }),
              },
            ],
          },
        ],
      }),
    } as unknown as Response);

    const draft = await generateTailoredResumeDraftWithOpenAI({ profile, offer, resumeVersion });

    expect(draft.content).toContain(
      'Transformer les besoins produit en interfaces React fiables et maintenables',
    );
    expect(draft.content).not.toContain('souhaitant contribuer au poste');
    expect(draft.content).not.toContain('Objectif : répondre aux priorités du poste');
  });

  it('generates a tailored resume with OpenAI using the template and matching context', async () => {
    process.env.OPENAI_KEY = 'test-key';
    process.env.OPENAI_GENERATE_MODEL = 'gpt-5.4';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  title: 'CV ciblé - Développeur React TypeScript',
                  content:
                    '### Informations personnelles\nNom injecté\nfake@example.test\n\n### Poste\n<p align="center">**Titre injecté**</p>\n\n### Objectif professionnel\nDéveloppeur React TypeScript orienté produit, je souhaite transformer les besoins métier en interfaces fiables avec TypeScript, React et une expérience API Node.js.\n\n### Compétences Clés\n- TypeScript\n- React\n\n### Expérience professionnelle\n- Développeur full-stack : Applications React et API Node.js.\n\n### Langues\n- Klingon : C2\n\n### Certifications\n- Certification inventée',
                  evidenceMap: [
                    {
                      generatedText: 'Développeur React TypeScript',
                      sourceType: 'offer',
                      sourceField: 'title',
                      sourceId: offer.offerId,
                      confidence: 'supported',
                    },
                    {
                      generatedText: 'TypeScript',
                      sourceType: 'profile',
                      sourceField: 'skills',
                      sourceId: profile.id,
                      confidence: 'user_confirmed',
                    },
                  ],
                  warnings: [],
                }),
              },
            ],
          },
        ],
      }),
    } as unknown as Response);

    const draft = await generateTailoredResumeDraftWithOpenAI({
      profile,
      offer,
      resumeVersion,
      userInstructions: 'Reste concis.',
      openAiApiKey: 'sk-user-request-key',
    });
    const body = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body)) as {
      model: string;
      instructions?: string;
      input: Array<{ content: Array<{ text: string }> }>;
    };
    const headers = jest.mocked(global.fetch).mock.calls[0]?.[1]?.headers as Record<string, string>;
    const promptPayload = JSON.parse(body.input[0]?.content[0]?.text ?? '{}') as {
      aiSectionInstructions?: string;
      candidateProfile?: Record<string, unknown>;
      resumeVersion?: Record<string, unknown>;
      matchingContext?: {
        matchedSkills?: string[];
        missingOfferSkills?: string[];
        relevantExperiences?: Array<{ titleRaw: string }>;
      };
    };

    expect(body.model).toBe('gpt-5.4');
    expect(headers.Authorization).toBe('Bearer sk-user-request-key');
    expect(body.instructions).toContain('valid UTF-8 French');
    expect(body.instructions).not.toMatch(/[ÃÂ]|â€™|â€œ|â€/);
    expect(promptPayload.aiSectionInstructions).toContain('Objectif professionnel');
    expect(promptPayload.aiSectionInstructions).toContain('phrase professionnelle naturelle');
    expect(promptPayload.aiSectionInstructions).not.toMatch(/[ÃÂ]|â€™|â€œ|â€/);
    expect(promptPayload.aiSectionInstructions).toContain('Compétences clés');
    expect(promptPayload.aiSectionInstructions).toContain('Expérience professionnelle');
    expect(promptPayload.candidateProfile).not.toHaveProperty('identityContact');
    expect(promptPayload.candidateProfile).not.toHaveProperty('education');
    expect(promptPayload.candidateProfile).not.toHaveProperty('languages');
    expect(promptPayload.candidateProfile).not.toHaveProperty('certifications');
    expect(promptPayload.resumeVersion).not.toHaveProperty('corpusContent');
    expect(promptPayload.matchingContext?.matchedSkills).toEqual(['TypeScript', 'React']);
    expect(promptPayload.matchingContext?.missingOfferSkills).toEqual([]);
    expect(promptPayload.matchingContext?.relevantExperiences).toHaveLength(1);
    expect(promptPayload.matchingContext?.relevantExperiences?.[0]?.titleRaw).toBe(
      'Développeur full-stack',
    );
    expect(draft.content).toContain('**Camille Martin**');
    expect(draft.content).toContain('Email : camille@example.test');
    expect(draft.content).toContain('https://github.com/camille-martin');
    expect(draft.content).toContain('https://camille-martin.dev');
    expect(draft.content).toContain('- Master informatique (RNCP 7)');
    expect(draft.content).toContain('- Anglais : B2');
    expect(draft.content).toContain('- AWS Cloud Practitioner');
    expect(draft.content).not.toContain('Nom injecté');
    expect(draft.content).not.toContain('fake@example.test');
    expect(draft.content).not.toContain('### Poste');
    expect(draft.content).not.toMatch(/^Poste$/m);
    expect(draft.content).toContain('---');
    expect(draft.content).not.toContain('### Publications et projets');
    expect(draft.content).not.toContain('Klingon');
    expect(draft.content).not.toContain('Certification inventée');
    expect(draft.content).not.toContain('### Informations personnelles');
    expect(draft.content).not.toContain('### Profil');
    expect(draft.content).not.toMatch(/^Profil$/m);
    expect(draft.content).not.toContain('Profile');
    expect(draft.content).toContain('### Compétences clés');
    expect(draft.content).toContain('### Objectif professionnel');
    expect(draft.content).toContain('### Objectif professionnel\n---\n');
    expect(draft.content).not.toContain('---\n### Objectif professionnel');
    const objectiveBlock =
      draft.content.match(/### Objectif professionnel\n---\n([\s\S]*?)(?:\n###|$)/)?.[1] ??
      '';
    expect(objectiveBlock).toContain('D\u00e9veloppeur React TypeScript');
    expect(objectiveBlock).toContain('TypeScript');
    expect(objectiveBlock).toContain('React');
    expect(objectiveBlock).not.toMatch(/candidat au poste/i);
    expect(objectiveBlock).not.toMatch(/[ÃÂ]|â€™|â€œ|â€/);
    expect(draft.content).not.toMatch(/^#{1,2}\s/m);
    expect(draft.content.split('\n').length).toBeLessThanOrEqual(58);
    expect(draft.content).toContain('<p align="center">**Développeur React TypeScript**</p>');
    expect(draft.evidenceMap.length).toBeGreaterThan(2);
    expect(draft.evidenceMap.every((evidence) => draft.content.includes(evidence.generatedText))).toBe(
      true,
    );
  });
});

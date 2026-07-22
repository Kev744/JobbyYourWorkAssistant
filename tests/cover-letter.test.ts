import {
  decideGenerationHandoff,
  generateCoverLetterDraftWithOpenAI,
} from '@/lib/generate/cover-letter';
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
      companyName: 'Acme',
      summary: 'Applications React et API Node.js.',
      skills: [{ raw: 'React' }, { raw: 'Node.js' }],
    },
  ],
  hobbies: [],
  certifications: [{ label: 'AWS Cloud Practitioner' }],
  skills: [{ raw: 'TypeScript' }, { raw: 'React' }, { raw: 'PostgreSQL' }],
  languages: [{ code: 'en', cecrl: 'B2' }],
  achievements: ['Portfolio applicatif React TypeScript'],
  identityContact: {
    fullName: 'Camille Martin',
    email: 'camille@example.test',
    phone: '0600000000',
    additionalInformation: 'https://www.linkedin.com/in/camille-martin',
  },
  scoringPayload: {
    candidateId: 'version-1',
    headline: 'Développeur TypeScript',
    location: { city: 'Paris' },
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
  description: 'React TypeScript Node.js, API REST, tests automatisés',
  company: { name: 'Acme Digital' },
  location: { city: 'Lyon' },
  contract: { type: 'CDI' },
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

describe('cover letter generation', () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_KEY;
  const originalCompanyResearchEnabled = process.env.ENABLE_COVER_LETTER_COMPANY_RESEARCH;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_KEY = originalOpenAiKey;
    process.env.ENABLE_COVER_LETTER_COMPANY_RESEARCH = originalCompanyResearchEnabled;
  });

  it('routes only explicit generation requests to resume or cover letter handoffs', () => {
    expect(decideGenerationHandoff('resume')).toBe('resume_generation');
    expect(decideGenerationHandoff('cover_letter')).toBe('cover_letter_generation');
    expect(decideGenerationHandoff('auto')).toBeNull();
    expect(decideGenerationHandoff(undefined)).toBe('resume_generation');
  });

  it('generates a French cover letter with project-specific prompt fields', async () => {
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
                  title: 'Lettre de motivation - Développeur React TypeScript',
                  objectLine: 'Objet : Candidature au poste de Développeur React TypeScript',
                  greeting: 'Madame, Monsieur,',
                  paragraphs: [
                    'Votre besoin autour de React, TypeScript et des API REST correspond à un contexte dans lequel je peux être rapidement utile.',
                    'Chez Acme, j’ai développé des applications React et des API Node.js, ce qui me permet de relier exigences produit, qualité applicative et livraison concrète.',
                    'Je me tiens à votre disposition pour échanger sur ma candidature et sur ma contribution possible à vos projets.',
                  ],
                  closing: 'Dans l’attente de votre retour, je vous prie d’agréer, Madame, Monsieur, mes sincères salutations.',
                  evidenceMap: [],
                  warnings: [],
                }),
              },
            ],
          },
        ],
      }),
    } as unknown as Response);

    const draft = await generateCoverLetterDraftWithOpenAI({
      profile,
      offer,
      resumeVersion,
      openAiApiKey: 'sk-user-request-key',
    });
    const body = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body)) as {
      instructions?: string;
      input: Array<{ content: Array<{ text: string }> }>;
    };
    const headers = jest.mocked(global.fetch).mock.calls[0]?.[1]?.headers as Record<string, string>;
    const promptPayload = JSON.parse(body.input[0]?.content[0]?.text ?? '{}') as {
      candidateProfile?: Record<string, unknown>;
      jobOffer?: Record<string, unknown>;
      matchingContext?: Record<string, unknown>;
      resumeVersion?: Record<string, unknown>;
    };

    expect(headers.Authorization).toBe('Bearer sk-user-request-key');
    expect(body.instructions).toContain('candidateProfile');
    expect(body.instructions).toContain('jobOffer');
    expect(body.instructions).toContain('matchingContext');
    expect(body.instructions).toContain('Vous — Moi — Nous');
    expect(body.instructions).not.toMatch(/[ÃÂ]|â€™|â€œ|â€/);
    expect(promptPayload.candidateProfile).not.toHaveProperty('identityContact');
    expect(promptPayload.resumeVersion).not.toHaveProperty('corpusContent');
    expect(promptPayload.jobOffer?.title).toBe('Développeur React TypeScript');
    expect(promptPayload.matchingContext).toHaveProperty('matchedSkills');
    expect(draft.title).toContain('Développeur React TypeScript');
    expect(draft.content).toContain('Camille Martin');
    expect(draft.content).toContain('camille@example.test');
    expect(draft.content).toContain('https://www.linkedin.com/in/camille-martin');
    expect(draft.content).toContain('Objet : Candidature au poste de Développeur React TypeScript');
    expect(draft.content).toContain('Madame, Monsieur,');
    expect(draft.content).toContain('React, TypeScript et des API REST');
    expect(draft.content).not.toMatch(/[ÃÂ]|â€™|â€œ|â€/);
  });

  it('adds company address lines from the job offer content to the recipient block', async () => {
    process.env.OPENAI_KEY = 'test-key';
    process.env.ENABLE_COVER_LETTER_COMPANY_RESEARCH = 'false';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  title: 'Lettre de motivation - Développeur React TypeScript',
                  objectLine: 'Objet : Candidature au poste de Développeur React TypeScript',
                  greeting: 'Madame, Monsieur,',
                  paragraphs: [
                    'Votre besoin React et TypeScript correspond à mon expérience produit.',
                    'Mon expérience React et Node.js répond à ce besoin de livraison fiable.',
                    'Je me tiens à votre disposition pour échanger sur cette contribution.',
                  ],
                  closing:
                    'Dans l’attente de votre retour, je vous prie d’agréer, Madame, Monsieur, mes sincères salutations.',
                  evidenceMap: [],
                  warnings: [],
                }),
              },
            ],
          },
        ],
      }),
    } as unknown as Response);

    const draft = await generateCoverLetterDraftWithOpenAI({
      profile,
      offer: {
        ...offer,
        description:
          'React TypeScript Node.js. Adresse de l’entreprise : 12 rue de la Paix, 75002 Paris.',
      },
      resumeVersion,
    });

    expect(draft.content).toContain('Acme Digital\n12 rue de la Paix\n75002 Paris');
    expect(jest.mocked(global.fetch)).toHaveBeenCalledTimes(1);
  });

  it('uses web search for company context only when offer content is not sufficient', async () => {
    process.env.OPENAI_KEY = 'test-key';
    process.env.ENABLE_COVER_LETTER_COMPANY_RESEARCH = 'true';
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          output: [
            {
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    companyActivity: 'Acme Digital développe des plateformes SaaS.',
                    companyValues: ['qualité produit', 'collaboration'],
                    currentContext: 'Recrutement sur des projets React.',
                    usefulForVousParagraph:
                      'Acme Digital renforce ses projets SaaS avec une attente forte sur React et la qualité produit.',
                    companyAddress: {
                      addressLine: '45 avenue Victor Hugo',
                      postalCode: '69002',
                      city: 'Lyon',
                    },
                    sources: ['https://example.test/acme'],
                    warnings: [],
                  }),
                },
              ],
            },
          ],
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          output: [
            {
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    title: 'Lettre de motivation - Développeur React TypeScript',
                    objectLine: 'Objet : Candidature au poste de Développeur React TypeScript',
                    greeting: 'Madame, Monsieur,',
                    paragraphs: [
                      'Acme Digital renforce ses projets SaaS avec une attente forte sur React et la qualité produit.',
                      'Mon expérience React et Node.js répond à ce besoin de livraison fiable.',
                      'Je me tiens à votre disposition pour échanger sur cette contribution.',
                    ],
                    closing:
                      'Dans l’attente de votre retour, je vous prie d’agréer, Madame, Monsieur, mes sincères salutations.',
                    evidenceMap: [],
                    warnings: [],
                  }),
                },
              ],
            },
          ],
        }),
      } as unknown as Response);

    const draft = await generateCoverLetterDraftWithOpenAI({ profile, offer, resumeVersion });

    expect(jest.mocked(global.fetch)).toHaveBeenCalledTimes(2);
    const researchBody = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body)) as {
      tools?: Array<{ type: string }>;
      input: Array<{ content: Array<{ text: string }> }>;
    };
    const generationBody = JSON.parse(String(jest.mocked(global.fetch).mock.calls[1]?.[1]?.body)) as {
      input: Array<{ content: Array<{ text: string }> }>;
    };
    const researchPayload = JSON.parse(researchBody.input[0]?.content[0]?.text ?? '{}') as {
      candidateProfile?: unknown;
      company?: Record<string, unknown>;
    };
    const generationPayload = JSON.parse(generationBody.input[0]?.content[0]?.text ?? '{}') as {
      companyResearch?: Record<string, unknown>;
    };

    expect(researchBody.tools).toEqual([
      {
        type: 'web_search',
        filters: {
          blocked_domains: ['wikipedia.org', 'reddit.com', 'quora.com', 'fandom.com'],
        },
        external_web_access: false,
      },
    ]);
    expect(researchPayload).not.toHaveProperty('candidateProfile');
    expect(researchPayload.company?.name).toBe('Acme Digital');
    expect(generationPayload.companyResearch?.usefulForVousParagraph).toContain('qualité produit');
    expect(draft.content).toContain('Acme Digital\n45 avenue Victor Hugo\n69002 Lyon');
  });

  it('skips web search when the job offer already contains company values, CSR context and address', async () => {
    process.env.OPENAI_KEY = 'test-key';
    process.env.ENABLE_COVER_LETTER_COMPANY_RESEARCH = 'true';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  title: 'Lettre de motivation - Développeur React TypeScript',
                  objectLine: 'Objet : Candidature au poste de Développeur React TypeScript',
                  greeting: 'Madame, Monsieur,',
                  paragraphs: [
                    'Votre annonce met en avant une culture produit, des valeurs de collaboration, une démarche RSE et un label qualité.',
                    'Mon expérience React et Node.js répond à ce besoin de livraison fiable.',
                    'Je me tiens à votre disposition pour échanger sur cette contribution.',
                  ],
                  closing:
                    'Dans l’attente de votre retour, je vous prie d’agréer, Madame, Monsieur, mes sincères salutations.',
                  evidenceMap: [],
                  warnings: [],
                }),
              },
            ],
          },
        ],
      }),
    } as unknown as Response);

    await generateCoverLetterDraftWithOpenAI({
      profile,
      offer: {
        ...offer,
        description:
          "L'entreprise valorise la collaboration, la transparence, une démarche RSE structurée, un label qualité et une culture produit centrée utilisateur. Adresse de l’entreprise : 12 rue de la Paix, 75002 Paris.",
      },
      resumeVersion,
    });

    expect(jest.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    const generationBody = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body)) as {
      input: Array<{ content: Array<{ text: string }> }>;
    };
    const generationPayload = JSON.parse(generationBody.input[0]?.content[0]?.text ?? '{}') as {
      companyResearch?: Record<string, unknown>;
    };

    expect(generationPayload.companyResearch?.status).toBe('offer_context_sufficient');
    expect(generationPayload.companyResearch?.usefulForVousParagraph).toContain('collaboration');
  });
});

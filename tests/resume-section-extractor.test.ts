import {
  extractResumeSectionsWithOpenAI,
  formatResumeSectionsAsRichTextHtml,
  normalizeResumeSectionExtraction,
  type ResumeSectionExtraction,
} from '@/lib/profile/resume-section-extractor';
import { generateCandidateProfileDraft } from '@/lib/profile/profile-extractor';
import { richTextHtmlToServerPlainText } from '@/lib/rich-text/html';

const sections: ResumeSectionExtraction = {
  profile: 'Developpeur full-stack oriente produit.',
  profession: 'Developpeur TypeScript',
  education: '- Master informatique',
  educationItems: [{ degreeLabel: 'Master informatique', sourceText: 'Master informatique' }],
  professionalExperiences: '- Developpeur full-stack - Acme - 2021-2024',
  professionalExperienceItems: [
    {
      titleRaw: 'Developpeur full-stack',
      companyName: 'Acme',
      summary: "Developpement d'API Node.js et interfaces Next.js.",
      startDate: '01/2021',
      endDate: '12/2024',
      sourceText: 'Developpeur full-stack - Acme - 2021-2024',
    },
  ],
  skills: '- TypeScript\n- Next.js',
  languages: '- Francais - C2\n- Anglais - B2',
  certifications: '',
  hobbies: 'Course a pied',
  warnings: ['Certifications laissees vides.'],
};

describe('resume section extraction formatting', () => {
  const originalFetch = global.fetch;
  const originalOpenAiKey = process.env.OPENAI_KEY;
  const originalOpenAiModel = process.env.OPENAI_MODEL;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_KEY = originalOpenAiKey;
    process.env.OPENAI_MODEL = originalOpenAiModel;
  });

  it('formats extracted sections as editable rich text HTML', () => {
    expect(formatResumeSectionsAsRichTextHtml(sections)).toBe(
      '<h2>Profile</h2><p>Developpeur full-stack oriente produit.</p><h2>Profession</h2><p>Developpeur TypeScript</p><h2>Education</h2><p>Master informatique</p><h2>Professional Experiences</h2><p>Developpeur full-stack - Acme - Developpement d&#39;API Node.js et interfaces Next.js.</p><h2>Skills</h2><p>TypeScript</p><p>Next.js</p><h2>Languages</h2><p>Francais - C2</p><p>Anglais - B2</p><h2>Certifications</h2><p><br></p><h2>Hobbies</h2><p>Course a pied</p>',
    );
  });

  it('renders extracted experience descriptions from structured items', () => {
    expect(
      formatResumeSectionsAsRichTextHtml({
        ...sections,
        professionalExperiences: '- Developpeur full-stack',
        professionalExperienceItems: [
          {
            titleRaw: 'Developpeur full-stack',
            companyName: 'Acme',
            location: 'Paris',
            summary: "Developpement d'API Node.js et interfaces Next.js.",
            startDate: '01/2021',
            endDate: '12/2024',
            sourceText:
              "Developpeur full-stack\nAcme\nParis\n2021 - 2024\nDeveloppement d'API Node.js et interfaces Next.js.",
          },
        ],
      }),
    ).toContain(
      "<h2>Professional Experiences</h2><p>Developpeur full-stack - Acme - Developpement d&#39;API Node.js et interfaces Next.js.</p>",
    );
  });

  it('includes key profile sections in the rich text content', () => {
    const richTextContent = formatResumeSectionsAsRichTextHtml(sections);

    expect(richTextContent).toContain('<h2>Professional Experiences</h2>');
    expect(richTextContent).toContain('<h2>Skills</h2>');
    expect(richTextContent).toContain('<h2>Profession</h2>');
    expect(richTextContent).toContain('<h2>Languages</h2>');
  });

  it('uses gpt-5.4 for OpenAI resume section extraction when configured', async () => {
    process.env.OPENAI_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'gpt-5.4';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [{ content: [{ type: 'output_text', text: JSON.stringify(sections) }] }],
      }),
    } as unknown as Response);

    await extractResumeSectionsWithOpenAI({
      title: 'CV',
      corpusContent:
        'Profession\nDeveloppeur TypeScript\n\nProfessional Experiences\nDeveloper\n\nLanguages\nEnglish B2\n\nSkills\nTypeScript',
    });
    const body = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body)) as {
      model: string;
      reasoning: { effort: string };
      instructions: string;
      text: { format: { schema: { required: string[]; properties: Record<string, unknown> } } };
    };

    expect(body.model).toBe('gpt-5.4');
    expect(body.reasoning.effort).toBe('medium');
    expect(body.text.format.schema.required).toEqual(
      expect.arrayContaining([
        'profession',
        'languages',
        'educationItems',
        'professionalExperienceItems',
      ]),
    );
    expect(JSON.stringify(body.text.format.schema.properties)).toContain('companyName');
    expect(JSON.stringify(body.text.format.schema.properties)).toContain('sourceText');
    expect(body.instructions).toContain('PDF or OCR');
    expect(body.instructions).toContain('structured arrays first');
    expect(body.instructions).toContain('source of truth');
    expect(body.instructions).toContain('one item per distinct job');
    expect(body.instructions).toContain('Do not repeat the role title');
    expect(body.instructions).toContain('professionalExperiences string must render the titleRaw');
    expect(body.instructions).toContain('startDate and endDate must be extracted');
    expect(body.instructions).toContain('Do not assume the source date input format');
    expect(body.instructions).toContain('only in MM/YYYY format');
    expect(body.instructions).toContain('01/YYYY for the start year and 12/YYYY for the end year');
    expect(body.instructions).toContain('Never return false, true, null');
    expect(body.instructions).toContain('canonical language name');
    expect(body.instructions).toContain('map them respectively to C1, B2, B1, and A1');
    expect(body.instructions).toContain('Always sort languages by proficiency');
    expect(body.instructions).toContain('Never output "fr", "en", "es", "de", or "it"');
    expect(body.instructions).toContain('one item per diploma/training/school block');
    expect(body.instructions).toContain('Do not include Markdown syntax');
  });

  it('redacts confidential contact information before sending the corpus to OpenAI', async () => {
    process.env.OPENAI_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [{ content: [{ type: 'output_text', text: JSON.stringify(sections) }] }],
      }),
    } as unknown as Response);

    await extractResumeSectionsWithOpenAI({
      title: 'CV',
      corpusContent: `
Kevin Esteves
kevin.esteves@example.test
06 12 34 56 78
Ville : Paris

Profile
Developpeur full-stack
`,
    });
    const body = JSON.parse(String(jest.mocked(global.fetch).mock.calls[0]?.[1]?.body)) as {
      input: Array<{ content: Array<{ text: string }> }>;
    };
    const promptText = body.input[0]?.content[0]?.text ?? '';

    expect(promptText).not.toContain('Kevin Esteves');
    expect(promptText).not.toContain('kevin.esteves@example.test');
    expect(promptText).not.toContain('06 12 34 56 78');
    expect(promptText).not.toContain('Ville : Paris');
    expect(promptText).toContain('[contact redacted]');
    expect(promptText).toContain('Developpeur full-stack');
  });

  it('keeps locally extracted contact information outside the OpenAI payload for profile generation', async () => {
    process.env.OPENAI_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output: [{ content: [{ type: 'output_text', text: JSON.stringify(sections) }] }],
      }),
    } as unknown as Response);

    const extraction = await extractResumeSectionsWithOpenAI({
      title: 'CV',
      corpusContent: `
Kévin ESTEVES
kevin.esteves@example.test
06 12 34 56 78
75000 Paris

Profile
Developpeur full-stack
`,
    });

    expect(extraction.identityContact).toEqual({
      fullName: 'Kévin ESTEVES',
      email: 'kevin.esteves@example.test',
      phone: '06 12 34 56 78',
      city: 'Paris',
      postalCode: '75000',
    });
  });

  it('removes placeholder company names without discarding AI dates', () => {
    const extraction = normalizeResumeSectionExtraction({
      ...sections,
      professionalExperiences: '',
      professionalExperienceItems: [
        {
          titleRaw: 'Developpeur full-stack',
          companyName: 'false',
          location: '',
          summary: 'Developpement Next.js',
          startDate: '01/2021',
          endDate: '12/2024',
          sourceText: 'Developpeur full-stack\n2021 - 2024\nDeveloppement Next.js',
        },
      ],
    });

    expect(extraction?.professionalExperienceItems).toEqual([
      {
        titleRaw: 'Developpeur full-stack',
        companyName: undefined,
        location: undefined,
        summary: 'Developpement Next.js',
        startDate: '01/2021',
        endDate: '12/2024',
        sourceText: 'Developpeur full-stack\n2021 - 2024\nDeveloppement Next.js',
      },
    ]);
  });

  it('repairs an unsupported AI company name from the item source block', () => {
    const extraction = normalizeResumeSectionExtraction({
      ...sections,
      professionalExperiences: 'Developpeur full-stack - Paris - Developpement Next.js',
      professionalExperienceItems: [
        {
          titleRaw: 'Developpeur full-stack',
          companyName: 'Paris',
          location: 'Paris',
          summary: 'Developpement Next.js',
          startDate: '01/2021',
          endDate: '12/2024',
          sourceText: 'Developpeur full-stack\nAcme Digital\nParis\n2021 - 2024\nDeveloppement Next.js',
        },
      ],
    });

    expect(extraction?.professionalExperienceItems[0]).toMatchObject({
      titleRaw: 'Developpeur full-stack',
      companyName: 'Acme Digital',
      summary: 'Developpement Next.js',
      startDate: '01/2021',
      endDate: '12/2024',
    });
  });

  it('repairs blank AI dates from the same experience source text', () => {
    const extraction = normalizeResumeSectionExtraction({
      ...sections,
      professionalExperiences: '',
      professionalExperienceItems: [
        {
          titleRaw: 'Product Owner',
          companyName: 'Gamma SAS',
          location: '',
          summary: 'Cadrage produit',
          startDate: '',
          endDate: '',
          sourceText: 'Product Owner\nGamma SAS\njanv. 2020 - mars 2022\nCadrage produit',
        },
      ],
    });

    expect(extraction?.professionalExperienceItems[0]).toMatchObject({
      titleRaw: 'Product Owner',
      companyName: 'Gamma SAS',
      summary: 'Cadrage produit',
      startDate: '01/2020',
      endDate: '03/2022',
    });
  });

  it('repairs sourceText dates from the original corpus when OpenAI omits them', () => {
    const extraction = normalizeResumeSectionExtraction(
      {
        ...sections,
        professionalExperiences: 'Product Owner - Gamma SAS - Cadrage produit',
        professionalExperienceItems: [
          {
            titleRaw: 'Product Owner',
            companyName: 'Gamma SAS',
            location: '',
            summary: 'Cadrage produit',
            startDate: '',
            endDate: '',
            sourceText: 'Product Owner\nGamma SAS\nCadrage produit',
          },
        ],
      },
      {
        sourceCorpus: `
Profil
Product Owner
Gamma SAS
janv. 2020 - mars 2022
Cadrage produit

Competences
Agile
`,
      },
    );

    expect(extraction?.professionalExperienceItems[0]).toMatchObject({
      titleRaw: 'Product Owner',
      companyName: 'Gamma SAS',
      summary: 'Cadrage produit',
      startDate: '01/2020',
      endDate: '03/2022',
      sourceText: 'Product Owner\nGamma SAS\njanv. 2020 - mars 2022\nCadrage produit',
    });
  });

  it('repairs missing OpenAI sub-section arrays with deterministic parsing', async () => {
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
                  ...sections,
                  education: 'Master informatique\nUniversite Paris Cite\n2022',
                  educationItems: [],
                  professionalExperiences:
                    'Developpeur full-stack\nAcme\n2021 - 2024\nMissions : developpement Next.js',
                  professionalExperienceItems: [],
                  warnings: [],
                }),
              },
            ],
          },
        ],
      }),
    } as unknown as Response);

    const extraction = await extractResumeSectionsWithOpenAI({
      title: 'CV',
      corpusContent: 'Formation et experiences',
    });

    expect(extraction.educationItems).toEqual([
      {
        degreeLabel: 'Master informatique',
        schoolName: 'Universite Paris Cite',
        graduationDate: '2022',
      },
    ]);
    expect(extraction.professionalExperienceItems).toEqual([
      {
        titleRaw: 'Developpeur full-stack',
        companyName: 'Acme',
        summary: 'Missions : developpement Next.js',
        startDate: '01/2021',
        endDate: '12/2024',
      },
    ]);
  });

  it('accepts multiple OpenAI education and experience blocks without collapsing them', async () => {
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
                  ...sections,
                  education:
                    'Master informatique\nUniversite Paris Cite\n2022\nBTS SIO\nLycee Jean Rostand\n2020',
                  educationItems: [
                    {
                      degreeLabel: 'Master informatique',
                      schoolName: 'Universite Paris Cite',
                      field: 'informatique',
                      graduationDate: '2022',
                      sourceText: 'Master informatique\nUniversite Paris Cite\n2022',
                    },
                    {
                      degreeLabel: 'BTS SIO',
                      schoolName: 'Lycee Jean Rostand',
                      field: 'informatique',
                      graduationDate: '2020',
                      sourceText: 'BTS SIO\nLycee Jean Rostand\n2020',
                    },
                  ],
                  professionalExperiences:
                    'Developpeur full-stack - Acme - 2021-2024\nConsultant QA - Beta Conseil - 2019-2021',
                  professionalExperienceItems: [
                    {
                      titleRaw: 'Developpeur full-stack',
                      companyName: 'Acme',
                      location: '',
                      summary: 'Developpeur full-stack - Acme - 2021-2024',
                      startDate: '01/2021',
                      endDate: '12/2024',
                      sourceText: 'Developpeur full-stack - Acme - 2021-2024',
                    },
                    {
                      titleRaw: 'Consultant QA',
                      companyName: 'Beta Conseil',
                      location: '',
                      summary: 'Consultant QA - Beta Conseil - 2019-2021',
                      startDate: '01/2019',
                      endDate: '12/2021',
                      sourceText: 'Consultant QA - Beta Conseil - 2019-2021',
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

    const extraction = await extractResumeSectionsWithOpenAI({
      title: 'CV',
      corpusContent: 'CV avec plusieurs formations et experiences',
    });

    expect(extraction.educationItems).toHaveLength(2);
    expect(extraction.professionalExperienceItems).toHaveLength(2);
    expect(extraction.professionalExperienceItems[0]?.companyName).toBe('Acme');
    expect(extraction.professionalExperienceItems[1]?.companyName).toBe('Beta Conseil');
  });

  it('keeps generated rich text compatible with profile draft extraction', () => {
    const richTextContent = formatResumeSectionsAsRichTextHtml(sections);
    const draft = generateCandidateProfileDraft({
      resumeVersionId: 'version-1',
      title: 'Version editee',
      romeCode: 'M1805',
      romePredictionScore: 0.82,
      corpusContent: richTextHtmlToServerPlainText(richTextContent),
    });

    expect(draft.profession).toBe('Developpeur TypeScript');
    expect(draft.summary).toBe('Developpeur full-stack oriente produit.');
    expect(draft.education).toEqual([{ degreeLabel: 'Master informatique' }]);
    expect(draft.professionalExperiences).toEqual([
      {
        titleRaw: 'Developpeur full-stack',
        companyName: 'Acme',
        summary: "Developpement d'API Node.js et interfaces Next.js.",
        startDate: undefined,
        endDate: undefined,
      },
    ]);
    expect(draft.skills.map((skill) => skill.raw)).toEqual(['TypeScript', 'Next.js']);
    expect(draft.languages).toEqual([
      { code: 'Français', cecrl: 'C2' },
      { code: 'Anglais', cecrl: 'B2' },
    ]);
    expect(draft.hobbies).toEqual(['Course a pied']);
  });

  it('keeps multiple generated rich text experiences as separate profile draft items', () => {
    const richTextContent = formatResumeSectionsAsRichTextHtml({
      ...sections,
      professionalExperiences:
        'Developpeur full-stack - Acme - Developpement API\nConsultant QA - Beta Conseil - Tests automatises',
      professionalExperienceItems: [
        {
          titleRaw: 'Developpeur full-stack',
          companyName: 'Acme',
          summary: 'Developpement API',
          startDate: '01/2021',
          endDate: '12/2024',
          sourceText: 'Developpeur full-stack\nAcme\n2021 - 2024\nDeveloppement API',
        },
        {
          titleRaw: 'Consultant QA',
          companyName: 'Beta Conseil',
          summary: 'Tests automatises',
          startDate: '01/2019',
          endDate: '12/2021',
          sourceText: 'Consultant QA\nBeta Conseil\n2019 - 2021\nTests automatises',
        },
      ],
    });
    const draft = generateCandidateProfileDraft({
      resumeVersionId: 'version-1',
      title: 'Version editee',
      romeCode: 'M1805',
      romePredictionScore: 0.82,
      corpusContent: richTextHtmlToServerPlainText(richTextContent),
    });

    expect(draft.professionalExperiences).toEqual([
      {
        titleRaw: 'Developpeur full-stack',
        companyName: 'Acme',
        summary: 'Developpement API',
        startDate: undefined,
        endDate: undefined,
      },
      {
        titleRaw: 'Consultant QA',
        companyName: 'Beta Conseil',
        summary: 'Tests automatises',
        startDate: undefined,
        endDate: undefined,
      },
    ]);
  });

  it('sorts extracted language lines by proficiency before rich text rendering', () => {
    const richTextContent = formatResumeSectionsAsRichTextHtml({
      ...sections,
      languages: 'Italien - A1\nAnglais - B2\nFrancais - langue maternelle\nAllemand - C1',
    });

    expect(richTextContent).toContain(
      '<h2>Languages</h2><p>Francais - langue maternelle</p><p>Allemand - C1</p><p>Anglais - B2</p><p>Italien - A1</p>',
    );
  });
});

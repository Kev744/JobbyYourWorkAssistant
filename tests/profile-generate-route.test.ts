import { loadLatestExtraction } from '@/app/api/profile/generate/route';
import type { ResumeSectionExtraction } from '@/lib/profile/resume-section-extractor';

const sections: ResumeSectionExtraction = {
  profile: 'Developpeur full-stack.',
  profession: 'Developpeur TypeScript',
  education: '',
  educationItems: [],
  professionalExperiences: 'Developpeur full-stack - Acme - API Node.js',
  professionalExperienceItems: [
    {
      titleRaw: 'Developpeur full-stack',
      companyName: 'Acme',
      summary: 'API Node.js',
      startDate: '01/2021',
      endDate: '12/2024',
      sourceText: 'Developpeur full-stack\nAcme\n2021 - 2024\nAPI Node.js',
    },
  ],
  skills: 'TypeScript',
  languages: '',
  certifications: '',
  hobbies: '',
  warnings: [],
};

describe('profile generation extraction loading', () => {
  it('falls back to a file-level extraction created before the resume version was saved', async () => {
    const queries = [
      createQuery(null),
      createQuery({
        sections,
        markdown_content: '<h2>Professional Experiences</h2><p>Developpeur full-stack - Acme - API Node.js</p>',
      }),
    ];
    const db = {
      from: jest.fn(() => queries.shift()),
    };

    const extraction = await loadLatestExtraction({
      db: db as never,
      userId: 'user-1',
      resumeFileId: 'file-1',
      resumeVersionId: 'version-1',
    });

    expect(extraction.sections?.professionalExperienceItems).toEqual([
      expect.objectContaining({
        titleRaw: 'Developpeur full-stack',
        companyName: 'Acme',
        startDate: '01/2021',
        endDate: '12/2024',
      }),
    ]);
    expect(db.from).toHaveBeenCalledTimes(2);
  });
});

function createQuery(data: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data }),
  };
}

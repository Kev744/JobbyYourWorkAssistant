import { extractEducationItems, extractProfessionalExperiences } from '@/lib/profile/profile-item-parser';

describe('profile item parser', () => {
  it('groups multi-line professional experiences with their company, dates, and missions', () => {
    const experiences = extractProfessionalExperiences(`
- Developpeur full-stack
Acme
2021 - 2024
Missions : developpement Next.js et API Node.js

- Consultant QA - Beta Conseil - 2019 - 2021
Tests automatises Jest et Cypress
`);

    expect(experiences).toEqual([
      {
        titleRaw: 'Developpeur full-stack',
        companyName: 'Acme',
        summary: 'Missions : developpement Next.js et API Node.js',
        startDate: '2021',
        endDate: '2024',
      },
      {
        titleRaw: 'Consultant QA',
        companyName: 'Beta Conseil',
        summary: 'Tests automatises Jest et Cypress',
        startDate: '2019',
        endDate: '2021',
      },
    ]);
  });

  it('extracts compact and ongoing professional experience date ranges', () => {
    expect(
      extractProfessionalExperiences(`
- Product Owner | Gamma SAS | janv. 2020 - mars 2022
- Ingenieur logiciel chez Delta Tech depuis 2023
`),
    ).toEqual([
      {
        titleRaw: 'Product Owner',
        companyName: 'Gamma SAS',
        summary: undefined,
        startDate: 'janv. 2020',
        endDate: 'mars 2022',
      },
      {
        titleRaw: 'Ingenieur logiciel',
        companyName: 'Delta Tech',
        summary: undefined,
        startDate: '2023',
        endDate: "Aujourd'hui",
      },
    ]);
  });

  it('extracts the company when it appears before the role', () => {
    expect(
      extractProfessionalExperiences(`
Acme Digital
Developpeur front-end
2018-2020
Refonte React du portail client
`),
    ).toEqual([
      {
        titleRaw: 'Developpeur front-end',
        companyName: 'Acme Digital',
        summary: 'Refonte React du portail client',
        startDate: '2018',
        endDate: '2020',
      },
    ]);
  });

  it('does not use a mission line after dates as the company', () => {
    expect(
      extractProfessionalExperiences(`
Developpeur full-stack
2021 - 2024
Developpement Next.js
`),
    ).toEqual([
      {
        titleRaw: 'Developpeur full-stack',
        companyName: undefined,
        summary: 'Developpement Next.js',
        startDate: '2021',
        endDate: '2024',
      },
    ]);
  });

  it('keeps company and mission when rich text contains no role title', () => {
    expect(extractProfessionalExperiences('Acme - Refonte React du portail client')).toEqual([
      {
        titleRaw: '',
        companyName: 'Acme',
        summary: 'Refonte React du portail client',
        startDate: undefined,
        endDate: undefined,
      },
    ]);
  });

  it('keeps consecutive compact rich text experience rows as separate blocks', () => {
    expect(
      extractProfessionalExperiences(`
Developpeur full-stack - Acme - Developpement d'API Node.js
Consultant QA - Beta Conseil - Tests automatises Jest et Cypress
Product Owner - Gamma SAS - Cadrage produit et ateliers metier
`),
    ).toEqual([
      {
        titleRaw: 'Developpeur full-stack',
        companyName: 'Acme',
        summary: "Developpement d'API Node.js",
        startDate: undefined,
        endDate: undefined,
      },
      {
        titleRaw: 'Consultant QA',
        companyName: 'Beta Conseil',
        summary: 'Tests automatises Jest et Cypress',
        startDate: undefined,
        endDate: undefined,
      },
      {
        titleRaw: 'Product Owner',
        companyName: 'Gamma SAS',
        summary: 'Cadrage produit et ateliers metier',
        startDate: undefined,
        endDate: undefined,
      },
    ]);
  });

  it('groups each education entry with the corresponding school and graduation date', () => {
    const education = extractEducationItems(`
Master informatique
Universite Paris Cite
2022

BTS SIO
Lycee Jean Rostand
2020
`);

    expect(education).toEqual([
      {
        degreeLabel: 'Master informatique',
        schoolName: 'Universite Paris Cite',
        graduationDate: '2022',
      },
      {
        degreeLabel: 'BTS SIO',
        schoolName: 'Lycee Jean Rostand',
        graduationDate: '2020',
      },
    ]);
  });

  it('keeps one-line bullets as independent education entries', () => {
    expect(
      extractEducationItems(`
- Master informatique - Universite Paris Cite - 2022
- BTS SIO - Lycee Jean Rostand - 2020
`),
    ).toEqual([
      {
        degreeLabel: 'Master informatique',
        schoolName: 'Universite Paris Cite',
        graduationDate: '2022',
      },
      {
        degreeLabel: 'BTS SIO',
        schoolName: 'Lycee Jean Rostand',
        graduationDate: '2020',
      },
    ]);
  });
});

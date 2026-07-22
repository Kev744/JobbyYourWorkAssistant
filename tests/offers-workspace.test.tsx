import { renderToStaticMarkup } from 'react-dom/server';

import { OfferCard, OffersWorkspace } from '@/components/offers-workspace';
import type { JobOffer, ScoredOffer } from '@/types';

describe('OfferCard', () => {
  it('renders a session-only OpenAI API key field for generation', () => {
    const html = renderToStaticMarkup(<OffersWorkspace />);

    expect(html).toContain('Clé API OpenAI');
    expect(html).toContain('Non enregistrée');
  });

  it('renders a supervised auto-apply action', () => {
    const html = renderToStaticMarkup(<OffersWorkspace />);

    expect(html).toContain("Démarrer l&#x27;auto-candidature");
  });

  it('renders a cover letter generation action next to the resume action', () => {
    const html = renderToStaticMarkup(
      <OfferCard
        offer={offer}
        score={score}
        sourceBadge="France Travail"
        isGenerating={false}
        isGeneratingCoverLetter={false}
        isCreatingApplication={false}
        onGenerate={() => undefined}
        onGenerateCoverLetter={() => undefined}
        onCreateApplication={() => undefined}
      />,
    );

    expect(html).toContain('Générer un CV');
    expect(html).toContain('Générer une lettre de motivation');
  });

  it('renders the editable PDF export controls after generation', () => {
    const html = renderToStaticMarkup(
      <OfferCard
        offer={offer}
        score={score}
        sourceBadge="France Travail"
        generatedUrls={{
          pdf: 'https://example.test/cv.pdf',
          docx: 'https://example.test/cv.docx',
          content: 'CV généré',
        }}
        generatedCoverLetterUrls={{
          pdf: 'https://example.test/lettre.pdf',
          docx: 'https://example.test/lettre.docx',
          content: 'Lettre générée',
        }}
        editingDocumentKind="resume"
        isGenerating={false}
        isGeneratingCoverLetter={false}
        isCreatingApplication={false}
        onGenerate={() => undefined}
        onGenerateCoverLetter={() => undefined}
        onCreateApplication={() => undefined}
      />,
    );

    expect(html).toContain('Modifier avant téléchargement');
    expect(html).toContain('Télécharger le PDF modifié');
  });

  it('renders the OpenAI ATS scoring breakdown when available', () => {
    const html = renderToStaticMarkup(
      <OfferCard
        offer={offer}
        score={{
          ...score,
          breakdown: {
            ...score.breakdown,
            finalScore: 86,
            requiredCriteria: 27,
            skillsAndTools: 16,
            experienceRelevance: 18,
            roleTitleSeniorityDomain: 9,
            educationCertificationsLanguages: 8,
            logisticsFit: 4,
            evidenceQuality: 4,
            capsApplied: [],
          },
        }}
        sourceBadge="France Travail"
        isGenerating={false}
        isGeneratingCoverLetter={false}
        isCreatingApplication={false}
        onGenerate={() => undefined}
        onGenerateCoverLetter={() => undefined}
        onCreateApplication={() => undefined}
      />,
    );

    expect(html).toContain('Critères obligatoires');
    expect(html).toContain('27/30');
    expect(html).toContain('Compétences et outils');
    expect(html).toContain('16/20');
  });
});

const offer: JobOffer = {
  offerId: 'france_travail:123',
  source: 'france_travail',
  sourceOfferId: '123',
  title: 'Développeur React TypeScript',
  description: 'React TypeScript Node.js',
  location: { city: 'Paris' },
  jobTarget: { rawTitle: 'Développeur React TypeScript', canonicalRomeCode: 'M1805' },
  skills: [{ raw: 'TypeScript' }],
};

const score: ScoredOffer = {
  offer,
  breakdown: {
    skills: 20,
    title: 12,
    experience: 8,
    education: 5,
    certifications: 0,
    languages: 2,
    keywords: 2,
    softSkills: 1,
    location: 3,
    salary: 0,
    remote: 0,
    mustHaveCoverage: 1,
    finalScore: 72,
  },
  matchedFeatures: {
    exactSkills: ['TypeScript'],
    fuzzySkills: [],
    semanticSkills: [],
    missingMustHave: [],
  },
};

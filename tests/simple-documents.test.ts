import { generateDocumentFromText, normalizeCorpusText } from '@/lib/export/simple-documents';
import { extractResumeTextFromBuffer } from '@/lib/upload/resume-text-extractor';

describe('simple document exports', () => {
  it('generates a PDF buffer', () => {
    const document = generateDocumentFromText('CV', 'Experience TypeScript', 'pdf');

    expect(document.contentType).toBe('application/pdf');
    expect(document.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(document.bytes.toString('latin1')).toContain('/Producer');
    expect(document.bytes.toString('latin1')).toContain('(PDFKit)');
    expectPdfStructure(document.bytes);
  });

  it('generates a DOCX zip buffer', () => {
    const document = generateDocumentFromText('CV', 'Formation\nCompetences', 'docx');

    expect(document.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(document.bytes.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('normalizes corpus line endings and whitespace', () => {
    expect(normalizeCorpusText('Profil\r\nTest  \n')).toBe('Profil\nTest');
  });

  it('extracts editable text from a plain text corpus buffer', () => {
    const extraction = extractResumeTextFromBuffer({
      bytes: Buffer.from('Profil\r\nDeveloppeur TypeScript  \n'),
      mimeType: 'text/plain',
    });

    expect(extraction.warnings).toEqual([]);
    expect(extraction.text).toBe('Profil\nDeveloppeur TypeScript');
  });

  it('extracts editable text from a Markdown corpus buffer', () => {
    const extraction = extractResumeTextFromBuffer({
      bytes: Buffer.from('## Profil\n\n**Developpeur TypeScript**'),
      mimeType: 'text/markdown',
    });

    expect(extraction.warnings).toEqual([]);
    expect(extraction.text).toBe('## Profil\n\n**Developpeur TypeScript**');
  });

  it('extracts editable text from a generated PDF buffer', () => {
    const document = generateDocumentFromText('CV', 'Profil\nDeveloppeur TypeScript', 'pdf');
    const extraction = extractResumeTextFromBuffer({
      bytes: document.bytes,
      mimeType: document.contentType,
    });

    expect(extraction.warnings).toEqual([]);
    expect(extraction.text).not.toContain('CV');
    expect(extraction.text).toContain('Developpeur TypeScript');
  });

  it('extracts editable text from a generated DOCX buffer', () => {
    const document = generateDocumentFromText('CV', 'Formation\nMaster informatique', 'docx');
    const extraction = extractResumeTextFromBuffer({
      bytes: document.bytes,
      mimeType: document.contentType,
    });

    expect(extraction.warnings).toEqual([]);
    expect(extraction.text).toBe('Formation\nMaster informatique');
  });

  it('does not render export filenames as PDF or DOCX content', () => {
    const pdf = generateDocumentFromText('CV cible', 'Profil\nDeveloppeur TypeScript', 'pdf');
    const docx = generateDocumentFromText('CV cible', 'Profil\nDeveloppeur TypeScript', 'docx');
    const pdfExtraction = extractResumeTextFromBuffer({
      bytes: pdf.bytes,
      mimeType: pdf.contentType,
    });
    const docxExtraction = extractResumeTextFromBuffer({
      bytes: docx.bytes,
      mimeType: docx.contentType,
    });

    expect(pdfExtraction.text).not.toContain('CV cible');
    expect(docxExtraction.text).not.toContain('CV cible');
    expect(pdfExtraction.text).toContain('Profil');
    expect(docxExtraction.text).toContain('Profil');
  });

  it('renders centered resume title markup without printing raw HTML in DOCX text', () => {
    const document = generateDocumentFromText(
      'CV cible',
      '### Poste\n<p align="center">**Developpeur React TypeScript**</p>',
      'docx',
    );
    const extraction = extractResumeTextFromBuffer({
      bytes: document.bytes,
      mimeType: document.contentType,
    });

    expect(extraction.text).toContain('Developpeur React TypeScript');
    expect(extraction.text).not.toContain('<p align="center">');
    expect(extraction.text).not.toContain('**');
    expect(extraction.text).not.toContain('###');
  });

  it('applies cover letter block alignment to DOCX without printing raw HTML', () => {
    const document = generateDocumentFromText(
      'Lettre de motivation',
      [
        '<div align="right">',
        'A l’attention du service des ressources humaines',
        'Acme Digital',
        '</div>',
        '',
        '<div align="justify">',
        'Madame, Monsieur,',
        'Votre mission produit et votre culture de collaboration correspondent a mon experience.',
        '</div>',
      ].join('\n'),
      'docx',
    );
    const documentXml = document.bytes.toString('utf8');
    const extraction = extractResumeTextFromBuffer({
      bytes: document.bytes,
      mimeType: document.contentType,
    });

    expect(documentXml).toContain('<w:jc w:val="right"/>');
    expect(documentXml).toContain('<w:jc w:val="both"/>');
    expect(extraction.text).toContain('Acme Digital');
    expect(extraction.text).toContain('Madame, Monsieur,');
    expect(extraction.text).not.toContain('<div');
    expect(extraction.text).not.toContain('</div>');
  });

  it('places right-aligned cover letter blocks near the right side in PDF output', () => {
    const document = generateDocumentFromText(
      '',
      [
        '<div align="right">',
        'A l’attention du service des ressources humaines',
        'Acme Digital',
        '</div>',
      ].join('\n'),
      'pdf',
    );
    const extraction = extractResumeTextFromBuffer({
      bytes: document.bytes,
      mimeType: document.contentType,
    });
    const pdf = document.bytes.toString('latin1');

    expect(extraction.text).toContain('Acme Digital');
    expect(pdf).not.toContain('<div align="right">');
    expect(pdf).not.toContain('</div>');
    expectPdfStructure(document.bytes);
  });

  it('includes font, size, and separator metadata in generated DOCX output', () => {
    const document = generateDocumentFromText(
      '',
      [
        '**Camille Martin**',
        '### Competences cles',
        '- TypeScript',
        '---',
        '<p align="center">**Developpeur React TypeScript**</p>',
      ].join('\n'),
      'docx',
    );
    const documentXml = document.bytes.toString('utf8');

    expect(documentXml).toContain('w:rFonts w:ascii="Arial"');
    expect(documentXml).toContain('w:rFonts w:ascii="Cambria"');
    expect(documentXml).toContain('<w:sz w:val="23"/>');
    expect(documentXml).toContain('<w:sz w:val="28"/>');
    expect(documentXml).toContain('<w:jc w:val="center"/>');
    expect(documentXml).toContain('<w:pBdr><w:bottom');
    expect(documentXml.match(/<w:b\/>/g)).toHaveLength(3);
  });

  it('declares Arial body and Cambria title fonts in generated PDF output', () => {
    const document = generateDocumentFromText(
      '',
      '**Camille Martin**\n### Competences cles\n- TypeScript\n<p align="center">**Developpeur React TypeScript**</p>',
      'pdf',
    );
    const pdf = document.bytes.toString('latin1');

    expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Arial/);
    expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+(Cambria|Cambria-Bold)/);
    expectPdfStructure(document.bytes);
  });

  it('uses the full PDF page height before omitting lower resume sections', () => {
    const content = [
      '**Camille Martin**',
      'Email : camille@example.test',
      '<p align="center">**Developpeur React TypeScript**</p>',
      '',
      '### Objectif professionnel',
      '---',
      'Transformer les besoins produit en interfaces fiables avec React, TypeScript et une pratique API Node.js.',
      '',
      '### Competences cles',
      '---',
      '- TypeScript',
      '- React',
      '- Node.js',
      '- PostgreSQL',
      '- Tests automatises',
      '- API REST',
      '',
      '### Experience professionnelle',
      '---',
      '- Developpeur full-stack : Applications React et API Node.js.',
      '- Developpement de composants reutilisables et integration API.',
      '- Maintenance corrective et amelioration continue.',
      '- Collaboration produit, priorisation et livraison incrementale.',
      '- Qualite applicative avec tests automatises.',
      '- Optimisation des parcours utilisateurs.',
      '- Documentation technique concise.',
      '- Support aux mises en production.',
      '',
      '### Formation',
      '---',
      '- Master informatique (RNCP 7)',
      '- Licence informatique',
      '- Formation cloud applicatif',
      '',
      '### Langues',
      '---',
      '- Francais : langue maternelle',
      '- Anglais : B2',
      '- Espagnol : B1',
      '- Italien : A2',
      '- Allemand : A1',
      '',
      '### Certifications',
      '---',
      '- AWS Cloud Practitioner',
      '- Scrum Foundation',
      '',
      '### Publications et projets',
      '---',
      '- Portfolio applicatif React TypeScript',
      '- Articles techniques sur API et tests',
      '',
      "### Associations et centres d'interet",
      '---',
      '- Benevolat associatif',
      '- Veille technologique',
      '- Course a pied',
    ].join('\n');
    const document = generateDocumentFromText('', content, 'pdf');
    const extraction = extractResumeTextFromBuffer({
      bytes: document.bytes,
      mimeType: document.contentType,
    });

    expect(extraction.text).toContain('AWS Cloud Practitioner');
    expect(extraction.text).toContain('Portfolio applicatif React TypeScript');
    expect(extraction.text).toContain("Associations et centres d'interet");
    expect(extraction.text).toContain('Course a pied');
    expect(document.bytes.toString('latin1')).not.toContain(' Td () Tj ET');
    expectPdfStructure(document.bytes);
  });
});

function expectPdfStructure(bytes: Buffer): void {
  const pdf = bytes.toString('latin1');
  const startxrefMatch = pdf.match(/startxref\s+(\d+)\s+%%EOF\s*$/);
  const xrefOffset = Number(startxrefMatch?.[1]);

  expect(pdf.startsWith('%PDF-')).toBe(true);
  expect(startxrefMatch).not.toBeNull();
  expect(Number.isInteger(xrefOffset)).toBe(true);
  expect(pdf.slice(xrefOffset, xrefOffset + 4)).toBe('xref');
  expect(pdf).toContain('trailer');
}

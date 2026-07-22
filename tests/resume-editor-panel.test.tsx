import { renderToStaticMarkup } from 'react-dom/server';

import { ResumeEditorPanel } from '@/components/resume-editor-panel';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

describe('ResumeEditorPanel', () => {
  it('keeps profile generation as the only AI extraction action and offers local corpus exports', () => {
    const html = renderToStaticMarkup(<ResumeEditorPanel files={[]} />);

    expect(html).toContain('G');
    expect(html).toContain('n');
    expect(html).toContain('rer le profil');
    expect(html).toContain('Exporter Markdown');
    expect(html).toContain('Exporter texte');
    expect(html).not.toContain('Extraire les sections');
    expect(html).not.toContain('Exporter PDF');
    expect(html).not.toContain('Exporter DOCX');
  });

  it('explains that importing a resume is optional when pasting a corpus', () => {
    const html = renderToStaticMarkup(<ResumeEditorPanel files={[]} />);

    expect(html).toContain('facultatif');
    expect(html).toContain('coller directement votre corpus');
    expect(html).toContain('modifier les sections dans le profil');
  });

  it('allows Markdown and native text uploads as corpus sources', () => {
    const html = renderToStaticMarkup(<ResumeEditorPanel files={[]} />);

    expect(html).toContain('Markdown');
    expect(html).toContain('TXT');
  });
});

import { richTextHtmlToMarkdown, richTextHtmlToServerPlainText } from '@/lib/rich-text/html';

describe('rich text corpus exports', () => {
  it('exports headings, emphasis and lists as Markdown', () => {
    const markdown = richTextHtmlToMarkdown(
      '<h2>Profil</h2><p><strong>Kevin</strong> <em>Esteves</em></p><ul><li>TypeScript</li><li>React</li></ul>',
    );

    expect(markdown).toBe('## Profil\n\n**Kevin** _Esteves_\n\n- TypeScript\n- React');
  });

  it('exports native text without formatting markup', () => {
    const text = richTextHtmlToServerPlainText('<h2>Profil</h2><p><strong>Developpeur</strong></p>');

    expect(text).toBe('Profil\nDeveloppeur');
  });
});

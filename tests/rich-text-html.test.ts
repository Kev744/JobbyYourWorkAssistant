/**
 * @jest-environment jsdom
 */

import {
  plainTextToRichTextHtml,
  richTextHtmlToPlainText,
  richTextHtmlToServerPlainText,
} from '@/lib/rich-text/html';

describe('rich text HTML conversion', () => {
  it('renders plain text as rich text blocks', () => {
    const html = plainTextToRichTextHtml(`Profile
Developpeur full-stack`);

    expect(html).toBe('<p>Profile</p><p>Developpeur full-stack</p>');
  });

  it('serializes edited rich text back to plain structured text', () => {
    const text = richTextHtmlToPlainText(
      '<h2>Profile</h2><p><strong>Developpeur</strong> full-stack</p><h2>Skills</h2><ul><li>TypeScript</li><li>Next.js</li></ul>',
    );

    expect(text).toBe(`Profile
Developpeur full-stack
Skills
- TypeScript
- Next.js`);
  });

  it('serializes rich text on the server without DOM APIs', () => {
    expect(
      richTextHtmlToServerPlainText('<h2>Profile</h2><p>Developpeur&nbsp;full-stack</p>'),
    ).toBe(`Profile
Developpeur full-stack`);
  });
});

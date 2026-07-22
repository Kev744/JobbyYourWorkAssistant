const BLOCK_TAG_PATTERN = /<\/?(?:div|p|h[1-6]|li|ul|ol|br)\b[^>]*>/i;

export function plainTextToRichTextHtml(value: string): string {
  if (!value.trim()) return '';

  return value
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `<p>${escapeHtml(line.trimEnd())}</p>` : '<p><br></p>'))
    .join('');
}

export function richTextHtmlToPlainText(html: string): string {
  if (!html.trim()) return '';

  if (!BLOCK_TAG_PATTERN.test(html)) {
    return decodeHtml(html).trim();
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  return Array.from(container.childNodes)
    .map((node) => nodeToPlainText(node))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function richTextHtmlToServerPlainText(html: string): string {
  if (!html.trim()) return '';

  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li)\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .split(/\r?\n/)
    .map((line) => decodeHtmlEntities(line).trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function richTextHtmlToMarkdown(html: string): string {
  if (!html.trim()) return '';

  if (!BLOCK_TAG_PATTERN.test(html)) {
    return decodeHtmlPortable(html).trim();
  }

  if (typeof document === 'undefined') {
    return htmlToMarkdownWithoutDom(html);
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  return Array.from(container.childNodes)
    .map((node) => nodeToMarkdown(node))
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function nodeToPlainText(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeWhitespace(node.textContent ?? '');
  }

  if (!(node instanceof HTMLElement)) return '';

  const tagName = node.tagName.toLowerCase();

  if (tagName === 'br') return '\n';

  if (tagName === 'ul' || tagName === 'ol') {
    return Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === 'li')
      .map((child) => `- ${inlineNodesToPlainText(child).trim()}`)
      .join('\n');
  }

  if (tagName === 'li') {
    return `- ${inlineNodesToPlainText(node).trim()}`;
  }

  if (tagName === 'div' || tagName === 'p' || /^h[1-6]$/.test(tagName)) {
    return inlineNodesToPlainText(node).trim();
  }

  return inlineNodesToPlainText(node);
}

function inlineNodesToPlainText(element: Element): string {
  return Array.from(element.childNodes)
    .map((child) => inlineNodeToPlainText(child))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function inlineNodeToPlainText(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeWhitespace(node.textContent ?? '');
  }

  if (!(node instanceof HTMLElement)) return '';
  if (node.tagName.toLowerCase() === 'br') return '\n';

  return Array.from(node.childNodes)
    .map((child) => inlineNodeToPlainText(child))
    .join('');
}

function nodeToMarkdown(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeWhitespace(node.textContent ?? '').trim();
  }

  if (!(node instanceof HTMLElement)) return '';

  const tagName = node.tagName.toLowerCase();

  if (tagName === 'br') return '\n';

  if (/^h[1-6]$/.test(tagName)) {
    const level = Number(tagName.slice(1));
    return `${'#'.repeat(level)} ${inlineNodesToMarkdown(node).trim()}`.trim();
  }

  if (tagName === 'ul') {
    return Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === 'li')
      .map((child) => `- ${inlineNodesToMarkdown(child).trim()}`)
      .join('\n');
  }

  if (tagName === 'ol') {
    return Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === 'li')
      .map((child, index) => `${index + 1}. ${inlineNodesToMarkdown(child).trim()}`)
      .join('\n');
  }

  if (tagName === 'li') {
    return `- ${inlineNodesToMarkdown(node).trim()}`;
  }

  if (tagName === 'div' || tagName === 'p') {
    return inlineNodesToMarkdown(node).trim();
  }

  return inlineNodesToMarkdown(node).trim();
}

function inlineNodesToMarkdown(element: Element): string {
  return Array.from(element.childNodes)
    .map((child) => inlineNodeToMarkdown(child))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function inlineNodeToMarkdown(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeWhitespace(node.textContent ?? '');
  }

  if (!(node instanceof HTMLElement)) return '';

  const tagName = node.tagName.toLowerCase();

  if (tagName === 'br') return '\n';

  const content = Array.from(node.childNodes)
    .map((child) => inlineNodeToMarkdown(child))
    .join('');

  if (!content.trim()) return '';
  if (tagName === 'strong' || tagName === 'b') return `**${content.trim()}**`;
  if (tagName === 'em' || tagName === 'i') return `_${content.trim()}_`;

  return content;
}

function htmlToMarkdownWithoutDom(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*h([1-6])\b[^>]*>([\s\S]*?)<\s*\/\s*h\1\s*>/gi, (_, level: string, content: string) =>
      `\n\n${'#'.repeat(Number(level))} ${inlineHtmlToMarkdown(content).trim()}\n\n`,
    )
    .replace(/<\s*li\b[^>]*>([\s\S]*?)<\s*\/\s*li\s*>/gi, (_, content: string) =>
      `- ${inlineHtmlToMarkdown(content).trim()}\n`,
    )
    .replace(/<\s*(p|div)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, (_, _tag: string, content: string) =>
      `\n\n${inlineHtmlToMarkdown(content).trim()}\n\n`,
    )
    .replace(/<\s*\/\s*(ul|ol)\s*>/gi, '\n\n')
    .replace(/<\s*(ul|ol)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .split(/\r?\n/)
    .map((line) => decodeHtmlEntities(line).trimEnd())
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inlineHtmlToMarkdown(value: string): string {
  return value
    .replace(/<\s*strong\b[^>]*>([\s\S]*?)<\s*\/\s*strong\s*>/gi, (_, content: string) =>
      `**${inlineHtmlToMarkdown(content).trim()}**`,
    )
    .replace(/<\s*b\b[^>]*>([\s\S]*?)<\s*\/\s*b\s*>/gi, (_, content: string) =>
      `**${inlineHtmlToMarkdown(content).trim()}**`,
    )
    .replace(/<\s*em\b[^>]*>([\s\S]*?)<\s*\/\s*em\s*>/gi, (_, content: string) =>
      `_${inlineHtmlToMarkdown(content).trim()}_`,
    )
    .replace(/<\s*i\b[^>]*>([\s\S]*?)<\s*\/\s*i\s*>/gi, (_, content: string) =>
      `_${inlineHtmlToMarkdown(content).trim()}_`,
    )
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, ' ');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtml(value: string): string {
  const element = document.createElement('textarea');
  element.innerHTML = value;

  return element.value;
}

function decodeHtmlPortable(value: string): string {
  return typeof document === 'undefined' ? decodeHtmlEntities(value) : decodeHtml(value);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

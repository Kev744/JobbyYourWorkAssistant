import { existsSync } from 'node:fs';

import PDFDocument from 'pdfkit';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_TOP_Y = 36;
const PDF_BOTTOM_Y = 805;
const PDF_LEFT_X = 50;
const PDF_RIGHT_X = 545;
const PDF_TEXT_WIDTH = PDF_RIGHT_X - PDF_LEFT_X;

export type ExportFormat = 'pdf' | 'docx';

export interface GeneratedDocument {
  bytes: Buffer;
  contentType: string;
  extension: ExportFormat;
}

type RenderAlignment = 'left' | 'center' | 'right' | 'justify';

interface RenderLine {
  text: string;
  align: RenderAlignment;
  kind: 'body' | 'heading' | 'jobTitle' | 'documentTitle' | 'bullet' | 'strong' | 'blank' | 'rule';
}

interface PdfFontNames {
  body: string;
  bold: string;
  title: string;
}

export function generateDocumentFromText(title: string, content: string, format: ExportFormat) {
  if (format === 'pdf') {
    return generatePdf(title, content);
  }

  return generateDocx(title, content);
}

export function normalizeCorpusText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function generatePdf(_title: string, content: string): GeneratedDocument {
  const sourceText = content;
  const lines = fitPdfPageLines(wrapLines(sourceText, 86));
  const document = new PDFDocument({
    size: 'A4',
    margin: 0,
    compress: false,
    font: null as unknown as string,
    info: {
      Producer: 'PDFKit',
      Creator: 'MatchingCV AI',
    },
  });
  let y = PDF_TOP_Y;

  const fonts = registerPdfFonts(document);

  for (const line of lines) {
    if (line.kind === 'blank') {
      y += pdfLineHeight(line);
      continue;
    }

    if (line.kind === 'rule') {
      document
        .save()
        .lineWidth(0.35)
        .moveTo(PDF_LEFT_X, y)
        .lineTo(PDF_RIGHT_X, y)
        .stroke()
        .restore();
      y += pdfLineHeight(line);
      continue;
    }

    document
      .font(pdfFontName(line, fonts))
      .fontSize(pdfFontSize(line))
      .text(line.text, PDF_LEFT_X, y, {
        width: PDF_TEXT_WIDTH,
        align: pdfAlignment(line),
        lineBreak: false,
      });
    y += pdfLineHeight(line);
  }

  document.end();
  const chunks: Buffer[] = [];
  let chunk: Buffer | string | null;

  while ((chunk = document.read() as Buffer | string | null) !== null) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const bytes = Buffer.concat(chunks);
  assertValidPdf(bytes);

  return {
    bytes,
    contentType: 'application/pdf',
    extension: 'pdf',
  };
}

function assertValidPdf(bytes: Buffer): void {
  const pdf = bytes.toString('latin1');
  const startxrefMatch = pdf.match(/startxref\s+(\d+)\s+%%EOF\s*$/);
  const xrefOffset = Number(startxrefMatch?.[1]);

  if (
    !pdf.startsWith('%PDF-') ||
    !startxrefMatch ||
    !Number.isInteger(xrefOffset) ||
    pdf.slice(xrefOffset, xrefOffset + 4) !== 'xref' ||
    !pdf.includes('trailer')
  ) {
    throw new Error('Generated PDF is malformed.');
  }
}

function registerPdfFonts(document: PDFKit.PDFDocument): PdfFontNames {
  const actualPath: string = process.cwd();
  const fonts: Array<{
    key: keyof PdfFontNames;
    name: string;
    paths: string[];
  }> = [
    {
      key: 'body',
      name: 'Arial',
      paths: [`${actualPath}/src/assets/fonts/arial.ttf`],
    },
    {
      key: 'bold',
      name: 'Arial-Bold',
      paths: [
        `${actualPath}/src/assets/fonts/arialbd.ttf`,
        `${actualPath}/src/assets/fonts/arial.ttf`,
      ],
    },
    {
      key: 'title',
      name: 'Cambria-Bold',
      paths: [
        `${actualPath}/src/assets/fonts/cambriab.ttf`,
        `${actualPath}/src/assets/fonts/arialbd.ttf`,
        `${actualPath}/src/assets/fonts/arial.ttf`
      ],
    },
  ];
  const names = {} as PdfFontNames;

  for (const font of fonts) {
    const fontPath = font.paths.find((path) => existsSync(path));

    if (!fontPath) {
      throw new Error(`Missing PDF font file for ${font.name}.`);
    }

    document.registerFont(font.name, fontPath);
    names[font.key] = font.name;
  }

  return names;
}

function fitPdfPageLines(lines: RenderLine[]): RenderLine[] {
  const output: RenderLine[] = [];
  let y = PDF_TOP_Y;

  for (const line of lines) {
    const nextY = y + pdfLineHeight(line);

    if (nextY > PDF_BOTTOM_Y) {
      break;
    }

    output.push(line);
    y = nextY;
  }

  return output;
}

function generateDocx(_title: string, content: string): GeneratedDocument {
  const sourceText = content;
  const paragraphs = parseRenderLines(sourceText).map(renderDocxParagraph);
  const files = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="https://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    {
      name: 'word/document.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join('\n')}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>
  </w:body>
</w:document>`,
    },
  ];

  const bytes = createZip(files);
  assertValidDocx(bytes);

  return {
    bytes,
    contentType: DOCX_CONTENT_TYPE,
    extension: 'docx',
  };
}

function assertValidDocx(bytes: Buffer): void {
  if (bytes.length < 22) {
    throw new Error('Generated DOCX is malformed.');
  }

  if (bytes.subarray(0, 2).toString('latin1') !== 'PK') {
    throw new Error('Generated DOCX is malformed.');
  }

  const eocdOffset = findZipEndOfCentralDirectory(bytes);

  if (eocdOffset < 0) {
    throw new Error('Generated DOCX is malformed.');
  }

  const fileCount = bytes.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = bytes.readUInt32LE(eocdOffset + 16);
  const centralDirectoryEntries = new Set<string>();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < fileCount; index += 1) {
    if (offset + 46 > bytes.length) {
      throw new Error('Generated DOCX is malformed.');
    }

    if (bytes.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Generated DOCX is malformed.');
    }

    const fileNameLength = bytes.readUInt16LE(offset + 28);
    const extraFieldLength = bytes.readUInt16LE(offset + 30);
    const fileCommentLength = bytes.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    const nextOffset = offset + 46 + fileNameLength + extraFieldLength + fileCommentLength;

    if (nameEnd > bytes.length) {
      throw new Error('Generated DOCX is malformed.');
    }

    centralDirectoryEntries.add(bytes.subarray(nameStart, nameEnd).toString('utf8'));
    offset = nextOffset;
  }

  if (
    !centralDirectoryEntries.has('[Content_Types].xml') ||
    !centralDirectoryEntries.has('_rels/.rels') ||
    !centralDirectoryEntries.has('word/document.xml')
  ) {
    throw new Error('Generated DOCX is malformed.');
  }
}

function findZipEndOfCentralDirectory(bytes: Buffer): number {
  if (bytes.length < 22) return -1;

  const minimumOffset = Math.max(0, bytes.length - 65_557);

  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function createZip(files: Array<{ name: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const content = Buffer.from(file.content, 'utf8');
    const crc = crc32(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function wrapLines(text: string, maxLength: number): RenderLine[] {
  return parseRenderLines(text).flatMap((renderLine) => {
    const words = renderLine.text.split(/\s+/).filter(Boolean);
    const output: RenderLine[] = [];
    let current = '';

    for (const word of words) {
      if (`${current} ${word}`.trim().length > maxLength) {
        if (current) output.push({ ...renderLine, text: current });
        current = word;
      } else {
        current = `${current} ${word}`.trim();
      }
    }

    output.push({ ...renderLine, text: current });
    return output;
  });
}

function parseRenderLines(text: string): RenderLine[] {
  const lines = normalizeCorpusText(text).split('\n');
  const output: RenderLine[] = [];
  let blockAlign: RenderAlignment = 'left';

  for (const line of lines) {
    const trimmed = line.trim();
    const openingBlock = trimmed.match(/^<div\s+align=["'](left|center|right|justify)["']>\s*$/i);
    const closingBlock = /^<\/div>\s*$/i.test(trimmed);

    if (openingBlock) {
      blockAlign = normalizeAlignment(openingBlock[1]);
      continue;
    }

    if (closingBlock) {
      blockAlign = 'left';
      continue;
    }

    output.push(toRenderLine(line, blockAlign));
  }

  return output;
}

function toRenderLine(line: string, defaultAlign: RenderAlignment = 'left'): RenderLine {
  const trimmed = line.trim();
  const alignedParagraph = trimmed.match(
    /^<p\s+align=["'](left|center|right|justify)["']>\s*(.*?)\s*<\/p>$/i,
  );

  if (alignedParagraph) {
    const align = normalizeAlignment(alignedParagraph[1]);
    return {
      text: cleanDisplayMarkup(alignedParagraph[2] ?? ''),
      align,
      kind: align === 'center' ? 'jobTitle' : 'body',
    };
  }

  if (!trimmed) {
    return {
      text: '',
      align: defaultAlign,
      kind: 'blank',
    };
  }

  if (trimmed === '---') {
    return {
      text: '',
      align: 'left',
      kind: 'rule',
    };
  }

  if (trimmed.startsWith('### ')) {
    return {
      text: cleanDisplayMarkup(trimmed.replace(/^###\s*/, '')),
      align: 'left',
      kind: 'heading',
    };
  }

  if (/^\*\*.+\*\*$/.test(trimmed)) {
    return {
      text: cleanDisplayMarkup(trimmed),
      align: defaultAlign,
      kind: 'strong',
    };
  }

  return {
    text: cleanDisplayMarkup(line),
    align: defaultAlign,
    kind: trimmed.startsWith('- ') ? 'bullet' : 'body',
  };
}

function cleanDisplayMarkup(value: string): string {
  return value
    .replace(/<\/?div[^>]*>/gi, '')
    .replace(/<\/?p[^>]*>/gi, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();
}

function normalizeAlignment(value: string | undefined): RenderAlignment {
  if (value === 'center' || value === 'right' || value === 'justify') return value;

  return 'left';
}

function pdfAlignment(line: RenderLine): 'left' | 'center' | 'right' | 'justify' {
  return line.align;
}

function pdfFontSize(line: RenderLine): number {
  if (line.kind === 'jobTitle') return 14;
  if (line.kind === 'heading') return 11;
  if (line.kind === 'documentTitle') return 12;

  return 8.8;
}

function pdfFontName(line: RenderLine, fonts: PdfFontNames): string {
  if (['documentTitle', 'heading', 'jobTitle'].includes(line.kind)) return fonts.title;
  if (line.kind === 'strong') return fonts.bold;

  return fonts.body;
}

function pdfLineHeight(line: RenderLine): number {
  if (line.kind === 'blank') return 6;
  if (line.kind === 'rule') return 10;
  if (line.kind === 'jobTitle') return 18;
  if (line.kind === 'heading') return 15;

  return 11.5;
}

function renderDocxParagraph(line: RenderLine): string {
  if (line.kind === 'rule') {
    return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="B8C0CC"/></w:pBdr><w:spacing w:before="80" w:after="80"/></w:pPr></w:p>';
  }

  const alignment = docxAlignment(line.align);
  const spacing = docxSpacing(line);
  const paragraphProperties = `<w:pPr>${alignment}${spacing}</w:pPr>`;
  const fontFamily = docxFontFamily(line);
  const runProperties = `<w:rPr><w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}" w:cs="${fontFamily}"/><w:sz w:val="${docxFontSize(line)}"/>${docxBold(line)}</w:rPr>`;

  return `<w:p>${paragraphProperties}<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(line.text || ' ')}</w:t></w:r></w:p>`;
}

function docxAlignment(align: RenderAlignment): string {
  if (align === 'center') return '<w:jc w:val="center"/>';
  if (align === 'right') return '<w:jc w:val="right"/>';
  if (align === 'justify') return '<w:jc w:val="both"/>';

  return '';
}

function docxFontSize(line: RenderLine): number {
  if (line.kind === 'jobTitle') return 28;
  if (line.kind === 'heading') return 23;
  if (line.kind === 'documentTitle') return 24;

  return 19;
}

function docxFontFamily(line: RenderLine): string {
  return ['documentTitle', 'heading', 'jobTitle'].includes(line.kind) ? 'Cambria' : 'Arial';
}

function docxBold(line: RenderLine): string {
  return ['documentTitle', 'heading', 'jobTitle', 'strong'].includes(line.kind)
    ? '<w:b/>'
    : '';
}

function docxSpacing(line: RenderLine): string {
  if (line.kind === 'blank') return '<w:spacing w:after="40"/>';
  if (line.kind === 'heading') return '<w:spacing w:before="160" w:after="60"/>';
  if (line.kind === 'jobTitle') return '<w:spacing w:before="100" w:after="120"/>';

  return '<w:spacing w:after="35"/>';
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}



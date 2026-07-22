import { inflateRawSync, inflateSync } from 'node:zlib';

import { normalizeCorpusText } from '@/lib/export/simple-documents';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TEXT_CORPUS_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/markdown',
]);

export interface ExtractedResumeText {
  text: string;
  warnings: string[];
}

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface PdfStream {
  objectNumber: number | null;
  dictionary: string;
  content: Buffer;
}

export function extractResumeTextFromBuffer(params: {
  bytes: Buffer;
  mimeType: string;
}): ExtractedResumeText {
  if (TEXT_CORPUS_MIME_TYPES.has(params.mimeType)) {
    return extractTextCorpus(params.bytes);
  }

  if (params.mimeType === DOCX_CONTENT_TYPE) {
    return extractDocxText(params.bytes);
  }

  if (params.mimeType === 'application/pdf') {
    return extractPdfText(params.bytes);
  }

  if (params.mimeType.startsWith('image/')) {
    return {
      text: '',
      warnings: ['Extraction locale impossible pour une image : OCR requis.'],
    };
  }

  return {
    text: '',
    warnings: ['Format non pris en charge pour l’extraction automatique.'],
  };
}

function extractTextCorpus(bytes: Buffer): ExtractedResumeText {
  const text = normalizeCorpusText(bytes.toString('utf8'));

  return {
    text,
    warnings: text ? [] : ['Aucun texte exploitable trouvé dans le fichier texte.'],
  };
}

function extractDocxText(bytes: Buffer): ExtractedResumeText {
  try {
    const documentXml = readZipFile(bytes, 'word/document.xml')?.toString('utf8');

    if (!documentXml) {
      return { text: '', warnings: ['Texte DOCX introuvable.'] };
    }

    const paragraphs = Array.from(documentXml.matchAll(/<w:p[\s\S]*?<\/w:p>/g))
      .map((paragraphMatch) =>
        Array.from(paragraphMatch[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
          .map((textMatch) => decodeXml(textMatch[1] ?? ''))
          .join(''),
      )
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    const text = normalizeCorpusText(paragraphs.join('\n'));

    return {
      text,
      warnings: text ? [] : ['Aucun texte exploitable trouvé dans le DOCX.'],
    };
  } catch {
    return {
      text: '',
      warnings: ['Impossible d’extraire le texte du DOCX.'],
    };
  }
}

function extractPdfText(bytes: Buffer): ExtractedResumeText {
  try {
    const streams = extractPdfStreams(bytes);
    const unicodeMaps = buildPdfFontUnicodeMaps(bytes, streams);
    const fallbackUnicodeMap = buildPdfToUnicodeMap(streams.map((stream) => stream.content));
    const lines = streams.flatMap((stream) =>
      extractPdfTextLines(stream.content, unicodeMaps, fallbackUnicodeMap),
    );
    const text = normalizeCorpusText(lines.join('\n'));

    return {
      text,
      warnings: text ? [] : ['Aucun texte exploitable trouvé dans le PDF.'],
    };
  } catch {
    return {
      text: '',
      warnings: ['Impossible d’extraire le texte du PDF.'],
    };
  }
}

function readZipFile(zip: Buffer, fileName: string): Buffer | null {
  const entry = readZipEntries(zip).find((item) => item.name === fileName);

  if (!entry) return null;

  const localSignature = zip.readUInt32LE(entry.localHeaderOffset);

  if (localSignature !== 0x04034b50) {
    throw new Error('Invalid local ZIP header.');
  }

  const fileNameLength = zip.readUInt16LE(entry.localHeaderOffset + 26);
  const extraLength = zip.readUInt16LE(entry.localHeaderOffset + 28);
  const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressed = zip.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressed;
  }

  if (entry.compressionMethod === 8) {
    const inflated = inflateRawSync(compressed);

    if (entry.uncompressedSize > 0 && inflated.length !== entry.uncompressedSize) {
      throw new Error('Invalid inflated ZIP entry length.');
    }

    return inflated;
  }

  throw new Error('Unsupported ZIP compression method.');
}

function readZipEntries(zip: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(zip);

  if (eocdOffset < 0) {
    throw new Error('Invalid DOCX ZIP.');
  }

  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = zip.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid central ZIP header.');
    }

    const compressionMethod = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const fileNameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(zip: Buffer): number {
  const minimumOffset = Math.max(0, zip.length - 65_557);

  for (let offset = zip.length - 22; offset >= minimumOffset; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function extractPdfStreams(pdf: Buffer): PdfStream[] {
  const source = pdf.toString('latin1');
  const streams: PdfStream[] = [];
  const objectPattern = /(?:^|\r?\n)(\d+)\s+\d+\s+obj([\s\S]*?)endobj/g;
  let match: RegExpExecArray | null;

  while ((match = objectPattern.exec(source))) {
    const objectNumber = Number.parseInt(match[1] ?? '0', 10);
    const body = match[2] ?? '';
    const streamMatch = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/.exec(body);

    if (!streamMatch) continue;

    const dictionary = streamMatch[1] ?? '';
    const rawStream = Buffer.from(streamMatch[2] ?? '', 'latin1');
    const content = /\/FlateDecode\b/.test(dictionary) ? inflateSync(rawStream) : rawStream;

    streams.push({ objectNumber, dictionary, content });
  }

  return streams;
}

function extractPdfTextLines(
  stream: Buffer,
  unicodeMaps: Map<string, Map<string, string>>,
  fallbackUnicodeMap: Map<string, string>,
): string[] {
  const content = stream.toString('latin1');

  if (!/\/F\d+\s+[\d.]+\s+Tf/.test(content)) {
    return [];
  }

  const textObjects = Array.from(content.matchAll(/BT([\s\S]*?)ET/g)).map((match) => match[1] ?? '');

  if (textObjects.length > 0) {
    return textObjects
      .map((textObject) =>
        extractPdfTextObjectText(textObject, unicodeMaps, fallbackUnicodeMap),
      )
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const lines: string[] = [];
  let currentLine: string[] = [];

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (character === '(') {
      const parsed = readPdfLiteralString(content, index);
      currentLine.push(parsed.value);
      index = parsed.endIndex;
      continue;
    }

    if (content.startsWith(' Td', index) || content.startsWith(' TD', index)) {
      if (currentLine.length > 0) {
        lines.push(currentLine.join('').trim());
        currentLine = [];
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine.join('').trim());
  }

  return lines.filter(Boolean);
}

function extractPdfTextObjectText(
  content: string,
  unicodeMaps: Map<string, Map<string, string>>,
  fallbackUnicodeMap: Map<string, string>,
): string {
  const parts: string[] = [];
  const tokenPattern = /\/(F\d+)\s+[\d.]+\s+Tf|\((?:\\.|[^\\)])*\)|<([0-9a-fA-F]+)>/g;
  let currentUnicodeMap = fallbackUnicodeMap;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(content))) {
    if (match[1]) {
      currentUnicodeMap = unicodeMaps.get(match[1]) ?? fallbackUnicodeMap;
      continue;
    }

    const token = match[0];

    if (token.startsWith('(')) {
      parts.push(readPdfLiteralString(token, 0).value);
      continue;
    }

    if (match[2]) {
      parts.push(decodePdfHexText(match[2], currentUnicodeMap));
    }
  }

  return parts.join('');
}

function buildPdfFontUnicodeMaps(pdf: Buffer, streams: PdfStream[]): Map<string, Map<string, string>> {
  const source = pdf.toString('latin1');
  const streamByObjectNumber = new Map<number, PdfStream>();
  const fontObjectByResourceName = new Map<string, number>();
  const fontMaps = new Map<string, Map<string, string>>();

  for (const stream of streams) {
    if (stream.objectNumber !== null) {
      streamByObjectNumber.set(stream.objectNumber, stream);
    }
  }

  for (const fontMatch of source.matchAll(/\/(F\d+)\s+(\d+)\s+\d+\s+R/g)) {
    fontObjectByResourceName.set(fontMatch[1] ?? '', Number.parseInt(fontMatch[2] ?? '0', 10));
  }

  for (const [resourceName, fontObjectNumber] of fontObjectByResourceName) {
    const fontDictionary = extractPdfObjectDictionary(source, fontObjectNumber);
    const toUnicodeObjectNumber = Number.parseInt(
      fontDictionary.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/)?.[1] ?? '',
      10,
    );
    const toUnicodeStream = streamByObjectNumber.get(toUnicodeObjectNumber);

    if (toUnicodeStream) {
      fontMaps.set(resourceName, buildPdfToUnicodeMap([toUnicodeStream.content]));
    }
  }

  return fontMaps;
}

function extractPdfObjectDictionary(source: string, objectNumber: number): string {
  const objectMatch = new RegExp(
    `(?:^|\\r?\\n)${objectNumber}\\s+\\d+\\s+obj\\s*<<([\\s\\S]*?)>>`,
  ).exec(source);

  return objectMatch?.[1] ?? '';
}

function buildPdfToUnicodeMap(streams: Buffer[]): Map<string, string> {
  const unicodeMap = new Map<string, string>();

  for (const stream of streams) {
    const content = stream.toString('latin1');
    const rangeBlocks = content.matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]\s*endbfrange/g,
    );

    for (const rangeBlock of rangeBlocks) {
      const start = parseInt(rangeBlock[1] ?? '', 16);
      const end = parseInt(rangeBlock[2] ?? '', 16);
      const values = Array.from((rangeBlock[3] ?? '').matchAll(/<([0-9a-fA-F]+)>/g)).map(
        (valueMatch) => valueMatch[1] ?? '',
      );

      for (let code = start; code <= end; code += 1) {
        const value = values[code - start];

        if (value) {
          unicodeMap.set(code.toString(16).padStart(4, '0').toLowerCase(), decodeUtf16BeHex(value));
        }
      }
    }

    const charMappings = content.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g);

    for (const charMapping of charMappings) {
      const source = (charMapping[1] ?? '').toLowerCase();
      const target = charMapping[2] ?? '';

      if (source && target && !unicodeMap.has(source)) {
        unicodeMap.set(source, decodeUtf16BeHex(target));
      }
    }
  }

  return unicodeMap;
}

function decodePdfHexText(hex: string, unicodeMap: Map<string, string>): string {
  if (!hex) return '';

  const chunks = hex.match(/.{1,4}/g) ?? [];

  return chunks
    .map((chunk) => unicodeMap.get(chunk.toLowerCase().padStart(4, '0')) ?? decodeUtf16BeHex(chunk))
    .join('');
}

function decodeUtf16BeHex(hex: string): string {
  const normalizedHex = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = Buffer.from(normalizedHex, 'hex');

  if (bytes.length === 0) return '';
  if (bytes.length === 1) return String.fromCharCode(bytes[0] ?? 0);

  const characters: string[] = [];

  for (let index = 0; index < bytes.length; index += 2) {
    characters.push(String.fromCharCode(bytes.readUInt16BE(index)));
  }

  return characters.join('');
}

function readPdfLiteralString(content: string, startIndex: number): {
  value: string;
  endIndex: number;
} {
  let depth = 1;
  let value = '';

  for (let index = startIndex + 1; index < content.length; index += 1) {
    const character = content[index];

    if (character === '\\') {
      const next = content[index + 1];
      const escaped = decodePdfEscape(next);
      value += escaped.value;
      index += escaped.consumed;
      continue;
    }

    if (character === '(') {
      depth += 1;
      value += character;
      continue;
    }

    if (character === ')') {
      depth -= 1;

      if (depth === 0) {
        return { value, endIndex: index };
      }

      value += character;
      continue;
    }

    value += character;
  }

  return { value, endIndex: content.length - 1 };
}

function decodePdfEscape(value: string | undefined): { value: string; consumed: number } {
  if (!value) return { value: '', consumed: 0 };

  if (value === 'n') return { value: '\n', consumed: 1 };
  if (value === 'r') return { value: '\r', consumed: 1 };
  if (value === 't') return { value: '\t', consumed: 1 };
  if (value === 'b') return { value: '\b', consumed: 1 };
  if (value === 'f') return { value: '\f', consumed: 1 };

  return { value, consumed: 1 };
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

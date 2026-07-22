import type { CandidateProfile, EducationItem } from '@/types';

type ProfessionalExperienceItem = CandidateProfile['professionalExperiences'][number];

interface ParsedLine {
  content: string;
  isListItem: boolean;
  isBlank: boolean;
}

interface DateRange {
  startDate?: string;
  endDate?: string;
}

const DATE_PATTERN = String.raw`(?:\b(?:19|20)\d{2}\b|\b(?:0?[1-9]|1[0-2])\/(?:19|20)\d{2}\b|\b(?:janvier|janv\.?|f(?:e|\u00e9)vrier|f(?:e|\u00e9)vr\.?|mars|avril|avr\.?|mai|juin|juillet|juil\.?|aout|ao\u00fbt|septembre|sept\.?|octobre|oct\.?|novembre|nov\.?|d(?:e|\u00e9)cembre|d(?:e|\u00e9)c\.?)\s+(?:19|20)\d{2}\b)`;
const PRESENT_PATTERN = String.raw`(?:present|pr(?:e|\u00e9)sent|actuel|aujourd(?:'|\u2019|\u02bc)?hui|maintenant|en cours)`;
const DATE_RANGE_SEPARATOR_PATTERN = String.raw`(?:\s*(?:-|\u2013|\u2014|\||\/)\s*|\s+(?:a|\u00e0|au|to|jusqu(?:'|\u2019)?a|jusqu(?:'|\u2019)?\u00e0)\s+)`;
const DATE_RANGE_REGEX = new RegExp(
  String.raw`(?:\b(?:depuis|since)\s+(${DATE_PATTERN}))|(?:(${DATE_PATTERN})${DATE_RANGE_SEPARATOR_PATTERN}(${DATE_PATTERN}|${PRESENT_PATTERN}))`,
  'i',
);
const YEAR_REGEX = /\b(?:19|20)\d{2}\b/;
const COMPANY_CONNECTOR_REGEX = /\s+(?:chez|at|for|pour)\s+/i;

export function extractProfessionalExperiences(value: string): ProfessionalExperienceItem[] {
  return groupExperienceLines(parseSectionLines(value)).map(parseExperienceBlock).filter(hasExperienceContent);
}

export function extractEducationItems(value: string): EducationItem[] {
  return groupEducationLines(parseSectionLines(value)).map(parseEducationBlock).filter(hasEducationContent);
}

function parseSectionLines(value: string): ParsedLine[] {
  return value.split(/\r?\n/).map((rawLine) => {
    const trimmed = rawLine.trim();
    const listMatch = trimmed.match(/^[-*\u2022]\s+(.*)$/);

    return {
      content: (listMatch?.[1] ?? trimmed).trim(),
      isListItem: Boolean(listMatch),
      isBlank: trimmed.length === 0,
    };
  });
}

function groupExperienceLines(lines: ParsedLine[]): ParsedLine[][] {
  const blocks: ParsedLine[][] = [];
  let current: ParsedLine[] = [];

  for (const line of lines) {
    if (line.isBlank) {
      pushBlock(blocks, current);
      current = [];
      continue;
    }

    if (shouldStartExperienceBlock(current, line)) {
      pushBlock(blocks, current);
      current = [];
    }

    current.push(line);
  }

  pushBlock(blocks, current);

  return blocks;
}

function groupEducationLines(lines: ParsedLine[]): ParsedLine[][] {
  const blocks: ParsedLine[][] = [];
  let current: ParsedLine[] = [];

  for (const line of lines) {
    if (line.isBlank) {
      pushBlock(blocks, current);
      current = [];
      continue;
    }

    if (shouldStartEducationBlock(current, line)) {
      pushBlock(blocks, current);
      current = [];
    }

    current.push(line);
  }

  pushBlock(blocks, current);

  return blocks;
}

function pushBlock(blocks: ParsedLine[][], block: ParsedLine[]): void {
  const cleanBlock = block.filter((line) => line.content.length > 0);

  if (cleanBlock.length > 0) blocks.push(cleanBlock);
}

function shouldStartExperienceBlock(current: ParsedLine[], next: ParsedLine): boolean {
  if (current.length === 0) return false;
  if (next.isListItem && isLikelyExperienceHeader(next.content)) return true;
  if (current.length === 1 && isCompactExperienceLine(current[0]?.content) && isCompactExperienceLine(next.content)) {
    return true;
  }
  if (hasDateRange(current) && hasDateSignal(next.content) && isLikelyExperienceHeader(next.content)) {
    return true;
  }

  return current.length >= 3 && isLikelyExperienceHeader(next.content) && !isLikelyContinuation(next.content);
}

function shouldStartEducationBlock(current: ParsedLine[], next: ParsedLine): boolean {
  if (current.length === 0) return false;
  if (next.isListItem && (hasEducationSignal(next.content) || isLikelySchoolLine(next.content))) return true;

  const currentText = joinBlock(current);
  const currentHasDegree = hasEducationSignal(currentText);
  const currentHasSchool = isLikelySchoolLine(currentText);
  const currentHasDate = hasDateSignal(currentText);
  const nextHasDegree = hasEducationSignal(next.content);
  const nextHasSchool = isLikelySchoolLine(next.content);

  if (currentHasDegree && currentHasSchool && (nextHasDegree || nextHasSchool)) return true;
  if (currentHasDegree && currentHasDate && nextHasDegree) return true;
  if (currentHasSchool && currentHasDate && nextHasSchool) return true;

  return false;
}

function parseExperienceBlock(block: ParsedLine[]): ProfessionalExperienceItem {
  const lines = block.map((line) => line.content);
  const companySummaryItem = parseCompanySummaryBlock(lines);

  if (companySummaryItem) return companySummaryItem;

  const blockText = lines.join('\n');
  const dateRange = extractDateRange(blockText);
  const headerLine = selectExperienceHeaderLine(lines);
  const titleRaw = cleanExperienceTitle(headerLine);
  const companyName = extractCompanyName(lines, headerLine, titleRaw);
  const summary = cleanProfessionalExperienceSummary(lines.join('\n'), {
    titleRaw,
    companyName,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  return {
    titleRaw: titleRaw || summary || '',
    companyName,
    summary,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  };
}

function parseCompanySummaryBlock(lines: string[]): ProfessionalExperienceItem | null {
  if (lines.length !== 1) return null;

  const line = lines[0] ?? '';
  const parts = splitMeaningfulParts(line);

  if (parts.length !== 2) return null;
  if (hasDateSignal(line) || hasExperienceRoleSignal(line)) return null;

  const [companyName, summary] = parts;

  if (!isLikelyCompanyName(companyName) || !summary) return null;

  return {
    titleRaw: '',
    companyName,
    summary,
  };
}

export function cleanProfessionalExperienceSummary(
  value: string | undefined,
  metadata: {
    titleRaw?: string;
    companyName?: string;
    location?: string;
    startDate?: string;
    endDate?: string | null;
  },
): string | undefined {
  const lines = (value ?? '')
    .split(/\r?\n/)
    .map((line) => cleanExperienceSummaryLine(line, metadata))
    .filter(Boolean);

  return lines.join('\n') || undefined;
}

function parseEducationBlock(block: ParsedLine[]): EducationItem {
  const lines = block.map((line) => line.content);
  const parts = lines.flatMap(splitMeaningfulParts);
  const graduationDate = extractGraduationDate(lines.join(' '));
  const schoolName = parts.find(isLikelySchoolLine);
  const degreeParts = parts.filter((part) => {
    if (part === schoolName) return false;
    if (part === graduationDate) return false;

    return hasEducationSignal(part) || !YEAR_REGEX.test(part);
  });
  const degreeLabel = selectDegreeLabel(degreeParts, parts, schoolName, graduationDate);

  return {
    degreeLabel,
    schoolName,
    graduationDate: graduationDate || undefined,
  };
}

function selectExperienceHeaderLine(lines: string[]): string {
  const withRole = lines.find((line) => hasExperienceRoleSignal(line));

  if (withRole) return withRole;

  return lines.find((line) => !isDateOnlyLine(line)) ?? lines[0] ?? '';
}

function cleanExperienceTitle(value: string): string {
  const withoutDate = removeDateRange(value).replace(YEAR_REGEX, '').trim();
  const parts = splitMeaningfulParts(withoutDate);
  const rolePart = parts.find(hasExperienceRoleSignal);

  return cleanRoleTitle(rolePart ?? parts[0] ?? withoutDate);
}

function selectDegreeLabel(
  degreeParts: string[],
  allParts: string[],
  schoolName: string | undefined,
  graduationDate: string,
): string | undefined {
  const explicitDegree = degreeParts.find(hasEducationSignal);

  if (explicitDegree) return explicitDegree;

  return allParts.find((part) => part !== schoolName && part !== graduationDate && !isLikelySchoolLine(part));
}

function splitMeaningfulParts(value: string): string[] {
  return value
    .split(/\s[-\u2013\u2014|]\s|,\s+|\s{2,}/)
    .map((part) => removeDateRange(part).trim())
    .filter(Boolean);
}

function isCompactExperienceLine(value: string | undefined): boolean {
  if (!value || hasDateSignal(value)) return false;

  const parts = splitMeaningfulParts(value);
  const roleIndex = parts.findIndex(hasExperienceRoleSignal);

  if (roleIndex < 0) return false;

  const companyCandidate = parts[roleIndex + 1] ?? parts[roleIndex - 1];

  return isLikelyCompanyName(companyCandidate);
}

function extractDateRange(value: string): DateRange {
  const match = value.match(DATE_RANGE_REGEX);

  if (!match) return {};

  if (match[1]) {
    return {
      startDate: cleanDateValue(match[1]),
      endDate: "Aujourd'hui",
    };
  }

  return {
    startDate: cleanDateValue(match[2]),
    endDate: cleanDateValue(match[3]),
  };
}

function extractCompanyName(lines: string[], headerLine: string, titleRaw: string): string | undefined {
  const headerCompany = extractCompanyFromHeaderLine(headerLine, titleRaw);

  if (headerCompany) return headerCompany;

  const headerIndex = lines.indexOf(headerLine);
  const linesAfterHeader = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines.slice(1);
  const linesBeforeHeader = headerIndex > 0 ? lines.slice(0, headerIndex).reverse() : [];
  const linesAfterHeaderBeforeDates = linesAfterHeader.slice(0, firstDateLineIndex(linesAfterHeader));
  const candidateLines =
    headerIndex > 0 ? [...linesBeforeHeader, ...linesAfterHeaderBeforeDates] : linesAfterHeaderBeforeDates;

  return candidateLines.map(cleanCompanyCandidate).find(isLikelyCompanyName);
}

function firstDateLineIndex(lines: string[]): number {
  const dateIndex = lines.findIndex(hasDateSignal);

  return dateIndex >= 0 ? dateIndex : lines.length;
}

function extractCompanyFromHeaderLine(headerLine: string, titleRaw: string): string | undefined {
  const withoutDate = removeDateRange(headerLine).replace(YEAR_REGEX, '').trim();
  const connectorMatch = withoutDate.match(COMPANY_CONNECTOR_REGEX);

  if (connectorMatch?.index !== undefined) {
    const companyCandidate = withoutDate.slice(connectorMatch.index + connectorMatch[0].length);
    const firstCompanyPart = splitMeaningfulParts(companyCandidate)[0] ?? companyCandidate;
    const cleanedCompany = cleanCompanyCandidate(firstCompanyPart);

    if (isLikelyCompanyName(cleanedCompany)) return cleanedCompany;
  }

  const parts = splitMeaningfulParts(withoutDate);
  const roleIndex = parts.findIndex((part) => hasExperienceRoleSignal(part) || sameNormalizedText(part, titleRaw));

  if (roleIndex < 0) return undefined;

  const adjacentCandidates = [parts[roleIndex + 1], parts[roleIndex - 1]];

  return adjacentCandidates.map(cleanCompanyCandidate).find(isLikelyCompanyName);
}

function cleanRoleTitle(value: string): string {
  return value.split(COMPANY_CONNECTOR_REGEX)[0]?.trim() ?? value.trim();
}

function cleanExperienceSummaryLine(
  value: string,
  metadata: {
    titleRaw?: string;
    companyName?: string;
    location?: string;
    startDate?: string;
    endDate?: string | null;
  },
): string {
  const line = value.trim();

  if (!line) return '';
  if (!metadataResidue(line, metadata)) return '';

  const parts = splitMeaningfulParts(line);
  const keptParts = parts.filter((part) => metadataResidue(part, metadata));

  if (parts.length > 1 && keptParts.length < parts.length) {
    return keptParts.join(' - ');
  }

  return stripLeadingMetadata(line, metadata);
}

function stripLeadingMetadata(
  value: string,
  metadata: {
    titleRaw?: string;
    companyName?: string;
    location?: string;
    startDate?: string;
    endDate?: string | null;
  },
): string {
  let cleaned = value.trim();

  for (const metadataValue of [metadata.titleRaw, metadata.companyName, metadata.location]) {
    if (!metadataValue) continue;

    cleaned = cleaned.replace(new RegExp(`^${escapeRegExp(metadataValue)}\\s*[:\\-–—|,/]*\\s*`, 'i'), '');
  }

  return cleaned.trim();
}

function metadataResidue(
  value: string,
  metadata: {
    titleRaw?: string;
    companyName?: string;
    location?: string;
    startDate?: string;
    endDate?: string | null;
  },
): string {
  let residue = removeDateRange(value).replace(YEAR_REGEX, '');

  for (const metadataValue of [metadata.titleRaw, metadata.companyName, metadata.location]) {
    if (!metadataValue) continue;

    residue = residue.replace(new RegExp(escapeRegExp(metadataValue), 'gi'), '');
  }

  return residue
    .replace(COMPANY_CONNECTOR_REGEX, ' ')
    .replace(/[-\u2013\u2014|,/():\s]+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanCompanyCandidate(value: string | undefined): string {
  if (!value) return '';

  const withoutDate = cleanBoundarySeparators(removeDateRange(value).replace(YEAR_REGEX, ''));
  const withoutPrefix = withoutDate.replace(/^(?:chez|at|for|pour)\s+/i, '').trim();
  const parts = splitMeaningfulParts(withoutPrefix);

  return (parts.find((part) => !hasExperienceRoleSignal(part)) ?? withoutPrefix).trim();
}

function cleanBoundarySeparators(value: string): string {
  return value.replace(/^[-\u2013\u2014|,/()\s]+|[-\u2013\u2014|,/()\s]+$/g, '').trim();
}

function extractGraduationDate(value: string): string {
  return value.match(YEAR_REGEX)?.[0] ?? '';
}

function cleanDateValue(value: string | undefined): string | undefined {
  if (!value) return undefined;

  return value.replace(/\s+/g, ' ').trim();
}

function removeDateRange(value: string): string {
  return value.replace(DATE_RANGE_REGEX, '').trim();
}

function hasDateRange(lines: ParsedLine[]): boolean {
  return DATE_RANGE_REGEX.test(joinBlock(lines));
}

function hasDateSignal(value: string): boolean {
  return DATE_RANGE_REGEX.test(value) || YEAR_REGEX.test(value) || new RegExp(PRESENT_PATTERN, 'i').test(value);
}

function isDateOnlyLine(value: string): boolean {
  const withoutDates = removeDateRange(value).replace(YEAR_REGEX, '').replace(new RegExp(PRESENT_PATTERN, 'gi'), '');

  return withoutDates.replace(/[-\u2013\u2014|,/()\s]/g, '').length === 0;
}

function isLikelyExperienceHeader(value: string): boolean {
  return hasExperienceRoleSignal(value) || DATE_RANGE_REGEX.test(value);
}

function isLikelyContinuation(value: string): boolean {
  const normalized = normalizeText(value);

  return /^(mission|missions|realisation|realisations|projet|projets|technologies|stack|environnement|resultat|resultats|taches|responsabilites|outils)\b/.test(
    normalized,
  );
}

function isLikelyCompanyName(value: string | undefined): value is string {
  if (!value) return false;
  if (value.length < 2 || value.length > 90) return false;
  if (isDateOnlyLine(value) || hasExperienceRoleSignal(value) || isLikelyContinuation(value)) return false;

  const normalized = normalizeText(value);
  const rejectedSingleValues = [
    'remote',
    'remotely',
    'teletravail',
    'hybride',
    'presentiel',
    'paris',
    'lyon',
    'marseille',
    'toulouse',
    'nantes',
    'lille',
    'bordeaux',
    'rennes',
    'monaco',
  ];

  if (rejectedSingleValues.includes(normalized)) return false;
  if (/^(experience|experiences|emploi|emplois|stage|stages|alternance|freelance)\b/.test(normalized)) return false;
  if (/[:;]$/.test(value.trim())) return false;

  return true;
}

function hasExperienceRoleSignal(value: string): boolean {
  const normalized = normalizeText(value);
  const roleKeywords = [
    'developpeur',
    'developer',
    'ingenieur',
    'engineer',
    'consultant',
    'chef de projet',
    'product owner',
    'scrum master',
    'technicien',
    'analyste',
    'architecte',
    'lead',
    'manager',
    'responsable',
    'alternant',
    'stagiaire',
    'freelance',
    'formateur',
  ];

  return roleKeywords.some((keyword) => normalized.includes(keyword));
}

function isLikelySchoolLine(value: string): boolean {
  const normalized = normalizeText(value);
  const schoolKeywords = [
    'universite',
    'university',
    'ecole',
    'school',
    'lycee',
    'institut',
    'institute',
    'campus',
    'academy',
    'academie',
    'iut',
    'cnam',
    'insa',
    'epitech',
    'epita',
    'openclassrooms',
    'simplon',
  ];

  return schoolKeywords.some((keyword) => normalized.includes(keyword));
}

function hasEducationSignal(value: string): boolean {
  const normalized = normalizeText(value);
  const degreeKeywords = [
    'bts',
    'dut',
    'but',
    'licence',
    'bachelor',
    'master',
    'mba',
    'doctorat',
    'diplome',
    'certificat',
    'certification',
    'formation',
    'titre professionnel',
    'bac',
  ];

  return degreeKeywords.some((keyword) => normalized.includes(keyword));
}

function hasExperienceContent(item: ProfessionalExperienceItem): boolean {
  return Boolean(
    item.titleRaw?.trim() || item.companyName?.trim() || item.summary?.trim() || item.startDate || item.endDate,
  );
}

function hasEducationContent(item: EducationItem): boolean {
  return Boolean(item.degreeLabel?.trim() || item.schoolName?.trim() || item.graduationDate);
}

function joinBlock(lines: ParsedLine[]): string {
  return lines.map((line) => line.content).join('\n');
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function sameNormalizedText(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;

  return normalizeText(left) === normalizeText(right);
}

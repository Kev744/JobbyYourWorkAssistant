import type { Cecrl, LanguageItem, LanguageProficiency } from '@/types';

export const NATIVE_LANGUAGE_LEVEL = 'langue maternelle' satisfies LanguageProficiency;
export const LANGUAGE_PROFICIENCY_ORDER: LanguageProficiency[] = [
  NATIVE_LANGUAGE_LEVEL,
  'C2',
  'C1',
  'B2',
  'B1',
  'A2',
  'A1',
];

const CECRL_PATTERN = /\b(A1|A2|B1|B2|C1|C2)\b/i;

export function normalizeLanguageLevel(value: string): LanguageProficiency | undefined {
  const explicitLevel = value.match(CECRL_PATTERN)?.[1]?.toUpperCase() as Cecrl | undefined;

  if (explicitLevel) return explicitLevel;

  const normalized = normalizeLanguageLevelText(value);

  if (
    normalized.includes('langue maternelle') ||
    normalized.includes('langue de naissance') ||
    normalized.includes('mother tongue') ||
    normalized.includes('natif') ||
    normalized.includes('native')
  ) {
    return NATIVE_LANGUAGE_LEVEL;
  }

  if (normalized.includes('courant') || normalized.includes('fluent')) return 'C1';
  if (normalized.includes('avance') || normalized.includes('advanced')) return 'B2';
  if (normalized.includes('intermediaire') || normalized.includes('intermediate')) return 'B1';
  if (normalized.includes('debutant') || normalized.includes('beginner')) return 'A1';

  return undefined;
}

export function toComparableCecrl(value: LanguageProficiency | undefined): Cecrl | undefined {
  return value === NATIVE_LANGUAGE_LEVEL ? 'C2' : value;
}

export function sortLanguageItems<T extends LanguageItem>(languages: T[]): T[] {
  return [...languages].sort(compareLanguageItems);
}

function compareLanguageItems(first: LanguageItem, second: LanguageItem): number {
  return languageProficiencyRank(first.cecrl) - languageProficiencyRank(second.cecrl);
}

function languageProficiencyRank(value: LanguageProficiency | undefined): number {
  const index = value ? LANGUAGE_PROFICIENCY_ORDER.indexOf(value) : -1;

  return index === -1 ? LANGUAGE_PROFICIENCY_ORDER.length : index;
}

function normalizeLanguageLevelText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

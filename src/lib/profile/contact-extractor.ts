import { getLocationOptions } from '@/lib/profile/location-options';

export interface ConfidentialContactInfo {
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  postalCode?: string;
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:(?:\+33|0033)[\s.-]?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}/;
const LOCATION_LABEL_PATTERN = /^(?:ville|city|localisation|location|adresse|address)\s*[:\-]\s*(.+)$/i;
const NAME_LABEL_PATTERN = /^(?:nom(?:\s+complet)?|full\s*name|name|pr(?:e|\u00e9)nom\s+nom|nom\s+pr(?:e|\u00e9)nom)\s*[:\-]\s*(.+)$/i;
const POSTAL_CITY_PATTERN = /\b(\d{5})\s+([\p{L}'\u2019 -]{2,60})/u;
const LOCATION_SEPARATOR_PATTERN = /[,;|/]+/;
const STREET_ADDRESS_PATTERN =
  /\b(?:all(?:e|\u00e9)e|avenue|av\.?|boulevard|bd\.?|chemin|impasse|place|quai|route|rue|square)\b/i;

const NON_NAME_TERMS = new Set([
  'profile',
  'profil',
  'profession',
  'formation',
  'education',
  'competences',
  'skills',
  'langues',
  'languages',
  'certifications',
  'hobbies',
  'developpeur',
  'developer',
  'ingenieur',
  'engineer',
  'consultant',
  'product',
  'owner',
  'manager',
  'alternance',
  'stage',
]);

interface KnownLocationIndex {
  cities: string[];
  regions: Set<string>;
  regionsAndDepartments: Set<string>;
}

let cachedKnownLocationIndex: KnownLocationIndex | null = null;

export function extractConfidentialContactInfo(content: string): ConfidentialContactInfo {
  const lines = contactLines(content);
  const email = content.match(EMAIL_PATTERN)?.[0];
  const phone = findPhone(lines);
  const labeledName = findLabeledValue(lines, NAME_LABEL_PATTERN);
  const location = extractLocation(lines);
  const fullName = cleanContactValue(labeledName) || lines.find(isLikelyPersonName);

  return {
    fullName,
    email,
    phone,
    city: location.city,
    postalCode: location.postalCode,
  };
}

export function redactConfidentialContactInfo(content: string): string {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line, index) => (isConfidentialContactLine(line, index) ? '[contact redacted]' : line))
    .filter((line, index, lines) => line !== '[contact redacted]' || lines[index - 1] !== line)
    .join('\n')
    .trim();
}

function contactLines(content: string): string[] {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function findLabeledValue(lines: string[], pattern: RegExp): string | undefined {
  for (const line of lines) {
    const match = line.match(pattern)?.[1];

    if (match) return match;
  }

  return undefined;
}

function extractLocation(lines: string[]): Pick<ConfidentialContactInfo, 'city' | 'postalCode'> {
  const labeledLocation = findLabeledValue(lines, LOCATION_LABEL_PATTERN);
  const labeled = labeledLocation ? parseLocationValue(labeledLocation) : {};

  if (labeled.city) return labeled;

  for (const line of lines.slice(0, 20)) {
    const parsed = parsePostalCityValue(line);

    if (parsed.city) return parsed;
  }

  for (const line of lines.slice(0, 20)) {
    const parsed = parseKnownCityValue(line);

    if (parsed.city) return parsed;
  }

  for (const line of lines.slice(0, 20)) {
    const parsed = parseContextualCityValue(line);

    if (parsed.city) return parsed;
  }

  return {};
}

function parseLocationValue(value: string): Pick<ConfidentialContactInfo, 'city' | 'postalCode'> {
  const postalLocation = parsePostalCityValue(value);

  if (postalLocation.city) return postalLocation;

  const knownCityLocation = parseKnownCityValue(value);

  if (knownCityLocation.city) return knownCityLocation;

  return parseContextualCityValue(value);
}

function parsePostalCityValue(value: string): Pick<ConfidentialContactInfo, 'city' | 'postalCode'> {
  const postalMatch = value.match(POSTAL_CITY_PATTERN);

  if (postalMatch?.[2]) {
    return {
      city: cleanCity(postalMatch[2]),
      postalCode: postalMatch[1],
    };
  }

  return {};
}

function parseContextualCityValue(value: string): Pick<ConfidentialContactInfo, 'city' | 'postalCode'> {
  const cleaned = cleanCity(value);

  if (isLikelyCityLine(cleaned, value) && !isKnownRegionOrDepartment(cleaned)) {
    return { city: cleaned };
  }

  return {};
}

function parseKnownCityValue(value: string): Pick<ConfidentialContactInfo, 'city' | 'postalCode'> {
  if (hasBinaryNoise(value)) return {};

  const segments = value
    .split(LOCATION_SEPARATOR_PATTERN)
    .map(cleanCity)
    .filter(Boolean);
  const candidates = segments.length > 1 ? segments : [cleanCity(value)];
  const knownCity = findKnownCity(candidates);

  return knownCity ? { city: knownCity } : {};
}

function cleanCity(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '')
    .replace(PHONE_PATTERN, '')
    .replace(/\b(?:france|monaco)\b/gi, '')
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isConfidentialContactLine(line: string, index: number): boolean {
  const trimmed = line.trim();

  if (!trimmed) return false;
  if (EMAIL_PATTERN.test(trimmed) || isLikelyPhoneLine(trimmed)) return true;
  if (NAME_LABEL_PATTERN.test(trimmed) || LOCATION_LABEL_PATTERN.test(trimmed)) return true;
  if (index < 20 && (isLikelyPersonName(trimmed) || POSTAL_CITY_PATTERN.test(trimmed))) return true;

  return false;
}

function findPhone(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 30)) {
    if (!isLikelyPhoneLine(line)) continue;

    const phone = line.match(PHONE_PATTERN)?.[0];

    if (phone && !isPlaceholderPhone(phone)) return phone;
  }

  return undefined;
}

function isLikelyPhoneLine(value: string): boolean {
  const trimmed = value.trim();
  const phone = trimmed.match(PHONE_PATTERN)?.[0];

  if (!phone || isPlaceholderPhone(phone)) return false;
  if (hasBinaryNoise(trimmed)) return false;

  const withoutPhone = trimmed.replace(PHONE_PATTERN, '').trim();

  return (
    trimmed.length <= 45 ||
    /^(?:t(?:e|\u00e9)l(?:e|\u00e9)?phone|mobile|portable|phone|tel)\s*[:\-]/i.test(trimmed) ||
    withoutPhone.length <= 20
  );
}

function isPlaceholderPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');

  return /^(?:0123456789|1234567890|0000000000|1111111111)$/.test(digits);
}

function isLikelyCityLine(cleaned: string, original: string): boolean {
  if (!cleaned || !/^[\p{L}'\u2019 -]{2,60}$/u.test(cleaned)) return false;
  if (hasBinaryNoise(original) || isResumeHeading(cleaned) || isLikelyPersonName(cleaned)) return false;
  if (STREET_ADDRESS_PATTERN.test(original)) return false;

  const normalizedWords = cleaned.split(/\s+/).map(normalizeForComparison);

  if (normalizedWords.some((word) => NON_NAME_TERMS.has(word))) return false;

  return (
    /\b(?:france|monaco)\b/i.test(original) ||
    cleaned.split(/\s+/).length <= 3
  );
}

function findKnownCity(candidates: string[]): string | undefined {
  const { cities } = knownLocationIndex();

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeForComparison(candidate);
    const matchedCity = cities.find((city) => normalizeForComparison(city) === normalizedCandidate);

    if (matchedCity) return matchedCity;
  }

  for (const candidate of candidates) {
    if (STREET_ADDRESS_PATTERN.test(candidate) || !hasLocationContext(candidate)) continue;

    const normalizedCandidate = normalizeForComparison(candidate);
    const matchedCity = cities.find((city) => {
      const normalizedCity = normalizeForComparison(city);

      return new RegExp(`(?:^| )${escapeRegExp(normalizedCity)}(?: |$)`).test(normalizedCandidate);
    });

    if (matchedCity) return matchedCity;
  }

  return undefined;
}

function isKnownRegionOrDepartment(value: string): boolean {
  return knownLocationIndex().regionsAndDepartments.has(normalizeForComparison(value));
}

function hasLocationContext(value: string): boolean {
  if (/\b(?:france|monaco)\b/i.test(value)) return true;

  const normalizedValue = normalizeForComparison(value);

  for (const region of knownLocationIndex().regions) {
    if (new RegExp(`(?:^| )${escapeRegExp(region)}(?: |$)`).test(normalizedValue)) {
      return true;
    }
  }

  return false;
}

function knownLocationIndex(): KnownLocationIndex {
  if (cachedKnownLocationIndex) return cachedKnownLocationIndex;

  const options = getLocationOptions();

  cachedKnownLocationIndex = {
    cities: [...new Set(options.cities.map((city) => city.name).filter(Boolean))].sort(
      (left, right) => right.length - left.length,
    ),
    regions: new Set(options.regions.map((location) => normalizeForComparison(location.name)).filter(Boolean)),
    regionsAndDepartments: new Set(
      [...options.regions, ...options.departments]
        .map((location) => normalizeForComparison(location.name))
        .filter(Boolean),
    ),
  };

  return cachedKnownLocationIndex;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasBinaryNoise(value: string): boolean {
  const visible = value.replace(/\s/g, '');

  if (!visible) return false;

  const noisyCharacters = Array.from(visible).filter((character) => {
    if (/[\p{L}\p{N}@+().,'\u2019/-]/u.test(character)) return false;

    return true;
  }).length;

  return /[\u0000-\u001f]/.test(value) || noisyCharacters / visible.length > 0.2;
}

function isLikelyPersonName(value: string): boolean {
  const cleaned = cleanContactValue(value);

  if (!cleaned || cleaned.length < 4 || cleaned.length > 80) return false;
  if (EMAIL_PATTERN.test(cleaned) || PHONE_PATTERN.test(cleaned) || /\d/.test(cleaned)) return false;
  if (!/^[\p{L}'\u2019.-]+(?:\s+[\p{L}'\u2019.-]+){1,5}$/u.test(cleaned)) return false;
  if (isResumeHeading(cleaned)) return false;

  const words = cleaned.split(/\s+/);
  const normalizedWords = words.map(normalizeForComparison);

  if (normalizedWords.some((word) => NON_NAME_TERMS.has(word))) return false;

  return words.every((word) => startsWithUppercaseLetter(word)) || words.some((word) => word === word.toUpperCase());
}

function startsWithUppercaseLetter(value: string): boolean {
  const firstLetter = value.match(/\p{L}/u)?.[0];

  return Boolean(firstLetter && firstLetter === firstLetter.toUpperCase());
}

function isResumeHeading(value: string): boolean {
  return NON_NAME_TERMS.has(normalizeForComparison(value));
}

function cleanContactValue(value: string | undefined): string | undefined {
  const cleaned = value
    ?.replace(/^[\s:;-]+|[\s:;-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || undefined;
}

function normalizeForComparison(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

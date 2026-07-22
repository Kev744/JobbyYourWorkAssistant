import {
  buildProviderWarning,
  fetchProviderResponse,
  throwProviderResponseError,
} from '@/lib/providers/http';
import type { JobOffer, ProfileRequirements, SkillItem } from '@/types';

const TOKEN_URL =
  'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';
const OFFERS_SEARCH_URL = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search';
const OFFERS_SCOPE = 'api_offresdemploiv2 o2dsoffre';
const FRANCE_TRAVAIL_SOURCE = 'france_travail' as const;
const FRANCE_TRAVAIL_PAGE_SIZE = 150;
const FRANCE_TRAVAIL_MAX_RESULTS = 1_150;
const FRANCE_TRAVAIL_MAX_START_INDEX = 1_000;
const FRANCE_TRAVAIL_CONTRACT_FILTERS: Record<
  string,
  { parameter: 'typeContrat' | 'natureContrat'; code: string }
> = {
  CDI: { parameter: 'typeContrat', code: 'CDI' },
  CDD: { parameter: 'typeContrat', code: 'CDD' },
  INTERIM: { parameter: 'typeContrat', code: 'MIS' },
  INTÉRIM: { parameter: 'typeContrat', code: 'MIS' },
  MIS: { parameter: 'typeContrat', code: 'MIS' },
  STAGE: { parameter: 'natureContrat', code: 'FA' },
  APPRENTISSAGE: { parameter: 'natureContrat', code: 'E2' },
  ALTERNANCE: { parameter: 'natureContrat', code: 'E2' },
  E2: { parameter: 'natureContrat', code: 'E2' },
  POE: { parameter: 'natureContrat', code: 'FV' },
  FV: { parameter: 'natureContrat', code: 'FV' },
};

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

interface FranceTravailTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface FranceTravailSearchResponse {
  resultats?: FranceTravailOffer[];
}

interface ContentRange {
  start: number;
  end: number;
  total?: number;
}

interface FranceTravailOffer {
  id?: string;
  intitule?: string;
  description?: string;
  dateCreation?: string;
  lieuTravail?: {
    libelle?: string;
    codePostal?: string;
    commune?: string;
    latitude?: number;
    longitude?: number;
  };
  entreprise?: {
    nom?: string;
  };
  typeContrat?: string;
  typeContratLibelle?: string;
  dureeTravailLibelle?: string;
  salaire?: {
    libelle?: string;
    commentaire?: string;
  };
  origineOffre?: {
    urlOrigine?: string;
  };
  contact?: {
    urlPostulation?: string;
  };
  romeCode?: string;
  experienceLibelle?: string;
  experienceExige?: string;
  competences?: Array<{
    libelle?: string;
    exigence?: string;
  }>;
  langues?: Array<{
    libelle?: string;
    exigence?: string;
  }>;
  qualitesProfessionnelles?: Array<{
    libelle?: string;
  }>;
}

export interface FranceTravailSearchInput {
  requirements?: ProfileRequirements | null;
  profession?: string;
  romeCode?: string;
  limit?: number;
  pageSize?: number;
}

export interface FranceTravailSearchResult {
  offers: JobOffer[];
  upstreamQuery: Record<string, string>;
  warnings: string[];
}

export async function searchFranceTravailOffers(
  input: FranceTravailSearchInput,
): Promise<FranceTravailSearchResult> {
  const query = buildFranceTravailQuery(input);

  try {
    const token = await getFranceTravailAccessToken();
    const maxOffers = Math.min(input.limit ?? FRANCE_TRAVAIL_MAX_RESULTS, FRANCE_TRAVAIL_MAX_RESULTS);
    const pageSize = getFranceTravailPageSize(input);
    const offers: JobOffer[] = [];
    const seenOfferIds = new Set<string>();
    const warnings: string[] = [];
    let start = 0;
    let lastRangeEnd = pageSize - 1;

    while (offers.length < maxOffers && start <= FRANCE_TRAVAIL_MAX_START_INDEX) {
      const remaining = maxOffers - offers.length;
      const end = Math.min(start + pageSize - 1, start + remaining - 1, FRANCE_TRAVAIL_MAX_RESULTS - 1);
      const pageQuery = { ...query, range: `${start}-${end}` };
      const { payload, contentRange } = await fetchFranceTravailOfferPage(token, pageQuery);
      const pageResults = payload.resultats ?? [];

      lastRangeEnd = end;

      for (const offer of pageResults.map(mapFranceTravailOffer)) {
        if (!offer || !isFranceOrMonacoOffer(offer) || seenOfferIds.has(offer.offerId)) continue;

        seenOfferIds.add(offer.offerId);
        offers.push(offer);

        if (offers.length >= maxOffers) break;
      }

      if (shouldStopFranceTravailPagination({ pageResults, requestedPageSize: end - start + 1, contentRange })) {
        break;
      }

      if (end >= FRANCE_TRAVAIL_MAX_RESULTS - 1) {
        break;
      }

      start = Math.min(end + 1, FRANCE_TRAVAIL_MAX_START_INDEX);
    }

    if (start > FRANCE_TRAVAIL_MAX_START_INDEX && offers.length >= FRANCE_TRAVAIL_MAX_RESULTS) {
      warnings.push('France Travail limite la pagination aux 1 150 premiers rÃƒÂ©sultats.');
    }

    return {
      offers,
      upstreamQuery: { ...query, range: `0-${lastRangeEnd}` },
      warnings,
    };
  } catch (error) {
    return {
      offers: [],
      upstreamQuery: query,
      warnings: [buildProviderWarning('France Travail', error)],
    };
  }
}

export function buildFranceTravailQuery(input: FranceTravailSearchInput): Record<string, string> {
  const requirements = input.requirements;
  const professionKeywords = requirements?.professionKeywords || input.profession || '';
  const query: Record<string, string> = {
    range: `0-${getFranceTravailPageSize(input) - 1}`,
  };

  if (input.romeCode && input.romeCode !== 'Inconnu') {
    query.codeROME = input.romeCode;
  } else if (professionKeywords) {
    query.motsCles = professionKeywords;
  }

  if (requirements?.city?.code) {
    query.commune = requirements.city.code;
    query.rayon = String(requirements.radiusKm);
  } else if (requirements?.department?.code) {
    query.departement = requirements.department.code;
  } else if (requirements?.region?.code) {
    query.region = requirements.region.code;
  }

  if (requirements?.contractTypes?.length) {
    const contracts = mapFranceTravailContractFilters(requirements.contractTypes);

    if (contracts.typeContrat.length > 0) {
      query.typeContrat = contracts.typeContrat.join(',');
    }

    if (contracts.natureContrat.length > 0) {
      query.natureContrat = contracts.natureContrat.join(',');
    }
  }

  if (requirements?.experienceLevel) {
    query.experience = requirements.experienceLevel;
  }

  if (requirements?.disabledAccepted) {
    query.accessibleTH = 'true';
  }

  return query;
}

function mapFranceTravailContractFilters(contractTypes: string[]): {
  typeContrat: string[];
  natureContrat: string[];
} {
  return contractTypes.reduce(
    (accumulator, contractType) => {
      const filter = FRANCE_TRAVAIL_CONTRACT_FILTERS[contractType.trim().toUpperCase()];

      if (filter && !accumulator[filter.parameter].includes(filter.code)) {
        accumulator[filter.parameter].push(filter.code);
      }

      return accumulator;
    },
    { typeContrat: [], natureContrat: [] } as { typeContrat: string[]; natureContrat: string[] },
  );
}

async function fetchFranceTravailOfferPage(
  token: string,
  query: Record<string, string>,
): Promise<{ payload: FranceTravailSearchResponse; contentRange: ContentRange | null }> {
  const url = new URL(OFFERS_SEARCH_URL);

  Object.entries(query).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetchProviderResponse(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });


  if (!response.ok) {
    throwProviderResponseError('France Travail', response);
  }

  return {
    payload: (await response.json()) as FranceTravailSearchResponse,
    contentRange: parseContentRange(response.headers.get('content-range')),
  };
}

function getFranceTravailPageSize(input: FranceTravailSearchInput): number {
  return Math.max(1, Math.min(input.pageSize ?? input.limit ?? FRANCE_TRAVAIL_PAGE_SIZE, FRANCE_TRAVAIL_PAGE_SIZE));
}

function shouldStopFranceTravailPagination(input: {
  pageResults: FranceTravailOffer[];
  requestedPageSize: number;
  contentRange: ContentRange | null;
}): boolean {
  if (input.pageResults.length === 0) return true;

  if (input.contentRange?.total !== undefined && input.contentRange.end + 1 >= input.contentRange.total) {
    return true;
  }

  return input.pageResults.length < input.requestedPageSize;
}

function parseContentRange(value: string | null): ContentRange | null {
  const match = value?.match(/(\d+)-(\d+)\/(\d+|\*)/);

  if (!match) return null;

  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: match[3] === '*' ? undefined : Number(match[3]),
  };
}

function mapFranceTravailOffer(offer: FranceTravailOffer): JobOffer | null {
  if (!offer.id || !offer.intitule || !offer.description) {
    return null;
  }

  const applicationUrl = offer.contact?.urlPostulation || offer.origineOffre?.urlOrigine;

  return {
    offerId: `${FRANCE_TRAVAIL_SOURCE}:${offer.id}`,
    source: FRANCE_TRAVAIL_SOURCE,
    sourceOfferId: offer.id,
    publishedAt: offer.dateCreation,
    title: offer.intitule,
    description: offer.description,
    company: offer.entreprise?.nom ? { name: offer.entreprise.nom } : undefined,
    location: {
      city: offer.lieuTravail?.libelle,
      postalCode: offer.lieuTravail?.codePostal,
      inseeCode: offer.lieuTravail?.commune,
      lat: offer.lieuTravail?.latitude,
      lon: offer.lieuTravail?.longitude,
    },
    remoteMode: inferRemoteMode(`${offer.intitule} ${offer.description}`),
    contract: {
      type: offer.typeContratLibelle || offer.typeContrat,
      workingTime: offer.dureeTravailLibelle,
    },
    salary: parseSalary(offer.salaire?.libelle ?? offer.salaire?.commentaire ?? ''),
    jobTarget: {
      rawTitle: offer.intitule,
      canonicalRomeCode: offer.romeCode,
    },
    skills: (offer.competences ?? [])
      .map(
        (skill): SkillItem => ({
          raw: skill.libelle ?? '',
          importance: skill.exigence === 'E' ? 'must' : 'should',
        }),
      )
      .filter((skill) => skill.raw),
    experienceRequirement: parseExperience(offer.experienceLibelle),
    languageRequirements: (offer.langues ?? []).map((language) => ({
      code: language.libelle ?? 'unknown',
      mandatory: language.exigence === 'E',
    })),
    softSkills: (offer.qualitesProfessionnelles ?? [])
      .map((quality) => quality.libelle)
      .filter((value): value is string => Boolean(value)),
    keywords: [],
    applicationUrl,
  };
}

function isFranceOrMonacoOffer(offer: JobOffer): boolean {
  const city = normalize(offer.location.city ?? '');
  const postalCode = offer.location.postalCode ?? '';

  if (city.includes('monaco') || postalCode.startsWith('98')) {
    return true;
  }

  return /^[0-9]{5}$/.test(postalCode) || Boolean(offer.location.inseeCode);
}

function inferRemoteMode(text: string): JobOffer['remoteMode'] {
  const normalized = normalize(text);

  if (normalized.includes('teletravail complet') || normalized.includes('100% teletravail')) {
    return 'remote';
  }

  if (normalized.includes('teletravail') || normalized.includes('hybride')) {
    return 'hybrid';
  }

  return 'onsite';
}

function parseExperience(label?: string): JobOffer['experienceRequirement'] {
  if (!label) {
    return undefined;
  }

  const match = label.match(/(\d+)/);

  return match ? { minYears: Number(match[1]) } : undefined;
}

function parseSalary(label: string): JobOffer['salary'] | undefined {
  const values = [...label.matchAll(/(\d[\d\s.]*)/g)]
    .map((match) => Number(match[1].replace(/[\s.]/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) {
    return undefined;
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const multiplier = normalize(label).includes('mensuel') ? 12 : 1;

  return {
    minAnnualGrossEur: minValue * multiplier,
    maxAnnualGrossEur: maxValue * multiplier,
  };
}

async function getFranceTravailAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_KEY;

  if (!clientId || !clientSecret) {
    throw new Error('France Travail credentials are missing');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: OFFERS_SCOPE,
  });
  const response = await fetchProviderResponse(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error('France Travail token request failed');
  }

  const payload = (await response.json()) as FranceTravailTokenResponse;


  if (!payload.access_token) {
    throw new Error('France Travail token response is missing access_token');
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 300) * 1000,
  };


  return cachedToken.accessToken;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

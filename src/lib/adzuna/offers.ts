import {
  buildProviderWarning,
  fetchProviderResponse,
  throwProviderResponseError,
} from '@/lib/providers/http';
import type { JobOffer, ProfileRequirements } from '@/types';

const ADZUNA_SEARCH_BASE_URL = 'https://api.adzuna.com/v1/api/jobs/fr/search';
const ADZUNA_SOURCE = 'adzuna' as const;
const ADZUNA_PAGE_SIZE = 50;
const ADZUNA_MAX_PAGES = 100;
const ADZUNA_MAX_RESULTS = ADZUNA_PAGE_SIZE * ADZUNA_MAX_PAGES;

interface AdzunaSearchResponse {
  count?: number;
  results?: AdzunaOffer[];
}

interface AdzunaOffer {
  id?: string;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: '0' | '1' | 0 | 1;
  latitude?: number;
  longitude?: number;
  contract_time?: string;
  contract_type?: string;
  company?: {
    display_name?: string;
  };
  location?: {
    display_name?: string;
    area?: string[];
  };
  category?: {
    label?: string;
    tag?: string;
  };
}

export interface AdzunaSearchInput {
  requirements?: ProfileRequirements | null;
  profession?: string;
  limit?: number;
  pageSize?: number;
}

export interface AdzunaSearchResult {
  offers: JobOffer[];
  upstreamQuery: Record<string, string>;
  warnings: string[];
}

export async function searchAdzunaOffers(input: AdzunaSearchInput): Promise<AdzunaSearchResult> {
  const query = buildAdzunaQuery(input);

  try {
    const credentials = getAdzunaCredentials();
    const pageSize = getAdzunaPageSize(input);
    const maxOffers = Math.min(input.limit ?? ADZUNA_MAX_RESULTS, ADZUNA_MAX_RESULTS);
    const offers: JobOffer[] = [];
    const seenOfferIds = new Set<string>();
    const warnings = buildAdzunaWarnings(input.requirements);
    let page = 1;
    let totalResults: number | undefined;

    while (offers.length < maxOffers && page <= ADZUNA_MAX_PAGES) {
      const payload = await fetchAdzunaOfferPage(credentials, query, page);
      const pageResults = payload.results ?? [];

      totalResults = payload.count ?? totalResults;

      for (const offer of pageResults.map(mapAdzunaOffer)) {
        if (!offer || !matchesCompany(offer, input.requirements?.companyName) || seenOfferIds.has(offer.offerId)) {
          continue;
        }

        seenOfferIds.add(offer.offerId);
        offers.push(offer);

        if (offers.length >= maxOffers) break;
      }

      if (shouldStopAdzunaPagination({ pageResults, pageSize, page, totalResults })) {
        break;
      }

      page += 1;
    }

    if (page > ADZUNA_MAX_PAGES && totalResults && totalResults > ADZUNA_MAX_RESULTS) {
      warnings.push(`Adzuna annonce ${totalResults} rÃƒÂ©sultats ; seuls les ${ADZUNA_MAX_RESULTS} premiers ont ÃƒÂ©tÃƒÂ© chargÃƒÂ©s.`);
    }

    return {
      offers,
      upstreamQuery: query,
      warnings,
    };
  } catch (error) {
    return {
      offers: [],
      upstreamQuery: query,
      warnings: [buildProviderWarning('Adzuna', error), ...buildAdzunaWarnings(input.requirements)],
    };
  }
}

export function buildAdzunaQuery(input: AdzunaSearchInput): Record<string, string> {
  const requirements = input.requirements;
  const query: Record<string, string> = {
    results_per_page: String(getAdzunaPageSize(input)),
    sort_by: 'date',
  };
  const keywords = requirements?.professionKeywords || input.profession || '';

  if (keywords) {
    query.what = keywords;
  }

  if (requirements?.city?.name) {
    query.where = requirements.city.name;
    query.distance = String(Math.max(1, requirements.radiusKm || 10));
  } else if (requirements?.department?.name) {
    query.where = requirements.department.name;
  } else if (requirements?.region?.name) {
    query.where = requirements.region.name;
  }

  if (requirements?.salaryMinAnnualGrossEur) {
    query.salary_min = String(requirements.salaryMinAnnualGrossEur);
  }

  if (requirements?.fullTime !== null && requirements?.fullTime !== undefined) {
    query.full_time = requirements.fullTime ? '1' : '0';
  }

  if (requirements?.permanent !== null && requirements?.permanent !== undefined) {
    query.permanent = requirements.permanent ? '1' : '0';
  }

  if (requirements?.companyName) {
    query.company = requirements.companyName;
  }

  return query;
}

async function fetchAdzunaOfferPage(
  credentials: { appId: string; appKey: string },
  query: Record<string, string>,
  page: number,
): Promise<AdzunaSearchResponse> {
  const url = new URL(`${ADZUNA_SEARCH_BASE_URL}/${page}`);

  url.searchParams.set('app_id', credentials.appId);
  url.searchParams.set('app_key', credentials.appKey);
  url.searchParams.set('content-type', 'application/json');

  Object.entries(query).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetchProviderResponse(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throwProviderResponseError('Adzuna', response);
  }

  return (await response.json()) as AdzunaSearchResponse;
}

function getAdzunaPageSize(input: AdzunaSearchInput): number {
  return Math.max(1, Math.min(input.pageSize ?? input.limit ?? ADZUNA_PAGE_SIZE, ADZUNA_PAGE_SIZE));
}

function shouldStopAdzunaPagination(input: {
  pageResults: AdzunaOffer[];
  pageSize: number;
  page: number;
  totalResults?: number;
}): boolean {
  if (input.pageResults.length === 0) return true;
  if (input.totalResults !== undefined && input.page * input.pageSize >= input.totalResults) return true;

  return input.pageResults.length < input.pageSize;
}

function mapAdzunaOffer(offer: AdzunaOffer): JobOffer | null {
  if (!offer.id || !offer.title || !offer.description) {
    return null;
  }

  const location = mapLocation(offer.location);

  if (!isFranceOrMonacoLocation(location)) {
    return null;
  }

  return {
    offerId: `${ADZUNA_SOURCE}:${offer.id}`,
    source: ADZUNA_SOURCE,
    sourceOfferId: offer.id,
    publishedAt: offer.created,
    title: offer.title,
    description: offer.description,
    company: offer.company?.display_name ? { name: offer.company.display_name } : undefined,
    location: {
      city: location.city,
      departmentCode: location.departmentCode,
      regionCode: location.regionCode,
      lat: offer.latitude,
      lon: offer.longitude,
    },
    remoteMode: inferRemoteMode(`${offer.title} ${offer.description}`),
    contract: {
      type: offer.contract_type,
      workingTime: offer.contract_time,
    },
    salary: mapSalary(offer),
    jobTarget: {
      rawTitle: offer.title,
    },
    skills: [],
    languageRequirements: [],
    softSkills: [],
    keywords: [offer.category?.label, offer.category?.tag].filter((value): value is string =>
      Boolean(value),
    ),
    applicationUrl: offer.redirect_url,
  };
}

function mapLocation(location: AdzunaOffer['location']): {
  country?: string;
  city?: string;
  departmentCode?: string;
  regionCode?: string;
} {
  const area = location?.area ?? [];
  const city = location?.display_name || area.at(-1);

  return {
    country: area.at(0),
    city,
    regionCode: area.at(1),
    departmentCode: area.at(2),
  };
}

function mapSalary(offer: AdzunaOffer): JobOffer['salary'] | undefined {
  if (!offer.salary_min && !offer.salary_max) {
    return undefined;
  }

  return {
    minAnnualGrossEur: offer.salary_min,
    maxAnnualGrossEur: offer.salary_max,
    isPredicted: offer.salary_is_predicted === '1' || offer.salary_is_predicted === 1,
  };
}

function isFranceOrMonacoLocation(location: { country?: string; city?: string }): boolean {
  const country = normalize(location.country ?? '');
  const city = normalize(location.city ?? '');

  if (city.includes('monaco')) {
    return true;
  }

  return !country || country === 'france';
}

function matchesCompany(offer: JobOffer, companyName?: string): boolean {
  if (!companyName) {
    return true;
  }

  return normalize(offer.company?.name ?? '').includes(normalize(companyName));
}

function buildAdzunaWarnings(requirements?: ProfileRequirements | null): string[] {
  const warnings: string[] = [];

  if (requirements?.contractTypes?.length) {
    warnings.push('Les types de contrat détaillés seront réutilisés au classement.');
  }

  if (requirements?.disabledAccepted) {
    warnings.push("Le filtre handicap n'est pas disponible chez Adzuna.");
  }

  if (requirements?.remotePreference) {
    warnings.push('Le télétravail est détecté dans le texte des offres Adzuna.');
  }

  return warnings;
}

function inferRemoteMode(text: string): JobOffer['remoteMode'] {
  const normalized = normalize(text);

  if (
    normalized.includes('teletravail complet') ||
    normalized.includes('remote') ||
    normalized.includes('100% teletravail')
  ) {
    return 'remote';
  }

  if (normalized.includes('teletravail') || normalized.includes('hybride')) {
    return 'hybrid';
  }

  return 'onsite';
}

function getAdzunaCredentials(): { appId: string; appKey: string } {
  const appId = process.env.ADZUNA_APP_ID ?? process.env.ADZUNA_API_ID;
  const appKey = process.env.ADZUNA_APP_KEY ?? process.env.ADZUNA_API_KEY;

  if (!appId || !appKey) {
    throw new Error('Adzuna credentials are missing');
  }

  return { appId, appKey };
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

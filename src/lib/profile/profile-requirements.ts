import type { LocationOption, ProfileRequirements } from '@/types';

export const PROFILE_REQUIREMENTS_SELECT =
  'id, user_id, candidate_profile_id, profession_keywords, city, department, region, radius_km, experience_level, availability, contract_types, disabled_accepted, salary_min_annual_gross_eur, remote_preference, full_time, permanent, company_name, provider_notes, created_at, updated_at';

interface ProfileRequirementsRow {
  id: string;
  user_id: string;
  candidate_profile_id: string | null;
  profession_keywords: string;
  city: unknown;
  department: unknown;
  region: unknown;
  radius_km: number;
  experience_level: string;
  availability: string;
  contract_types: string[];
  disabled_accepted: boolean;
  salary_min_annual_gross_eur: number | null;
  remote_preference: string;
  full_time: boolean | null;
  permanent: boolean | null;
  company_name: string;
  provider_notes: string[];
  created_at: string;
  updated_at: string;
}

export function mapProfileRequirementsRow(row: ProfileRequirementsRow): ProfileRequirements {
  return {
    id: row.id,
    candidateProfileId: row.candidate_profile_id,
    professionKeywords: row.profession_keywords,
    city: asLocationOption(row.city),
    department: asLocationOption(row.department),
    region: asLocationOption(row.region),
    radiusKm: row.radius_km,
    experienceLevel: row.experience_level,
    availability: row.availability,
    contractTypes: row.contract_types ?? [],
    disabledAccepted: row.disabled_accepted,
    salaryMinAnnualGrossEur: row.salary_min_annual_gross_eur,
    remotePreference: row.remote_preference,
    fullTime: row.full_time,
    permanent: row.permanent,
    companyName: row.company_name,
    providerNotes: row.provider_notes ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildProviderNotes(requirements: {
  city?: LocationOption | null;
  department?: LocationOption | null;
  region?: LocationOption | null;
  radiusKm: number;
  disabledAccepted: boolean;
  companyName: string;
  remotePreference: string;
}): string[] {
  const notes: string[] = [];

  if ((requirements.department || requirements.region) && !requirements.city) {
    notes.push('Le rayon est appliqué uniquement quand une commune est sélectionnée.');
  }

  if (requirements.disabledAccepted) {
    notes.push('Le filtre handicap sera transmis à France Travail si disponible.');
  }

  if (requirements.companyName) {
    notes.push('Le nom d’entreprise sera transmis à Adzuna et filtré côté serveur pour les sources qui ne le gèrent pas.');
  }

  if (requirements.remotePreference) {
    notes.push('Le télétravail peut être utilisé pour le classement même si un fournisseur ne propose pas ce filtre.');
  }

  return notes;
}

export function normalizeRequirementsPayload(payload: Record<string, unknown>) {
  const city = asLocationOption(payload.city);
  const department = asLocationOption(payload.department);
  const region = asLocationOption(payload.region);
  const radiusKm = clampNumber(payload.radiusKm, 0, 100, 10);
  const disabledAccepted = Boolean(payload.disabledAccepted);
  const companyName = stringValue(payload.companyName);
  const remotePreference = stringValue(payload.remotePreference);
  const normalized = {
    candidate_profile_id: stringValue(payload.candidateProfileId) || null,
    profession_keywords: stringValue(payload.professionKeywords),
    city,
    department,
    region,
    radius_km: radiusKm,
    experience_level: nonNegativeIntegerString(payload.experienceLevel),
    availability: stringValue(payload.availability),
    contract_types: Array.isArray(payload.contractTypes)
      ? payload.contractTypes.map(String).filter(Boolean)
      : [],
    disabled_accepted: disabledAccepted,
    salary_min_annual_gross_eur: positiveIntegerOrNull(payload.salaryMinAnnualGrossEur),
    remote_preference: remotePreference,
    full_time: nullableBoolean(payload.fullTime),
    permanent: nullableBoolean(payload.permanent),
    company_name: companyName,
    provider_notes: buildProviderNotes({
      city,
      department,
      region,
      radiusKm,
      disabledAccepted,
      companyName,
      remotePreference,
    }),
  };

  return normalized;
}

function asLocationOption(value: unknown): LocationOption | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const maybe = value as Partial<LocationOption>;

  if (!maybe.code || !maybe.name) {
    return null;
  }

  return {
    code: String(maybe.code),
    name: String(maybe.name),
    departmentCode: maybe.departmentCode ? String(maybe.departmentCode) : undefined,
    departmentName: maybe.departmentName ? String(maybe.departmentName) : undefined,
    regionCode: maybe.regionCode ? String(maybe.regionCode) : undefined,
    regionName: maybe.regionName ? String(maybe.regionName) : undefined,
    postalCode: maybe.postalCode ? String(maybe.postalCode) : undefined,
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function nonNegativeIntegerString(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numberValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return '';
  }

  return String(Math.max(0, Math.round(numberValue)));
}

function positiveIntegerOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null;
  }

  return Math.min(1_000_000, Math.round(numberValue));
}

function nullableBoolean(value: unknown): boolean | null {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

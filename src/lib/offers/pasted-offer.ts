import { createHash } from 'node:crypto';

import type { LocalDatabaseClient } from '@/lib/db/local-client';
import type { JobOffer, RemoteMode, SkillItem } from '@/types';

export const WEB_OFFER_SOURCE = 'web' as const;

const MIN_PASTED_OFFER_LENGTH = 40;
const MAX_PASTED_OFFER_LENGTH = 20_000;
const COMMON_SKILLS = [
  'TypeScript',
  'JavaScript',
  'React',
  'Next.js',
  'Node.js',
  'Node',
  'Vue.js',
  'Angular',
  'Python',
  'Java',
  'C#',
  '.NET',
  'PHP',
  'Symfony',
  'Laravel',
  'SQL',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Docker',
  'Kubernetes',
  'AWS',
  'Azure',
  'GCP',
  'Git',
  'Figma',
  'Excel',
  'Power BI',
  'Salesforce',
  'SAP',
  'Agile',
  'Scrum',
  'SEO',
  'Google Analytics',
  'Photoshop',
  'Illustrator',
] as const;

export class PastedOfferValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PastedOfferValidationError';
  }
}

export function createPastedWebOffer(input: {
  text: string;
  applicationUrl?: string;
  scopeId?: string;
  now?: Date;
}): JobOffer {
  const description = normalizePastedOfferText(input.text);

  if (description.length < MIN_PASTED_OFFER_LENGTH) {
    throw new PastedOfferValidationError('Collez une offre suffisamment détaillée pour préparer les documents.');
  }

  const lines = description.split('\n').map((line) => line.trim()).filter(Boolean);
  const title = inferTitle(lines);
  const location = inferLocation(lines);
  const contractType = inferContractType(description);
  const remoteMode = inferRemoteMode(description);
  const applicationUrl = normalizeApplicationUrl(input.applicationUrl);
  const sourceOfferId = createHash('sha256')
    .update(`${input.scopeId ?? ''}\u0000${description}\u0000${applicationUrl ?? ''}`)
    .digest('hex')
    .slice(0, 32);

  return {
    offerId: `${WEB_OFFER_SOURCE}:${sourceOfferId}`,
    source: WEB_OFFER_SOURCE,
    sourceOfferId,
    publishedAt: (input.now ?? new Date()).toISOString(),
    title,
    description,
    company: inferCompany(lines),
    location,
    remoteMode,
    contract: contractType ? { type: contractType } : undefined,
    jobTarget: { rawTitle: title },
    skills: extractSkills(description),
    keywords: extractKeywords(title),
    applicationUrl,
  };
}

export async function persistPastedWebOffer(
  db: LocalDatabaseClient,
  userId: string,
  offer: JobOffer,
): Promise<{ id: string; normalizedOffer: JobOffer }> {
  if (offer.source !== WEB_OFFER_SOURCE) {
    throw new Error('Only web offers can be persisted by this module.');
  }

  const { error: sourceError } = await db.from('job_offer_sources').upsert(
    { source: WEB_OFFER_SOURCE, label: 'Offre importée du web' },
    { onConflict: 'source' },
  );

  if (sourceError) {
    throw new Error('Unable to prepare the web offer source.');
  }

  const { error: offerError } = await db.from('job_offers').upsert(
    {
      source: offer.source,
      source_offer_id: offer.sourceOfferId,
      created_by: userId,
      offer_id: offer.offerId,
      title: offer.title,
      description: offer.description,
      company_name: offer.company?.name ?? null,
      location: offer.location,
      normalized_offer: offer,
      published_at: offer.publishedAt ?? null,
      application_url: offer.applicationUrl ?? null,
    },
    { onConflict: 'source,source_offer_id' },
  );

  if (offerError) {
    throw new Error('Unable to persist the pasted web offer.');
  }

  const { data, error } = await db
    .from('job_offers')
    .select('id, normalized_offer')
    .eq('source', WEB_OFFER_SOURCE)
    .eq('source_offer_id', offer.sourceOfferId)
    .single();

  if (error || !data?.normalized_offer) {
    throw new Error('Unable to reload the pasted web offer.');
  }

  return {
    id: data.id,
    normalizedOffer: data.normalized_offer as JobOffer,
  };
}

function normalizePastedOfferText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_PASTED_OFFER_LENGTH);
}

function inferTitle(lines: string[]): string {
  const title = lines.find((line) => {
    const normalized = line.toLowerCase();

    return (
      line.length >= 3 &&
      line.length <= 160 &&
      !/^(indeed|linkedin|welcome|accueil|postuler|candidature facile|description du poste|missions|profil recherché|avantages)$/i.test(
        normalized,
      )
    );
  });

  return title ?? 'Offre importée depuis le web';
}

function inferCompany(lines: string[]): JobOffer['company'] | undefined {
  const companyLine = lines.find((line) => /^(entreprise|société|societe|company)\s*:/i.test(line));
  const name = companyLine?.replace(/^(entreprise|société|societe|company)\s*:\s*/i, '').trim();

  return name ? { name } : undefined;
}

function inferLocation(lines: string[]): JobOffer['location'] {
  const postalLocation = lines
    .map((line) => /\b(\d{5})\s+([A-Za-zÀ-ÿ' -]{2,})/.exec(line))
    .find(Boolean);

  if (postalLocation) {
    return { postalCode: postalLocation[1], city: postalLocation[2].trim().replace(/[|•].*$/, '').trim() };
  }

  const cityLine = lines.find((line) => /\b(Paris|Lyon|Marseille|Toulouse|Bordeaux|Lille|Nantes|Strasbourg|Rennes|Montpellier)\b/i.test(line));
  const city = cityLine?.match(/\b(Paris|Lyon|Marseille|Toulouse|Bordeaux|Lille|Nantes|Strasbourg|Rennes|Montpellier)\b/i)?.[1];

  return city ? { city } : {};
}

function inferContractType(value: string): string | undefined {
  return /\b(CDI|CDD|alternance|apprentissage|stage|intérim|interim|freelance)\b/i.exec(value)?.[1];
}

function inferRemoteMode(value: string): RemoteMode | undefined {
  if (/\b(télétravail|teletravail|remote|à distance)\b/i.test(value)) return 'remote';
  if (/\b(hybride|hybrid)\b/i.test(value)) return 'hybrid';

  return undefined;
}

function extractSkills(value: string): SkillItem[] {
  const normalized = value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

  return COMMON_SKILLS.filter((skill) => {
    const skillPattern = skill
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\ /g, '\\s+');

    return new RegExp(`(^|[^a-z0-9])${skillPattern.toLowerCase()}($|[^a-z0-9])`, 'i').test(normalized);
  }).map((raw) => ({ raw }));
}

function extractKeywords(title: string): string[] {
  return title
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 8);
}

function normalizeApplicationUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value.trim());

    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

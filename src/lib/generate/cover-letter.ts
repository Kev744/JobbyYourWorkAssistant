import { readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  CandidateProfile,
  GeneratedResumeEvidence,
  JobOffer,
  ResumeVersionRecord,
  SkillItem,
} from '@/types';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_COVER_LETTER_MODEL = 'gpt-5.4';
const COVER_LETTER_INSTRUCTIONS_PATH = path.join(
  process.cwd(),
  'cover_letter_instruction',
  'cover_letter_prompt_instructions_project.md',
);

const COVER_LETTER_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    objectLine: { type: 'string' },
    greeting: { type: 'string' },
    paragraphs: {
      type: 'array',
      items: { type: 'string' },
    },
    closing: { type: 'string' },
    evidenceMap: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          generatedText: { type: 'string' },
          sourceType: { type: 'string', enum: ['profile', 'resume_version', 'offer'] },
          sourceField: { type: 'string' },
          sourceId: { type: 'string' },
          confidence: {
            type: 'string',
            enum: ['supported', 'user_confirmed', 'needs_review'],
          },
        },
        required: ['generatedText', 'sourceType', 'sourceField', 'sourceId', 'confidence'],
        additionalProperties: false,
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['title', 'objectLine', 'greeting', 'paragraphs', 'closing', 'evidenceMap', 'warnings'],
  additionalProperties: false,
} as const;

const COMPANY_RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    companyActivity: { type: 'string' },
    companyValues: {
      type: 'array',
      items: { type: 'string' },
    },
    currentContext: { type: 'string' },
    usefulForVousParagraph: { type: 'string' },
    companyAddress: {
      type: 'object',
      properties: {
        addressLine: { type: 'string' },
        postalCode: { type: 'string' },
        city: { type: 'string' },
      },
      required: ['addressLine', 'postalCode', 'city'],
      additionalProperties: false,
    },
    sources: {
      type: 'array',
      items: { type: 'string' },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: [
    'companyActivity',
    'companyValues',
    'currentContext',
    'usefulForVousParagraph',
    'companyAddress',
    'sources',
    'warnings',
  ],
  additionalProperties: false,
} as const;

export type GenerationHandoff = 'resume_generation' | 'cover_letter_generation';

interface OpenAIResponsePayload {
  output?: OpenAIResponseOutputItem[];
  error?: {
    message?: string;
  } | null;
}

interface OpenAIResponseOutputItem {
  content?: OpenAIResponseContentItem[];
}

interface OpenAIResponseContentItem {
  type?: string;
  text?: string;
}

interface OpenAICoverLetter {
  title: string;
  objectLine: string;
  greeting: string;
  paragraphs: string[];
  closing: string;
  evidenceMap: GeneratedResumeEvidence[];
  warnings: string[];
}

interface CompanyResearchContext {
  status: 'disabled' | 'no_company' | 'offer_context_sufficient' | 'web_search_used' | 'unavailable';
  companyActivity: string;
  companyValues: string[];
  currentContext: string;
  usefulForVousParagraph: string;
  companyAddress: CompanyPostalAddress;
  sources: string[];
  warnings: string[];
}

interface CompanyPostalAddress {
  addressLine: string;
  postalCode: string;
  city: string;
}

export interface CoverLetterDraft {
  title: string;
  content: string;
  evidenceMap: GeneratedResumeEvidence[];
  warnings: string[];
}

export function decideGenerationHandoff(value: unknown): GenerationHandoff | null {
  if (value === undefined || value === null || value === '') return 'resume_generation';
  if (value === 'resume') return 'resume_generation';
  if (value === 'cover_letter') return 'cover_letter_generation';

  return null;
}

export async function generateCoverLetterDraftWithOpenAI(input: {
  profile: CandidateProfile;
  offer: JobOffer;
  resumeVersion: ResumeVersionRecord;
  userInstructions?: string;
  openAiApiKey?: string;
}): Promise<CoverLetterDraft> {
  const apiKey = input.openAiApiKey?.trim() || process.env.OPENAI_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_KEY is missing.');
  }

  const instructions = loadCoverLetterInstructions();
  const matchingContext = buildCoverLetterMatchingContext(input.profile, input.offer);
  const companyResearch = await buildCompanyResearchContext(input.offer, apiKey);
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:
        process.env.OPENAI_COVER_LETTER_MODEL ||
        process.env.OPENAI_GENERATE_MODEL ||
        process.env.OPENAI_MODEL ||
        DEFAULT_COVER_LETTER_MODEL,
      instructions,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(
                {
                  candidateProfile: buildCoverLetterProfileContext(input.profile),
                  resumeVersion: {
                    id: input.resumeVersion.id,
                    title: input.resumeVersion.title,
                  },
                  jobOffer: buildCoverLetterOfferContext(input.offer),
                  matchingContext,
                  companyResearch,
                  userInstructions: input.userInstructions?.trim() || '',
                },
                null,
                2,
              ),
            },
          ],
        },
      ],
      max_output_tokens: 5_000,
      reasoning: { effort: 'low' },
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'cover_letter_generation',
          strict: true,
          schema: COVER_LETTER_SCHEMA,
        },
        verbosity: 'medium',
      },
    }),
  });
  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI cover letter generation failed.');
  }

  const parsed = JSON.parse(extractOutputText(payload)) as unknown;

  if (!isOpenAICoverLetter(parsed)) {
    throw new Error('OpenAI cover letter generation returned an invalid structure.');
  }

  return sanitizeCoverLetterDraft(parsed, {
    profile: input.profile,
    offer: input.offer,
    resumeVersion: input.resumeVersion,
    companyResearch,
  });
}

async function buildCompanyResearchContext(
  offer: JobOffer,
  apiKey: string,
): Promise<CompanyResearchContext> {
  const offerContext = extractOfferCompanyContext(offer);
  const offerAddress = extractCompanyAddressFromOffer(offer) ?? emptyCompanyAddress();

  if (!isCompanyResearchEnabled()) {
    return {
      status: 'disabled',
      companyActivity: '',
      companyValues: [],
      currentContext: '',
      usefulForVousParagraph: offerContext,
      companyAddress: offerAddress,
      sources: [],
      warnings: [],
    };
  }

  const companyName = safeText(offer.company?.name);

  if (!companyName) {
    return {
      status: 'no_company',
      companyActivity: '',
      companyValues: [],
      currentContext: '',
      usefulForVousParagraph: offerContext,
      companyAddress: offerAddress,
      sources: [],
      warnings: ['Recherche entreprise ignorée : nom d’entreprise absent dans l’offre.'],
    };
  }

  if (hasSufficientOfferCompanyContext(offer) && isCompleteCompanyAddress(offerAddress)) {
    return {
      status: 'offer_context_sufficient',
      companyActivity: '',
      companyValues: extractCompanyValueSignals(offer.description),
      currentContext: offerContext,
      usefulForVousParagraph: offerContext,
      companyAddress: offerAddress,
      sources: [],
      warnings: [],
    };
  }

  try {
    return await researchCompanyWithWebSearch(offer, companyName, apiKey);
  } catch {
    return {
      status: 'unavailable',
      companyActivity: '',
      companyValues: [],
      currentContext: '',
      usefulForVousParagraph: offerContext,
      companyAddress: offerAddress,
      sources: [],
      warnings: ['Recherche web indisponible : la lettre utilise uniquement le contenu de l’offre.'],
    };
  }
}

async function researchCompanyWithWebSearch(
  offer: JobOffer,
  companyName: string,
  apiKey: string,
): Promise<CompanyResearchContext> {
  if (!apiKey) {
    throw new Error('OPENAI_KEY is missing.');
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:
        process.env.OPENAI_COMPANY_RESEARCH_MODEL ||
        process.env.OPENAI_COVER_LETTER_MODEL ||
        process.env.OPENAI_MODEL ||
        DEFAULT_COVER_LETTER_MODEL,
      instructions: [
        'You research a company only to support the "Vous" paragraph of a French cover letter.',
        'Return concise JSON only. Use official or reliable public sources when web_search is useful.',
        'Also return the company postal address when a reliable current address is found.',
        'Do not infer candidate fit and do not request or use candidate personal data.',
        'If the company context is weak or ambiguous, keep fields blank and add a warning.',
      ].join(' '),
      tools: [
        {
          type: 'web_search',
          filters: {
            blocked_domains: ['wikipedia.org', 'reddit.com', 'quora.com', 'fandom.com'],
          },
          external_web_access: false,
        },
      ],
      tool_choice: 'auto',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(
                {
                  company: {
                    name: companyName,
                    location: offer.location,
                  },
                  job: {
                    title: offer.title,
                    source: offer.source,
                    sourceOfferId: offer.sourceOfferId,
                    descriptionExcerpt: safeText(offer.description).slice(0, 1_500),
                  },
                  requestedResearch:
                    'Find current public company activity, values, CSR/RSE signals, labels, culture, relevant business context for the cover letter "Vous" paragraph, and the company postal address. Return addressLine without ZIP/city, then postalCode and city separately.',
                },
                null,
                2,
              ),
            },
          ],
        },
      ],
      max_output_tokens: 2_000,
      reasoning: { effort: 'low' },
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'company_research',
          strict: true,
          schema: COMPANY_RESEARCH_SCHEMA,
        },
        verbosity: 'low',
      },
    }),
  });
  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI company research failed.');
  }

  const parsed = JSON.parse(extractOutputText(payload)) as unknown;

  if (!isCompanyResearchResult(parsed)) {
    throw new Error('OpenAI company research returned an invalid structure.');
  }

  return {
    status: 'web_search_used',
    companyActivity: safeText(parsed.companyActivity),
    companyValues: parsed.companyValues.map(safeText).filter(Boolean).slice(0, 6),
    currentContext: safeText(parsed.currentContext),
    usefulForVousParagraph: safeText(parsed.usefulForVousParagraph),
    companyAddress: sanitizeCompanyAddress(parsed.companyAddress) ?? emptyCompanyAddress(),
    sources: parsed.sources.map(safeText).filter(Boolean).slice(0, 8),
    warnings: parsed.warnings.map((warning) => warning.trim()).filter(Boolean),
  };
}

function loadCoverLetterInstructions(): string {
  return readFileSync(COVER_LETTER_INSTRUCTIONS_PATH, 'utf8');
}

function isCompanyResearchEnabled(): boolean {
  return process.env.ENABLE_COVER_LETTER_COMPANY_RESEARCH === 'true';
}

function sanitizeCoverLetterDraft(
  draft: OpenAICoverLetter,
  context: {
    profile: CandidateProfile;
    offer: JobOffer;
    resumeVersion: ResumeVersionRecord;
    companyResearch: CompanyResearchContext;
  },
): CoverLetterDraft {
  const content = buildCoverLetterContent(draft, context.profile, context.offer, context.companyResearch);
  const manualEvidenceMap = buildManualEvidenceMap(context.profile, context.offer, context.resumeVersion).filter(
    (evidence) => content.includes(evidence.generatedText),
  );
  const aiEvidenceMap = draft.evidenceMap
    .map((evidence) => ({
      generatedText: safeText(evidence.generatedText),
      sourceType: evidence.sourceType,
      sourceField: safeText(evidence.sourceField),
      sourceId:
        evidence.sourceType === 'offer'
          ? context.offer.offerId
          : evidence.sourceType === 'resume_version'
            ? context.resumeVersion.id
            : context.profile.id,
      confidence: evidence.confidence,
    }))
    .filter((evidence) => evidence.generatedText && content.includes(evidence.generatedText));

  return {
    title: safeText(draft.title) || `Lettre de motivation - ${safeText(context.offer.title)}`,
    content,
    evidenceMap: [...aiEvidenceMap, ...manualEvidenceMap],
    warnings: draft.warnings.map((warning) => warning.trim()).filter(Boolean),
  };
}

function buildCoverLetterContent(
  draft: OpenAICoverLetter,
  profile: CandidateProfile,
  offer: JobOffer,
  companyResearch: CompanyResearchContext,
): string {
  const identityLines = buildIdentityLines(profile);
  const recipientLines = buildRecipientLines(offer, companyResearch.companyAddress);
  const place = safeText(profile.scoringPayload.location?.city || offer.location.city);
  const dateLine = place
    ? `À ${place}, le ${formatFrenchDate(new Date())}`
    : `Le ${formatFrenchDate(new Date())}`;
  const signature = safeText(profile.identityContact.fullName || 'Candidat');
  const paragraphs = draft.paragraphs.map(safeParagraph).filter(Boolean).slice(0, 3);

  return normalizeContent(
    [
      '<div align="left">',
      ...identityLines,
      '</div>',
      '',
      '<div align="right">',
      ...recipientLines,
      '',
      dateLine,
      '</div>',
      '',
      '<div align="left">',
      safeText(draft.objectLine) || `Objet : Candidature au poste de ${safeText(offer.title)}`,
      '',
      safeText(draft.greeting) || 'Madame, Monsieur,',
      '</div>',
      '',
      '<div align="justify">',
      ...paragraphs.flatMap((paragraph) => [paragraph, '']),
      safeParagraph(draft.closing) ||
        'Dans l’attente de votre retour, je vous prie d’agréer, Madame, Monsieur, mes sincères salutations.',
      '</div>',
      '',
      '<div align="right">',
      signature,
      '</div>',
    ].join('\n'),
  );
}

function buildIdentityLines(profile: CandidateProfile): string[] {
  return [
    safeText(profile.identityContact.fullName || 'Candidat'),
    safeText(profile.identityContact.phone),
    safeText(profile.identityContact.email),
    ...splitAdditionalInformation(profile.identityContact.additionalInformation),
  ].filter((line): line is string => Boolean(line));
}

function splitAdditionalInformation(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\r?\n/)
    .map(safeText)
    .filter((line): line is string => Boolean(line));
}

function buildRecipientLines(offer: JobOffer, companyAddress?: CompanyPostalAddress): string[] {
  const companyName = safeText(offer.company?.name);
  const address = sanitizeCompanyAddress(companyAddress) ?? extractCompanyAddressFromOffer(offer);

  return [
    'À l’attention du service des ressources humaines',
    companyName,
    address?.addressLine,
    address ? `${address.postalCode} ${address.city}` : '',
  ].filter((line): line is string => Boolean(line));
}

function buildCoverLetterProfileContext(profile: CandidateProfile) {
  return {
    id: profile.id,
    summary: profile.summary,
    profession: profile.profession,
    professionalExperiences: profile.professionalExperiences,
    education: profile.education,
    certifications: profile.certifications,
    skills: profile.skills,
    languages: profile.languages,
    achievements: profile.achievements,
    romeCode: profile.romeCode,
    generationWarnings: profile.generationWarnings,
  };
}

function buildCoverLetterOfferContext(offer: JobOffer) {
  return {
    offerId: offer.offerId,
    source: offer.source,
    sourceOfferId: offer.sourceOfferId,
    title: offer.title,
    description: offer.description,
    company: offer.company,
    location: offer.location,
    remoteMode: offer.remoteMode,
    contract: offer.contract,
    salary: offer.salary,
    jobTarget: offer.jobTarget,
    skills: offer.skills,
    experienceRequirement: offer.experienceRequirement,
    educationRequirements: offer.educationRequirements,
    certificationRequirements: offer.certificationRequirements,
    languageRequirements: offer.languageRequirements,
    softSkills: offer.softSkills,
    keywords: offer.keywords,
    legalRequirements: offer.legalRequirements,
  };
}

function buildCoverLetterMatchingContext(profile: CandidateProfile, offer: JobOffer) {
  const offerSkillTokens = new Set((offer.skills ?? []).map((skill) => normalize(skill.raw)));
  const profileSkillTokens = new Set(profile.skills.map((skill) => normalize(skill.raw)));
  const matchedSkills = selectMatchedSkills(profile.skills, offer.skills).map((skill) => skill.raw);
  const missingOfferSkills = (offer.skills ?? [])
    .filter((skill) => !profileSkillTokens.has(normalize(skill.raw)))
    .map((skill) => skill.raw);
  const relevantExperiences = selectRelevantExperiences(profile, offer).slice(0, 2);

  return {
    matchedSkills,
    matchedOfferSkills: (offer.skills ?? [])
      .filter((skill) => offerSkillTokens.has(normalize(skill.raw)) && profileSkillTokens.has(normalize(skill.raw)))
      .map((skill) => skill.raw),
    missingOfferSkills,
    relevantExperiences,
    titlePattern: {
      candidateProfession: profile.profession,
      offerTitle: offer.title,
      sameRomeCode:
        Boolean(profile.romeCode) &&
        profile.romeCode !== 'Inconnu' &&
        profile.romeCode === offer.jobTarget.canonicalRomeCode,
    },
  };
}

function selectMatchedSkills(profileSkills: SkillItem[], offerSkills: SkillItem[]): SkillItem[] {
  if (offerSkills.length === 0) {
    return profileSkills.slice(0, 8);
  }

  const offerSkillTokens = new Set(offerSkills.map((skill) => normalize(skill.raw)));
  const matched = profileSkills.filter((skill) => offerSkillTokens.has(normalize(skill.raw)));

  return (matched.length > 0 ? matched : profileSkills).slice(0, 8);
}

function selectRelevantExperiences(profile: CandidateProfile, offer: JobOffer) {
  const offerTokens = normalize(`${offer.title} ${offer.description}`);
  const offerSkillTokens = (offer.skills ?? []).map((skill) => normalize(skill.raw));

  return profile.professionalExperiences
    .map((experience) => ({
      titleRaw: experience.titleRaw,
      companyName: experience.companyName,
      summary: experience.summary,
      skills: experience.skills,
      relevance:
        tokenOverlap(normalize(`${experience.titleRaw} ${experience.summary ?? ''}`), offerTokens) +
        (experience.skills ?? []).filter((skill) => offerSkillTokens.includes(normalize(skill.raw))).length,
    }))
    .filter((experience) => experience.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance);
}

function buildManualEvidenceMap(
  profile: CandidateProfile,
  offer: JobOffer,
  resumeVersion: ResumeVersionRecord,
): GeneratedResumeEvidence[] {
  return [
    ...buildEvidence(profile.id, 'profile', 'identityContact.fullName', buildIdentityLines(profile).slice(0, 1)),
    ...buildEvidence(profile.id, 'profile', 'identityContact', buildIdentityLines(profile).slice(1)),
    ...buildEvidence(offer.offerId, 'offer', 'title', [offer.title]),
    ...buildEvidence(offer.offerId, 'offer', 'company.name', [offer.company?.name ?? '']),
    ...buildEvidence(resumeVersion.id, 'resume_version', 'title', [resumeVersion.title]),
  ];
}

function buildEvidence(
  sourceId: string,
  sourceType: GeneratedResumeEvidence['sourceType'],
  sourceField: string,
  lines: string[],
): GeneratedResumeEvidence[] {
  return lines.map(safeText).filter(Boolean).map((line) => ({
    generatedText: line,
    sourceType,
    sourceField,
    sourceId,
    confidence: sourceType === 'offer' ? 'supported' : 'user_confirmed',
  }));
}

function extractOutputText(payload: OpenAIResponsePayload): string {
  const outputText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === 'output_text' && typeof content.text === 'string')
    .map((content) => content.text)
    .join('\n')
    .trim();

  if (!outputText) {
    throw new Error('OpenAI cover letter generation returned no text.');
  }

  return outputText;
}

function isOpenAICoverLetter(value: unknown): value is OpenAICoverLetter {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.title === 'string' &&
    typeof candidate.objectLine === 'string' &&
    typeof candidate.greeting === 'string' &&
    Array.isArray(candidate.paragraphs) &&
    candidate.paragraphs.every((paragraph) => typeof paragraph === 'string') &&
    typeof candidate.closing === 'string' &&
    Array.isArray(candidate.evidenceMap) &&
    candidate.evidenceMap.every(isGeneratedResumeEvidence) &&
    Array.isArray(candidate.warnings) &&
    candidate.warnings.every((warning) => typeof warning === 'string')
  );
}

function isCompanyResearchResult(value: unknown): value is Omit<CompanyResearchContext, 'status'> {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.companyActivity === 'string' &&
    Array.isArray(candidate.companyValues) &&
    candidate.companyValues.every((item) => typeof item === 'string') &&
    typeof candidate.currentContext === 'string' &&
    typeof candidate.usefulForVousParagraph === 'string' &&
    isCompanyAddressValue(candidate.companyAddress) &&
    Array.isArray(candidate.sources) &&
    candidate.sources.every((item) => typeof item === 'string') &&
    Array.isArray(candidate.warnings) &&
    candidate.warnings.every((item) => typeof item === 'string')
  );
}

function isCompanyAddressValue(value: unknown): value is CompanyPostalAddress {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.addressLine === 'string' &&
    typeof candidate.postalCode === 'string' &&
    typeof candidate.city === 'string'
  );
}

function isGeneratedResumeEvidence(value: unknown): value is GeneratedResumeEvidence {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.generatedText === 'string' &&
    ['profile', 'resume_version', 'offer'].includes(String(candidate.sourceType)) &&
    typeof candidate.sourceField === 'string' &&
    typeof candidate.sourceId === 'string' &&
    ['supported', 'user_confirmed', 'needs_review'].includes(String(candidate.confidence))
  );
}

function formatFrenchDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function normalizeContent(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractCompanyAddressFromOffer(offer: JobOffer): CompanyPostalAddress | null {
  const companyAddress = sanitizeCompanyAddress({
    addressLine: offer.company?.addressLine,
    postalCode: offer.company?.postalCode,
    city: offer.company?.city,
  });

  return companyAddress ?? extractCompanyAddressFromText(offer.description);
}

function extractCompanyAddressFromText(value: string): CompanyPostalAddress | null {
  const text = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const patterns = [
    /(?:adresse(?:\s+(?:de\s+l[’']entreprise|entreprise|soci[eé]t[eé]))?|si[eè]ge(?:\s+social)?|situ[eé]e?)\s*[:\-]\s*([^.;\n]+?),?\s+(\d{5})\s+([^.;,\n]+)/iu,
    /(\d+\s+(?:rue|avenue|av\.?|boulevard|bd|place|chemin|route|impasse|all[eé]e|cours)[^,.;\n]+),?\s+(\d{5})\s+([^.;,\n]+)/iu,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const address = sanitizeCompanyAddress({
      addressLine: match?.[1],
      postalCode: match?.[2],
      city: match?.[3],
    });

    if (address) return address;
  }

  return null;
}

function sanitizeCompanyAddress(value: unknown): CompanyPostalAddress | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<Record<keyof CompanyPostalAddress, unknown>>;
  const addressLine = cleanAddressPart(candidate.addressLine);
  const postalCode = safeText(typeof candidate.postalCode === 'string' ? candidate.postalCode : undefined);
  const city = cleanAddressPart(candidate.city);

  if (!addressLine || !/^\d{5}$/.test(postalCode) || !city) return null;

  return {
    addressLine,
    postalCode,
    city,
  };
}

function cleanAddressPart(value: unknown): string {
  return safeText(typeof value === 'string' ? value : undefined)
    .replace(/^[,:\-\s]+/, '')
    .replace(/[,:\-\s]+$/, '');
}

function emptyCompanyAddress(): CompanyPostalAddress {
  return {
    addressLine: '',
    postalCode: '',
    city: '',
  };
}

function isCompleteCompanyAddress(value: CompanyPostalAddress): boolean {
  return Boolean(sanitizeCompanyAddress(value));
}

function hasSufficientOfferCompanyContext(offer: JobOffer): boolean {
  const normalizedDescription = normalize(offer.description);
  const signalCount = [
    'valeur',
    'rse',
    'csr',
    'responsabilite sociale',
    'mission',
    'raison d etre',
    'label',
    'certifie',
    'certification',
    'culture',
    'engagement',
    'collaboration',
    'transparence',
    'inclusion',
    'diversite',
    'ethique',
    'environnement',
    'impact',
    'maniere de travailler',
  ].filter((signal) => normalizedDescription.includes(signal)).length;

  return signalCount >= 2;
}

function extractOfferCompanyContext(offer: JobOffer): string {
  const sentences = safeText(offer.description)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const contextualSentences = sentences.filter((sentence) => hasCompanySignal(sentence)).slice(0, 3);
  const source = contextualSentences.length > 0 ? contextualSentences : sentences.slice(0, 2);

  return source.join(' ').slice(0, 900);
}

function extractCompanyValueSignals(description: string): string[] {
  return Array.from(
    new Set(
      safeText(description)
        .split(/[,.;\n]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 2 && hasCompanySignal(item))
        .slice(0, 6),
    ),
  );
}

function hasCompanySignal(value: string): boolean {
  const normalizedValue = normalize(value);

  return [
    'valeur',
    'rse',
    'csr',
    'responsabilite sociale',
    'mission',
    'raison d etre',
    'label',
    'certifie',
    'certification',
    'culture',
    'engagement',
    'collaboration',
    'transparence',
    'inclusion',
    'diversite',
    'ethique',
    'environnement',
    'impact',
    'maniere de travailler',
  ].some((signal) => normalizedValue.includes(signal));
}

function safeParagraph(value: string | undefined): string {
  return safeText(value).slice(0, 900);
}

function safeText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function tokenOverlap(left: string, right: string): number {
  const rightTokens = new Set(right.split(/\s+/).filter((token) => token.length > 2));

  return left.split(/\s+/).filter((token) => rightTokens.has(token)).length;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\.js\b/g, '')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim();
}

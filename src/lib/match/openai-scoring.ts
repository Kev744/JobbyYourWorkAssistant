import type { CandidateResume, JobOffer, ScoredOffer, ScoreBreakdown } from '@/types';
import { compareScoredOffers } from '@/lib/match/prcv-r';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MATCH_MODEL = 'gpt-5.4-mini';

const MATCH_SCORING_SCHEMA = {
  type: 'object',
  properties: {
    scoredOffers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          offerId: { type: 'string' },
          finalScore: { type: 'number' },
          breakdown: {
            type: 'object',
            properties: {
              requiredCriteria: { type: 'number' },
              skillsAndTools: { type: 'number' },
              experienceRelevance: { type: 'number' },
              roleTitleSeniorityDomain: { type: 'number' },
              educationCertificationsLanguages: { type: 'number' },
              logisticsFit: { type: 'number' },
              evidenceQuality: { type: 'number' },
              capsApplied: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: [
              'requiredCriteria',
              'skillsAndTools',
              'experienceRelevance',
              'roleTitleSeniorityDomain',
              'educationCertificationsLanguages',
              'logisticsFit',
              'evidenceQuality',
              'capsApplied',
            ],
            additionalProperties: false,
          },
          matchedFeatures: {
            type: 'object',
            properties: {
              exactSkills: {
                type: 'array',
                items: { type: 'string' },
              },
              semanticSkills: {
                type: 'array',
                items: { type: 'string' },
              },
              missingMustHave: {
                type: 'array',
                items: { type: 'string' },
              },
              strengths: {
                type: 'array',
                items: { type: 'string' },
              },
              risks: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['exactSkills', 'semanticSkills', 'missingMustHave', 'strengths', 'risks'],
            additionalProperties: false,
          },
          explanation: { type: 'string' },
        },
        required: ['offerId', 'finalScore', 'breakdown', 'matchedFeatures', 'explanation'],
        additionalProperties: false,
      },
    },
  },
  required: ['scoredOffers'],
  additionalProperties: false,
} as const;

const MATCH_SCORING_INSTRUCTIONS = [
  'You are an ATS-style job matching evaluator for a French job-search application.',
  'Confront every relevant point of the candidate profile against each job offer: mandatory requirements, skills, tools, experience evidence, title/domain/seniority, education, certifications, languages, location, remote policy, contract, salary, and evidence quality.',
  'Use only information explicitly present in the provided candidate profile and job offer. Do not infer hidden experience or invent missing credentials.',
  'Return one score per offer out of 100 using this exact weighted breakdown:',
  'requiredCriteria: 30',
  'skillsAndTools: 20',
  'experienceRelevance: 20',
  'roleTitleSeniorityDomain: 10',
  'educationCertificationsLanguages: 10',
  'logisticsFit: 5',
  'evidenceQuality: 5',
  'Apply caps before finalScore when appropriate: missing legal or mandatory certification can cap at 0-30; missing most must-have requirements can cap at 59; clearly insufficient seniority can cap at 69; mandatory language gap of two or more CEFR levels can cap at 49.',
  'requiredCriteria means explicit mandatory conditions from the offer, not nice-to-have preferences.',
  'skillsAndTools must consider exact and semantic matches, but mark absent must-have skills in missingMustHave.',
  'logisticsFit covers location, remote mode, contract, availability, salary, working time, and practical fit when present.',
  'evidenceQuality rewards clearly evidenced matches from profile facts and penalizes vague or unsupported claims.',
  'Keep explanations concise, factual, and in French.',
].join('\n');

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

interface OpenAIScoringPayload {
  scoredOffers: OpenAIScoredOffer[];
}

interface OpenAIScoredOffer {
  offerId: string;
  finalScore: number;
  breakdown: {
    requiredCriteria: number;
    skillsAndTools: number;
    experienceRelevance: number;
    roleTitleSeniorityDomain: number;
    educationCertificationsLanguages: number;
    logisticsFit: number;
    evidenceQuality: number;
    capsApplied: string[];
  };
  matchedFeatures: {
    exactSkills: string[];
    semanticSkills: string[];
    missingMustHave: string[];
    strengths: string[];
    risks: string[];
  };
  explanation: string;
}

export async function scoreOffersWithOpenAI(input: {
  cv: CandidateResume;
  offers: JobOffer[];
  openAiApiKey?: string;
}): Promise<ScoredOffer[]> {
  if (input.offers.length === 0) {
    return [];
  }

  const apiKey = input.openAiApiKey?.trim() || process.env.OPENAI_KEY;

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
      model: process.env.OPENAI_MATCH_MODEL || process.env.OPENAI_MODEL || DEFAULT_MATCH_MODEL,
      instructions: MATCH_SCORING_INSTRUCTIONS,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(
                {
                  candidateProfile: input.cv,
                  jobOffers: input.offers.map(buildOfferScoringContext),
                  outputRules: {
                    scoreScale: '0-100',
                    finalScoreMustEqualCappedWeightedSum: true,
                    preserveOfferIds: true,
                  },
                },
                null,
                2,
              ),
            },
          ],
        },
      ],
      max_output_tokens: Math.min(20_000, 2_000 + input.offers.length * 1_200),
      reasoning: { effort: 'low' },
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'ats_match_scoring',
          strict: true,
          schema: MATCH_SCORING_SCHEMA,
        },
        verbosity: 'low',
      },
    }),
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI match scoring failed.');
  }

  const parsed = JSON.parse(extractOutputText(payload)) as unknown;

  if (!isOpenAIScoringPayload(parsed)) {
    throw new Error('OpenAI match scoring returned an invalid structure.');
  }

  return normalizeScoredOffers(parsed.scoredOffers, input.offers).sort(compareScoredOffers);
}

function normalizeScoredOffers(scoredOffers: OpenAIScoredOffer[], offers: JobOffer[]): ScoredOffer[] {
  const offerById = new Map(offers.map((offer) => [offer.offerId, offer]));
  const normalized: ScoredOffer[] = [];

  for (const scored of scoredOffers) {
    const offer = offerById.get(scored.offerId);

    if (!offer) {
      continue;
    }

    const breakdown = normalizeBreakdown(scored);

    normalized.push({
      offer,
      breakdown,
      matchedFeatures: {
        exactSkills: cleanStringList(scored.matchedFeatures.exactSkills),
        fuzzySkills: [],
        semanticSkills: [
          ...cleanStringList(scored.matchedFeatures.semanticSkills),
          ...cleanStringList(scored.matchedFeatures.strengths),
          ...cleanStringList(scored.matchedFeatures.risks).map((risk) => `Risque: ${risk}`),
        ],
        missingMustHave: cleanStringList(scored.matchedFeatures.missingMustHave),
      },
      explanation: cleanText(scored.explanation),
    });
  }

  return normalized;
}

function normalizeBreakdown(scored: OpenAIScoredOffer): ScoreBreakdown {
  const requiredCriteria = clamp(scored.breakdown.requiredCriteria, 0, 30);
  const skillsAndTools = clamp(scored.breakdown.skillsAndTools, 0, 20);
  const experienceRelevance = clamp(scored.breakdown.experienceRelevance, 0, 20);
  const roleTitleSeniorityDomain = clamp(scored.breakdown.roleTitleSeniorityDomain, 0, 10);
  const educationCertificationsLanguages = clamp(scored.breakdown.educationCertificationsLanguages, 0, 10);
  const logisticsFit = clamp(scored.breakdown.logisticsFit, 0, 5);
  const evidenceQuality = clamp(scored.breakdown.evidenceQuality, 0, 5);
  const weightedTotal =
    requiredCriteria +
    skillsAndTools +
    experienceRelevance +
    roleTitleSeniorityDomain +
    educationCertificationsLanguages +
    logisticsFit +
    evidenceQuality;
  const finalScore = clamp(scored.finalScore, 0, weightedTotal);

  return {
    skills: roundRatio(skillsAndTools / 20),
    title: roundRatio(roleTitleSeniorityDomain / 10),
    experience: roundRatio(experienceRelevance / 20),
    education: roundRatio(educationCertificationsLanguages / 10),
    certifications: roundRatio(educationCertificationsLanguages / 10),
    languages: roundRatio(educationCertificationsLanguages / 10),
    keywords: roundRatio(evidenceQuality / 5),
    softSkills: roundRatio(evidenceQuality / 5),
    location: roundRatio(logisticsFit / 5),
    salary: roundRatio(logisticsFit / 5),
    remote: roundRatio(logisticsFit / 5),
    mustHaveCoverage: roundRatio(requiredCriteria / 30),
    hardBlocker: scored.breakdown.capsApplied[0] ?? null,
    finalScore: Math.round(finalScore),
    requiredCriteria,
    skillsAndTools,
    experienceRelevance,
    roleTitleSeniorityDomain,
    educationCertificationsLanguages,
    logisticsFit,
    evidenceQuality,
    capsApplied: cleanStringList(scored.breakdown.capsApplied),
  };
}

function buildOfferScoringContext(offer: JobOffer) {
  return {
    offerId: offer.offerId,
    source: offer.source,
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

function extractOutputText(payload: OpenAIResponsePayload): string {
  const outputText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === 'output_text' && typeof content.text === 'string')
    .map((content) => content.text)
    .join('\n')
    .trim();

  if (!outputText) {
    throw new Error('OpenAI match scoring returned no text.');
  }

  return outputText;
}

function isOpenAIScoringPayload(value: unknown): value is OpenAIScoringPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return Array.isArray(candidate.scoredOffers) && candidate.scoredOffers.every(isOpenAIScoredOffer);
}

function isOpenAIScoredOffer(value: unknown): value is OpenAIScoredOffer {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<OpenAIScoredOffer>;

  return (
    typeof candidate.offerId === 'string' &&
    typeof candidate.finalScore === 'number' &&
    isBreakdown(candidate.breakdown) &&
    isMatchedFeatures(candidate.matchedFeatures) &&
    typeof candidate.explanation === 'string'
  );
}

function isBreakdown(value: unknown): value is OpenAIScoredOffer['breakdown'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<OpenAIScoredOffer['breakdown']>;

  return (
    typeof candidate.requiredCriteria === 'number' &&
    typeof candidate.skillsAndTools === 'number' &&
    typeof candidate.experienceRelevance === 'number' &&
    typeof candidate.roleTitleSeniorityDomain === 'number' &&
    typeof candidate.educationCertificationsLanguages === 'number' &&
    typeof candidate.logisticsFit === 'number' &&
    typeof candidate.evidenceQuality === 'number' &&
    Array.isArray(candidate.capsApplied) &&
    candidate.capsApplied.every((cap) => typeof cap === 'string')
  );
}

function isMatchedFeatures(value: unknown): value is OpenAIScoredOffer['matchedFeatures'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<OpenAIScoredOffer['matchedFeatures']>;

  return (
    Array.isArray(candidate.exactSkills) &&
    candidate.exactSkills.every((item) => typeof item === 'string') &&
    Array.isArray(candidate.semanticSkills) &&
    candidate.semanticSkills.every((item) => typeof item === 'string') &&
    Array.isArray(candidate.missingMustHave) &&
    candidate.missingMustHave.every((item) => typeof item === 'string') &&
    Array.isArray(candidate.strengths) &&
    candidate.strengths.every((item) => typeof item === 'string') &&
    Array.isArray(candidate.risks) &&
    candidate.risks.every((item) => typeof item === 'string')
  );
}

function cleanStringList(values: string[]): string[] {
  return values.map(cleanText).filter(Boolean).slice(0, 20);
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function roundRatio(value: number): number {
  return Math.round(clamp(value, 0, 1) * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

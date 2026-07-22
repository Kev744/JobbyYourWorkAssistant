import type {
  CandidateProfile,
  GeneratedResumeEvidence,
  JobOffer,
  ResumeVersionRecord,
  SkillItem,
} from '@/types';
import { sortLanguageItems } from '@/lib/language-levels';

export interface TailoredResumeDraft {
  title: string;
  content: string;
  evidenceMap: GeneratedResumeEvidence[];
  warnings: string[];
}

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_RESUME_GENERATION_MODEL = 'gpt-5.4';
const MAX_GENERATED_RESUME_LINES = 150;

const REQUIRED_RESUME_SECTIONS = [
  { title: 'Informations personnelles', maxLines: 4, visibleHeading: false },
  { title: 'Poste', maxLines: 1, visibleHeading: false },
  { title: 'Objectif professionnel', maxLines: 2, visibleHeading: true },
  { title: 'Compétences clés', maxLines: 6, visibleHeading: true },
  { title: 'Expérience professionnelle', maxLines: 8, visibleHeading: true },
  { title: 'Formation', maxLines: 3, visibleHeading: true },
  { title: 'Langues', maxLines: Number.MAX_SAFE_INTEGER, visibleHeading: true },
  { title: 'Certifications', maxLines: 2, visibleHeading: true },
  { title: 'Publications et projets', maxLines: 2, visibleHeading: true },
  { title: "Associations et centres d'intérêt", maxLines: 3, visibleHeading: true },
] as const;

const GENERATED_RESUME_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    content: { type: 'string' },
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
  required: ['title', 'content', 'evidenceMap', 'warnings'],
  additionalProperties: false,
} as const;

const OPENAI_GENERATION_INSTRUCTIONS = [
  'You are an agent specialized on hiring, you need to provide attracted sections and show the candidate matches with the job offer.',
  'Before to begin, you need to be careful on the AI section instructions and develop your answer on it.',
  'Generate only the AI-written sections of a tailored French resume from the provided candidate profile subset, job offer, matching context, and AI section instructions.',
  'First compare candidateProfile with jobOffer using matchingContext. Only after that comparison, write the AI sections.',
  'Use only facts explicitly present in candidateProfile, jobOffer, or matchingContext.',
  'Never invent employers, dates, diplomas, schools, credentials, certifications, skills, achievements, location, languages, or contact data.',
  'The final text must be valid UTF-8 French. Preserve accents such as Développeur and compétences, and use normal apostrophes.',
  'If the job offer requests a skill absent from the candidate profile, do not claim the candidate has it.',
  'Return only these visible level-3 sections in this exact order: Objectif professionnel, Compétences clés, Expérience professionnelle.',
  "Do not output contact details, Poste, Formation, Langues, Certifications, Publications et projets, Associations, centres d'intérêt, or any title named Informations personnelles or Profil.",
  'Prefer profile facts that match the job offer patterns: matched skills, the closest one or two relevant experiences, ROME/title proximity, and offer keywords.',
  'Write in French with simple professional syntax. Be concise, direct, ordered, ATS-compliant, and compact enough for exactly one page.',
  'Preserve UTF-8 French accents and apostrophes. Do not remove accents.',
  'Return Markdown-like plain text suitable for PDF/DOCX export. Do not return HTML.',
  'For evidenceMap, include short exact substrings from content and identify whether each one is supported by profile, resume_version, or offer.',
].join(' ');
const AI_SECTION_INSTRUCTIONS = [
  'Suivre le modèle source Modele CV ATS.pdf pour les sections rédigées par l\'IA.',
  'Rédiger uniquement ces sections, dans cet ordre :',
  '### Objectif professionnel',
  "Rédiger une phrase professionnelle naturelle ou deux, courte et spécifique au poste ciblé.",
  "Construire l'objectif après comparaison entre candidateProfile, jobOffer et matchingContext : citer les priorités du poste, les compétences confirmées les plus pertinentes et l'expérience la plus proche quand elles existent.",
  "Varier la formulation selon l'offre. Ne pas copier fallbackDraft, ne pas utiliser de phrase générique du type « souhaitant contribuer au poste » ou « répondre aux priorités du poste ».",
  "Rester créatif, pertinent et factuel : mettre en avant l'apport concret du candidat sans inventer de compétence, résultat, employeur ou date.",
  '### Compétences clés',
  "Lister les compétences pertinentes pour l'offre sous forme de puces, uniquement si elles existent dans le profil.",
  '### Expérience professionnelle',
  "Inclure seulement une à deux expériences les plus proches de l'offre.",
  'Sous chaque expérience, ajouter une à deux responsabilités ou réalisations factuelles.',
  "Utiliser des chiffres et résultats tangibles uniquement s'ils existent dans le profil.",
  "Ne pas rédiger les informations personnelles, le poste, la formation, les langues, les certifications, les projets, les associations ou les centres d'intérêt.",
  "Ces autres sections seront remplies automatiquement depuis le profil structuré, sans appel à l'IA.",
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

interface OpenAIGeneratedResume {
  title: string;
  content: string;
  evidenceMap: GeneratedResumeEvidence[];
  warnings: string[];
}

export function generateTailoredResumeDraft(input: {
  profile: CandidateProfile;
  offer: JobOffer;
  resumeVersion: ResumeVersionRecord;
  userInstructions?: string;
}): TailoredResumeDraft {
  const evidenceMap: GeneratedResumeEvidence[] = [];
  const warnings: string[] = [];
  const lines: string[] = [];
  const profile = input.profile;
  const offer = input.offer;
  const matchedSkills = selectMatchedSkills(profile.skills, offer.skills);
  const experiences = selectRelevantExperiences(profile, offer)
    .filter((experience) => experience.relevance > 0)
    .splice(0, 2);
  const certifications = profile.certifications.slice(0, 3);
  const languages = sortLanguageItems(profile.languages);
  const title = `CV ciblé - ${safeText(offer.title || profile.profession || 'Candidature')}`;
  const fullName = safeText(profile.identityContact.fullName || 'Candidat');
  const headline = safeText(profile.profession || profile.scoringPayload.headline || offer.title);

  addLine(lines, evidenceMap, fullName, {
    sourceType: 'profile',
    sourceField: 'identityContact.fullName',
    sourceId: profile.id,
    confidence: profile.identityContact.fullName ? 'user_confirmed' : 'needs_review',
  });
  addLine(lines, evidenceMap, headline, {
    sourceType: 'profile',
    sourceField: 'profession',
    sourceId: profile.id,
    confidence: profile.profession ? 'user_confirmed' : 'needs_review',
  });

  const contactLine = [profile.identityContact.email, profile.identityContact.phone]
    .map(safeText)
    .filter(Boolean)
    .join(' | ');

  if (contactLine) {
    addLine(lines, evidenceMap, contactLine, {
      sourceType: 'profile',
      sourceField: 'identityContact',
      sourceId: profile.id,
      confidence: 'user_confirmed',
    });
  }

  for (const line of splitAdditionalInformation(profile.identityContact.additionalInformation)) {
    addLine(lines, evidenceMap, line, {
      sourceType: 'profile',
      sourceField: 'identityContact.additionalInformation',
      sourceId: profile.id,
      confidence: 'user_confirmed',
    });
  }

  addBlank(lines);
  addSection(lines, evidenceMap, 'Cible', `Poste visé : ${safeText(offer.title)}`, {
    sourceType: 'offer',
    sourceField: 'title',
    sourceId: offer.offerId,
    confidence: 'supported',
  });

  if (offer.company?.name) {
    addLine(lines, evidenceMap, `Entreprise : ${safeText(offer.company.name)}`, {
      sourceType: 'offer',
      sourceField: 'company.name',
      sourceId: offer.offerId,
      confidence: 'supported',
    });
  }

  if (profile.summary) {
    addBlank(lines);
    addSection(lines, evidenceMap, 'Objectif professionnel', safeText(profile.summary), {
      sourceType: 'profile',
      sourceField: 'summary',
      sourceId: profile.id,
      confidence: 'user_confirmed',
    });
  }

  if (matchedSkills.length > 0) {
    addBlank(lines);
    addSection(lines, evidenceMap, 'Compétences clés', matchedSkills.map((skill) => skill.raw).join(' | '), {
      sourceType: 'profile',
      sourceField: 'skills',
      sourceId: profile.id,
      confidence: 'user_confirmed',
    });
  }

  if (experiences.length > 0) {
    addBlank(lines);
    lines.push('Expériences pertinentes');
    for (const experience of experiences) {
      const text = `- ${safeText(experience.titleRaw)}${experience.summary ? ` : ${safeText(experience.summary)}` : ''}`;
      addLine(lines, evidenceMap, text, {
        sourceType: 'profile',
        sourceField: 'professionalExperiences',
        sourceId: profile.id,
        confidence: 'user_confirmed',
      });
    }
  }

  if (profile.education.length > 0) {
    addBlank(lines);
    lines.push('Formation');
    for (const education of profile.education.slice(0, 2)) {
      addLine(lines, evidenceMap, `- ${safeText(education.degreeLabel || education.field || 'Formation confirmée')}`, {
        sourceType: 'profile',
        sourceField: 'education',
        sourceId: profile.id,
        confidence: 'user_confirmed',
      });
    }
  }

  if (certifications.length > 0) {
    addBlank(lines);
    lines.push('Certifications');
    for (const certification of certifications) {
      addLine(lines, evidenceMap, `- ${safeText(certification.label)}`, {
        sourceType: 'profile',
        sourceField: 'certifications',
        sourceId: profile.id,
        confidence: 'user_confirmed',
      });
    }
  }

  if (languages.length > 0) {
    addBlank(lines);
    lines.push('Langues');
    for (const language of languages) {
      addLine(lines, evidenceMap, `- ${languageLabel(language.code)}${language.cecrl ? ` ${language.cecrl}` : ''}`, {
        sourceType: 'profile',
        sourceField: 'languages',
        sourceId: profile.id,
        confidence: 'user_confirmed',
      });
    }
  }

  addBlank(lines);
  addSection(
    lines,
    evidenceMap,
    'Source corpus',
    `Version utilisée : ${safeText(input.resumeVersion.title)}`,
    {
      sourceType: 'resume_version',
      sourceField: 'title',
      sourceId: input.resumeVersion.id,
      confidence: 'supported',
    },
  );

  if (input.userInstructions?.trim()) {
    warnings.push(
      'Les consignes utilisateur ont été enregistrées, mais seules les informations confirmées ou sourcées ont été générées.',
    );
  }

  const content = trimToOnePage(lines).join('\n');

  return {
    title,
    content,
    evidenceMap: evidenceMap.filter((evidence) => content.includes(evidence.generatedText)),
    warnings,
  };
}

export async function generateTailoredResumeDraftWithOpenAI(input: {
  profile: CandidateProfile;
  offer: JobOffer;
  resumeVersion: ResumeVersionRecord;
  userInstructions?: string;
  openAiApiKey?: string;
}): Promise<TailoredResumeDraft> {
  const apiKey = input.openAiApiKey?.trim() || process.env.OPENAI_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_KEY is missing.');
  }

  const deterministicFallback = generateTailoredResumeDraft(input);
  const matchingContext = buildMatchingContext(input.profile, input.offer);
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:
        process.env.OPENAI_GENERATE_MODEL ||
        process.env.OPENAI_MODEL ||
        DEFAULT_RESUME_GENERATION_MODEL,
      instructions: OPENAI_GENERATION_INSTRUCTIONS,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(
                {
                  aiSectionInstructions: AI_SECTION_INSTRUCTIONS,
                  candidateProfile: buildAiProfileGenerationContext(input.profile),
                  resumeVersion: {
                    id: input.resumeVersion.id,
                    title: input.resumeVersion.title,
                  },
                  jobOffer: buildOfferGenerationContext(input.offer),
                  matchingContext,
                  userInstructions: input.userInstructions?.trim() || '',
                  fallbackDraft: buildAiOnlyFallbackDraft(input.profile, input.offer),
                },
                null,
                2,
              ),
            },
          ],
        },
      ],
      max_output_tokens: 8_000,
      reasoning: { effort: 'low' },
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'tailored_resume_generation',
          strict: true,
          schema: GENERATED_RESUME_SCHEMA,
        },
        verbosity: 'medium',
      },
    }),
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI tailored resume generation failed.');
  }

  const parsed = JSON.parse(extractOutputText(payload)) as unknown;

  if (!isOpenAIGeneratedResume(parsed)) {
    throw new Error('OpenAI tailored resume generation returned an invalid structure.');
  }

  return sanitizeOpenAIDraft(parsed, {
    fallbackTitle: deterministicFallback.title,
    fallbackEvidenceMap: deterministicFallback.evidenceMap,
    fallbackWarnings: deterministicFallback.warnings,
    profileId: input.profile.id,
    resumeVersionId: input.resumeVersion.id,
    offerId: input.offer.offerId,
    offerTitle: input.offer.title,
    profile: input.profile,
  });
}

function selectMatchedSkills(profileSkills: SkillItem[], offerSkills: SkillItem[]): SkillItem[] {
  if (offerSkills.length === 0) {
    return profileSkills.slice(0, 10);
  }

  const offerSkillTokens = new Set(offerSkills.map((skill) => normalize(skill.raw)));
  const matched = profileSkills.filter((skill) => offerSkillTokens.has(normalize(skill.raw)));

  return (matched.length > 0 ? matched : profileSkills).slice(0, 10);
}

function buildMatchingContext(profile: CandidateProfile, offer: JobOffer) {
  const matchedSkills = selectMatchedSkills(profile.skills, offer.skills).map((skill) => skill.raw);
  const offerSkillTokens = new Set((offer.skills ?? []).map((skill) => normalize(skill.raw)));
  const profileSkillTokens = new Set(profile.skills.map((skill) => normalize(skill.raw)));
  const missingOfferSkills = (offer.skills ?? [])
    .filter((skill) => !profileSkillTokens.has(normalize(skill.raw)))
    .map((skill) => skill.raw)
    .slice(0, 20);
  const relevantExperiences = selectRelevantExperiences(profile, offer)
    .filter((experience) => experience.relevance > 0)
    .slice(0, 2)
    .map((experience) => ({
      titleRaw: experience.titleRaw,
      summary: experience.summary,
      startDate: experience.startDate,
      endDate: experience.endDate,
      skills: (experience.skills ?? []).map((skill) => skill.raw),
      relevance: experience.relevance,
    }));
  const matchedOfferSkills = (offer.skills ?? [])
    .filter((skill) => offerSkillTokens.has(normalize(skill.raw)) && profileSkillTokens.has(normalize(skill.raw)))
    .map((skill) => skill.raw);

  return {
    matchedSkills,
    matchedOfferSkills,
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

function selectRelevantExperiences(profile: CandidateProfile, offer: JobOffer) {
  const offerTokens = normalize(`${offer.title} ${offer.description}`);
  const offerSkillTokens = (offer.skills ?? []).map((skill) => normalize(skill.raw));

  return profile.professionalExperiences
    .map((experience) => ({
      ...experience,
      relevance:
        tokenOverlap(normalize(`${experience.titleRaw} ${experience.summary ?? ''}`), offerTokens) +
        (experience.skills ?? []).filter((skill) => offerSkillTokens.includes(normalize(skill.raw))).length,
    }))
    .sort((a, b) => b.relevance - a.relevance);
}

function buildAiProfileGenerationContext(profile: CandidateProfile) {
  return {
    id: profile.id,
    summary: profile.summary,
    profession: profile.profession,
    professionalExperiences: profile.professionalExperiences,
    skills: profile.skills,
    romeCode: profile.romeCode,
    generationWarnings: profile.generationWarnings,
  };
}

function buildAiOnlyFallbackDraft(profile: CandidateProfile, offer: JobOffer): string {
  const matchedSkills = selectMatchedSkills(profile.skills, offer.skills);
  const experiences = selectRelevantExperiences(profile, offer)
    .filter((experience) => experience.relevance > 0)
    .slice(0, 2);
  const lines = [
    '### Objectif professionnel',
    safeText(profile.summary),
    '',
    '### Compétences clés',
    ...matchedSkills.slice(0, 6).map((skill) => `- ${safeText(skill.raw)}`),
    '',
    '### Expérience professionnelle',
    ...experiences.map((experience) =>
      `- ${safeText(experience.titleRaw)}${experience.summary ? ` : ${safeText(experience.summary)}` : ''}`,
    ),
  ];

  return lines.filter((line, index, all) => line || all[index - 1]).join('\n');
}

function buildOfferGenerationContext(offer: JobOffer) {
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

function extractOutputText(payload: OpenAIResponsePayload): string {
  const outputText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === 'output_text' && typeof content.text === 'string')
    .map((content) => content.text)
    .join('\n')
    .trim();

  if (!outputText) {
    throw new Error('OpenAI tailored resume generation returned no text.');
  }

  return outputText;
}

function isOpenAIGeneratedResume(value: unknown): value is OpenAIGeneratedResume {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.title === 'string' &&
    typeof candidate.content === 'string' &&
    Array.isArray(candidate.evidenceMap) &&
    candidate.evidenceMap.every(isGeneratedResumeEvidence) &&
    Array.isArray(candidate.warnings) &&
    candidate.warnings.every((warning) => typeof warning === 'string')
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

function sanitizeOpenAIDraft(
  draft: OpenAIGeneratedResume,
  fallback: {
    fallbackTitle: string;
    fallbackEvidenceMap: GeneratedResumeEvidence[];
    fallbackWarnings: string[];
    profileId: string;
    resumeVersionId: string;
    offerId: string;
    offerTitle: string;
    profile: CandidateProfile;
  },
): TailoredResumeDraft {
  const content = normalizeGeneratedContent(draft.content);
  const layoutContent = enforceResumeLayout(content, fallback.offerTitle, fallback.profile);
  const evidenceMap = draft.evidenceMap
    .map((evidence) => ({
      generatedText: safeText(evidence.generatedText),
      sourceType: evidence.sourceType,
      sourceField: safeText(evidence.sourceField),
      sourceId: normalizeEvidenceSourceId(evidence, fallback),
      confidence: evidence.confidence,
    }))
    .filter((evidence) => evidence.generatedText && layoutContent.includes(evidence.generatedText));
  const manualEvidenceMap = buildManualEvidenceMap(fallback.profile, fallback.offerId, fallback.offerTitle).filter(
    (evidence) => layoutContent.includes(evidence.generatedText),
  );

  return {
    title: safeText(draft.title) || fallback.fallbackTitle,
    content: layoutContent,
    evidenceMap:
      evidenceMap.length > 0 || manualEvidenceMap.length > 0
        ? [...evidenceMap, ...manualEvidenceMap]
        : fallback.fallbackEvidenceMap,
    warnings: [
      ...fallback.fallbackWarnings,
      ...draft.warnings.map((warning) => warning.trim()).filter(Boolean),
    ],
  };
}

function normalizeEvidenceSourceId(
  evidence: GeneratedResumeEvidence,
  fallback: {
    profileId: string;
    resumeVersionId: string;
    offerId: string;
  },
): string {
  if (evidence.sourceType === 'profile') return fallback.profileId;
  if (evidence.sourceType === 'resume_version') return fallback.resumeVersionId;

  return fallback.offerId;
}

function normalizeGeneratedContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
    .split('\n')
    .slice(0, MAX_GENERATED_RESUME_LINES)
    .join('\n');
}

function enforceResumeLayout(content: string, offerTitle: string, profile: CandidateProfile): string {
  const normalized = normalizeGeneratedContent(content);
  const lines = normalized.split('\n');
  const centeredTitleLine = `<p align="center">**${safeText(offerTitle)}**</p>`;
  const sectionMap = new Map<string, string[]>(
    REQUIRED_RESUME_SECTIONS.map((section) => [section.title, []]),
  );

  let currentSection: string | null = 'Objectif professionnel';

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (/^<p\s+align=["']center["']>.*<\/p>$/i.test(trimmed)) {
      currentSection = null;
      continue;
    }

    const heading = canonicalResumeSection(trimmed);

    if (heading) {
      currentSection = isAiGeneratedSection(heading) ? heading : null;
      continue;
    }

    if (currentSection) {
      const normalizedLine = normalizeGeneratedLine(trimmed);

      if (isInternalTemplateLabelLine(normalizedLine)) {
        continue;
      }

      sectionMap.get(currentSection)?.push(normalizedLine);
    }
  }

  const aiObjectiveLines = sectionMap.get('Objectif professionnel')?.filter(Boolean) ?? [];

  sectionMap.set('Informations personnelles', buildIdentityLines(profile));
  sectionMap.set('Poste', [centeredTitleLine]);
  sectionMap.set(
    'Objectif professionnel',
    aiObjectiveLines.length > 0 ? aiObjectiveLines : buildProfessionalObjectiveLines(profile, offerTitle),
  );
  sectionMap.set('Formation', buildEducationLines(profile));
  sectionMap.set('Langues', buildLanguageLines(profile));
  sectionMap.set('Certifications', buildCertificationLines(profile));
  sectionMap.set('Publications et projets', buildAchievementLines(profile));
  sectionMap.set("Associations et centres d'intérêt", buildHobbyLines(profile));

  const output: string[] = [];

  for (const section of REQUIRED_RESUME_SECTIONS) {
    const sectionLines = (sectionMap.get(section.title) ?? [])
      .filter(Boolean)
      .slice(0, section.maxLines);

    if (!section.visibleHeading) {
      if (sectionLines.length > 0) {
        output.push(...sectionLines, '');
      }
      continue;
    }

    if (sectionLines.length === 0) {
      continue;
    }

    output.push(`### ${section.title}`, '---', ...sectionLines, '');
  }

  return normalizeGeneratedContent(output.join('\n'));
}

function isAiGeneratedSection(section: string): boolean {
  return [
    'Objectif professionnel',
    'Compétences clés',
    'Expérience professionnelle',
  ].includes(section);
}

function buildIdentityLines(profile: CandidateProfile): string[] {
  const lines: string[] = [];
  const fullName = safeText(profile.identityContact.fullName);

  if (fullName) {
    lines.push(toStrongLine(fullName));
  }

  if (profile.identityContact.email) {
    lines.push(`Email : ${safeText(profile.identityContact.email)}`);
  }

  if (profile.identityContact.phone) {
    lines.push(`Téléphone : ${safeText(profile.identityContact.phone)}`);
  }

  lines.push(...splitAdditionalInformation(profile.identityContact.additionalInformation));

  const city = safeText(profile.scoringPayload.location?.city);

  if (city) {
    lines.push(`Ville : ${city}`);
  }

  return lines;
}

function splitAdditionalInformation(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\r?\n/)
    .map(safeText)
    .filter((line): line is string => Boolean(line));
}

function buildProfessionalObjectiveLines(profile: CandidateProfile, offerTitle: string): string[] {
  const role = safeText(profile.profession || profile.scoringPayload.headline);
  const target = safeText(offerTitle);
  const matchingSkills = profile.skills
    .filter((skill) => normalize(target).includes(normalize(skill.raw)))
    .map((skill) => safeText(skill.raw))
    .filter(Boolean)
    .slice(0, 3);
  const fallbackSkills = matchingSkills.length > 0
    ? matchingSkills
    : profile.skills.map((skill) => safeText(skill.raw)).filter(Boolean).slice(0, 3);
  const skillSegment = formatInlineList(fallbackSkills);
  const roleSegment = role || 'Candidat';
  const targetSegment = target ? ` au poste de ${target}` : '';
  const skillClause = skillSegment ? ` en mobilisant ${skillSegment}` : '';
  const objective = `${roleSegment} souhaitant contribuer${targetSegment}${skillClause}. Objectif : r\u00e9pondre aux priorit\u00e9s du poste avec une contribution concr\u00e8te, fiable et rapidement op\u00e9rationnelle.`;

  return safeText(objective) ? [safeText(objective)] : [];
}

function formatInlineList(items: string[]): string {
  const uniqueItems = Array.from(new Set(items.map(safeText).filter(Boolean)));

  if (uniqueItems.length <= 1) {
    return uniqueItems[0] ?? '';
  }

  return `${uniqueItems.slice(0, -1).join(', ')} et ${uniqueItems.at(-1)}`;
}

function buildEducationLines(profile: CandidateProfile): string[] {
  return profile.education.slice(0, 3).map((education) => {
    const label = safeText(education.degreeLabel || education.field || 'Formation confirmée');
    const details = [
      education.rncpLevel ? `RNCP ${education.rncpLevel}` : '',
      safeText(education.graduationDate ?? undefined),
    ].filter(Boolean);

    return details.length > 0 ? `- ${label} (${details.join(', ')})` : `- ${label}`;
  });
}

function buildLanguageLines(profile: CandidateProfile): string[] {
  return sortLanguageItems(profile.languages).map((language) => {
    const label = languageLabel(language.code);

    return `- ${label}${language.cecrl ? ` : ${language.cecrl}` : ''}`;
  });
}

function buildCertificationLines(profile: CandidateProfile): string[] {
  return profile.certifications.slice(0, 2).map((certification) => `- ${safeText(certification.label)}`);
}

function buildAchievementLines(profile: CandidateProfile): string[] {
  return profile.achievements.slice(0, 2).map((achievement) => `- ${safeText(achievement)}`);
}

function buildHobbyLines(profile: CandidateProfile): string[] {
  return profile.hobbies.slice(0, 3).map((hobby) => `- ${safeText(hobby)}`);
}

function buildManualEvidenceMap(
  profile: CandidateProfile,
  offerId: string,
  offerTitle: string,
): GeneratedResumeEvidence[] {
  return [
    ...buildProfileEvidence(profile, 'identityContact.fullName', buildIdentityLines(profile).slice(0, 1)),
    ...buildProfileEvidence(profile, 'identityContact', buildIdentityLines(profile).slice(1)),
    ...buildProfileEvidence(profile, 'education', buildEducationLines(profile)),
    ...buildProfileEvidence(profile, 'languages', buildLanguageLines(profile)),
    ...buildProfileEvidence(profile, 'certifications', buildCertificationLines(profile)),
    ...buildProfileEvidence(profile, 'achievements', buildAchievementLines(profile)),
    ...buildProfileEvidence(profile, 'hobbies', buildHobbyLines(profile)),
    {
      generatedText: `<p align="center">**${safeText(offerTitle)}**</p>`,
      sourceType: 'offer',
      sourceField: 'title',
      sourceId: offerId,
      confidence: 'supported',
    },
  ];
}

function buildProfileEvidence(
  profile: CandidateProfile,
  sourceField: string,
  lines: string[],
): GeneratedResumeEvidence[] {
  return lines.filter(Boolean).map((line) => ({
    generatedText: line,
    sourceType: 'profile',
    sourceField,
    sourceId: profile.id,
    confidence: 'user_confirmed',
  }));
}

function languageLabel(code: string): string {
  const normalized = normalize(code);
  const labels = new Map<string, string>([
    ['fr', 'Français'],
    ['en', 'Anglais'],
    ['es', 'Espagnol'],
    ['de', 'Allemand'],
    ['it', 'Italien'],
    ['pt', 'Portugais'],
  ]);

  if (normalized.includes('francais') || normalized === 'french') return labels.get('fr') ?? code;
  if (normalized.includes('anglais') || normalized === 'english') return 'Anglais';
  if (normalized.includes('espagnol') || normalized === 'spanish') return 'Espagnol';
  if (normalized.includes('allemand') || normalized === 'german') return 'Allemand';
  if (normalized.includes('italien') || normalized === 'italian') return 'Italien';
  if (normalized.includes('portugais') || normalized === 'portuguese') return 'Portugais';

  return labels.get(code.toLowerCase()) ?? code;
}

function canonicalResumeSection(line: string): string | null {
  const heading = line.replace(/^#{1,6}\s*/, '').trim();
  const normalized = normalize(heading);
  const aliases = new Map<string, string>([
    ['informations personnelles', 'Informations personnelles'],
    ['information personnelle', 'Informations personnelles'],
    ['profil', 'Objectif professionnel'],
    ['profile', 'Objectif professionnel'],
    ['poste', 'Poste'],
    ['objectif professionnel', 'Objectif professionnel'],
    ['competences cles', 'Compétences clés'],
    ['competence cles', 'Compétences clés'],
    ['competences', 'Compétences clés'],
    ['experience professionnelle', 'Expérience professionnelle'],
    ['experiences professionnelles', 'Expérience professionnelle'],
    ['formation', 'Formation'],
    ['parcours scolaire', 'Formation'],
    ['langues', 'Langues'],
    ['certifications', 'Certifications'],
    ['publications et projets', 'Publications et projets'],
    ['projets', 'Publications et projets'],
    ['realisations', 'Publications et projets'],
    ['hobbies', "Associations et centres d'intérêt"],
    ['associations et centres d interet', "Associations et centres d'intérêt"],
    ['centres d interet', "Associations et centres d'intérêt"],
  ]);

  return aliases.get(normalized) ?? null;
}

function normalizeGeneratedLine(line: string): string {
  return line.replace(/^#{1,6}\s*/, '').trim();
}

function isInternalTemplateLabelLine(line: string): boolean {
  const cleaned = cleanStrongMarkup(line)
    .replace(/^[-*]\s*/, '')
    .trim();
  const normalized = normalize(cleaned);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  return (
    tokens.includes('profile') ||
    normalized === 'profile' ||
    normalized.startsWith('profile ') ||
    normalized === 'profil' ||
    normalized.startsWith('profil ') ||
    normalized === 'poste' ||
    normalized.startsWith('poste ') ||
    normalized === 'informations personnelles' ||
    normalized.startsWith('informations personnelles ')
  );
}

function toStrongLine(line: string): string {
  const cleaned = cleanStrongMarkup(line);

  return cleaned ? `**${cleaned}**` : '';
}

function cleanStrongMarkup(line: string): string {
  return line.replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
}

function addSection(
  lines: string[],
  evidenceMap: GeneratedResumeEvidence[],
  heading: string,
  text: string,
  evidence: Omit<GeneratedResumeEvidence, 'generatedText'>,
): void {
  lines.push(heading);
  addLine(lines, evidenceMap, text, evidence);
}

function addLine(
  lines: string[],
  evidenceMap: GeneratedResumeEvidence[],
  text: string,
  evidence: Omit<GeneratedResumeEvidence, 'generatedText'>,
): void {
  const cleaned = safeText(text);

  if (!cleaned) {
    return;
  }

  lines.push(cleaned);
  evidenceMap.push({
    generatedText: cleaned,
    ...evidence,
  });
}

function addBlank(lines: string[]): void {
  if (lines.at(-1) !== '') {
    lines.push('');
  }
}

function trimToOnePage(lines: string[]): string[] {
  return lines.filter((line, index, all) => line || all[index - 1]).slice(0, 46);
}

function tokenOverlap(left: string, right: string): number {
  const rightTokens = new Set(right.split(/\s+/).filter((token) => token.length > 2));

  return left.split(/\s+/).filter((token) => rightTokens.has(token)).length;
}

function safeText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 600);
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

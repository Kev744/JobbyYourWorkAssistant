import type {
  CandidateProfile,
  CandidateResume,
  CertificationItem,
  EducationItem,
  LanguageItem,
  SkillItem,
} from '@/types';
import { normalizeLanguageLevel, sortLanguageItems } from '@/lib/language-levels';
import { extractConfidentialContactInfo } from '@/lib/profile/contact-extractor';
import {
  cleanProfessionalExperienceSummary,
  extractEducationItems,
  extractProfessionalExperiences,
} from '@/lib/profile/profile-item-parser';
import type { ResumeSectionExtraction } from '@/lib/profile/resume-section-extractor';

type ProfileDraft = Omit<CandidateProfile, 'id' | 'createdAt' | 'updatedAt'>;

const SECTION_ALIASES = {
  summary: ['profil', 'profile', 'résumé', 'resume', 'présentation', 'presentation'],
  profession: [
    'profession',
    'métier',
    'metier',
    'poste',
    'poste recherché',
    'poste recherche',
    'titre',
    'intitulé',
    'intitule',
    'objectif',
    'objectif professionnel',
    'professional title',
    'target role',
  ],
  education: ['formation', 'éducation', 'education', 'diplômes', 'diplomes'],
  professionalExperiences: [
    'expériences professionnelles',
    'experiences professionnelles',
    'expérience professionnelle',
    'experience professionnelle',
    'expériences',
    'experiences',
    'professional experiences',
    'professional experience',
  ],
  hobbies: [
    'centres d’intérêt',
    'centres d’interet',
    "centres d'intérêt",
    "centres d'interet",
    'loisirs',
    'hobbies',
  ],
  certifications: ['certifications', 'certificats'],
  skills: ['compétences', 'competences', 'skills'],
  languages: [
    'langues',
    'langue',
    'languages',
    'language',
    'compétences linguistiques',
    'competences linguistiques',
    'niveaux de langue',
    'niveau de langue',
    'langues étrangères',
    'langues etrangeres',
  ],
  achievements: ['réalisations', 'realisations', 'projets', 'achievements'],
} as const;

export function generateCandidateProfileDraft(params: {
  resumeVersionId: string;
  corpusContent: string;
  title: string;
  romeCode: string;
  romePredictionScore: number;
  extractedSections?: ResumeSectionExtraction | null;
  identityCorpusContent?: string;
}): ProfileDraft {
  const sections = params.extractedSections
    ? sectionMapFromExtraction(params.extractedSections)
    : splitSections(params.corpusContent);
  const summary = firstSection(sections, SECTION_ALIASES.summary) || firstParagraph(params.corpusContent);
  const profession =
    firstSection(sections, SECTION_ALIASES.profession) || inferProfession(params.title, summary);
  const skills = toSkillItems(firstSection(sections, SECTION_ALIASES.skills));
  const education =
    params.extractedSections?.educationItems.length
      ? params.extractedSections.educationItems.map(toEducationItem)
      : extractEducationItems(firstSection(sections, SECTION_ALIASES.education));
  const professionalExperiences =
    params.extractedSections?.professionalExperienceItems.length
      ? params.extractedSections.professionalExperienceItems.map(toProfessionalExperienceItem)
      : extractProfessionalExperiences(firstSection(sections, SECTION_ALIASES.professionalExperiences));
  const certifications = toCertificationItems(firstSection(sections, SECTION_ALIASES.certifications));
  const languages = toLanguageItems(firstSection(sections, SECTION_ALIASES.languages));
  const hobbies = toLineItems(firstSection(sections, SECTION_ALIASES.hobbies));
  const achievements = toLineItems(firstSection(sections, SECTION_ALIASES.achievements));
  const contactInfo =
    params.extractedSections?.identityContact ??
    extractConfidentialContactInfo(params.identityCorpusContent ?? params.corpusContent);
  const identityContact = {
    fullName: contactInfo.fullName,
    email: contactInfo.email,
    phone: contactInfo.phone,
  };
  const warnings = [
    ...buildWarnings({
      summary,
      profession,
      skills,
      education,
      professionalExperiences,
      certifications,
      languages,
      hobbies,
      achievements,
    }),
    ...(params.extractedSections?.warnings ?? []),
  ];
  const scoringPayload: CandidateResume = {
    candidateId: params.resumeVersionId,
    headline: profession,
    titles: profession ? [{ raw: profession, canonicalRomeCode: normalizeRomeCode(params.romeCode) }] : [],
    experiences: professionalExperiences,
    skills,
    education,
    location: contactInfo.city
      ? {
          city: contactInfo.city,
          postalCode: contactInfo.postalCode,
        }
      : undefined,
    certifications,
    languages,
    keywords: [],
    softSkills: [],
  };

  return {
    resumeVersionId: params.resumeVersionId,
    summary,
    profession,
    education,
    professionalExperiences,
    hobbies,
    certifications,
    skills,
    languages,
    achievements,
    identityContact,
    scoringPayload,
    romeCode: params.romeCode,
    romePredictionScore: params.romePredictionScore,
    generationWarnings: warnings,
    confirmationStatus: 'draft',
  };
}

interface SectionMap {
  [heading: string]: string;
}

function splitSections(content: string): SectionMap {
  const sections: SectionMap = {};
  let currentHeading = 'profil';

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = normalizeHeading(line);

    if (heading) {
      currentHeading = heading;
      sections[currentHeading] = sections[currentHeading] ?? '';
      continue;
    }

    if (line) {
      sections[currentHeading] = `${sections[currentHeading] ?? ''}\n${line}`.trim();
    }
  }

  return sections;
}

function sectionMapFromExtraction(extraction: ResumeSectionExtraction): SectionMap {
  return {
    profil: extraction.profile,
    profession: extraction.profession,
    formation: extraction.education,
    'experiences professionnelles': extraction.professionalExperiences,
    competences: extraction.skills,
    langues: extraction.languages,
    certifications: extraction.certifications,
    hobbies: extraction.hobbies,
  };
}

function toProfessionalExperienceItem(
  item: ResumeSectionExtraction['professionalExperienceItems'][number],
): CandidateProfile['professionalExperiences'][number] {
  return {
    titleRaw: item.titleRaw,
    companyName: item.companyName,
    location: item.location || undefined,
    summary: cleanProfessionalExperienceSummary(item.summary, item),
    startDate: item.startDate,
    endDate: item.endDate,
  };
}

function toEducationItem(item: ResumeSectionExtraction['educationItems'][number]): EducationItem {
  return {
    degreeLabel: item.degreeLabel,
    schoolName: item.schoolName,
    field: item.field,
    graduationDate: item.graduationDate,
  };
}

function normalizeHeading(line: string): string | null {
  const cleaned = line
    .replace(/^#{1,4}\s*/, '')
    .replace(/[*:_-]+$/g, '')
    .trim();
  const normalized = normalizeText(cleaned);
  const allHeadings = Object.values(SECTION_ALIASES).flat();

  return allHeadings.some((heading) => normalizeText(heading) === normalized) ? normalized : null;
}

function firstSection(sections: SectionMap, aliases: readonly string[]): string {
  for (const alias of aliases) {
    const value = sections[normalizeText(alias)];
    if (value) return value.trim();
  }

  return '';
}

function firstParagraph(content: string): string {
  return content
    .split(/\n\s*\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 600) ?? '';
}

function inferProfession(title: string, summary: string): string {
  const cleanedTitle = title.replace(/\.[^.]+$/, '').trim();

  if (cleanedTitle && !/^version/i.test(cleanedTitle)) {
    return cleanedTitle;
  }

  return summary.split(/[.\n]/)[0]?.trim().slice(0, 160) ?? '';
}

function toLineItems(value: string): string[] {
  return value
    .split(/\n|;|•/)
    .map((item) => item.trim().replace(/^[-*]\s*/, ''))
    .filter((item) => item.length > 0)
    .slice(0, 30);
}

function toSkillItems(value: string): SkillItem[] {
  return value
    .split(/,|\n|;|•/)
    .map((item) => item.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean)
    .slice(0, 80)
    .map((raw) => ({ raw }));
}

function toCertificationItems(value: string): CertificationItem[] {
  return toLineItems(value).map((label) => ({ label }));
}

function toLanguageItems(value: string): LanguageItem[] {
  return sortLanguageItems(toLineItems(value).map((line) => {
    const cecrl = normalizeLanguageLevel(line);
    const code = inferCanonicalLanguageName(line);

    return { code, cecrl };
  }));
}

function inferCanonicalLanguageName(value: string): string {
  const normalized = normalizeText(value);

  if (normalized.includes('anglais') || normalized.includes('english') || normalized === 'en') return 'Anglais';
  if (normalized.includes('espagnol') || normalized.includes('spanish') || normalized === 'es') return 'Espagnol';
  if (normalized.includes('allemand') || normalized.includes('german') || normalized === 'de') return 'Allemand';
  if (normalized.includes('italien') || normalized.includes('italian') || normalized === 'it') return 'Italien';
  if (normalized.includes('francais') || normalized.includes('french') || normalized === 'fr') return 'Français';
  if (normalized.includes('portugais') || normalized.includes('portuguese') || normalized === 'pt') return 'Portugais';

  return normalized.split(/\s+/)[0]?.slice(0, 12) || 'unknown';
}

function buildWarnings(profile: {
  summary: string;
  profession: string;
  skills: SkillItem[];
  education: unknown[];
  professionalExperiences: unknown[];
  certifications: unknown[];
  languages: unknown[];
  hobbies: unknown[];
  achievements: unknown[];
}): string[] {
  const warnings: string[] = [];

  if (!profile.summary) warnings.push('Profil laissé vide : aucune information explicite trouvée.');
  if (!profile.profession) warnings.push('Profession laissée vide : aucune information explicite trouvée.');
  if (profile.skills.length === 0) warnings.push('Compétences laissées vides : aucune liste explicite trouvée.');
  if (profile.education.length === 0) warnings.push('Formation laissée vide : aucune section explicite trouvée.');
  if (profile.professionalExperiences.length === 0) {
    warnings.push('Expériences professionnelles laissées vides : aucune section explicite trouvée.');
  }
  if (profile.certifications.length === 0) warnings.push('Certifications laissées vides.');
  if (profile.languages.length === 0) warnings.push('Langues laissées vides.');
  if (profile.hobbies.length === 0) warnings.push('Centres d’intérêt laissés vides.');
  if (profile.achievements.length === 0) warnings.push('Réalisations laissées vides.');

  return warnings;
}

function normalizeRomeCode(romeCode: string): string | undefined {
  return romeCode === 'Inconnu' ? undefined : romeCode;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

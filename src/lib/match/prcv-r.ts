import type {
  CandidateResume,
  Cecrl,
  CertificationItem,
  EducationItem,
  JobOffer,
  LanguageItem,
  RemoteMode,
  ScoredOffer,
  ScoreBreakdown,
  SkillItem,
} from '@/types';
import { toComparableCecrl } from '@/lib/language-levels';

const WEIGHTS = {
  skills: 0.35,
  title: 0.15,
  experience: 0.15,
  education: 0.08,
  certifications: 0.05,
  languages: 0.06,
  keywords: 0.04,
  softSkills: 0.04,
  location: 0.03,
  salary: 0.03,
  remote: 0.02,
} as const;

const CECRL_ORDER: Cecrl[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEGAL_TERMS = ['permis', 'habilitation', 'autorisation', 'carte professionnelle'];

interface SkillMatch {
  offerSkill: SkillItem;
  score: number;
  type: 'exact' | 'fuzzy' | 'missing';
  matchedRaw?: string;
}

interface ScoreCapsInput {
  raw: number;
  mustHaveCoverage: number;
  hardBlocker: string | null;
  experienceScore: number;
  languageGap: number;
  minimumExperienceYears?: number;
}

export function scoreOfferAgainstCv(cv: CandidateResume, offer: JobOffer): ScoredOffer {
  const skillMatches = matchSkills(cv.skills ?? [], offer.skills ?? []);
  const skills = scoreSkills(skillMatches, offer.skills ?? []);
  const title = scoreTitle(cv, offer);
  const experience = scoreExperience(cv, offer);
  const education = scoreEducation(cv.education ?? [], offer.educationRequirements ?? []);
  const certifications = scoreCertifications(cv.certifications ?? [], offer.certificationRequirements ?? []);
  const languages = scoreLanguages(cv.languages ?? [], offer.languageRequirements ?? []);
  const keywords = scoreTextSet(cv.keywords ?? [], offer.keywords ?? []);
  const softSkills = scoreTextSet(cv.softSkills ?? [], offer.softSkills ?? []);
  const location = scoreLocation(cv.location, offer);
  const salary = scoreSalary(cv.targetSalary, offer.salary);
  const remote = scoreRemote(cv.location?.remotePreference, offer.remoteMode);
  const mustHaveCoverage = computeMustHaveCoverage(skillMatches, offer.skills ?? []);
  const hardBlocker = detectHardBlocker(cv, offer);
  const raw =
    100 *
    (WEIGHTS.skills * skills +
      WEIGHTS.title * title +
      WEIGHTS.experience * experience +
      WEIGHTS.education * education +
      WEIGHTS.certifications * certifications +
      WEIGHTS.languages * languages.score +
      WEIGHTS.keywords * keywords +
      WEIGHTS.softSkills * softSkills +
      WEIGHTS.location * location +
      WEIGHTS.salary * salary +
      WEIGHTS.remote * remote);
  const finalScore = applyCaps({
    raw,
    mustHaveCoverage,
    hardBlocker,
    experienceScore: experience,
    languageGap: languages.maxMandatoryGap,
    minimumExperienceYears: offer.experienceRequirement?.minYears,
  });
  const matchedFeatures = buildMatchedFeatures(skillMatches, offer.skills ?? []);
  const breakdown: ScoreBreakdown = {
    skills: roundScore(skills),
    title: roundScore(title),
    experience: roundScore(experience),
    education: roundScore(education),
    certifications: roundScore(certifications),
    languages: roundScore(languages.score),
    keywords: roundScore(keywords),
    softSkills: roundScore(softSkills),
    location: roundScore(location),
    salary: roundScore(salary),
    remote: roundScore(remote),
    mustHaveCoverage: roundScore(mustHaveCoverage),
    hardBlocker,
    finalScore: roundScore(finalScore),
  };

  return {
    offer,
    breakdown,
    matchedFeatures,
    explanation: buildFrenchExplanation(breakdown, matchedFeatures),
  };
}

export function rankOffers(cv: CandidateResume, offers: JobOffer[]): ScoredOffer[] {
  return offers.map((offer) => scoreOfferAgainstCv(cv, offer)).sort(compareScoredOffers);
}

export function compareScoredOffers(a: ScoredOffer, b: ScoredOffer): number {
  return (
    b.breakdown.finalScore - a.breakdown.finalScore ||
    b.breakdown.mustHaveCoverage - a.breakdown.mustHaveCoverage ||
    b.breakdown.experience - a.breakdown.experience ||
    b.breakdown.title - a.breakdown.title ||
    b.breakdown.location + b.breakdown.remote - (a.breakdown.location + a.breakdown.remote) ||
    b.breakdown.salary - a.breakdown.salary ||
    comparePublishedAt(b.offer.publishedAt, a.offer.publishedAt) ||
    a.offer.offerId.localeCompare(b.offer.offerId)
  );
}

export function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\.js\b/g, '')
    .replace(/\bjs\b/g, 'javascript')
    .replace(/\bts\b/g, 'typescript')
    .replace(/\bc sharp\b/g, 'c#')
    .replace(/\bf sharp\b/g, 'f#')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .replace(/(?:^|\s)\+(?=\s|$)/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function matchSkills(cvSkills: SkillItem[], offerSkills: SkillItem[]): SkillMatch[] {
  const normalizedCvSkills = cvSkills.map((skill) => ({
    raw: skill.raw,
    normalized: normalizeSkill(skill),
  }));

  return offerSkills.map((offerSkill) => {
    const normalizedOfferSkill = normalizeSkill(offerSkill);
    const exact = normalizedCvSkills.find((skill) => skill.normalized === normalizedOfferSkill);

    if (exact) {
      return { offerSkill, score: 1, type: 'exact', matchedRaw: exact.raw };
    }

    const fuzzy = normalizedCvSkills
      .map((skill) => ({
        ...skill,
        similarity: tokenSimilarity(skill.normalized, normalizedOfferSkill),
      }))
      .sort((a, b) => b.similarity - a.similarity)[0];

    if (fuzzy && fuzzy.similarity >= 0.82) {
      return { offerSkill, score: 0.75, type: 'fuzzy', matchedRaw: fuzzy.raw };
    }

    return { offerSkill, score: 0, type: 'missing' };
  });
}

function scoreSkills(matches: SkillMatch[], offerSkills: SkillItem[]): number {
  if (offerSkills.length === 0) {
    return 0.6;
  }

  const denominator = offerSkills.reduce((sum, skill) => sum + importanceWeight(skill), 0);
  const numerator = matches.reduce(
    (sum, match) => sum + importanceWeight(match.offerSkill) * match.score,
    0,
  );

  return clamp01(numerator / denominator);
}

function computeMustHaveCoverage(matches: SkillMatch[], offerSkills: SkillItem[]): number {
  const mustSkills = offerSkills.filter((skill) => skill.importance === 'must');

  if (mustSkills.length === 0) {
    return 1;
  }

  const matched = matches.filter(
    (match) => match.offerSkill.importance === 'must' && match.score > 0,
  ).length;

  return matched / mustSkills.length;
}

function scoreTitle(cv: CandidateResume, offer: JobOffer): number {
  const offerRome = offer.jobTarget.canonicalRomeCode;
  const cvRomeCodes = cv.titles.map((title) => title.canonicalRomeCode).filter(Boolean);

  if (offerRome && cvRomeCodes.includes(offerRome)) {
    return 1;
  }

  if (
    offerRome &&
    cvRomeCodes.some((code) => code && code.slice(0, 3).toUpperCase() === offerRome.slice(0, 3).toUpperCase())
  ) {
    return 0.85;
  }

  const cvTitles = [cv.headline, ...cv.titles.map((title) => title.raw)].filter(Boolean);
  const bestSimilarity = Math.max(
    0,
    ...cvTitles.map((title) => tokenSimilarity(normalizeToken(title), normalizeToken(offer.title))),
  );

  return bestSimilarity >= 0.35 ? bestSimilarity : 0;
}

function scoreExperience(cv: CandidateResume, offer: JobOffer): number {
  const minYears = offer.experienceRequirement?.minYears;

  if (!minYears || minYears <= 0) {
    return 0.6;
  }

  const relevantYears = computeRelevantExperienceYears(cv, offer);

  return clamp01(relevantYears / minYears);
}

export function computeRelevantExperienceYears(cv: CandidateResume, offer: JobOffer): number {
  const offerTitle = normalizeToken(offer.title);
  const offerSkills = new Set((offer.skills ?? []).map(normalizeSkill));

  return cv.experiences.reduce((sum, experience) => {
    const titleScore = tokenSimilarity(normalizeToken(experience.titleRaw), offerTitle);
    const skillOverlap = (experience.skills ?? []).some((skill) => offerSkills.has(normalizeSkill(skill)));
    const romeMatch =
      experience.canonicalRomeCode &&
      offer.jobTarget.canonicalRomeCode &&
      experience.canonicalRomeCode === offer.jobTarget.canonicalRomeCode;

    if (titleScore < 0.25 && !skillOverlap && !romeMatch) {
      return sum;
    }

    return sum + computeExperienceYears(experience.startDate, experience.endDate);
  }, 0);
}

function computeExperienceYears(startDate?: string, endDate?: string | null): number {
  if (!startDate) {
    return 0;
  }

  const start = parsePartialDate(startDate);
  const end = endDate ? parsePartialDate(endDate) : new Date();

  if (!start || !end || end <= start) {
    return 0;
  }

  return (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

function scoreEducation(cvEducation: EducationItem[], requirements: EducationItem[]): number {
  if (requirements.length === 0) {
    return 0.6;
  }

  const scores = requirements.map((requirement) => {
    const best = Math.max(
      0,
      ...cvEducation.map((education) => {
        const level = scoreRncpLevel(education.rncpLevel, requirement.rncpLevel);
        const field = scoreField(education.field ?? education.degreeLabel, requirement.field ?? requirement.degreeLabel);

        return 0.7 * level + 0.3 * field;
      }),
    );

    return requirement.mandatory ? best : Math.max(0.6, best);
  });

  return average(scores);
}

function scoreCertifications(cvCertifications: CertificationItem[], requirements: CertificationItem[]): number {
  if (requirements.length === 0) {
    return 0.6;
  }

  const activeCertifications = cvCertifications.filter((certification) => !isExpired(certification));
  const scores = requirements.map((requirement) => {
    const best = Math.max(
      0,
      ...activeCertifications.map((certification) =>
        certificationMatches(certification, requirement) ? 1 : tokenSimilarity(
          normalizeToken(certification.label),
          normalizeToken(requirement.label),
        ),
      ),
    );

    return requirement.mandatory ? best : Math.max(0.6, best);
  });

  return average(scores);
}

function scoreLanguages(cvLanguages: LanguageItem[], requirements: LanguageItem[]): {
  score: number;
  maxMandatoryGap: number;
} {
  if (requirements.length === 0) {
    return { score: 0.6, maxMandatoryGap: 0 };
  }

  let maxMandatoryGap = 0;
  const scores = requirements.map((requirement) => {
    const candidate = cvLanguages.find((language) => normalizeLanguage(language.code) === normalizeLanguage(requirement.code));
    const requiredLevel = toComparableCecrl(requirement.minCecrl ?? requirement.cecrl);

    if (!requiredLevel) {
      return candidate ? 1 : requirement.mandatory ? 0 : 0.6;
    }

    const candidateLevel = toComparableCecrl(candidate?.cecrl);

    if (!candidateLevel) {
      if (requirement.mandatory) maxMandatoryGap = Math.max(maxMandatoryGap, 6);

      return requirement.mandatory ? 0 : 0.6;
    }

    const gap = cecrlRank(requiredLevel) - cecrlRank(candidateLevel);

    if (requirement.mandatory) {
      maxMandatoryGap = Math.max(maxMandatoryGap, gap);
    }

    if (gap <= 0) return 1;
    if (gap === 1) return 0.6;
    return 0;
  });

  return { score: average(scores), maxMandatoryGap };
}

function scoreTextSet(cvItems: string[], offerItems: string[]): number {
  if (offerItems.length === 0) {
    return 0.6;
  }

  const normalizedCv = cvItems.map(normalizeToken);
  const scores = offerItems.map((item) => {
    const normalizedItem = normalizeToken(item);
    const best = Math.max(0, ...normalizedCv.map((candidate) => tokenSimilarity(candidate, normalizedItem)));

    return best >= 0.82 ? 1 : best >= 0.55 ? 0.5 : 0;
  });

  return average(scores);
}

function scoreLocation(cvLocation: CandidateResume['location'], offer: JobOffer): number {
  if (offer.remoteMode === 'remote') {
    return 1;
  }

  if (!cvLocation) {
    return 0.6;
  }

  if (cvLocation.city && offer.location.city) {
    return normalizeToken(cvLocation.city) === normalizeToken(offer.location.city) ? 1 : 0.5;
  }

  if (cvLocation.departmentCode && offer.location.departmentCode) {
    return cvLocation.departmentCode === offer.location.departmentCode ? 0.85 : 0.4;
  }

  if (cvLocation.regionCode && offer.location.regionCode) {
    return cvLocation.regionCode === offer.location.regionCode ? 0.75 : 0.4;
  }

  return 0.6;
}

function scoreSalary(
  targetSalary: CandidateResume['targetSalary'],
  offerSalary: JobOffer['salary'],
): number {
  if (!offerSalary?.minAnnualGrossEur && !offerSalary?.maxAnnualGrossEur) {
    return 0.6;
  }

  if (!targetSalary?.minAnnualGrossEur && !targetSalary?.maxAnnualGrossEur) {
    return 0.6;
  }

  const targetMin = targetSalary.minAnnualGrossEur ?? targetSalary.maxAnnualGrossEur ?? 0;
  const targetMax = targetSalary.maxAnnualGrossEur ?? targetSalary.minAnnualGrossEur ?? targetMin;
  const offerMin = offerSalary.minAnnualGrossEur ?? offerSalary.maxAnnualGrossEur ?? 0;
  const offerMax = offerSalary.maxAnnualGrossEur ?? offerSalary.minAnnualGrossEur ?? offerMin;
  const overlap = Math.max(0, Math.min(targetMax, offerMax) - Math.max(targetMin, offerMin));
  const targetWidth = Math.max(1, targetMax - targetMin);

  if (overlap > 0) {
    return clamp01(overlap / targetWidth);
  }

  return offerMax >= targetMin ? 0.8 : 0;
}

function scoreRemote(preferredRemote: RemoteMode | undefined, offerRemote: JobOffer['remoteMode']): number {
  if (!preferredRemote || !offerRemote) {
    return 0.6;
  }

  const rank = { onsite: 0, hybrid: 1, remote: 2 } as const;
  const diff = rank[offerRemote] - rank[preferredRemote as keyof typeof rank];

  if (diff === 0) return 1;
  if (diff > 0) return 0.85;
  if (diff === -1) return 0.6;
  return 0.2;
}

function detectHardBlocker(cv: CandidateResume, offer: JobOffer): string | null {
  const mandatoryCertifications = (offer.certificationRequirements ?? []).filter(
    (certification) => certification.mandatory,
  );
  const activeCertifications = cv.certifications?.filter((certification) => !isExpired(certification)) ?? [];

  for (const requirement of mandatoryCertifications) {
    const hasCertification = activeCertifications.some((certification) =>
      certificationMatches(certification, requirement),
    );
    const isLegal = LEGAL_TERMS.some((term) => normalizeToken(requirement.label).includes(term));

    if (isLegal && !hasCertification) {
      return `Certification obligatoire manquante : ${requirement.label}`;
    }
  }

  for (const legalRequirement of offer.legalRequirements ?? []) {
    const normalizedRequirement = normalizeToken(legalRequirement);
    const hasEvidence = [
      ...(cv.certifications ?? []).map((certification) => certification.label),
      ...(cv.skills ?? []).map((skill) => skill.raw),
      ...(cv.keywords ?? []),
    ].some((value) => normalizeToken(value).includes(normalizedRequirement));

    if (!hasEvidence) {
      return `Exigence légale obligatoire manquante : ${legalRequirement}`;
    }
  }

  return null;
}

function applyCaps(input: ScoreCapsInput): number {
  if (input.hardBlocker) {
    return 0;
  }

  let finalScore = input.raw;

  if (input.mustHaveCoverage < 0.5) {
    finalScore = Math.min(finalScore, 59);
  }

  if (
    input.minimumExperienceYears &&
    input.minimumExperienceYears >= 3 &&
    input.experienceScore < 0.75
  ) {
    finalScore = Math.min(finalScore, 69);
  }

  if (input.languageGap >= 2) {
    finalScore = Math.min(finalScore, 49);
  }

  return clamp(finalScore, 0, 100);
}

function buildMatchedFeatures(matches: SkillMatch[], offerSkills: SkillItem[]): ScoredOffer['matchedFeatures'] {
  const exactSkills = matches
    .filter((match) => match.type === 'exact')
    .map((match) => match.offerSkill.raw);
  const fuzzySkills = matches
    .filter((match) => match.type === 'fuzzy')
    .map((match) => match.offerSkill.raw);
  const missingMustHave = offerSkills
    .filter(
      (skill) =>
        skill.importance === 'must' &&
        !matches.some((match) => match.offerSkill.raw === skill.raw && match.score > 0),
    )
    .map((skill) => skill.raw);

  return {
    exactSkills,
    fuzzySkills,
    semanticSkills: [],
    missingMustHave,
  };
}

function buildFrenchExplanation(
  breakdown: ScoreBreakdown,
  matchedFeatures: ScoredOffer['matchedFeatures'],
): string {
  if (breakdown.hardBlocker) {
    return `Score bloque à 0 : ${breakdown.hardBlocker}.`;
  }

  if (matchedFeatures.missingMustHave.length > 0) {
    return `Score plafonné si nécessaire : compétences indispensables manquantes (${matchedFeatures.missingMustHave.join(', ')}).`;
  }

  if (breakdown.finalScore >= 80) {
    return 'Très bonne correspondance déterministe entre le profil confirmé et les exigences de l offre.';
  }

  if (breakdown.finalScore >= 60) {
    return 'Correspondance partielle : plusieurs signaux sont présents, mais certains critères restent à confirmer.';
  }

  return 'Correspondance limitée : les exigences principales de l offre sont peu couvertes par le profil confirmé.';
}

function importanceWeight(skill: SkillItem): number {
  if (skill.importance === 'must') return 1;
  if (skill.importance === 'nice') return 0.4;
  return 0.7;
}

function normalizeSkill(skill: SkillItem): string {
  return skill.canonicalSkillId ? normalizeToken(skill.canonicalSkillId) : normalizeToken(skill.raw);
}

function tokenSimilarity(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.includes(right) || right.includes(left)) {
    return 0.9;
  }

  const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const jaccard = union ? intersection / union : 0;
  const char = levenshteinSimilarity(left, right);

  return Math.max(jaccard, char);
}

function levenshteinSimilarity(left: string, right: string): number {
  const distance = levenshtein(left, right);
  const maxLength = Math.max(left.length, right.length, 1);

  return 1 - distance / maxLength;
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const insert = current[rightIndex] + 1;
      const remove = previous[rightIndex + 1] + 1;
      const replace = previous[rightIndex] + (left[leftIndex] === right[rightIndex] ? 0 : 1);
      current.push(Math.min(insert, remove, replace));
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length] ?? 0;
}

function scoreRncpLevel(candidate?: number, required?: number): number {
  if (!required) {
    return 0.6;
  }

  if (!candidate) {
    return 0;
  }

  if (candidate >= required) {
    return 1;
  }

  return Math.max(0, 1 - (required - candidate) * 0.35);
}

function scoreField(candidate?: string, required?: string): number {
  if (!required) {
    return 0.6;
  }

  if (!candidate) {
    return 0;
  }

  return tokenSimilarity(normalizeToken(candidate), normalizeToken(required));
}

function certificationMatches(candidate: CertificationItem, requirement: CertificationItem): boolean {
  if (candidate.rncpCode && requirement.rncpCode && candidate.rncpCode === requirement.rncpCode) {
    return true;
  }

  if (candidate.rsCode && requirement.rsCode && candidate.rsCode === requirement.rsCode) {
    return true;
  }

  return normalizeToken(candidate.label) === normalizeToken(requirement.label);
}

function isExpired(certification: CertificationItem, now = new Date()): boolean {
  if (!certification.expiryDate) {
    return false;
  }

  const expiry = Date.parse(certification.expiryDate);

  return Number.isFinite(expiry) && expiry < now.getTime();
}

function normalizeLanguage(value: string): string {
  const normalized = normalizeToken(value);

  if (normalized.includes('anglais') || normalized === 'english') return 'en';
  if (normalized.includes('francais') || normalized === 'french') return 'fr';
  if (normalized.includes('espagnol') || normalized === 'spanish') return 'es';
  if (normalized.includes('allemand') || normalized === 'german') return 'de';
  if (normalized.includes('italien') || normalized === 'italian') return 'it';

  return normalized.slice(0, 12);
}

function cecrlRank(value: Cecrl): number {
  return CECRL_ORDER.indexOf(value);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0.6;
  }

  return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function parsePartialDate(value: string): Date | null {
  const yearMonth = value.match(/^(\d{4})(?:-(\d{2}))?/);

  if (!yearMonth) {
    return null;
  }

  return new Date(Number(yearMonth[1]), Number(yearMonth[2] ?? 1) - 1, 1);
}

function comparePublishedAt(left?: string, right?: string): number {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;

  return (Number.isFinite(leftTime) ? leftTime : 0) - (Number.isFinite(rightTime) ? rightTime : 0);
}

function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100) * 100) / 100;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

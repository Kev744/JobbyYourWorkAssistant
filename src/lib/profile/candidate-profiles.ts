import type { CandidateProfile } from '@/types';
import { sortLanguageItems } from '@/lib/language-levels';

interface CandidateProfileRow {
  id: string;
  resume_version_id: string;
  summary: string;
  profession: string;
  education: unknown;
  professional_experiences: unknown;
  hobbies: unknown;
  certifications: unknown;
  skills: unknown;
  languages: unknown;
  achievements: unknown;
  identity_contact: unknown;
  scoring_payload: unknown;
  rome_code: string;
  rome_prediction_score: number | null;
  generation_warnings: unknown;
  confirmation_status: 'draft' | 'confirmed';
  created_at: string;
  updated_at: string;
}

export const CANDIDATE_PROFILE_SELECT =
  'id, resume_version_id, summary, profession, education, professional_experiences, hobbies, certifications, skills, languages, achievements, identity_contact, scoring_payload, rome_code, rome_prediction_score, generation_warnings, confirmation_status, created_at, updated_at';

export function mapCandidateProfileRow(row: CandidateProfileRow): CandidateProfile {
  return {
    id: row.id,
    resumeVersionId: row.resume_version_id,
    summary: row.summary,
    profession: row.profession,
    education: asArray(row.education),
    professionalExperiences: asArray(row.professional_experiences),
    hobbies: asArray(row.hobbies),
    certifications: asArray(row.certifications),
    skills: asArray(row.skills),
    languages: sortLanguageItems(asArray(row.languages)),
    achievements: asArray(row.achievements),
    identityContact: asObject(row.identity_contact),
    scoringPayload: asObject(row.scoring_payload) as CandidateProfile['scoringPayload'],
    romeCode: row.rome_code,
    romePredictionScore: row.rome_prediction_score,
    generationWarnings: asArray(row.generation_warnings),
    confirmationStatus: row.confirmation_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function profileToUpdatePayload(profile: Partial<CandidateProfile>) {
  return {
    summary: profile.summary,
    profession: profile.profession,
    education: profile.education,
    professional_experiences: profile.professionalExperiences,
    hobbies: profile.hobbies,
    certifications: profile.certifications,
    skills: profile.skills,
    languages: profile.languages,
    achievements: profile.achievements,
    identity_contact: profile.identityContact,
    scoring_payload: profile.scoringPayload,
    rome_code: profile.romeCode,
    rome_prediction_score: profile.romePredictionScore,
    generation_warnings: profile.generationWarnings,
    confirmation_status: profile.confirmationStatus,
  };
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject<T extends object>(value: unknown): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : ({} as T);
}

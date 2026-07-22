export type RemoteMode = 'onsite' | 'hybrid' | 'remote';
export type Importance = 'must' | 'should' | 'nice';
export type Cecrl = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type NativeLanguageLevel = 'langue maternelle';
export type LanguageProficiency = Cecrl | NativeLanguageLevel;

export interface LocationRef {
  city?: string;
  postalCode?: string;
  inseeCode?: string;
  departmentCode?: string;
  regionCode?: string;
  lat?: number;
  lon?: number;
  remotePreference?: RemoteMode;
  maxCommuteKm?: number;
}

export interface SkillItem {
  raw: string;
  canonicalSkillId?: string;
  importance?: Importance;
  level?: 'basic' | 'intermediate' | 'advanced' | 'expert';
  lastUsedDate?: string | null;
}

export interface EducationItem {
  degreeLabel?: string;
  schoolName?: string;
  rncpLevel?: number;
  field?: string;
  graduationDate?: string | null;
  mandatory?: boolean;
}

export interface LanguageItem {
  code: string;
  cecrl?: LanguageProficiency;
  minCecrl?: Cecrl;
  mandatory?: boolean;
}

export interface CertificationItem {
  label: string;
  rncpCode?: string;
  rsCode?: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  mandatory?: boolean;
}

export interface CandidateResume {
  candidateId: string;
  headline: string;
  identity?: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
  location?: LocationRef;
  targetSalary?: {
    minAnnualGrossEur?: number;
    maxAnnualGrossEur?: number;
  };
  titles: Array<{
    raw: string;
    canonicalRomeCode?: string;
  }>;
  experiences: Array<{
    titleRaw: string;
    canonicalRomeCode?: string;
    location?: string;
    startDate?: string;
    endDate?: string | null;
    summary?: string;
    skills?: SkillItem[];
  }>;
  skills: SkillItem[];
  education: EducationItem[];
  certifications?: CertificationItem[];
  languages?: LanguageItem[];
  softSkills?: string[];
  keywords?: string[];
}

export interface JobOffer {
  offerId: string;
  source: 'france_travail' | 'adzuna' | 'web';
  sourceOfferId: string;
  publishedAt?: string;
  title: string;
  description: string;
  company?: {
    name?: string;
    addressLine?: string;
    postalCode?: string;
    city?: string;
  };
  location: LocationRef;
  remoteMode?: RemoteMode;
  contract?: {
    type?: string;
    weeklyHours?: number;
    workingTime?: string;
  };
  salary?: {
    minAnnualGrossEur?: number;
    maxAnnualGrossEur?: number;
    isPredicted?: boolean;
  };
  jobTarget: {
    rawTitle: string;
    canonicalRomeCode?: string;
  };
  skills: SkillItem[];
  experienceRequirement?: {
    minYears?: number;
  };
  educationRequirements?: EducationItem[];
  certificationRequirements?: CertificationItem[];
  languageRequirements?: LanguageItem[];
  softSkills?: string[];
  keywords?: string[];
  legalRequirements?: string[];
  applicationUrl?: string;
}

export interface ScoreBreakdown {
  skills: number;
  title: number;
  experience: number;
  education: number;
  certifications: number;
  languages: number;
  keywords: number;
  softSkills: number;
  location: number;
  salary: number;
  remote: number;
  mustHaveCoverage: number;
  hardBlocker?: string | null;
  finalScore: number;
  requiredCriteria?: number;
  skillsAndTools?: number;
  experienceRelevance?: number;
  roleTitleSeniorityDomain?: number;
  educationCertificationsLanguages?: number;
  logisticsFit?: number;
  evidenceQuality?: number;
  capsApplied?: string[];
}

export interface ScoredOffer {
  offer: JobOffer;
  breakdown: ScoreBreakdown;
  matchedFeatures: {
    exactSkills: string[];
    fuzzySkills: string[];
    semanticSkills: string[];
    missingMustHave: string[];
  };
  explanation?: string;
}

export interface GeneratedResumeEvidence {
  generatedText: string;
  sourceType: 'profile' | 'resume_version' | 'offer';
  sourceField: string;
  sourceId: string;
  confidence: 'supported' | 'user_confirmed' | 'needs_review';
}

export interface GeneratedResumeRecord {
  id: string;
  candidateProfileId: string;
  resumeVersionId: string;
  jobOfferId: string;
  title: string;
  content: string;
  evidenceMap: GeneratedResumeEvidence[];
  userInstructions: string;
  pdfStoragePath?: string | null;
  docxStoragePath?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus = 'accepted' | 'pending' | 'refused';

export interface ApplicationStatusEvent {
  id: string;
  applicationId: string;
  fromStatus?: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string;
  createdAt: string;
}

export interface ApplicationRecord {
  id: string;
  generatedResumeId: string;
  jobOfferId: string;
  offerSnapshot: JobOffer;
  generatedResumePdfPath?: string | null;
  generatedResumeDocxPath?: string | null;
  applicationUrl?: string | null;
  currentStatus: ApplicationStatus;
  statusHistory: ApplicationStatusEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationSkillStatistic {
  skill: string;
  count: number;
  percentage: number;
}

export interface ApplicationStatusStatistics {
  totalApplications: number;
  topSkills: ApplicationSkillStatistic[];
  emptyState: string;
}

export interface ApplicationStatistics {
  accepted: ApplicationStatusStatistics;
  refused: ApplicationStatusStatistics;
  generatedAt: string;
}

export interface CandidateProfile {
  id: string;
  resumeVersionId: string;
  summary: string;
  profession: string;
  education: EducationItem[];
  professionalExperiences: Array<{
    titleRaw: string;
    companyName?: string;
    location?: string;
    summary?: string;
    startDate?: string;
    endDate?: string | null;
    skills?: SkillItem[];
  }>;
  hobbies: string[];
  certifications: CertificationItem[];
  skills: SkillItem[];
  languages: LanguageItem[];
  achievements: string[];
  identityContact: {
    fullName?: string;
    email?: string;
    phone?: string;
    additionalInformation?: string;
  };
  scoringPayload: CandidateResume;
  romeCode: string;
  romePredictionScore?: number | null;
  generationWarnings: string[];
  confirmationStatus: 'draft' | 'confirmed';
  createdAt: string;
  updatedAt: string;
}

export interface RomePrediction {
  romeCode: string;
  scorePrediction: number;
  label?: string;
  warning?: string;
}

export interface LocationOption {
  code: string;
  name: string;
  departmentCode?: string;
  departmentName?: string;
  regionCode?: string;
  regionName?: string;
  postalCode?: string;
}

export interface ProfileRequirements {
  id: string;
  candidateProfileId?: string | null;
  professionKeywords: string;
  city?: LocationOption | null;
  department?: LocationOption | null;
  region?: LocationOption | null;
  radiusKm: number;
  experienceLevel: string;
  availability: string;
  contractTypes: string[];
  disabledAccepted: boolean;
  salaryMinAnnualGrossEur?: number | null;
  remotePreference: string;
  fullTime?: boolean | null;
  permanent?: boolean | null;
  companyName: string;
  providerNotes: string[];
  createdAt: string;
  updatedAt: string;
}

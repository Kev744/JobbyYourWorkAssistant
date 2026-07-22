export interface AutoApplyCandidateProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: {
    city?: string;
    region?: string;
    country?: string;
    postalCode?: string;
  };
  resumeFileId: string;
  coverLetterTemplateId?: string;
  links?: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  workAuthorization?: Record<string, string>;
  education?: AutoApplyEducationEntry[];
  employmentHistory?: AutoApplyEmploymentEntry[];
  skills?: string[];
  salaryExpectations?: {
    amount?: number;
    currency?: string;
    period?: 'year' | 'month' | 'hour';
  };
  availability?: string;
  sensitiveQuestionPreferences?: {
    demographicQuestions: 'ask' | 'skip' | 'prefer-not-to-say';
    disabilityQuestions: 'ask' | 'skip' | 'prefer-not-to-say';
    veteranQuestions: 'ask' | 'skip' | 'prefer-not-to-say';
  };
}

export interface AutoApplyEducationEntry {
  degreeLabel?: string;
  schoolName?: string;
  field?: string;
  graduationDate?: string | null;
}

export interface AutoApplyEmploymentEntry {
  title?: string;
  companyName?: string;
  location?: string;
  startDate?: string;
  endDate?: string | null;
  summary?: string;
}

import { z } from "zod";

/**
 * Master candidate profile. Every leaf is lenient on input (null / missing /
 * wrong type collapses to an empty value) so that AI output and older stored
 * rows always parse into a fully-populated, strictly-typed object.
 */

const text = z.string().trim().catch("");
const flag = z.boolean().catch(false);
const list = <T extends z.ZodType>(item: T) => z.array(item).catch([]);
const section = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value && typeof value === "object" ? value : {}), schema);

export const contactInfoSchema = z.object({
  email: text,
  phone: text,
  address: text,
  city: text,
  state: text,
  postalCode: text,
  country: text,
  linkedin: text,
  github: text,
  portfolio: text,
});

export const workExperienceSchema = z.object({
  company: text,
  title: text,
  location: text,
  /** ISO-ish `YYYY-MM` where known, otherwise free text as written on the CV. */
  start: text,
  end: text,
  current: flag,
  bullets: list(text),
});

export const educationSchema = z.object({
  institution: text,
  degree: text,
  fieldOfStudy: text,
  /** Graduation (or expected graduation) year. */
  year: text,
  grade: text,
});

export const customAnswerSchema = z.object({
  question: text,
  answer: text,
});

/**
 * Standard ATS screening questions. An empty string always means
 * "the candidate has not answered" - it must never be guessed.
 */
export const screeningAnswersSchema = z.object({
  workAuthorization: text,
  requiresSponsorship: text,
  securityClearance: text,
  willingToRelocate: text,
  noticePeriod: text,
  salaryExpectation: text,
  gender: text,
  ethnicity: text,
  veteranStatus: text,
  disabilityStatus: text,
  custom: list(customAnswerSchema),
});

export const candidateProfileSchema = z.object({
  firstName: text,
  lastName: text,
  headline: text,
  summary: text,
  contactInfo: section(contactInfoSchema),
  workHistory: list(workExperienceSchema),
  education: list(educationSchema),
  skills: list(text),
  screeningAnswers: section(screeningAnswersSchema),
});

export type ContactInfo = z.infer<typeof contactInfoSchema>;
export type WorkExperience = z.infer<typeof workExperienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type CustomAnswer = z.infer<typeof customAnswerSchema>;
export type ScreeningAnswers = z.infer<typeof screeningAnswersSchema>;
export type CandidateProfile = z.infer<typeof candidateProfileSchema>;

export const emptyProfile = (): CandidateProfile => candidateProfileSchema.parse({});
export const emptyWorkExperience = (): WorkExperience => workExperienceSchema.parse({});
export const emptyEducation = (): Education => educationSchema.parse({});

/** Screening answers with a fixed label, in display order. */
export const SCREENING_FIELDS = [
  { key: "workAuthorization", label: "Work authorization", hint: "e.g. Authorized to work in the US" },
  { key: "requiresSponsorship", label: "Requires visa sponsorship", hint: "Yes / No" },
  { key: "securityClearance", label: "Security clearance", hint: "e.g. None, Secret, TS/SCI" },
  { key: "willingToRelocate", label: "Willing to relocate", hint: "Yes / No" },
  { key: "noticePeriod", label: "Notice period", hint: "e.g. 2 weeks" },
  { key: "salaryExpectation", label: "Salary expectation", hint: "e.g. 120,000 USD" },
  { key: "gender", label: "Gender (voluntary)", hint: "Leave blank to always answer manually" },
  { key: "ethnicity", label: "Race / ethnicity (voluntary)", hint: "Leave blank to always answer manually" },
  { key: "veteranStatus", label: "Veteran status (voluntary)", hint: "Leave blank to always answer manually" },
  { key: "disabilityStatus", label: "Disability status (voluntary)", hint: "Leave blank to always answer manually" },
] as const satisfies ReadonlyArray<{
  key: Exclude<keyof ScreeningAnswers, "custom">;
  label: string;
  hint: string;
}>;

/** Drops blank list entries so half-filled editor rows are never persisted. */
export function pruneProfile(profile: CandidateProfile): CandidateProfile {
  return {
    ...profile,
    workHistory: profile.workHistory
      .filter((job) => job.company || job.title)
      .map((job) => ({ ...job, bullets: job.bullets.filter(Boolean) })),
    education: profile.education.filter((entry) => entry.institution || entry.degree),
    skills: [...new Set(profile.skills.filter(Boolean))],
    screeningAnswers: {
      ...profile.screeningAnswers,
      custom: profile.screeningAnswers.custom.filter((qa) => qa.question && qa.answer),
    },
  };
}

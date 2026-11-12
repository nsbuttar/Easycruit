import { z } from "zod";

export const APPLICATION_STATUSES = [
  "Auto-Filled",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
] as const;

export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

/** Payload the extension sends after it has auto-filled an application form. */
export const trackApplicationSchema = z.object({
  companyName: z.string().trim().max(200).catch(""),
  jobTitle: z.string().trim().max(300).catch(""),
  jobUrl: z.string().url().max(2000),
});
export type TrackApplicationRequest = z.infer<typeof trackApplicationSchema>;

export interface Application {
  id: string;
  companyName: string;
  jobTitle: string;
  jobUrl: string;
  status: ApplicationStatus;
  appliedAt: string;
}

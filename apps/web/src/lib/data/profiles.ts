import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { candidateProfileSchema, pruneProfile, type CandidateProfile } from "@omniprofile/shared";

const COLUMNS =
  "first_name, last_name, headline, summary, contact_info, work_history, education, skills, screening_answers";

interface ProfileRow {
  first_name: string;
  last_name: string;
  headline: string;
  summary: string;
  contact_info: unknown;
  work_history: unknown;
  education: unknown;
  skills: string[];
  screening_answers: unknown;
}

const fromRow = (row: ProfileRow): CandidateProfile =>
  candidateProfileSchema.parse({
    firstName: row.first_name,
    lastName: row.last_name,
    headline: row.headline,
    summary: row.summary,
    contactInfo: row.contact_info,
    workHistory: row.work_history,
    education: row.education,
    skills: row.skills,
    screeningAnswers: row.screening_answers,
  });

const toRow = (profile: CandidateProfile): ProfileRow => ({
  first_name: profile.firstName,
  last_name: profile.lastName,
  headline: profile.headline,
  summary: profile.summary,
  contact_info: profile.contactInfo,
  work_history: profile.workHistory,
  education: profile.education,
  skills: profile.skills,
  screening_answers: profile.screeningAnswers,
});

/**
 * `userId` is always applied explicitly so these functions are safe with
 * both the RLS-scoped client and the admin client.
 */
export async function getProfile(db: SupabaseClient, userId: string): Promise<CandidateProfile | null> {
  const { data, error } = await db
    .from("candidate_profiles")
    .select(COLUMNS)
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();
  if (error) throw new Error(`Failed to load profile (${error.code})`);
  return data ? fromRow(data) : null;
}

export async function saveProfile(
  db: SupabaseClient,
  userId: string,
  input: unknown,
): Promise<CandidateProfile> {
  const profile = pruneProfile(candidateProfileSchema.parse(input));
  const { error } = await db
    .from("candidate_profiles")
    .upsert(
      { user_id: userId, ...toRow(profile), updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`Failed to save profile (${error.code})`);
  return profile;
}

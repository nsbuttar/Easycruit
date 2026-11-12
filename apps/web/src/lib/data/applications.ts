import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applicationStatusSchema,
  type Application,
  type ApplicationStatus,
  type TrackApplicationRequest,
} from "@omniprofile/shared";

interface ApplicationRow {
  id: string;
  company_name: string;
  job_title: string;
  job_url: string;
  status: string;
  applied_at: string;
}

const COLUMNS = "id, company_name, job_title, job_url, status, applied_at";

const fromRow = (row: ApplicationRow): Application => ({
  id: row.id,
  companyName: row.company_name,
  jobTitle: row.job_title,
  jobUrl: row.job_url,
  status: applicationStatusSchema.catch("Auto-Filled").parse(row.status),
  appliedAt: row.applied_at,
});

export async function listApplications(db: SupabaseClient, userId: string): Promise<Application[]> {
  const { data, error } = await db
    .from("applications")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("applied_at", { ascending: false })
    .returns<ApplicationRow[]>();
  if (error) throw new Error(`Failed to list applications (${error.code})`);
  return (data ?? []).map(fromRow);
}

/**
 * Records an auto-filled application. Re-filling the same job URL keeps the
 * existing row (and whatever status the user has since given it).
 */
export async function trackApplication(
  db: SupabaseClient,
  userId: string,
  input: TrackApplicationRequest,
): Promise<void> {
  const { error } = await db.from("applications").upsert(
    {
      user_id: userId,
      company_name: input.companyName,
      job_title: input.jobTitle,
      job_url: input.jobUrl,
    },
    { onConflict: "user_id,job_url", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Failed to track application (${error.code})`);
}

export async function updateApplicationStatus(
  db: SupabaseClient,
  userId: string,
  id: string,
  status: ApplicationStatus,
): Promise<void> {
  const { error } = await db.from("applications").update({ status }).eq("user_id", userId).eq("id", id);
  if (error) throw new Error(`Failed to update application (${error.code})`);
}

export async function deleteApplication(db: SupabaseClient, userId: string, id: string): Promise<void> {
  const { error } = await db.from("applications").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error(`Failed to delete application (${error.code})`);
}

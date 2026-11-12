"use server";

import type { CandidateProfile } from "@omniprofile/shared";
import { getSession } from "@/lib/auth";
import { saveProfile } from "@/lib/data/profiles";
import { logError } from "@/lib/logger";

export type SaveProfileResult = { ok: true; profile: CandidateProfile } | { ok: false; error: string };

/** Persists the reviewed profile. Input is untrusted and re-validated server-side. */
export async function saveProfileAction(input: unknown): Promise<SaveProfileResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session has expired. Please sign in again." };

  try {
    const profile = await saveProfile(session.supabase, session.user.id, input);
    return { ok: true, profile };
  } catch (error) {
    logError("profile.save_failed", error);
    return { ok: false, error: "We could not save your profile. Please try again." };
  }
}

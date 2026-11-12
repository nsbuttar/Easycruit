import type { ProfileSummary } from "@omniprofile/shared";
import { extensionRoute } from "@/lib/api";
import { getProfile } from "@/lib/data/profiles";
import { createAdminClient } from "@/lib/supabase/server";

/** GET -> ProfileSummary. The popup only needs an overview, so that is all we send. */
export const GET = extensionRoute("extension.profile_failed", async (_request, userId) => {
  const profile = await getProfile(createAdminClient(), userId);
  const summary: ProfileSummary = {
    hasProfile: profile !== null,
    displayName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : "",
    headline: profile?.headline ?? "",
    counts: {
      workHistory: profile?.workHistory.length ?? 0,
      education: profile?.education.length ?? 0,
      skills: profile?.skills.length ?? 0,
    },
  };
  return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
});

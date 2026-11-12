import { detectAts, trackApplicationSchema } from "@omniprofile/shared";
import { apiError, extensionRoute, readJson } from "@/lib/api";
import { trackApplication } from "@/lib/data/applications";
import { createAdminClient } from "@/lib/supabase/server";

/** POST { companyName, jobTitle, jobUrl } -> 204. Called after a successful auto-fill. */
export const POST = extensionRoute("extension.track_failed", async (request, userId) => {
  const body = trackApplicationSchema.safeParse(await readJson(request));
  if (!body.success || !detectAts(body.data.jobUrl)) {
    return apiError("invalid_request", "Malformed application.");
  }
  await trackApplication(createAdminClient(), userId, body.data);
  return new Response(null, { status: 204 });
});

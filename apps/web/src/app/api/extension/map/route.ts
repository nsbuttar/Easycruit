import { detectAts, mapFieldsRequestSchema } from "@omniprofile/shared";
import { mapFields } from "@/lib/ai/map-fields";
import { apiError, extensionRoute, readJson } from "@/lib/api";
import { getProfile } from "@/lib/data/profiles";
import { logEvent } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * POST { url, pageTitle, fields } -> MappingResult
 *
 * The profile never leaves the server unmapped: the extension receives only
 * the specific values chosen for fields on a supported ATS page.
 */
export const POST = extensionRoute("extension.map_failed", async (request, userId) => {
  const body = mapFieldsRequestSchema.safeParse(await readJson(request));
  if (!body.success) return apiError("invalid_request", "Malformed field list.");

  const ats = detectAts(body.data.url);
  if (!ats) return apiError("invalid_request", "This site is not a supported ATS.");

  const profile = await getProfile(createAdminClient(), userId);
  if (!profile) return apiError("no_profile", "Create your profile in the OmniProfile vault first.");

  const startedAt = Date.now();
  const result = await mapFields(profile, body.data);

  logEvent("fields.mapped", {
    ats: ats.id,
    fields: body.data.fields.length,
    filled: result.fills.length,
    unmapped: result.unmapped.length,
    ms: Date.now() - startedAt,
  });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
});

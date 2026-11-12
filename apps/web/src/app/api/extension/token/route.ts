import { z } from "zod";
import { apiError, handleApiError, readJson } from "@/lib/api";
import { exchangeAuthorizationCode, revokeExtensionToken } from "@/lib/extension-auth";

const bodySchema = z.object({
  code: z.string().min(20).max(200),
  codeVerifier: z.string().min(43).max(128),
  redirectUri: z.string().max(200),
});

/** POST { code, codeVerifier, redirectUri } -> { accessToken, expiresAt } */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = bodySchema.safeParse(await readJson(request));
    if (!body.success) return apiError("invalid_request", "Malformed token request.");

    const token = await exchangeAuthorizationCode(body.data);
    if (!token) return apiError("invalid_request", "The authorization code is invalid or has expired.");

    return Response.json(token, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError("extension.token_failed", error);
  }
}

/** DELETE with a bearer token revokes it (extension "Disconnect"). */
export async function DELETE(request: Request): Promise<Response> {
  try {
    await revokeExtensionToken(request);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError("extension.revoke_failed", error);
  }
}

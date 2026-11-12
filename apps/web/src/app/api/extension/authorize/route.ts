import { apiError, handleApiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { isAllowedRedirectUri, isValidCodeChallenge, issueAuthorizationCode } from "@/lib/extension-auth";
import { logEvent } from "@/lib/logger";

/**
 * POST (HTML form from /extension/authorize) -> 303 to the extension's
 * redirect URI with `code` and `state`.
 *
 * Uses the browser session, so it must only honour same-origin submissions:
 * otherwise another site could silently approve access for its own extension.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return apiError("invalid_request", "Cross-origin authorization is not allowed.", 403);
    }

    const session = await getSession();
    if (!session) return apiError("unauthenticated", "Please sign in again.");

    const form = await request.formData();
    const redirectUri = String(form.get("redirect_uri") ?? "");
    const state = String(form.get("state") ?? "");
    const codeChallenge = String(form.get("code_challenge") ?? "");

    if (!isAllowedRedirectUri(redirectUri) || !isValidCodeChallenge(codeChallenge) || !state || state.length > 200) {
      return apiError("invalid_request", "Invalid authorization request.");
    }

    const code = await issueAuthorizationCode({ userId: session.user.id, codeChallenge, redirectUri });
    logEvent("extension.authorized");

    const target = new URL(redirectUri);
    target.searchParams.set("code", code);
    target.searchParams.set("state", state);
    return new Response(null, { status: 303, headers: { Location: target.toString() } });
  } catch (error) {
    return handleApiError("extension.authorize_failed", error);
  }
}

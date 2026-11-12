import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { TokenResponse } from "@omniprofile/shared";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * OAuth 2.0 authorization-code flow with PKCE (S256) for the browser
 * extension. Codes and tokens are random 256-bit values; only their SHA-256
 * hashes are stored.
 */

const CODE_TTL_MS = 2 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const REDIRECT_PATTERN = /^https:\/\/([a-p]{32})\.chromiumapp\.org\/[\w\-./]*$/;

const sha256 = (value: string) => createHash("sha256").update(value).digest();
const hashForStorage = (value: string) => sha256(value).toString("hex");
const randomSecret = () => randomBytes(32).toString("base64url");

/**
 * A redirect URI is valid only if it is a `chrome.identity` redirect for an
 * allow-listed extension. Outside production an empty allow-list accepts any
 * extension id so unpacked builds work without configuration.
 */
export function isAllowedRedirectUri(redirectUri: string): boolean {
  const extensionId = REDIRECT_PATTERN.exec(redirectUri)?.[1];
  if (!extensionId) return false;
  const allowed = serverEnv.allowedExtensionIds;
  if (allowed.length === 0) return !serverEnv.isProduction;
  return allowed.includes(extensionId);
}

export const isValidCodeChallenge = (challenge: string) => CHALLENGE_PATTERN.test(challenge);

export async function issueAuthorizationCode(params: {
  userId: string;
  codeChallenge: string;
  redirectUri: string;
}): Promise<string> {
  const code = randomSecret();
  const { error } = await createAdminClient()
    .from("extension_auth_codes")
    .insert({
      code_hash: hashForStorage(code),
      user_id: params.userId,
      code_challenge: params.codeChallenge,
      redirect_uri: params.redirectUri,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
  if (error) throw new Error(`Failed to issue authorization code (${error.code})`);
  return code;
}

/** Redeems a one-time code for an access token. Returns null if anything is off. */
export async function exchangeAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenResponse | null> {
  if (!VERIFIER_PATTERN.test(params.codeVerifier)) return null;
  const db = createAdminClient();

  // Delete-and-return makes the code single-use even under concurrent redemption.
  const { data: row, error } = await db
    .from("extension_auth_codes")
    .delete()
    .eq("code_hash", hashForStorage(params.code))
    .select("user_id, code_challenge, redirect_uri, expires_at")
    .maybeSingle<{ user_id: string; code_challenge: string; redirect_uri: string; expires_at: string }>();
  if (error) throw new Error(`Failed to redeem authorization code (${error.code})`);
  if (!row) return null;

  const expected = Buffer.from(row.code_challenge);
  const actual = Buffer.from(sha256(params.codeVerifier).toString("base64url"));
  const verifierMatches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!verifierMatches) return null;
  if (row.redirect_uri !== params.redirectUri) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  const accessToken = randomSecret();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const { error: insertError } = await db.from("extension_tokens").insert({
    token_hash: hashForStorage(accessToken),
    user_id: row.user_id,
    expires_at: expiresAt,
  });
  if (insertError) throw new Error(`Failed to issue access token (${insertError.code})`);

  return { accessToken, expiresAt };
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}

/** Resolves the user id behind an extension request, or null if unauthenticated. */
export async function authenticateExtension(request: Request): Promise<string | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const { data, error } = await createAdminClient()
    .from("extension_tokens")
    .select("user_id, expires_at")
    .eq("token_hash", hashForStorage(token))
    .maybeSingle<{ user_id: string; expires_at: string }>();
  if (error) throw new Error(`Failed to verify access token (${error.code})`);
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.user_id;
}

export async function revokeExtensionToken(request: Request): Promise<void> {
  const token = bearerToken(request);
  if (!token) return;
  await createAdminClient().from("extension_tokens").delete().eq("token_hash", hashForStorage(token));
}

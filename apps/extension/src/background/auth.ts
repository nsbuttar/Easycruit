import { EXTENSION_API, type TokenResponse } from "@omniprofile/shared";
import { API_ORIGIN } from "../lib/config.ts";
import { ExtensionError } from "../lib/messages.ts";

/**
 * OAuth 2.0 authorization-code flow with PKCE against the OmniProfile web app,
 * driven by chrome.identity.launchWebAuthFlow.
 */

const STORAGE_KEY = "auth";

interface StoredAuth {
  accessToken: string;
  expiresAt: string;
}

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const randomToken = (): string => base64Url(crypto.getRandomValues(new Uint8Array(32)));

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

export async function getAccessToken(): Promise<string | null> {
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as StoredAuth | undefined;
  if (!stored) return null;
  if (new Date(stored.expiresAt).getTime() <= Date.now()) {
    await clearAccessToken();
    return null;
  }
  return stored.accessToken;
}

export const clearAccessToken = (): Promise<void> => chrome.storage.local.remove(STORAGE_KEY);

export async function connect(): Promise<void> {
  const redirectUri = chrome.identity.getRedirectURL();
  const state = randomToken();
  const codeVerifier = randomToken();

  const authorizeUrl = new URL(EXTENSION_API.authorize, API_ORIGIN);
  authorizeUrl.search = new URLSearchParams({
    redirect_uri: redirectUri,
    state,
    code_challenge: await sha256(codeVerifier),
    code_challenge_method: "S256",
  }).toString();

  let responseUrl: string | undefined;
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({ url: authorizeUrl.toString(), interactive: true });
  } catch {
    throw new ExtensionError("cancelled", "Sign-in was cancelled.");
  }
  if (!responseUrl) throw new ExtensionError("cancelled", "Sign-in was cancelled.");

  const params = new URL(responseUrl).searchParams;
  const code = params.get("code");
  if (!code || params.get("state") !== state) {
    throw new ExtensionError("unauthenticated", "Sign-in could not be verified. Please try again.");
  }

  let response: Response;
  try {
    response = await fetch(new URL(EXTENSION_API.token, API_ORIGIN), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, codeVerifier, redirectUri }),
    });
  } catch {
    throw new ExtensionError("network", "Could not reach OmniProfile. Check your connection.");
  }
  if (!response.ok) throw new ExtensionError("unauthenticated", "Sign-in failed. Please try again.");

  const token = (await response.json()) as TokenResponse;
  const stored: StoredAuth = { accessToken: token.accessToken, expiresAt: token.expiresAt };
  await chrome.storage.local.set({ [STORAGE_KEY]: stored });
}

export async function disconnect(): Promise<void> {
  const accessToken = await getAccessToken();
  await clearAccessToken();
  if (!accessToken) return;
  // Best effort: the local token is already gone even if revocation fails.
  await fetch(new URL(EXTENSION_API.token, API_ORIGIN), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => undefined);
}

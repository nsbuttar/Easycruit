/** Wire contracts between the web API and the browser extension. */

export const EXTENSION_API = {
  authorize: "/extension/authorize",
  token: "/api/extension/token",
  profile: "/api/extension/profile",
  map: "/api/extension/map",
  applications: "/api/extension/applications",
} as const;

export interface TokenResponse {
  accessToken: string;
  expiresAt: string;
}

/** Non-sensitive overview shown in the extension popup. */
export interface ProfileSummary {
  hasProfile: boolean;
  displayName: string;
  headline: string;
  counts: { workHistory: number; education: number; skills: number };
}

export type ApiErrorCode =
  | "unauthenticated"
  | "invalid_request"
  | "no_profile"
  | "not_configured"
  | "ai_failed"
  | "server_error";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

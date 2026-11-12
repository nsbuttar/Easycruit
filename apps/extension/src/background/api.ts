import type { ApiErrorBody } from "@omniprofile/shared";
import { API_ORIGIN } from "../lib/config.ts";
import { ExtensionError } from "../lib/messages.ts";
import { clearAccessToken, getAccessToken } from "./auth.ts";

const NOT_CONNECTED = "Connect OmniProfile from the extension icon in your toolbar.";

/** Authenticated JSON request to the OmniProfile API. */
export async function apiRequest<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new ExtensionError("unauthenticated", NOT_CONNECTED);

  let response: Response;
  try {
    response = await fetch(new URL(path, API_ORIGIN), {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ExtensionError("network", "Could not reach OmniProfile. Check your connection.");
  }

  if (response.status === 401) {
    await clearAccessToken();
    throw new ExtensionError("unauthenticated", NOT_CONNECTED);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ExtensionError(
      body?.error?.code ?? "server_error",
      body?.error?.message ?? "OmniProfile ran into a problem. Please try again.",
    );
  }
  return (response.status === 204 ? null : await response.json()) as T;
}

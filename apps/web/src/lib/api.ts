import "server-only";
import type { ApiErrorBody, ApiErrorCode } from "@omniprofile/shared";
import { connection } from "next/server";
import { AiError } from "@/lib/ai/client";
import { ConfigError } from "@/lib/env";
import { authenticateExtension } from "@/lib/extension-auth";
import { logError } from "@/lib/logger";

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  invalid_request: 400,
  no_profile: 404,
  not_configured: 503,
  ai_failed: 502,
  server_error: 500,
};

export function apiError(code: ApiErrorCode, message: string, status = STATUS[code]): Response {
  return Response.json({ error: { code, message } } satisfies ApiErrorBody, { status });
}

/** Maps any thrown error to a safe JSON response and a PII-free log line. */
export function handleApiError(event: string, error: unknown): Response {
  logError(event, error);
  if (error instanceof ConfigError) {
    return apiError("not_configured", "The server is missing required configuration.");
  }
  if (error instanceof AiError) {
    return apiError("ai_failed", "The AI service could not process this request. Please try again.");
  }
  return apiError("server_error", "Something went wrong. Please try again.");
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Wraps an extension API handler with bearer-token auth and error handling. */
export function extensionRoute(
  event: string,
  handler: (request: Request, userId: string) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    // Opt out of prerendering before the try block, so the framework's
    // bail-out signal is never mistaken for a handler error.
    await connection();
    try {
      const userId = await authenticateExtension(request);
      if (!userId) return apiError("unauthenticated", "Connect the extension to your OmniProfile account.");
      return await handler(request, userId);
    } catch (error) {
      return handleApiError(event, error);
    }
  };
}

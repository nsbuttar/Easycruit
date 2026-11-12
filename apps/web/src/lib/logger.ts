import "server-only";

/**
 * PII-safe structured logging.
 *
 * Only primitive metadata is accepted, and callers pass counts, durations and
 * identifiers - never CV text, profile content, form values or model output.
 * Errors are reduced to their class name and HTTP status, because provider
 * error messages can echo request payloads.
 */
type Meta = Record<string, string | number | boolean | undefined>;

function describeError(error: unknown): Meta {
  if (!(error instanceof Error)) return { errorName: "UnknownError" };
  const status = (error as { status?: unknown }).status;
  return { errorName: error.name, status: typeof status === "number" ? status : undefined };
}

export function logEvent(event: string, meta: Meta = {}): void {
  console.info(JSON.stringify({ level: "info", event, ...meta }));
}

export function logError(event: string, error: unknown, meta: Meta = {}): void {
  console.error(JSON.stringify({ level: "error", event, ...describeError(error), ...meta }));
}

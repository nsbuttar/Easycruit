import "server-only";

function required(name: string, value: string | undefined): string {
  if (!value) throw new ConfigError(`Missing environment variable ${name}`);
  return value;
}

/** Thrown when the deployment is missing configuration (never user-caused). */
export class ConfigError extends Error {
  override name = "ConfigError";
}

// NEXT_PUBLIC_* must be referenced statically so they are inlined for the browser.
export const publicEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  },
};

export const serverEnv = {
  get supabaseSecretKey() {
    return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
  },
  get openaiApiKey() {
    return required("OPENAI_API_KEY", process.env.OPENAI_API_KEY);
  },
  get cvModel() {
    return process.env.OPENAI_CV_MODEL || "gpt-4o";
  },
  get mappingModel() {
    return process.env.OPENAI_MAPPING_MODEL || "gpt-4o-mini";
  },
  get allowedExtensionIds() {
    return (process.env.EXTENSION_ALLOWED_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

/**
 * Supported applicant tracking systems.
 *
 * Kept dependency-free: the extension build script imports this file directly
 * to generate the manifest's content-script match patterns.
 */

export interface AtsPlatform {
  id: string;
  name: string;
  /** Host suffixes: a host matches if it equals the suffix or ends with `.${suffix}`. */
  hostSuffixes: readonly string[];
}

export const ATS_PLATFORMS = [
  { id: "workday", name: "Workday", hostSuffixes: ["myworkdayjobs.com", "myworkdaysite.com"] },
  { id: "greenhouse", name: "Greenhouse", hostSuffixes: ["greenhouse.io"] },
  { id: "lever", name: "Lever", hostSuffixes: ["lever.co"] },
  { id: "taleo", name: "Taleo", hostSuffixes: ["taleo.net"] },
] as const satisfies readonly AtsPlatform[];

export type SupportedAts = (typeof ATS_PLATFORMS)[number];
export type AtsId = SupportedAts["id"];

export function detectAts(url: string): SupportedAts | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return (
    ATS_PLATFORMS.find((platform) =>
      platform.hostSuffixes.some((suffix: string) => host === suffix || host.endsWith(`.${suffix}`)),
    ) ?? null
  );
}

/** Chrome match patterns covering every supported ATS host. */
export function atsMatchPatterns(): string[] {
  return ATS_PLATFORMS.flatMap((platform) =>
    platform.hostSuffixes.flatMap((suffix) => [`https://${suffix}/*`, `https://*.${suffix}/*`]),
  );
}

import type { AtsId, TrackApplicationRequest } from "@omniprofile/shared";

const meta = (property: string): string =>
  document.querySelector<HTMLMetaElement>(`meta[property="${property}"], meta[name="${property}"]`)?.content.trim() ?? "";

const titleCase = (slug: string): string =>
  slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** Each ATS encodes the employer's slug in a predictable part of the URL. */
function companySlug(ats: AtsId, url: URL): string {
  const [subdomain = ""] = url.hostname.split(".");
  const [firstSegment = ""] = url.pathname.split("/").filter(Boolean);
  switch (ats) {
    case "workday":
    case "taleo":
      return subdomain;
    case "greenhouse":
      return firstSegment === "embed" ? (url.searchParams.get("for") ?? "") : firstSegment;
    case "lever":
      return firstSegment;
  }
}

/** Best-effort description of the job on this page, for the applications tracker. */
export function readJobMeta(ats: AtsId): TrackApplicationRequest {
  const url = new URL(location.href);
  const heading = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return {
    companyName: meta("og:site_name") || titleCase(companySlug(ats, url)),
    jobTitle: (heading || meta("og:title") || document.title).slice(0, 300),
    jobUrl: `${url.origin}${url.pathname}${url.search}`,
  };
}

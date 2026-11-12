/**
 * Limits that bound what a page can make us send to the mapping model.
 * Dependency-free so the content script can import them without bundling zod.
 */
export const MAX_FIELDS = 120;
/** High enough for a full country list, the largest select an ATS normally has. */
export const MAX_OPTIONS = 300;
export const MAX_FIELD_TEXT = 300;

/** Minimum model confidence for a value to be injected into the page. */
export const CONFIDENCE_THRESHOLD = 0.7;

/** Injected at build time by scripts/build.mjs. */
declare const __API_ORIGIN__: string;

export const API_ORIGIN: string = __API_ORIGIN__;
export const VAULT_URL = `${API_ORIGIN}/vault`;

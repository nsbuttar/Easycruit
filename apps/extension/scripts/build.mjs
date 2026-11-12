// Builds the MV3 extension into ./dist with esbuild.
//   node scripts/build.mjs           one-off production build
//   node scripts/build.mjs --watch   rebuild on change
//
// OMNIPROFILE_API_URL sets the web app origin (default http://localhost:3000).

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { atsMatchPatterns } from "../../../packages/shared/src/ats-platforms.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = resolve(root, "dist");
const watch = process.argv.includes("--watch");

const apiUrl = new URL(process.env.OMNIPROFILE_API_URL ?? "http://localhost:3000");
if (apiUrl.pathname !== "/" || apiUrl.search || apiUrl.hash) {
  throw new Error("OMNIPROFILE_API_URL must be a bare origin, e.g. https://app.example.com");
}
const isLocal = apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1";
if (apiUrl.protocol !== "https:" && !isLocal) {
  throw new Error("OMNIPROFILE_API_URL must use https outside local development");
}

const manifest = {
  manifest_version: 3,
  name: "OmniProfile",
  description: "Auto-fill job applications from your OmniProfile vault.",
  version: "0.1.0",
  minimum_chrome_version: "116",
  action: { default_title: "OmniProfile", default_popup: "popup.html" },
  // The bundle is an IIFE (classic script), so no `type: "module"` here.
  background: { service_worker: "background.js" },
  permissions: ["storage", "identity"],
  // Only the OmniProfile API. ATS pages are reached through content scripts alone.
  host_permissions: [`${apiUrl.origin}/*`],
  content_scripts: [
    {
      matches: atsMatchPatterns(),
      js: ["content.js"],
      run_at: "document_idle",
      all_frames: true,
    },
  ],
};

/** @type {import("esbuild").BuildOptions} */
const options = {
  absWorkingDir: root,
  entryPoints: {
    background: "src/background/index.ts",
    content: "src/content/index.ts",
    popup: "src/popup/main.tsx",
  },
  outdir,
  bundle: true,
  // Content scripts cannot be ES modules, so everything ships as a self-contained IIFE.
  format: "iife",
  target: "chrome116",
  jsx: "automatic",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  legalComments: "none",
  define: {
    __API_ORIGIN__: JSON.stringify(apiUrl.origin),
    "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production"),
  },
  logLevel: "info",
};

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await writeFile(resolve(outdir, "manifest.json"), JSON.stringify(manifest, null, 2));
await cp(resolve(root, "src/popup/popup.html"), resolve(outdir, "popup.html"));

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log(`Watching. API origin: ${apiUrl.origin}`);
} else {
  await esbuild.build(options);
  console.log(`Built extension to ${outdir} (API origin: ${apiUrl.origin})`);
}

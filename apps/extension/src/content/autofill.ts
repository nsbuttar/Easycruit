import type { MappingResult, SupportedAts } from "@omniprofile/shared";
import { VAULT_URL } from "../lib/config.ts";
import { ExtensionError, send } from "../lib/messages.ts";
import { fillField } from "./fill.ts";
import { flagForAttention, flashFilled, scrollToField } from "./highlight.ts";
import { readJobMeta } from "./job-meta.ts";
import { hasFileUpload, scrapeFields, type ScrapedField } from "./scrape.ts";
import type { AttentionItem, PanelContent } from "./widget.ts";

const FILL_REJECTED = "The page did not accept this value";

interface Outcome {
  filled: ScrapedField[];
  attention: Array<{ field: ScrapedField; reason: string }>;
}

/** Injects every mapped value and sorts fields into filled vs. needs-attention. */
function applyMapping(fields: Map<string, ScrapedField>, mapping: MappingResult): Outcome {
  const outcome: Outcome = { filled: [], attention: [] };

  for (const fill of mapping.fills) {
    const field = fields.get(fill.ref);
    if (!field) continue;
    if (fillField(field, fill.value)) outcome.filled.push(field);
    else outcome.attention.push({ field, reason: FILL_REJECTED });
  }
  for (const { ref, reason } of mapping.unmapped) {
    const field = fields.get(ref);
    if (field) outcome.attention.push({ field, reason });
  }
  return outcome;
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

function summarise(outcome: Outcome, needsFile: boolean): PanelContent {
  const notes: string[] = [];
  if (outcome.attention.length > 0) {
    notes.push(`${plural(outcome.attention.length, "field")} left blank and highlighted for you to complete:`);
  }
  // Required questions first: those block submission.
  const items: AttentionItem[] = [...outcome.attention]
    .sort((a, b) => Number(b.field.descriptor.required) - Number(a.field.descriptor.required))
    .map(({ field, reason }) => ({
      label: `${field.descriptor.label || field.descriptor.name || "Unlabelled field"}${field.descriptor.required ? " *" : ""}`,
      reason,
      onSelect: () => scrollToField(field),
    }));

  const closing = ["Review every answer before you submit."];
  if (needsFile) closing.unshift("Attach your CV file yourself: browsers do not allow extensions to upload files.");

  return {
    title: `Filled ${plural(outcome.filled.length, "field")}`,
    notes: outcome.attention.length > 0 ? [...closing, ...notes] : closing,
    items,
  };
}

function describeError(error: unknown): PanelContent {
  if (!(error instanceof ExtensionError)) {
    return { title: "Something went wrong", tone: "error", notes: ["Please try again."] };
  }
  switch (error.code) {
    case "unauthenticated":
      return { title: "Connect your account", tone: "error", notes: [error.message] };
    case "no_profile":
      return {
        title: "Your vault is empty",
        tone: "error",
        notes: ["Upload your CV to create a profile, then come back and try again."],
        link: { label: "Open my vault", href: VAULT_URL },
      };
    default:
      return { title: "Auto-fill failed", tone: "error", notes: [error.message] };
  }
}

/**
 * The full auto-fill loop for the current frame:
 * scrape -> map (server-side AI) -> inject -> highlight -> track.
 */
export async function runAutoFill(ats: SupportedAts): Promise<PanelContent> {
  const fields = scrapeFields();
  if (fields.size === 0) {
    return {
      title: "Nothing to fill",
      notes: ["No empty form fields were found. Open the application form, then try again."],
    };
  }

  let mapping: MappingResult;
  try {
    mapping = await send("fields:map", {
      url: location.href,
      pageTitle: document.title,
      fields: [...fields.values()].map((field) => field.descriptor),
    });
  } catch (error) {
    return describeError(error);
  }

  const outcome = applyMapping(fields, mapping);
  outcome.filled.forEach(flashFilled);
  outcome.attention.forEach(({ field }) => flagForAttention(field));

  if (outcome.filled.length > 0) {
    // Tracking is a convenience; a failure here must not disturb the fill result.
    void send("application:track", readJobMeta(ats.id)).catch(() => undefined);
  }
  return summarise(outcome, hasFileUpload());
}

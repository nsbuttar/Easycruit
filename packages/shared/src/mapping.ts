import { z } from "zod";

/** Limits that bound what a page can make us send to the mapping model. */
export const MAX_FIELDS = 120;
export const MAX_OPTIONS = 60;
const MAX_TEXT = 300;

/** Minimum model confidence for a value to be injected into the page. */
export const CONFIDENCE_THRESHOLD = 0.7;

const clipped = z
  .string()
  .catch("")
  .transform((value) => value.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT));

export const fieldKindSchema = z.enum([
  "text",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "checkboxGroup",
]);
export type FieldKind = z.infer<typeof fieldKindSchema>;

/** One fillable control (or radio/checkbox group) scraped from an ATS form. */
export const fieldDescriptorSchema = z.object({
  /** Extension-assigned handle used to find the element(s) again. */
  ref: z.string().min(1).max(32),
  kind: fieldKindSchema,
  /** The HTML input type (`email`, `tel`, `date`, ...), for format hints. */
  inputType: clipped,
  id: clipped,
  name: clipped,
  label: clipped,
  placeholder: clipped,
  autocomplete: clipped,
  required: z.boolean().catch(false),
  /** Visible option labels for select / radio / checkboxGroup. */
  options: z.array(clipped).max(MAX_OPTIONS).catch([]),
});
export type FieldDescriptor = z.infer<typeof fieldDescriptorSchema>;

export const mapFieldsRequestSchema = z.object({
  url: z.string().url().max(2000),
  pageTitle: clipped,
  fields: z.array(fieldDescriptorSchema).min(1).max(MAX_FIELDS),
});
export type MapFieldsRequest = z.infer<typeof mapFieldsRequestSchema>;

export interface FieldFill {
  ref: string;
  /** Option label(s) for choice fields, `"true"`/`"false"` for a lone checkbox, text otherwise. */
  value: string | string[];
  confidence: number;
}

export interface UnmappedField {
  ref: string;
  reason: string;
}

export interface MappingResult {
  fills: FieldFill[];
  unmapped: UnmappedField[];
}

/** What we accept back from the model before it is reconciled against the form. */
export const rawMappingSchema = z.object({
  fills: z
    .array(
      z.object({
        ref: z.string(),
        value: z.union([z.string(), z.array(z.string()), z.boolean(), z.number()]).nullable(),
        confidence: z.number().catch(0),
      }),
    )
    .catch([]),
  unmapped: z.array(z.object({ ref: z.string(), reason: z.string().catch("") })).catch([]),
});
export type RawMapping = z.infer<typeof rawMappingSchema>;

const normalise = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

function matchOption(options: readonly string[], candidate: string): string | null {
  const wanted = normalise(candidate);
  if (!wanted) return null;
  return options.find((option) => normalise(option) === wanted) ?? null;
}

const TRUTHY = new Set(["true", "yes", "y", "1", "checked", "on"]);
const FALSY = new Set(["false", "no", "n", "0", "unchecked", "off"]);

function coerceValue(field: FieldDescriptor, raw: RawMapping["fills"][number]["value"]): string | string[] | null {
  if (raw === null) return null;
  const values = (Array.isArray(raw) ? raw : [String(raw)]).map((value) => value.trim()).filter(Boolean);
  const [first] = values;
  if (first === undefined) return null;

  switch (field.kind) {
    case "checkbox": {
      const token = normalise(first);
      if (TRUTHY.has(token)) return "true";
      if (FALSY.has(token)) return "false";
      return null;
    }
    case "select":
    case "radio":
      return matchOption(field.options, first);
    case "checkboxGroup": {
      const matched = values.map((value) => matchOption(field.options, value));
      return matched.every((value): value is string => value !== null) ? matched : null;
    }
    default:
      return first;
  }
}

const NO_MATCH = "No confident match in your profile";

/**
 * Validates untrusted model output against the fields that were actually on
 * the page. Guarantees that every requested field appears exactly once -
 * either as a safe fill or as an unmapped entry the user must handle.
 */
export function reconcileMapping(
  fields: readonly FieldDescriptor[],
  raw: RawMapping,
  threshold: number = CONFIDENCE_THRESHOLD,
): MappingResult {
  const byRef = new Map(fields.map((field) => [field.ref, field]));
  const reasons = new Map(raw.unmapped.map((entry) => [entry.ref, entry.reason]));
  const fills = new Map<string, FieldFill>();

  for (const candidate of raw.fills) {
    const field = byRef.get(candidate.ref);
    if (!field || fills.has(candidate.ref)) continue;
    if (candidate.confidence < threshold) continue;
    const value = coerceValue(field, candidate.value);
    if (value === null) continue;
    fills.set(candidate.ref, {
      ref: candidate.ref,
      value,
      confidence: Math.min(1, candidate.confidence),
    });
  }

  const unmapped = fields
    .filter((field) => !fills.has(field.ref))
    .map((field) => ({ ref: field.ref, reason: reasons.get(field.ref)?.trim() || NO_MATCH }));

  return { fills: [...fills.values()], unmapped };
}

import { MAX_FIELDS, MAX_OPTIONS, type FieldDescriptor, type FieldKind } from "@omniprofile/shared";

export type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface ScrapedOption {
  label: string;
  element: HTMLInputElement | HTMLOptionElement;
}

/** A descriptor (sent to the server) plus the live elements it refers to (kept locally). */
export interface ScrapedField {
  descriptor: FieldDescriptor;
  elements: FormControl[];
  options: ScrapedOption[];
}

const SKIPPED_INPUT_TYPES = new Set([
  "hidden",
  "password",
  "file",
  "submit",
  "button",
  "reset",
  "image",
  "search",
  "range",
  "color",
]);

const clean = (text: string | null | undefined): string =>
  (text ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*(\*|\(required\))\s*$/i, "")
    .trim();

function hasBox(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

/**
 * Only controls a person could see and use are scraped. Custom-styled radios
 * and checkboxes are usually visually hidden, so their label or parent stands
 * in for them.
 */
function isUsable(control: FormControl): boolean {
  if (control.disabled || control.closest("[aria-hidden='true'], [hidden], [inert]")) return false;
  if ("readOnly" in control && control.readOnly) return false;
  if (hasBox(control)) return true;
  if (control instanceof HTMLInputElement && (control.type === "radio" || control.type === "checkbox")) {
    const proxy = control.labels?.[0] ?? control.parentElement;
    return proxy ? hasBox(proxy) : false;
  }
  return false;
}

function textOfIds(ids: string | null): string {
  if (!ids) return "";
  return clean(
    ids
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" "),
  );
}

const LABEL_LIKE = "label, legend, [class*='label' i], [class*='question' i], [data-automation-id*='label' i]";

/** Looks a few ancestors up for label-like text that belongs to this control alone. */
function nearbyLabel(start: Element, maxControls: number): string {
  let ancestor = start.parentElement;
  for (let depth = 0; ancestor && depth < 4; depth += 1, ancestor = ancestor.parentElement) {
    if (ancestor.querySelectorAll("input:not([type='hidden']), select, textarea").length > maxControls) break;
    for (const candidate of ancestor.querySelectorAll(LABEL_LIKE)) {
      if (candidate.contains(start)) continue;
      const text = clean(candidate.textContent);
      if (text) return text;
    }
  }
  return "";
}

function labelOf(control: FormControl): string {
  return (
    clean([...(control.labels ?? [])].map((label) => label.textContent).join(" ")) ||
    clean(control.getAttribute("aria-label")) ||
    textOfIds(control.getAttribute("aria-labelledby")) ||
    clean(control.closest("label")?.textContent) ||
    clean(control.title) ||
    nearbyLabel(control, 1)
  );
}

/** The question a radio / checkbox group answers, as opposed to its option labels. */
function groupLabelOf(controls: HTMLInputElement[]): string {
  const [first] = controls;
  if (!first) return "";
  const group = first.closest("fieldset, [role='radiogroup'], [role='group']");
  if (group) {
    const text =
      clean(group.querySelector("legend")?.textContent) ||
      clean(group.getAttribute("aria-label")) ||
      textOfIds(group.getAttribute("aria-labelledby"));
    if (text) return text;
  }
  return nearbyLabel(first, controls.length);
}

function describe(control: FormControl, kind: FieldKind, label: string, options: string[]): Omit<FieldDescriptor, "ref"> {
  return {
    kind,
    inputType: control instanceof HTMLInputElement ? control.type : "",
    id: control.id,
    name: control.name,
    label,
    placeholder: "placeholder" in control ? control.placeholder : "",
    autocomplete: control.getAttribute("autocomplete") ?? "",
    required: control.required || control.getAttribute("aria-required") === "true",
    options,
  };
}

type Draft = Omit<ScrapedField, "descriptor"> & { descriptor: Omit<FieldDescriptor, "ref"> };

function scrapeSelect(select: HTMLSelectElement): Draft | null {
  // Leave alone anything the user (or the ATS) has already answered.
  if (select.selectedIndex > 0 && select.value !== "") return null;
  const options = [...select.options]
    .filter((option) => !option.disabled && option.value !== "" && clean(option.textContent))
    .slice(0, MAX_OPTIONS)
    .map((element) => ({ label: clean(element.textContent), element }));
  if (options.length === 0) return null;
  return {
    descriptor: describe(select, "select", labelOf(select), options.map((option) => option.label)),
    elements: [select],
    options,
  };
}

function scrapeText(control: HTMLInputElement | HTMLTextAreaElement): Draft | null {
  if (control.value.trim() !== "") return null;
  const kind = control instanceof HTMLTextAreaElement ? "textarea" : "text";
  return { descriptor: describe(control, kind, labelOf(control), []), elements: [control], options: [] };
}

function scrapeChoiceGroup(controls: HTMLInputElement[]): Draft | null {
  const [first] = controls;
  if (!first || controls.some((control) => control.checked)) return null;

  if (first.type === "checkbox" && controls.length === 1) {
    return { descriptor: describe(first, "checkbox", labelOf(first), []), elements: controls, options: [] };
  }

  const options = controls
    .map((element) => ({ label: labelOf(element) || clean(element.value), element }))
    .filter((option) => option.label)
    .slice(0, MAX_OPTIONS);
  if (options.length === 0) return null;

  const kind = first.type === "radio" ? "radio" : "checkboxGroup";
  return {
    descriptor: describe(first, kind, groupLabelOf(controls), options.map((option) => option.label)),
    elements: controls,
    options,
  };
}

/** Radios / checkboxes sharing a name within the same form are one question. */
function choiceGroupKey(control: HTMLInputElement, index: number): string {
  return control.name ? `${control.type}:${control.name}` : `${control.type}#${index}`;
}

/**
 * Collects every empty, user-fillable control on the page. Fields that
 * already hold a value are skipped so user input is never overwritten.
 */
export function scrapeFields(root: ParentNode = document): Map<string, ScrapedField> {
  const controls = [...root.querySelectorAll<FormControl>("input, select, textarea")].filter(
    (control) => !(control instanceof HTMLInputElement && SKIPPED_INPUT_TYPES.has(control.type)) && isUsable(control),
  );

  const drafts: Draft[] = [];
  const choiceGroups = new Map<string, HTMLInputElement[]>();

  controls.forEach((control, index) => {
    if (control instanceof HTMLInputElement && (control.type === "radio" || control.type === "checkbox")) {
      const scope = control.form ? [...document.forms].indexOf(control.form) : -1;
      const key = `${scope}|${choiceGroupKey(control, index)}`;
      const group = choiceGroups.get(key);
      if (group) {
        group.push(control);
      } else {
        const created = [control];
        choiceGroups.set(key, created);
        // Reserve the group's position so fields stay in document order.
        drafts.push({ descriptor: describe(control, "radio", "", []), elements: created, options: [] });
      }
      return;
    }
    const draft = control instanceof HTMLSelectElement ? scrapeSelect(control) : scrapeText(control);
    if (draft) drafts.push(draft);
  });

  const fields = new Map<string, ScrapedField>();
  for (const draft of drafts) {
    const [first] = draft.elements;
    const isChoice = first instanceof HTMLInputElement && (first.type === "radio" || first.type === "checkbox");
    const resolved = isChoice ? scrapeChoiceGroup(draft.elements as HTMLInputElement[]) : draft;
    if (!resolved) continue;
    if (fields.size >= MAX_FIELDS) break;
    const ref = `op-${fields.size + 1}`;
    fields.set(ref, { ...resolved, descriptor: { ...resolved.descriptor, ref } });
  }
  return fields;
}

/** True when the page asks for a file (CV / cover letter), which cannot be auto-attached. */
export const hasFileUpload = (root: ParentNode = document): boolean =>
  root.querySelector("input[type='file']") !== null;

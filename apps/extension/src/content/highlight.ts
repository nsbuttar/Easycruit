import type { ScrapedField } from "./scrape.ts";

const STATE_ATTRIBUTE = "data-omniprofile-state";
const STYLE_ID = "omniprofile-highlight-styles";
const FILLED_FLASH_MS = 4000;

type HighlightState = "filled" | "attention";

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    [${STATE_ATTRIBUTE}] { outline-offset: 2px !important; border-radius: 4px; transition: outline-color .3s; }
    [${STATE_ATTRIBUTE}="filled"] { outline: 2px solid #16a34a !important; }
    [${STATE_ATTRIBUTE}="attention"] { outline: 2px dashed #d97706 !important; background-color: rgba(251, 191, 36, .12) !important; }
  `;
  (document.head ?? document.documentElement).append(style);
}

/** Hidden radios and checkboxes cannot show an outline, so their group container carries it. */
export function highlightTarget(field: ScrapedField): HTMLElement | null {
  const [first] = field.elements;
  if (!first) return null;
  if (field.descriptor.kind === "text" || field.descriptor.kind === "textarea" || field.descriptor.kind === "select") {
    return first;
  }
  return (
    first.closest<HTMLElement>("fieldset, [role='radiogroup'], [role='group']") ??
    first.closest<HTMLElement>("label") ??
    first.parentElement
  );
}

function mark(field: ScrapedField, state: HighlightState): HTMLElement | null {
  ensureStyles();
  const target = highlightTarget(field);
  target?.setAttribute(STATE_ATTRIBUTE, state);
  return target;
}

const unmark = (target: HTMLElement, state: HighlightState): void => {
  if (target.getAttribute(STATE_ATTRIBUTE) === state) target.removeAttribute(STATE_ATTRIBUTE);
};

/** Briefly confirms a field that was filled. */
export function flashFilled(field: ScrapedField): void {
  const target = mark(field, "filled");
  if (target) setTimeout(() => unmark(target, "filled"), FILLED_FLASH_MS);
}

/** Flags a field the user must complete; the flag clears once they interact with it. */
export function flagForAttention(field: ScrapedField): void {
  const target = mark(field, "attention");
  if (!target) return;
  const controller = new AbortController();
  const clear = (event: Event) => {
    if (!event.isTrusted) return; // ignore our own synthetic events
    unmark(target, "attention");
    controller.abort();
  };
  for (const element of field.elements) {
    element.addEventListener("input", clear, { signal: controller.signal });
    element.addEventListener("change", clear, { signal: controller.signal });
  }
}

export function scrollToField(field: ScrapedField): void {
  const target = highlightTarget(field);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  const [first] = field.elements;
  first?.focus({ preventScroll: true });
}

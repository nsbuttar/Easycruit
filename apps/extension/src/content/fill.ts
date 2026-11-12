import type { FieldFill } from "@omniprofile/shared";
import type { ScrapedField, ScrapedOption } from "./scrape.ts";

/**
 * Writes values into third-party forms the way a person would, so that
 * framework-controlled inputs (React, Angular, Vue) register the change.
 */

type ValueControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function prototypeOf(control: ValueControl): object {
  if (control instanceof HTMLInputElement) return HTMLInputElement.prototype;
  if (control instanceof HTMLTextAreaElement) return HTMLTextAreaElement.prototype;
  return HTMLSelectElement.prototype;
}

/**
 * Sets `.value` through the native prototype setter. Frameworks such as React
 * shadow the instance's `value` property to track changes; going through the
 * prototype leaves their tracker stale, so the following `input` event is
 * recognised as a real change instead of being swallowed.
 */
function setNativeValue(control: ValueControl, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(prototypeOf(control), "value")?.set;
  if (setter) setter.call(control, value);
  else control.value = value;
}

function focusControl(control: HTMLElement): void {
  control.focus({ preventScroll: true });
  // focus() emits nothing when the tab is in the background, so fall back to synthetic events.
  if (document.activeElement !== control) {
    control.dispatchEvent(new FocusEvent("focus"));
    control.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
  }
}

function blurControl(control: HTMLElement): void {
  if (document.activeElement === control) {
    control.blur();
  } else {
    control.dispatchEvent(new FocusEvent("blur"));
    control.dispatchEvent(new FocusEvent("focusout", { bubbles: true, composed: true }));
  }
}

function emitChange(control: HTMLElement, data: string | null): void {
  control.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillValue(control: ValueControl, value: string): boolean {
  focusControl(control);
  setNativeValue(control, value);
  emitChange(control, control instanceof HTMLSelectElement ? null : value);
  blurControl(control);
  // Typed inputs (date, number, email) silently reject malformed values.
  return control.value === value;
}

/** A real click is the only event every framework honours for radios and checkboxes. */
function setChecked(input: HTMLInputElement, checked: boolean): boolean {
  if (input.checked !== checked) {
    focusControl(input);
    input.click();
    blurControl(input);
  }
  return input.checked === checked;
}

const findOption = (options: ScrapedOption[], label: string): ScrapedOption | undefined =>
  options.find((option) => option.label === label);

/** Applies one mapped value. Returns false if the page did not accept it. */
export function fillField(field: ScrapedField, value: FieldFill["value"]): boolean {
  const [control] = field.elements;
  if (!control || !control.isConnected) return false;
  const values = Array.isArray(value) ? value : [value];
  const [single] = values;
  if (single === undefined) return false;

  switch (field.descriptor.kind) {
    case "text":
    case "textarea":
      return fillValue(control, single);

    case "select": {
      const option = findOption(field.options, single)?.element;
      return option instanceof HTMLOptionElement ? fillValue(control, option.value) : false;
    }

    case "radio": {
      const input = findOption(field.options, single)?.element;
      return input instanceof HTMLInputElement ? setChecked(input, true) : false;
    }

    case "checkbox":
      return control instanceof HTMLInputElement ? setChecked(control, single === "true") : false;

    case "checkboxGroup": {
      const inputs = values.map((label) => findOption(field.options, label)?.element);
      return (
        inputs.length > 0 &&
        inputs.every((input) => input instanceof HTMLInputElement && setChecked(input, true))
      );
    }
  }
}

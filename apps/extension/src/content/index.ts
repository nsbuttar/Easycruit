import { detectAts, type SupportedAts } from "@omniprofile/shared";
import { runAutoFill } from "./autofill.ts";
import { scrapeFields } from "./scrape.ts";
import { mountWidget } from "./widget.ts";

/** An embedded frame only gets a button once it actually contains a form. */
const MIN_FIELDS_IN_FRAME = 3;
const FRAME_POLL_MS = 1500;
const FRAME_POLL_ATTEMPTS = 20;

function mount(ats: SupportedAts): void {
  let running = false;
  const widget = mountWidget(async () => {
    if (running || !widget) return;
    running = true;
    widget.setBusy(true);
    try {
      widget.show(await runAutoFill(ats));
    } catch {
      widget.show({ title: "Something went wrong", tone: "error", notes: ["Please try again."] });
    } finally {
      widget.setBusy(false);
      running = false;
    }
  });
}

function boot(): void {
  const ats = detectAts(location.href);
  if (!ats) return;

  // Top-level ATS pages are single-page apps whose forms appear later, so the button is always offered.
  if (window.top === window) {
    mount(ats);
    return;
  }

  // Embedded job boards (e.g. a Greenhouse iframe on a company site): wait for the form to render.
  let attempts = 0;
  const poll = () => {
    if (scrapeFields().size >= MIN_FIELDS_IN_FRAME) {
      mount(ats);
    } else if ((attempts += 1) < FRAME_POLL_ATTEMPTS) {
      setTimeout(poll, FRAME_POLL_MS);
    }
  };
  poll();
}

boot();

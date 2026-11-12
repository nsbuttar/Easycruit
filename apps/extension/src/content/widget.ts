/**
 * The floating "Auto-Fill with OmniProfile" button and its result panel.
 *
 * Rendered in a closed shadow root so the host page's CSS cannot restyle it
 * and its scripts cannot read it. All page-derived text is set via
 * textContent, never as HTML.
 */

const HOST_ID = "omniprofile-widget";

const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .root {
    position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
    display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
    font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #18181b;
  }
  button { font: inherit; cursor: pointer; }
  button:focus-visible, a:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .launcher {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 16px; border: 0; border-radius: 999px;
    background: #18181b; color: #fff; font-weight: 600;
    box-shadow: 0 6px 20px rgba(0, 0, 0, .25);
  }
  .launcher:hover:not(:disabled) { background: #3f3f46; }
  .launcher:disabled { cursor: progress; opacity: .85; }
  .spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, .35); border-top-color: #fff;
    animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2.4s; } }
  .panel {
    width: min(340px, calc(100vw - 40px)); max-height: min(420px, calc(100vh - 110px));
    display: flex; flex-direction: column;
    background: #fff; border: 1px solid #e4e4e7; border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, .18); overflow: hidden;
  }
  .panel[hidden] { display: none; }
  .header { display: flex; align-items: flex-start; gap: 8px; padding: 12px 12px 8px 14px; }
  .title { flex: 1; margin: 0; font-size: 14px; font-weight: 600; }
  .title[data-tone="error"] { color: #b91c1c; }
  .close { border: 0; background: none; color: #71717a; font-size: 18px; line-height: 1; padding: 2px 6px; border-radius: 6px; }
  .close:hover { background: #f4f4f5; }
  .body { padding: 0 14px 14px; overflow-y: auto; }
  .note { margin: 0 0 8px; color: #52525b; font-size: 13px; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .item {
    width: 100%; text-align: left; padding: 8px 10px;
    border: 1px solid #fde68a; border-radius: 8px; background: #fffbeb; color: inherit;
  }
  .item:hover { background: #fef3c7; }
  .item-label { display: block; font-weight: 600; font-size: 13px; overflow-wrap: anywhere; }
  .item-reason { display: block; color: #78716c; font-size: 12px; }
  .link { display: inline-block; margin-top: 4px; color: #2563eb; font-weight: 600; font-size: 13px; }
`;

export interface AttentionItem {
  label: string;
  reason: string;
  onSelect: () => void;
}

export interface PanelContent {
  title: string;
  tone?: "info" | "error";
  notes?: string[];
  items?: AttentionItem[];
  link?: { label: string; href: string };
}

export interface Widget {
  setBusy(busy: boolean): void;
  show(content: PanelContent): void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const IDLE_LABEL = "Auto-Fill with OmniProfile";

/** Mounts the widget once per frame. Returns null if it is already mounted. */
export function mountWidget(onAutoFill: () => void): Widget | null {
  if (document.getElementById(HOST_ID)) return null;

  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = STYLES;

  const root = element("div", "root");
  const panel = element("section", "panel");
  panel.hidden = true;
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");

  const launcher = element("button", "launcher");
  launcher.type = "button";
  const spinner = element("span", "spinner");
  spinner.hidden = true;
  const launcherLabel = element("span", "", IDLE_LABEL);
  launcher.append(spinner, launcherLabel);
  launcher.addEventListener("click", onAutoFill);

  root.append(panel, launcher);
  shadow.append(style, root);
  document.documentElement.append(host);

  return {
    setBusy(busy) {
      launcher.disabled = busy;
      spinner.hidden = !busy;
      launcherLabel.textContent = busy ? "Filling…" : IDLE_LABEL;
    },

    show({ title, tone = "info", notes = [], items = [], link }) {
      const header = element("div", "header");
      const heading = element("h2", "title", title);
      heading.dataset.tone = tone;
      const close = element("button", "close", "×");
      close.type = "button";
      close.setAttribute("aria-label", "Close");
      close.addEventListener("click", () => {
        panel.hidden = true;
      });
      header.append(heading, close);

      const body = element("div", "body");
      for (const note of notes) body.append(element("p", "note", note));

      if (items.length > 0) {
        const list = element("ul", "list");
        for (const item of items) {
          const button = element("button", "item");
          button.type = "button";
          button.append(element("span", "item-label", item.label), element("span", "item-reason", item.reason));
          button.addEventListener("click", item.onSelect);
          const row = document.createElement("li");
          row.append(button);
          list.append(row);
        }
        body.append(list);
      }

      if (link) {
        const anchor = element("a", "link", link.label);
        anchor.href = link.href;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        body.append(anchor);
      }

      panel.replaceChildren(header, body);
      panel.hidden = false;
    },
  };
}

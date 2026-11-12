import { detectAts, EXTENSION_API } from "@omniprofile/shared";
import {
  ExtensionError,
  type Message,
  type MessageType,
  type RequestOf,
  type ResponseOf,
  type Result,
} from "../lib/messages.ts";
import { apiRequest } from "./api.ts";
import { connect, disconnect, getAccessToken } from "./auth.ts";

type Handlers = {
  [T in MessageType]: (payload: RequestOf<T>, sender: chrome.runtime.MessageSender) => Promise<ResponseOf<T>>;
};

/** Page-facing actions are only honoured for content scripts running on a supported ATS. */
function assertAtsSender(sender: chrome.runtime.MessageSender): void {
  if (!sender.tab || !sender.url || !detectAts(sender.url)) {
    throw new ExtensionError("invalid_request", "OmniProfile only works on supported job application sites.");
  }
}

/** Account management is reserved for the extension's own pages (the popup). */
function assertExtensionSender(sender: chrome.runtime.MessageSender): void {
  if (sender.tab || sender.id !== chrome.runtime.id) {
    throw new ExtensionError("invalid_request", "Not allowed from this page.");
  }
}

const handlers: Handlers = {
  "auth:status": async () => ({ connected: (await getAccessToken()) !== null }),

  "auth:connect": async (_payload, sender) => {
    assertExtensionSender(sender);
    await connect();
    return { connected: true };
  },

  "auth:disconnect": async (_payload, sender) => {
    assertExtensionSender(sender);
    await disconnect();
    return { connected: false };
  },

  "profile:summary": (_payload, sender) => {
    assertExtensionSender(sender);
    return apiRequest(EXTENSION_API.profile);
  },

  "fields:map": (payload, sender) => {
    assertAtsSender(sender);
    // The page URL comes from the browser, not from the (page-influenced) content script.
    return apiRequest(EXTENSION_API.map, { method: "POST", body: { ...payload, url: sender.url } });
  },

  "application:track": (payload, sender) => {
    assertAtsSender(sender);
    return apiRequest(EXTENSION_API.applications, { method: "POST", body: payload });
  },
};

async function dispatch(message: Message, sender: chrome.runtime.MessageSender): Promise<Result<unknown>> {
  const handler = handlers[message.type] as
    | ((payload: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>)
    | undefined;
  if (!handler) return { ok: false, code: "invalid_request", message: "Unknown request." };
  try {
    return { ok: true, data: await handler(message.payload, sender) };
  } catch (error) {
    if (error instanceof ExtensionError) return { ok: false, code: error.code, message: error.message };
    return { ok: false, code: "server_error", message: "OmniProfile ran into a problem. Please try again." };
  }
}

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  void dispatch(message, sender).then(sendResponse);
  return true; // keep the channel open for the async response
});

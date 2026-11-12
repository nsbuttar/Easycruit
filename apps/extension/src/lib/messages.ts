import type {
  ApiErrorCode,
  MapFieldsRequest,
  MappingResult,
  ProfileSummary,
  TrackApplicationRequest,
} from "@omniprofile/shared";

/**
 * Typed message protocol between the popup / content scripts and the
 * background service worker. The worker is the only context that holds the
 * access token or talks to the OmniProfile API.
 */
interface Protocol {
  "auth:status": { request: undefined; response: { connected: boolean } };
  "auth:connect": { request: undefined; response: { connected: true } };
  "auth:disconnect": { request: undefined; response: { connected: false } };
  "profile:summary": { request: undefined; response: ProfileSummary };
  "fields:map": { request: MapFieldsRequest; response: MappingResult };
  "application:track": { request: TrackApplicationRequest; response: null };
}

export type MessageType = keyof Protocol;
export type RequestOf<T extends MessageType> = Protocol[T]["request"];
export type ResponseOf<T extends MessageType> = Protocol[T]["response"];

export type Message = { [T in MessageType]: { type: T; payload: RequestOf<T> } }[MessageType];

export type ErrorCode = ApiErrorCode | "network" | "cancelled";

export type Result<T> = { ok: true; data: T } | { ok: false; code: ErrorCode; message: string };

export class ExtensionError extends Error {
  override name = "ExtensionError";
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

type Args<T extends MessageType> = RequestOf<T> extends undefined ? [] : [payload: RequestOf<T>];

/** Sends a message to the background worker and unwraps its Result. */
export async function send<T extends MessageType>(type: T, ...[payload]: Args<T>): Promise<ResponseOf<T>> {
  let result: Result<ResponseOf<T>> | undefined;
  try {
    result = await chrome.runtime.sendMessage({ type, payload });
  } catch {
    // The worker was unreachable, e.g. the extension was reloaded under an open tab.
    throw new ExtensionError("network", "OmniProfile was updated. Reload this page and try again.");
  }
  if (!result) throw new ExtensionError("network", "No response from OmniProfile. Please try again.");
  if (!result.ok) throw new ExtensionError(result.code, result.message);
  return result.data;
}

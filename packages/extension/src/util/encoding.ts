import type { Base64 } from "@codesync/shared";

/** Binary <-> base64 helpers for Yjs updates carried over the WS protocol. */
export const toBase64 = (bytes: Uint8Array): Base64 =>
  Buffer.from(bytes).toString("base64");

export const fromBase64 = (b64: Base64): Uint8Array =>
  new Uint8Array(Buffer.from(b64, "base64"));

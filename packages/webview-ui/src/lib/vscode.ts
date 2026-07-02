import type { HostToWebview, WebviewToHost } from "@codesync/shared";

interface VsCodeApi {
  postMessage(message: WebviewToHost): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | undefined;

/** Acquire the (singleton) VS Code webview API. */
export function getVsCodeApi(): VsCodeApi {
  if (!api) api = acquireVsCodeApi();
  return api;
}

/** Subscribe to messages from the extension host. Returns an unsubscribe fn. */
export function onHostMessage(handler: (message: HostToWebview) => void): () => void {
  const listener = (event: MessageEvent): void => {
    handler(event.data as HostToWebview);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

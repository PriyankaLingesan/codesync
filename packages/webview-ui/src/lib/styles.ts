/**
 * Shared CSS for the webview panels, using VS Code theme variables so the UI
 * matches the user's color theme. Injected via a <style> tag by each panel.
 */
export const baseStyles = `
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    padding: 0;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-foreground);
  }
  .empty {
    padding: 12px;
    opacity: 0.7;
    font-style: italic;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
  }
  .row:hover { background: var(--vscode-list-hoverBackground); }
  .avatar {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
  }
  .avatar.small { width: 20px; height: 20px; font-size: 9px; }
  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;
  }
  .name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    opacity: 0.7;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dot {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .feed {
    list-style: none;
    margin: 0;
    padding: 4px 0;
  }
  .event {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 5px 10px;
    border-left: 2px solid transparent;
  }
  .event .icon { flex: 0 0 auto; width: 16px; text-align: center; }
  .event .text { flex: 1 1 auto; min-width: 0; }
  .event .actor { font-weight: 600; }
  .event .file { opacity: 0.8; }
  .event .time { flex: 0 0 auto; opacity: 0.6; font-size: 11px; }

  /* Chat */
  .chat {
    display: flex;
    flex-direction: column;
    height: 100vh;
    box-sizing: border-box;
  }
  .messages {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .msg { display: flex; gap: 8px; align-items: flex-start; }
  .msg .body { min-width: 0; }
  .msg .head {
    display: flex;
    gap: 6px;
    align-items: baseline;
    margin-bottom: 1px;
  }
  .msg .author { font-weight: 600; }
  .msg .author.self { color: var(--vscode-textLink-foreground); }
  .msg .time { opacity: 0.55; font-size: 10px; }
  .msg .content { white-space: pre-wrap; word-break: break-word; }
  .typing {
    min-height: 16px;
    padding: 0 10px 4px;
    font-size: 11px;
    opacity: 0.7;
    font-style: italic;
  }
  .composer {
    flex: 0 0 auto;
    display: flex;
    gap: 6px;
    padding: 8px;
    border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.3));
  }
  .composer textarea {
    flex: 1 1 auto;
    resize: none;
    font-family: inherit;
    font-size: inherit;
    color: var(--vscode-input-foreground);
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 4px;
    padding: 6px 8px;
  }
  .composer textarea:focus {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }
  .composer button {
    flex: 0 0 auto;
    color: var(--vscode-button-foreground);
    background: var(--vscode-button-background);
    border: none;
    border-radius: 4px;
    padding: 0 12px;
    cursor: pointer;
  }
  .composer button:hover { background: var(--vscode-button-hoverBackground); }
  .composer button:disabled { opacity: 0.5; cursor: default; }

  /* Dependency graph */
  .graph { display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; }
  .graph-toolbar {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.3));
  }
  .graph-stats { font-weight: 600; }
  .graph-hint { opacity: 0.6; font-size: 11px; flex: 1 1 auto; }
  .graph-toolbar button {
    color: var(--vscode-button-foreground);
    background: var(--vscode-button-background);
    border: none; border-radius: 4px; padding: 3px 10px; cursor: pointer;
  }
  .graph-toolbar button:hover { background: var(--vscode-button-hoverBackground); }
  .graph-canvas { flex: 1 1 auto; overflow: hidden; cursor: grab; }
  .graph-canvas:active { cursor: grabbing; }
`;

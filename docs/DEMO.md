# CodeSync — Demo Guide

A 5-minute script for showing CodeSync live (or recording a GIF for your
portfolio). Assumes the server is running (`:4000`) and the extension is built.

## Setup for a two-user demo
You can simulate two collaborators on one machine:
1. Press **F5** to launch the Extension Development Host (window A).
2. In window A, open a project folder with a few source files.
3. Launch a **second** Extension Development Host the same way (window B), and
   open the *same* folder.

Give the two windows different names: Settings → `codesync.displayName`
("Alice" in A, "Bob" in B).

## The script

### 1. Create and join a room (30s)
- Window A: Command Palette → **CodeSync: Create Collaboration Room**. The room
  code is copied to your clipboard and shown in the status bar.
- Window B: **CodeSync: Join Collaboration Room**, paste the code.

### 2. Real-time editing + live cursors (90s)
- Open the same file in both windows.
- Type in A — the text appears in B instantly, and vice versa.
- Move your cursor / select text: the other window shows a **colored caret with
  your name** and a highlighted selection.

### 3. Presence + activity (60s)
- Open the **CodeSync** icon in the activity bar.
- **Collaborators** panel: both users appear with colored avatars, their active
  file, and a "typing…" indicator as they type.
- **Activity** panel: a live timeline of joins, file opens, and edits.

### 4. Chat (45s)
- Open the **Chat** panel. Send a message from A → it appears in B with author
  and timestamp. Start typing to show the "is typing…" indicator.

### 5. Codebase visualization (45s)
- Command Palette → **CodeSync: Show Dependency Graph**.
- A force-directed graph of the project's imports opens: blue = files,
  brown = external packages, node size = connectivity.
- Scroll to zoom, drag to pan, double-click a file node to open it.
- Edit an import in a file and watch the graph refresh live.

## Talking points for interviews
- **CRDT sync (Yjs):** conflict-free multi-user editing with no server-side OT.
- **Presence via awareness:** ephemeral cursor/selection/typing state, separate
  from the persisted document.
- **Clean architecture:** the server splits domain / application / infrastructure
  / interfaces; the extension separates transport, collaboration, and UI.
- **Type-safe wire protocol:** one shared package defines every WS/REST message,
  so client and server can't drift.

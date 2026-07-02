// Builds each webview panel as a self-contained IIFE bundle (React inlined)
// directly into the extension's media/ folder, so the extension can load them
// into webviews. Uses Vite's programmatic API in library mode, one call per
// panel so each emits a single file.
import { build } from "vite";
import react from "@vitejs/plugin-react";

const panels = [
  { name: "presence", entry: "src/panels/presence/main.tsx" },
  { name: "activity", entry: "src/panels/activity/main.tsx" },
  { name: "chat", entry: "src/panels/chat/main.tsx" },
  { name: "graph", entry: "src/panels/graph/main.tsx" }
];

for (const panel of panels) {
  await build({
    configFile: false,
    plugins: [react()],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      outDir: "../extension/media",
      emptyOutDir: false,
      minify: true,
      lib: {
        entry: panel.entry,
        name: `CodeSync_${panel.name}`,
        formats: ["iife"],
        fileName: () => `${panel.name}.js`
      }
    }
  });
}

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Webviews are bundled as static assets and loaded into VS Code webview panels.
// Each panel gets its own entry (added in later phases under src/panels/*).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Entries are registered per-panel in Phase 2+. Kept minimal for setup.
    rollupOptions: {
      output: {
        entryFileNames: "[name].js",
        assetFileNames: "[name][extname]"
      }
    }
  }
});

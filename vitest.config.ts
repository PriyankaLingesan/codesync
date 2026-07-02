import { defineConfig } from "vitest/config";

/**
 * Single Vitest config for the whole monorepo. `extensionAlias` lets the
 * server's NodeNext-style `./x.js` import specifiers resolve to the `.ts`
 * sources during tests, so tests can import source directly.
 */
export default defineConfig({
  resolve: {
    extensionAlias: {
      ".js": [".ts", ".js"]
    }
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node"
  }
});

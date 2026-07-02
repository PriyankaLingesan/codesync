import { describe, it, expect } from "vitest";
import {
  extractImports,
  externalName,
  resolveRelative
} from "../src/analysis/importParsing";

describe("extractImports", () => {
  it("captures every import form", () => {
    const source = [
      `import * as vscode from "vscode";`,
      `import { A } from './a';`,
      `import Default from "../lib/b.js";`,
      `export { X } from "./c";`,
      `import "./side-effect.css";`,
      `const y = require("lodash");`,
      `const z = await import("./dynamic");`,
      `import n from "node:path";`,
      `import s from "@scope/pkg";`
    ].join("\n");

    expect(extractImports(source)).toEqual([
      "vscode",
      "./a",
      "../lib/b.js",
      "./c",
      "./side-effect.css",
      "lodash",
      "./dynamic",
      "node:path",
      "@scope/pkg"
    ]);
  });

  it("returns nothing for import-free source", () => {
    expect(extractImports("const a = 1;\nfunction f() {}\n")).toEqual([]);
  });
});

describe("externalName", () => {
  it("keeps the scope for scoped packages", () => {
    expect(externalName("@codesync/shared/x")).toBe("@codesync/shared");
  });
  it("drops subpaths for plain packages", () => {
    expect(externalName("lodash/merge")).toBe("lodash");
  });
});

describe("resolveRelative", () => {
  const files = new Set([
    "src/a.ts",
    "src/lib/b.js",
    "src/c/index.ts",
    "src/app.ts"
  ]);

  it("resolves by adding extensions", () => {
    expect(resolveRelative("src/app.ts", "./a", files)).toBe("src/a.ts");
  });
  it("resolves explicit .js to the sibling file", () => {
    expect(resolveRelative("src/app.ts", "./lib/b.js", files)).toBe("src/lib/b.js");
  });
  it("resolves a directory to its index file", () => {
    expect(resolveRelative("src/app.ts", "./c", files)).toBe("src/c/index.ts");
  });
  it("returns null for unresolved imports", () => {
    expect(resolveRelative("src/app.ts", "./missing", files)).toBeNull();
  });
});

/**
 * Pure, dependency-free import-parsing helpers used by ImportGraphAnalyzer.
 * Kept free of the `vscode` API so they can be unit-tested in isolation.
 */

export const RESOLVE_EXTS = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

/**
 * Matches import specifiers in JS/TS source:
 * - `import ... from "x"` / `export ... from "x"`
 * - bare `import "x"`
 * - `require("x")`
 * - dynamic `import("x")`
 */
export const IMPORT_RE =
  /(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Extract all import specifiers from a source string. */
export function extractImports(text: string): string[] {
  const specs: string[] = [];
  IMPORT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMPORT_RE.exec(text)) !== null) {
    const spec = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (spec) specs.push(spec);
  }
  return specs;
}

/** Collapse a bare specifier to its package name (handles @scope/pkg). */
export function externalName(spec: string): string {
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    return parts.slice(0, 2).join("/");
  }
  return spec.split("/")[0];
}

/** Resolve a relative import against the set of known workspace files. */
export function resolveRelative(
  fromRel: string,
  spec: string,
  relSet: Set<string>
): string | null {
  const base = normalizePosix(joinPosix(dirnamePosix(fromRel), spec));

  for (const ext of RESOLVE_EXTS) {
    const candidate = base + ext;
    if (relSet.has(candidate)) return candidate;
  }
  for (const ext of RESOLVE_EXTS.slice(1)) {
    const candidate = normalizePosix(joinPosix(base, `index${ext}`));
    if (relSet.has(candidate)) return candidate;
  }
  return null;
}

// --- tiny posix path helpers (browser/node parity, no node:path dependency) ---

export function dirnamePosix(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

export function joinPosix(a: string, b: string): string {
  if (!a) return b;
  return `${a}/${b}`;
}

export function normalizePosix(p: string): string {
  const parts = p.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (stack.length > 0 && stack[stack.length - 1] !== "..") stack.pop();
      else stack.push("..");
    } else {
      stack.push(part);
    }
  }
  return stack.join("/");
}

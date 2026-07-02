import * as vscode from "vscode";
import type { GraphData, GraphEdge, GraphNode } from "@codesync/shared";
import { extractImports, externalName, resolveRelative } from "./importParsing";

const SOURCE_GLOB = "**/*.{ts,tsx,js,jsx,mjs,cjs}";
const EXCLUDE_GLOB = "**/{node_modules,dist,out,build,.git,.next,coverage}/**";
const MAX_FILES = 2000;

/**
 * Scans the workspace's source files and builds an import/dependency graph:
 * file nodes linked by relative imports, plus grouped external-package nodes.
 * Pure analysis — runs entirely in the extension host, no server involved.
 */
export class ImportGraphAnalyzer {
  async build(): Promise<GraphData> {
    const uris = await vscode.workspace.findFiles(
      SOURCE_GLOB,
      EXCLUDE_GLOB,
      MAX_FILES
    );

    const relPaths = uris.map((u) => toRel(u));
    const relSet = new Set(relPaths);
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    const addNode = (id: string, label: string, kind: GraphNode["kind"]): void => {
      if (!nodes.has(id)) nodes.set(id, { id, label, kind, degree: 0 });
    };

    for (const rel of relPaths) addNode(rel, rel, "file");

    for (const uri of uris) {
      const rel = toRel(uri);
      let text: string;
      try {
        text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
      } catch {
        continue;
      }

      for (const spec of extractImports(text)) {
        if (spec.startsWith(".")) {
          const target = resolveRelative(rel, spec, relSet);
          if (target && target !== rel) edges.push({ source: rel, target });
        } else if (!spec.startsWith("node:")) {
          const pkg = externalName(spec);
          const id = `npm:${pkg}`;
          addNode(id, pkg, "external");
          edges.push({ source: rel, target: id });
        }
      }
    }

    for (const edge of edges) {
      const s = nodes.get(edge.source);
      const t = nodes.get(edge.target);
      if (s) s.degree += 1;
      if (t) t.degree += 1;
    }

    return { nodes: [...nodes.values()], edges };
  }
}

function toRel(uri: vscode.Uri): string {
  return vscode.workspace.asRelativePath(uri, false).replace(/\\/g, "/");
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { GraphData, GraphNode } from "@codesync/shared";
import { getVsCodeApi, onHostMessage } from "../../lib/vscode";
import { baseStyles } from "../../lib/styles";

interface Positioned {
  id: string;
  x: number;
  y: number;
  node: GraphNode;
}

interface Layout {
  positions: Map<string, Positioned>;
  width: number;
  height: number;
}

const WIDTH = 1200;
const HEIGHT = 800;

/**
 * A compact force-directed layout (Fruchterman–Reingold style): edges pull
 * connected nodes together, all nodes repel each other, and a cooling schedule
 * settles the graph. Runs once per graph payload.
 */
function computeLayout(graph: GraphData): Layout {
  const n = Math.max(graph.nodes.length, 1);
  const area = WIDTH * HEIGHT;
  const k = Math.sqrt(area / n); // ideal edge length
  const iterations = Math.min(300, Math.max(60, Math.floor(6000 / n)));

  const pos = new Map<string, Positioned>();
  graph.nodes.forEach((node, i) => {
    // Deterministic-ish initial placement on a spiral to aid convergence.
    const angle = i * 2.399963; // golden angle
    const radius = (Math.sqrt(i) / Math.sqrt(n)) * (Math.min(WIDTH, HEIGHT) / 2);
    pos.set(node.id, {
      id: node.id,
      x: WIDTH / 2 + Math.cos(angle) * radius,
      y: HEIGHT / 2 + Math.sin(angle) * radius,
      node
    });
  });

  const disp = new Map<string, { x: number; y: number }>();
  let temperature = Math.min(WIDTH, HEIGHT) / 8;
  const cooling = temperature / (iterations + 1);
  const nodes = [...pos.values()];

  for (let iter = 0; iter < iterations; iter++) {
    for (const v of nodes) disp.set(v.id, { x: 0, y: 0 });

    // Repulsive forces (O(n^2); n is capped by the analyzer).
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const va = nodes[a];
        const vb = nodes[b];
        let dx = va.x - vb.x;
        let dy = va.y - vb.y;
        let dist = Math.hypot(dx, dy) || 0.01;
        if (dist > k * 6) continue; // ignore far pairs for speed
        const force = (k * k) / dist;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        const da = disp.get(va.id)!;
        const db = disp.get(vb.id)!;
        da.x += dx;
        da.y += dy;
        db.x -= dx;
        db.y -= dy;
      }
    }

    // Attractive forces along edges.
    for (const edge of graph.edges) {
      const vs = pos.get(edge.source);
      const vt = pos.get(edge.target);
      if (!vs || !vt) continue;
      let dx = vs.x - vt.x;
      let dy = vs.y - vt.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const force = (dist * dist) / k;
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      const ds = disp.get(vs.id)!;
      const dt = disp.get(vt.id)!;
      ds.x -= dx;
      ds.y -= dy;
      dt.x += dx;
      dt.y += dy;
    }

    // Apply displacement, capped by temperature; keep inside bounds.
    for (const v of nodes) {
      const d = disp.get(v.id)!;
      const len = Math.hypot(d.x, d.y) || 0.01;
      v.x += (d.x / len) * Math.min(len, temperature);
      v.y += (d.y / len) * Math.min(len, temperature);
      v.x = Math.max(20, Math.min(WIDTH - 20, v.x));
      v.y = Math.max(20, Math.min(HEIGHT - 20, v.y));
    }
    temperature = Math.max(1, temperature - cooling);
  }

  return { positions: pos, width: WIDTH, height: HEIGHT };
}

function colorFor(node: GraphNode): string {
  return node.kind === "external" ? "#a1887f" : "#64b5f6";
}

function radiusFor(node: GraphNode): number {
  return 4 + Math.min(10, Math.sqrt(node.degree) * 2);
}

function GraphApp(): React.JSX.Element {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const api = useMemo(() => getVsCodeApi(), []);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const off = onHostMessage((message) => {
      if (message.type === "graph") setGraph(message.graph);
    });
    api.postMessage({ type: "ready" });
    return off;
  }, [api]);

  const layout = useMemo(() => (graph ? computeLayout(graph) : null), [graph]);

  const onWheel = (e: React.WheelEvent): void => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setView((v) => ({ ...v, scale: Math.max(0.2, Math.min(4, v.scale * factor)) }));
  };
  const onMouseDown = (e: React.MouseEvent): void => {
    dragRef.current = { x: e.clientX - view.x, y: e.clientY - view.y };
  };
  const onMouseMove = (e: React.MouseEvent): void => {
    if (!dragRef.current) return;
    setView((v) => ({ ...v, x: e.clientX - dragRef.current!.x, y: e.clientY - dragRef.current!.y }));
  };
  const endDrag = (): void => {
    dragRef.current = null;
  };

  const openNode = (id: string): void => {
    api.postMessage({ type: "open-file", path: id });
  };

  const stats = graph
    ? `${graph.nodes.length} nodes · ${graph.edges.length} edges`
    : "Analyzing workspace…";

  return (
    <>
      <style>{baseStyles}</style>
      <div className="graph">
        <div className="graph-toolbar">
          <span className="graph-stats">{stats}</span>
          <span className="graph-hint">
            scroll to zoom · drag to pan · double-click a file to open
          </span>
          <button onClick={() => api.postMessage({ type: "refresh" })}>
            Refresh
          </button>
        </div>
        <div
          className="graph-canvas"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
        >
          {!layout || !graph ? (
            <div className="empty">{stats}</div>
          ) : (
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
                {graph.edges.map((edge, i) => {
                  const s = layout.positions.get(edge.source);
                  const t = layout.positions.get(edge.target);
                  if (!s || !t) return null;
                  const active =
                    hover === edge.source || hover === edge.target;
                  return (
                    <line
                      key={i}
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={active ? "#e57373" : "currentColor"}
                      strokeOpacity={active ? 0.9 : 0.18}
                      strokeWidth={active ? 1.5 : 0.75}
                    />
                  );
                })}
                {[...layout.positions.values()].map((p) => (
                  <g
                    key={p.id}
                    transform={`translate(${p.x} ${p.y})`}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover(null)}
                    onDoubleClick={() => openNode(p.id)}
                    style={{ cursor: p.node.kind === "file" ? "pointer" : "default" }}
                  >
                    <circle
                      r={radiusFor(p.node)}
                      fill={colorFor(p.node)}
                      stroke="rgba(0,0,0,0.35)"
                      strokeWidth={0.5}
                    />
                    {(hover === p.id || p.node.degree >= 6) && (
                      <text
                        x={radiusFor(p.node) + 2}
                        y={3}
                        fontSize={9}
                        fill="currentColor"
                      >
                        {p.node.label}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            </svg>
          )}
        </div>
      </div>
    </>
  );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<GraphApp />);

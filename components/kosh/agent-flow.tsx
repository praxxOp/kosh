"use client";

import "@xyflow/react/dist/style.css";

import * as React from "react";
import { Background, BackgroundVariant, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { Bot, Building2, Landmark, LineChart, MessageSquare, ShieldCheck, ShieldOff, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useKosh } from "./store";
import { ENGINE_LABELS, TOOL_LABELS } from "@/lib/kosh/labels";
import type { ActionEvent, ServerId } from "@/lib/kosh/types";

/* Node card in the kit's workflow style: round icon, title, subtitle, optional badge. */

type FlowData = {
  name: string;
  description: string;
  bg: string;
  icon: "prompt" | "agent" | "guard-on" | "guard-off" | "tally" | "alpaca" | "bank" | "kosh";
  badge?: string;
  counts?: { allowed: number; blocked: number; held: number };
  tone?: "ok" | "bad" | "warn" | "none";
  active?: boolean;
  wide?: boolean;
};
type FlowNode = Node<FlowData, "kosh">;

const ICONS = { prompt: MessageSquare, agent: Bot, "guard-on": ShieldCheck, "guard-off": ShieldOff, tally: Building2, alpaca: LineChart, bank: Landmark, kosh: Sparkles };

const hs: React.CSSProperties = { width: 8, height: 8, borderRadius: "50%", background: "transparent", border: "none", opacity: 0 };

function KoshNode({ data, selected }: NodeProps<FlowNode>) {
  const Icon = ICONS[data.icon];
  return (
    <div
      className={cn(
        "bg-card relative rounded-xl border p-3 shadow-sm transition-all",
        data.wide ? "w-[272px]" : "w-[240px]",
        selected || data.active ? "border-blue-400 ring-1 ring-blue-400/30" : "border-border hover:shadow-md",
        data.tone === "bad" && "border-red-300 dark:border-red-900",
        data.tone === "warn" && "border-amber-300 dark:border-amber-900",
        data.tone === "ok" && "border-green-300 dark:border-green-900"
      )}>
      <Handle type="target" position={Position.Left} id="left" style={hs} />
      <Handle type="source" position={Position.Right} id="right" style={hs} />
      <div className="flex items-center gap-2.5">
        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-white", data.bg)}>
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-none font-semibold">{data.name}</p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{data.description}</p>
        </div>
        {data.badge && (
          <Badge variant="outline" className="shrink-0 gap-1 px-1.5 py-0.5 text-[10px]">
            <Zap className="size-3" />
            {data.badge}
          </Badge>
        )}
      </div>
      {data.counts && (
        <div className="mt-2.5 flex items-center gap-1.5 border-t pt-2.5 text-[10px]">
          <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-green-700 dark:text-green-400">{data.counts.allowed} ok</span>
          <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-red-700 dark:text-red-400">{data.counts.blocked} blocked</span>
          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">{data.counts.held} held</span>
        </div>
      )}
    </div>
  );
}

const nodeTypes = { kosh: KoshNode };

const SERVERS: { id: ServerId; name: string; description: string; bg: string; icon: FlowData["icon"] }[] = [
  { id: "tally", name: "Tally", description: "Books · inbox (demo)", bg: "bg-blue-600", icon: "tally" },
  { id: "alpaca", name: "Alpaca", description: "Paper broker", bg: "bg-amber-500", icon: "alpaca" },
  { id: "bank", name: "Bank", description: "Transfers (pretend)", bg: "bg-emerald-600", icon: "bank" },
  { id: "kosh", name: "Recommendations", description: "Scoring pipeline", bg: "bg-purple-600", icon: "kosh" }
];

function useAgentFlowGraph(onSelect?: (server: ServerId | null) => void) {
  const { actions, mode, engine, running, lastPrompt } = useKosh();
  return React.useMemo(() => {
    const byServer = (s: ServerId) => actions.filter((a) => a.server === s);
    const counts = (list: ActionEvent[]) => ({
      allowed: list.filter((a) => a.decision === "allowed").length,
      blocked: list.filter((a) => a.decision === "blocked").length,
      held: list.filter((a) => a.decision === "held").length
    });
    const on = mode === "on";
    const latest = actions[0];
    const nodes: FlowNode[] = [
      {
        id: "prompt",
        type: "kosh",
        position: { x: 0, y: 190 },
        data: { name: "Prompt", description: lastPrompt ? lastPrompt.slice(0, 42) : "Waiting for input", bg: "bg-violet-500", icon: "prompt", badge: "Trigger", wide: true }
      },
      {
        id: "agent",
        type: "kosh",
        position: { x: 330, y: 190 },
        data: { name: "Kosh agent", description: "LLM · tool calling", bg: "bg-indigo-500", icon: "agent", active: running }
      },
      {
        id: "guard",
        type: "kosh",
        position: { x: 630, y: 190 },
        data: {
          name: on ? ENGINE_LABELS[engine === "none" ? "local" : engine] : "No guard",
          description: on ? "Checks every tool call" : "Calls go straight through",
          bg: on ? "bg-green-600" : "bg-red-500",
          icon: on ? "guard-on" : "guard-off",
          tone: on ? "ok" : "bad",
          counts: counts(actions),
          wide: true
        }
      },
      ...SERVERS.map((s, i): FlowNode => {
        const list = byServer(s.id);
        const last = list[0];
        return {
          id: s.id,
          type: "kosh",
          position: { x: 960, y: 20 + i * 118 },
          data: {
            name: s.name,
            description: last ? `${TOOL_LABELS[last.tool] ?? last.tool} · ${last.decision}` : s.description,
            bg: s.bg,
            icon: s.icon,
            counts: counts(list),
            tone: last?.decision === "blocked" ? "bad" : last?.decision === "held" ? "warn" : last ? "ok" : "none",
            active: running && latest?.server === s.id
          }
        };
      })
    ];
    const tone = (s: ServerId) => {
      const last = byServer(s)[0];
      return last?.decision === "blocked" ? "#ef4444" : last?.decision === "held" ? "#f59e0b" : last ? "#22c55e" : "var(--border)";
    };
    const edges: Edge[] = [
      { id: "e1", source: "prompt", target: "agent", type: "smoothstep", animated: running, style: { stroke: "var(--border)", strokeWidth: 1.5 } },
      { id: "e2", source: "agent", target: "guard", type: "smoothstep", animated: running, style: { stroke: on ? "#22c55e" : "#ef4444", strokeWidth: 1.5 } },
      ...SERVERS.map((s) => ({ id: `e-${s.id}`, source: "guard", target: s.id, type: "smoothstep", animated: running, style: { stroke: tone(s.id), strokeWidth: 1.5 } }))
    ];
    return { nodes, edges, onSelect };
  }, [actions, mode, engine, running, lastPrompt, onSelect]);
}

export function AgentFlow({ onSelectServer, toolbarSlot }: { onSelectServer?: (s: ServerId | null) => void; toolbarSlot?: React.ReactNode }) {
  const { nodes, edges } = useAgentFlowGraph();
  return (
    <div className="relative h-full w-full">
      {toolbarSlot && <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">{toolbarSlot}</div>}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnScroll
        onNodeClick={(_, n) => onSelectServer?.((SERVERS.some((s) => s.id === n.id) ? n.id : null) as ServerId | null)}
        onPaneClick={() => onSelectServer?.(null)}>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
      </ReactFlow>
    </div>
  );
}

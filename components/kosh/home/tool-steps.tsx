"use client";

import { useState } from "react";
import { AlertCircle, Check, ChevronDown, Clock, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionItem } from "../store";
import { TOOL_LABELS, summarizeInput, summarizeOutput } from "@/lib/kosh/labels";
import type { ActionEvent } from "@/lib/kosh/types";

function StatusGlyph({ decision }: { decision: ActionEvent["decision"] }) {
  if (decision === "allowed") return <Check className="text-muted-foreground size-3.5" />;
  if (decision === "blocked") return <X className="size-3.5 text-red-500" />;
  if (decision === "held") return <Clock className="size-3.5 text-amber-500" />;
  return <AlertCircle className="text-muted-foreground size-3.5" />;
}

function Step({ item }: { item: ActionItem }) {
  const a = item.event;
  const [open, setOpen] = useState(false);
  const input = summarizeInput(a);
  const detail = a.decision === "allowed" ? summarizeOutput(a) : a.reason;
  return (
    <li>
      <button
        type="button"
        onClick={() => detail && setOpen((v) => !v)}
        className={cn("group/step flex w-full items-center gap-2 py-1 text-start text-[13px]", detail ? "cursor-pointer" : "cursor-default")}>
        <StatusGlyph decision={a.decision} />
        <span className={cn(a.decision === "blocked" ? "text-foreground" : "text-muted-foreground group-hover/step:text-foreground")}>
          {TOOL_LABELS[a.tool] ?? a.tool}
        </span>
        {input && <span className="text-muted-foreground/70 truncate">{input}</span>}
        {a.decision === "blocked" && a.ruleId && <code className="bg-muted text-muted-foreground rounded px-1 text-[10px]">{a.ruleId}</code>}
        {a.decision === "held" && <span className="text-xs text-amber-600 dark:text-amber-400">needs approval</span>}
        {detail && <ChevronDown className={cn("text-muted-foreground/60 ml-auto size-3.5 shrink-0 transition-transform", open && "rotate-180")} />}
      </button>
      {open && detail && <p className="text-muted-foreground/80 pb-1.5 pl-[22px] text-[12.5px] leading-relaxed">{detail}</p>}
    </li>
  );
}

/**
 * A run of consecutive tool calls, the way Claude shows its work: one quiet line with a chevron,
 * the steps as plain text underneath. Open while the agent is still working, collapsible after.
 */
export function ToolSteps({ items, live }: { items: ActionItem[]; live: boolean }) {
  const [open, setOpen] = useState(true);
  const blocked = items.filter((i) => i.event.decision === "blocked").length;
  const held = items.filter((i) => i.event.decision === "held").length;
  const summary =
    items.length === 1
      ? TOOL_LABELS[items[0].event.tool] ?? items[0].event.tool
      : `Worked through ${items.length} steps${blocked ? ` · ${blocked} blocked` : ""}${held ? ` · ${held} need approval` : ""}`;

  return (
    <div className="max-w-[85%] lg:max-w-[75%]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-muted-foreground hover:text-foreground flex items-center gap-2 py-1 text-[13px] transition-colors">
        {live ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />}
        <span>{summary}</span>
      </button>
      {open && (
        <ul className="border-border/60 ml-[7px] border-l pl-3.5">
          {items.map((item) => (
            <Step key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

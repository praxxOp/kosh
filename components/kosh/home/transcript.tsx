"use client";

import { useEffect, useMemo, useRef } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Markdown } from "@/components/ui/custom/prompt/markdown";
import { PromptLoader } from "@/components/ui/custom/prompt/loader";
import { cn } from "@/lib/utils";
import { ApprovalCard } from "./approval-chip";
import { ToolSteps } from "./tool-steps";
import { useKosh, type ActionItem, type ChatMsg } from "../store";
import { shortTime } from "@/lib/kosh/labels";

type Block = { kind: "message"; item: ChatMsg } | { kind: "steps"; id: string; items: ActionItem[] };

/** Consecutive tool calls fold into one steps block, so the transcript reads as prose with work shown underneath. */
function toBlocks(timeline: (ChatMsg | ActionItem)[]): Block[] {
  const blocks: Block[] = [];
  for (const item of timeline) {
    if (item.kind === "message") {
      blocks.push({ kind: "message", item });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last && last.kind === "steps") last.items.push(item);
    else blocks.push({ kind: "steps", id: item.id, items: [item] });
  }
  return blocks;
}

/** The conversation, in the kit's chat bubbles: the user on the right, Kosh on the left, work shown between. */
export function Transcript() {
  const { timeline, running } = useKosh();
  const bottomRef = useRef<HTMLDivElement>(null);
  const blocks = useMemo(() => toBlocks(timeline), [timeline]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [timeline.length, running]);

  return (
    <div className="flex flex-col gap-5 py-2">
      {blocks.map((block, i) => {
        if (block.kind === "steps") {
          const live = running && i === blocks.length - 1;
          const heldIds = block.items.filter((it) => it.event.decision === "held" && it.event.approvalId).map((it) => it.event.approvalId!);
          return (
            <div key={block.id} className="flex flex-col gap-3">
              <ToolSteps items={block.items} live={live} />
              {heldIds.length > 0 && <ApprovalCard approvalIds={heldIds} />}
            </div>
          );
        }
        const item = block.item;
        const own = item.role === "user";
        // Kosh's streaming placeholder stays silent while steps are being shown.
        if (!own && !item.content && item.streaming) {
          const prev = blocks[i - 1];
          if (prev && prev.kind === "steps") return null;
        }
        return (
          <div key={item.id} className={cn("flex w-full flex-col gap-1", own && "items-end")}>
            <Bubble variant={own ? "default" : "muted"} align={own ? "end" : "start"} className="lg:max-w-[75%]">
              {!own && <span className="text-muted-foreground px-1 text-xs font-medium">Kosh</span>}
              <BubbleContent className={cn(!own && "prose prose-sm dark:prose-invert max-w-none")}>
                {item.content ? (
                  own ? (
                    <span className="whitespace-pre-wrap">{item.content}</span>
                  ) : (
                    <Markdown className="space-y-3">{item.content}</Markdown>
                  )
                ) : item.streaming ? (
                  <PromptLoader variant="pulse-dot" />
                ) : (
                  <span className="text-muted-foreground text-sm">(no reply)</span>
                )}
              </BubbleContent>
            </Bubble>
            {!item.streaming && <time className="text-muted-foreground text-xs">{shortTime(item.ts)}</time>}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

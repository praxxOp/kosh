"use client";

import { useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export interface GlassTab {
  value: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** A count beside the label; hidden at 0. */
  count?: number;
  /** "urgent" paints the count red: it needs the user. */
  countTone?: "urgent" | "quiet";
}

/**
 * The Home tab switcher: a frosted track with a solid pill that slides to the active tab.
 * Built on the raw Radix primitives (not the kit's styled Tabs) so none of the kit's
 * trigger/list styling fights the glass look. Must sit inside a `Tabs` root.
 */
export function GlassTabsList({ tabs, value, className }: { tabs: GlassTab[]; value: string; className?: string }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]');
      if (!active) {
        setPill(null);
        return;
      }
      setPill({ left: active.offsetLeft, width: active.offsetWidth });
      const start = active.offsetLeft;
      const end = start + active.offsetWidth;
      if (start < list.scrollLeft) list.scrollLeft = start;
      else if (end > list.scrollLeft + list.clientWidth) list.scrollLeft = end - list.clientWidth;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [value, tabs]);

  return (
    <TabsPrimitive.List
      ref={listRef}
      className={cn(
        // Frosted glass: a white that thins towards the bottom over a blur of what is behind;
        // a bright top edge and a hairline border catch the light, a tight shadow sits it on
        // the page and a wide one floats it.
        "relative inline-flex h-auto w-full max-w-full items-center [scrollbar-width:none] gap-0 overflow-x-auto rounded-full border border-black/[0.07] bg-gradient-to-b from-white/90 to-white/45 p-1 backdrop-blur-xl backdrop-saturate-150 sm:w-auto sm:gap-0.5 [&::-webkit-scrollbar]:hidden",
        "shadow-[inset_0_1px_0_rgb(255_255_255),inset_0_-1px_0_rgb(0_0_0/0.03),0_1px_2px_rgb(0_0_0/0.05),0_10px_30px_-6px_rgb(0_0_0/0.14)]",
        "dark:border-white/10 dark:from-white/[0.10] dark:to-white/[0.04] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_0_0/0.4),0_10px_30px_-6px_rgb(0_0_0/0.7)]",
        className
      )}>
      {/* The sliding pill, drawn under the labels: solid foreground (black on light, white on dark). */}
      <span
        aria-hidden
        className={cn(
          "bg-foreground absolute inset-y-1 rounded-full shadow-md transition-[left,width,opacity] duration-300 ease-out motion-reduce:transition-none",
          pill ? "opacity-100" : "opacity-0"
        )}
        style={pill ? { left: pill.left, width: pill.width } : undefined}
      />
      {tabs.map(({ value: tabValue, label, icon: Icon, count, countTone = "quiet" }) => (
        <TabsPrimitive.Trigger
          key={tabValue}
          value={tabValue}
          className={cn(
            "group text-muted-foreground hover:text-foreground relative z-10 inline-flex h-8 flex-auto cursor-pointer items-center justify-center gap-1 rounded-full border-0 bg-transparent px-1.5 text-[13px] font-medium whitespace-nowrap transition-colors outline-none sm:h-9 sm:flex-none sm:gap-1.5 sm:px-5 sm:text-[15px]",
            "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "data-[state=active]:text-background"
          )}>
          {/* Not on a phone: the room goes to the labels. */}
          {Icon && <Icon className="text-primary group-data-[state=active]:text-background hidden size-4 shrink-0 sm:block" />}
          {label}
          {!!count && count > 0 && (
            <span
              className={cn(
                "min-w-4 rounded-full px-1 text-[10px] leading-4 font-semibold tabular-nums sm:min-w-5 sm:px-1.5 sm:text-[11px] sm:leading-5",
                countTone === "urgent"
                  ? "bg-destructive text-white"
                  : "bg-muted text-muted-foreground group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background"
              )}>
              {count}
            </span>
          )}
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>
  );
}

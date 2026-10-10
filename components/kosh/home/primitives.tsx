"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A section's eyebrow: the coordinate, then optionally something on the right. */
export function SectionEyebrow({ children, urgent, action }: { children: React.ReactNode; urgent?: boolean; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <p className={cn("flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase", urgent ? "text-primary" : "text-muted-foreground")}>
        {urgent && <span className="bg-primary size-1.5 animate-pulse rounded-full" />}
        {children}
      </p>
      {action}
    </div>
  );
}

export type Tone = "urgent" | "warning" | "success" | "info" | "neutral";

export interface FeedAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  outline?: boolean;
  disabled?: boolean;
}

export interface FeedItem {
  id: string;
  tone: Tone;
  icon: LucideIcon;
  title: string;
  status: string;
  mutedStatus?: boolean;
  aside?: FeedAction;
  action?: FeedAction;
}

export interface FeedSection {
  title: string;
  urgent?: boolean;
  items: FeedItem[];
}

/** A list of actions: an icon, what it is and when, and the one button that does it. */
export function Feed({ items }: { items: FeedItem[] }) {
  return (
    <ul className="relative flex flex-col gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        const urgent = item.tone === "urgent";
        return (
          <li
            key={item.id}
            className="bg-card relative flex flex-col gap-3 rounded-xl border px-3.5 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_6px_16px_-6px_rgb(0_0_0/0.10)] sm:flex-row sm:items-center dark:shadow-[0_1px_2px_rgb(0_0_0/0.3),0_6px_16px_-6px_rgb(0_0_0/0.5)]">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="bg-foreground text-background flex size-9 shrink-0 items-center justify-center rounded-full">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="max-w-96 text-sm font-semibold text-pretty break-words">{item.title}</p>
                <p className={cn("text-muted-foreground truncate text-xs", urgent && !item.mutedStatus && "font-medium text-rose-600 dark:text-rose-400")}>{item.status}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 pl-12 sm:pl-0">
              {item.aside && (
                <Button size="sm" variant="outline" className="shrink-0 rounded-full" onClick={item.aside.onClick} disabled={item.aside.disabled}>
                  <item.aside.icon />
                  {item.aside.label}
                </Button>
              )}
              {item.action && (
                <Button
                  size="sm"
                  variant={urgent && !item.action.outline ? "default" : "outline"}
                  className="shrink-0 rounded-full"
                  onClick={item.action.onClick}
                  disabled={item.action.disabled}>
                  <item.action.icon />
                  {item.action.label}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Nothing needs the user. */
export function AllClearCard({ subtitle }: { subtitle: string }) {
  return (
    <div className="from-primary/15 via-primary/5 to-card relative overflow-hidden rounded-[22px] border bg-gradient-to-br p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-24px_rgb(0_0_0/0.2)]">
      <div className="bg-primary/20 absolute -top-10 -right-10 size-40 rounded-full blur-2xl" />
      <h2 className="text-xl font-semibold tracking-tight">All clear</h2>
      <p className="text-muted-foreground mt-1.5 flex items-center gap-2 text-sm font-medium">
        <span className="size-2 rounded-full bg-green-500" />
        {subtitle}
      </p>
    </div>
  );
}

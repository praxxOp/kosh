"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpIcon, MicIcon, Paperclip, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Suggestion } from "@/components/ui/custom/prompt/suggestion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useKosh } from "../store";
import { hasSuggestions, PROMPT_CATEGORIES, QUICK_ACTIONS } from "./prompts";

const ROWS = 5;

/** The panel the input opens when it is focused: topic tabs, the tab's prompts, and quick actions beside them. */
function SuggestionsPanel({ query, onPick, onReplay }: { query: string; onPick: (prompt: string) => void; onReplay: () => void }) {
  const [category, setCategory] = useState(PROMPT_CATEGORIES[0].id);
  const topic = PROMPT_CATEGORIES.find((c) => c.id === category) ?? PROMPT_CATEGORIES[0];
  const needle = query.trim().toLowerCase();
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle);
  const pool: { icon: LucideIcon; text: string }[] = needle
    ? PROMPT_CATEGORIES.flatMap((c) => c.prompts.map((text) => ({ icon: c.icon, text })))
    : topic.prompts.map((text) => ({ icon: topic.icon, text }));
  const rows = pool.filter((r) => matches(r.text)).slice(0, ROWS);
  const actions = QUICK_ACTIONS.filter((a) => matches(a.label));

  return (
    <div className="@container">
      <div className="overflow-x-auto border-b p-2">
        <Tabs value={topic.id} onValueChange={setCategory}>
          <TabsList>
            {PROMPT_CATEGORIES.map((c) => (
              <TabsTrigger key={c.id} value={c.id}>
                <c.icon />
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className={cn("grid", rows.length > 0 && actions.length > 0 && "@2xl:grid-cols-[3fr_2fr]")}>
        {rows.length > 0 && (
          <Command shouldFilter={false}>
            <CommandList className="max-h-none p-1">
              <CommandGroup heading={needle ? "Suggestions" : topic.label}>
                {rows.map((row) => (
                  <CommandItem key={row.text} value={row.text} onSelect={() => onPick(row.text)} className="cursor-pointer">
                    <row.icon />
                    <Highlight text={row.text} needle={needle} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
        {actions.length > 0 && (
          <div className={cn("p-2", rows.length > 0 && "@2xl:pl-0")}>
            <div className="bg-muted/30 h-full rounded-lg border p-3">
              <p className="text-muted-foreground mb-2 text-xs font-medium">Quick actions</p>
              <div className="flex flex-wrap gap-1.5">
                {actions.map((a) => (
                  <Suggestion key={a.id} type="button" size="sm" onClick={() => (a.kind === "replay" ? onReplay() : onPick(a.prompt))}>
                    <a.icon />
                    <Highlight text={a.label} needle={needle} />
                  </Suggestion>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Highlight({ text, needle }: { text: string; needle: string }) {
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, at)}
      <mark className="bg-primary/15 text-foreground rounded-sm">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </span>
  );
}

const PLACEHOLDER: Record<string, string> = {
  analyst: "Research and propose…",
  treasury_manager: "Ask Kosh anything…",
  cfo: "Ask Kosh anything…",
};

/**
 * The composer: a round input with a plain textarea, icon actions and the Kosh send button. Opens suggestions on focus.
 */
export function Composer() {
  const { send, replay, running, role } = useKosh();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 48), 128)}px`;
  }, [value]);

  const submit = (text = value) => {
    const t = text.trim();
    if (!t || running) return;
    setOpen(false);
    setValue("");
    void send(t);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-2">
      <Popover open={open && hasSuggestions(value)} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div ref={containerRef} data-kosh-input className="bg-background relative flex items-center rounded-4xl border shadow-sm">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              placeholder={PLACEHOLDER[role]}
              className="placeholder:text-muted-foreground flex-1 resize-none rounded-2xl border-0 bg-transparent px-4 py-4 text-sm break-words outline-none focus:ring-0"
              rows={1}
              style={{ minHeight: "3rem", maxHeight: "8rem", overflowWrap: "break-word", whiteSpace: "pre-wrap" }}
            />
            <div className="flex items-center gap-2 px-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label="Attach from Inbox" onClick={() => router.push("/dashboard/kosh/inbox")}>
                    <Paperclip className="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Attach reports and orders in the Inbox</TooltipContent>
              </Tooltip>
              <Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label="Voice input" title="Voice input">
                <MicIcon className="size-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                onClick={() => submit()}
                disabled={!value.trim() || running}
                className={cn("rounded-full", running && "animate-pulse")}
                title={running ? "Working…" : "Send"}
                aria-label="Send">
                <ArrowUpIcon className="size-5" />
              </Button>
            </div>
          </div>
        </PopoverAnchor>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={10}
          className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] overflow-y-auto p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (containerRef.current?.contains(e.target as Node)) e.preventDefault();
          }}>
          <SuggestionsPanel
            query={value}
            onPick={(p) => submit(p)}
            onReplay={() => {
              setOpen(false);
              void replay();
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

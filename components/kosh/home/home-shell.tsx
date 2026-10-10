"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ChartColumn, ChevronLeft, ListChecks, MessageSquare, PlusIcon, Workflow } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useKosh, type HomeTab } from "../store";
import { GlassTabsList, type GlassTab } from "./glass-tabs";
import { ActionsTab } from "./actions-tab";
import { InsightsTab } from "./insights-tab";
import { Transcript } from "./transcript";
import { Composer } from "./composer";
import { AgentFlow } from "../agent-flow";
import { ROLE_LABEL, type Role } from "@/lib/kosh/types";

const RANK: Record<Role, number> = { analyst: 0, treasury_manager: 1, cfo: 2 };
const FIRST_NAME: Record<Role, string> = { analyst: "Kavya", treasury_manager: "Arjun", cfo: "Priya" };

/** Back and New chat: outline, but see-through, with a fainter edge. */
const SOFT_OUTLINE = "border-foreground/10 bg-transparent shadow-none hover:bg-foreground/5 dark:bg-transparent";

function timeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

/** To the right of the input, shown on hover: the conversation or the live agent flow. */
function ViewSwitch() {
  const { chatView, setChatView, actions } = useKosh();
  const item = (v: "chat" | "flow", label: string, Icon: typeof Workflow) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={() => setChatView(v)}
          className={cn(
            "flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors",
            chatView === v ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}>
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
  return (
    <div
      className={cn(
        "bg-background flex h-12 shrink-0 items-center gap-1 rounded-full border p-1.5 shadow-sm transition-opacity",
        chatView === "flow" || actions.length > 0 ? "opacity-100" : "opacity-0 group-hover/home:opacity-100 focus-within:opacity-100"
      )}>
      {item("chat", "Chat", MessageSquare)}
      {item("flow", "Agent flow", Workflow)}
    </div>
  );
}

export function HomeShell() {
  const { tab, setTab, chatOpen, closeChat, clear, chatView, running, role, approvals, loadApprovals, loadInbox, loadCash } = useKosh();
  const composerRef = useRef<HTMLDivElement>(null);
  const [composerHeight, setComposerHeight] = useState(120);

  useEffect(() => {
    loadApprovals();
    loadInbox();
    loadCash();
  }, [loadApprovals, loadInbox, loadCash]);

  // The composer floats over the content; the scroll region leaves room for it.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const update = () => setComposerHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toDecide = approvals.filter((a) => a.status === "pending" && RANK[role] >= RANK[a.approver]).length;
  const tabs: GlassTab[] = [
    { value: "actions", label: "Actions", icon: ListChecks, count: toDecide, countTone: "urgent" },
    { value: "insights", label: "Insights", icon: ChartColumn },
  ];
  const inChat = chatOpen && chatView === "chat";
  const current = chatOpen ? "" : tab;
  const switcher = <GlassTabsList tabs={tabs} value={current} />;

  return (
    <Tabs value={current} onValueChange={(v) => setTab(v as HomeTab)} className="h-full gap-0">
      <div className="group/home from-primary/[0.07] relative isolate flex h-(--content-full-height) flex-col overflow-hidden rounded-md bg-gradient-to-b to-transparent to-45% lg:border">

        {/* In a chat: the header pinned to the top of the card, with no fill of its own. The tabs sit
            where they sat under the greeting; under them, this chat's toolbar in the messages' column. */}
        {inChat && (
          <div className="absolute inset-x-0 top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center px-4 pt-4 pb-2">
            <Button variant="outline" size="sm" className={cn(SOFT_OUTLINE, "h-9 justify-self-start rounded-full")} onClick={closeChat}>
              <ChevronLeft /> Home
            </Button>
            {switcher}
            <Button variant="outline" size="sm" className={cn(SOFT_OUTLINE, "h-9 justify-self-end rounded-full")} onClick={clear} disabled={running}>
              <PlusIcon /> New chat
            </Button>
          </div>
        )}

        {chatView === "flow" ? (
          <div className="absolute inset-0 p-3" style={{ paddingBottom: composerHeight + 12 }}>
            <div className="bg-card/60 h-full overflow-hidden rounded-xl border">
              <AgentFlow />
            </div>
          </div>
        ) : (
          /* SCROLL REGION: fills the card; the composer floats over its bottom. In a chat the messages
             fade out before they reach the header (it is about 68px tall; they start at 88px). */
          <div
            className={cn("absolute inset-0 overflow-y-auto", inChat && "[mask-image:linear-gradient(to_bottom,transparent_68px,black_88px)]")}>
            <div className={cn("px-4", inChat ? "pt-[88px]" : "pt-5")} style={{ paddingBottom: composerHeight + 16 }}>
              {inChat ? (
                <div className="mx-auto flex w-full max-w-3xl flex-col">
                  <Transcript />
                </div>
              ) : (
                <div className="w-full">
                  <header className="flex flex-col items-center gap-2 px-4 pt-2 pb-6 text-center">
                    <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">{format(new Date(), "EEEE, d MMMM")}</p>
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      Good {timeOfDay()}, <span className="text-primary">{FIRST_NAME[role]}</span>
                    </h1>
                    <p className="text-muted-foreground text-sm">{ROLE_LABEL[role]} · Acme Pvt Ltd</p>
                  </header>
                  <div className="sticky top-3 z-30 flex justify-center">{switcher}</div>
                  <div className="mt-6 w-full">
                    <TabsContent value="actions">
                      <ActionsTab />
                    </TabsContent>
                    <TabsContent value="insights">
                      <InsightsTab />
                    </TabsContent>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating composer: blurred bar over the bottom of the card. */}
        <div ref={composerRef} className="bg-background/80 absolute inset-x-0 bottom-0 z-10 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-3 pb-4">
            <div className="kosh-input-glow min-w-0 flex-1">
              <Composer />
            </div>
            <ViewSwitch />
          </div>
        </div>
      </div>
    </Tabs>
  );
}

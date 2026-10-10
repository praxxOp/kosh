"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, Hourglass, MessageSquareText, Send, Sparkles } from "lucide-react";
import { useKosh } from "../store";
import { AllClearCard, Feed, SectionEyebrow, type FeedItem, type FeedSection } from "./primitives";
import { inr, usd } from "@/lib/kosh/labels";
import { ROLE_LABEL, type Role } from "@/lib/kosh/types";

const RANK: Record<Role, number> = { analyst: 0, treasury_manager: 1, cfo: 2 };
const SHORT: Record<Role, string> = { analyst: "Analyst", treasury_manager: "Manager", cfo: "CFO" };

export function ActionsTab() {
  const router = useRouter();
  const { role, approvals, actions, cash, threads, busyApproval, running, send, submitApproval, decide, selectThread, loadApprovals, loadInbox } = useKosh();

  useEffect(() => {
    loadApprovals();
    loadInbox();
  }, [loadApprovals, loadInbox, role]);

  const openThread = (id: string) => {
    selectThread(id);
    router.push("/dashboard/kosh/inbox");
  };
  const describe = (a: (typeof approvals)[number]) => `${a.amountUsd ? usd(a.amountUsd) + " " : ""}${String(a.input.symbol ?? "")} order`.trim();

  // Decisions waiting on me (or on someone below me in the chain).
  const toDecide: FeedItem[] = approvals
    .filter((a) => a.status === "pending" && RANK[role] >= RANK[a.approver])
    .map((a) => ({
      id: a.id,
      tone: "urgent",
      icon: Banknote,
      title: describe(a),
      status: `From ${SHORT[a.requestedBy]} · needs your approval`,
      mutedStatus: true,
      action: { label: "Approve", icon: Check, onClick: () => decide(a.id, "approve"), disabled: busyApproval === a.id },
    }));

  // My own proposals.
  const mine: FeedItem[] = approvals
    .filter((a) => a.requestedBy === role && (a.status === "draft" || a.status === "pending"))
    .map((a) => {
      const who = SHORT[a.approver];
      const thread = threads.find((t) => t.approvalId === a.id);
      return a.status === "draft"
        ? {
            id: a.id,
            tone: "warning" as const,
            icon: Send,
            title: describe(a),
            status: `Needs ${who} approval`,
            action: { label: `Send to ${who}`, icon: Send, onClick: () => submitApproval(a.id), disabled: busyApproval === a.id },
          }
        : {
            id: a.id,
            tone: "info" as const,
            icon: Hourglass,
            title: describe(a),
            status: `With the ${who}`,
            action: thread ? { label: "Open thread", icon: MessageSquareText, onClick: () => openThread(thread.id), outline: true } : undefined,
          };
    });

  // A nudge from the books, until the cash is dealt with.
  const deployed = actions.some((a) => a.tool === "alpaca_place_order" && a.decision === "allowed");
  const nudges: FeedItem[] = [];
  if (cash && !deployed)
    nudges.push({
      id: "idle-cash",
      tone: "warning",
      icon: Sparkles,
      title: `${inr(cash.position.spareCash)} idle`,
      status: "Spare cash above the buffer",
      action: { label: role === "analyst" ? "Propose" : "Invest", icon: Sparkles, onClick: () => send("We have spare cash. Invest it safely per policy."), disabled: running },
    });
  const sections: FeedSection[] = [
    { title: "Needs you now", urgent: true, items: toDecide },
    { title: "Your proposals", items: mine },
    { title: "Suggested", items: nudges },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {sections.length === 0 && <AllClearCard subtitle={`Nothing is waiting on the ${ROLE_LABEL[role]}`} />}
      {sections.map((section) => (
        <div key={section.title} className="space-y-2">
          <SectionEyebrow urgent={section.urgent}>{section.title}</SectionEyebrow>
          <Feed items={section.items} />
        </div>
      ))}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Check, MessageSquareText, Send, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { usd } from "@/lib/kosh/labels";
import { ROLE_LABEL, type Approval, type Role } from "@/lib/kosh/types";
import { useKosh } from "../store";

const RANK: Record<Role, number> = { analyst: 0, treasury_manager: 1, cfo: 2 };
const INITIALS: Record<Role, string> = { analyst: "KI", treasury_manager: "AS", cfo: "PN" };
const NAME: Record<Role, string> = { analyst: "Kavya Iyer", treasury_manager: "Arjun Shah", cfo: "Priya Nair" };

function StatusBadge({ a }: { a: Approval }) {
  if (a.status === "draft") return <Badge variant="secondary">Draft</Badge>;
  if (a.status === "pending") return <Badge variant="warning">Waiting</Badge>;
  if (a.status === "approved") return <Badge variant="success">Approved</Badge>;
  return <Badge variant="destructive">Rejected</Badge>;
}

/**
 * The proposals from one agent turn, as a single card: who has to approve, the orders, one action.
 * The requester sends them; the approver (or anyone above) decides; everyone else just sees the status.
 */
export function ApprovalCard({ approvalIds }: { approvalIds: string[] }) {
  const { approvals, role, submitApproval, decide, busyApproval, selectThread, threads } = useKosh();
  const router = useRouter();
  const items = approvalIds.map((id) => approvals.find((a) => a.id === id)).filter((a): a is Approval => !!a);
  if (items.length === 0) return null;

  // One approver per card in practice; fall back to the highest if a turn mixed them.
  const approver = items.reduce<Role>((top, a) => (RANK[a.approver] > RANK[top] ? a.approver : top), items[0].approver);
  const total = items.reduce((s, a) => s + (a.amountUsd ?? 0), 0);
  const drafts = items.filter((a) => a.status === "draft");
  const pending = items.filter((a) => a.status === "pending");
  const busy = items.some((a) => a.id === busyApproval);
  const canDecide = RANK[role] >= RANK[approver];
  const allDone = items.every((a) => a.status === "approved" || a.status === "rejected");
  const thread = threads.find((t) => items.some((a) => a.id === t.approvalId));

  const title = allDone
    ? items.every((a) => a.status === "approved")
      ? "Approved"
      : "Decided"
    : pending.length && !drafts.length
      ? `Waiting for the ${ROLE_LABEL[approver]}`
      : `Needs ${ROLE_LABEL[approver]} approval`;

  return (
    <Card className="w-full max-w-md gap-3 py-4">
      <CardHeader className="px-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="text-xs">{INITIALS[approver]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs">
              {items.length} {items.length === 1 ? "order" : "orders"} · {usd(total)} · {NAME[approver]}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="outline">R6</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="px-4">
        <ul className="divide-y rounded-lg border">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="font-medium">{String(a.input.symbol ?? a.tool)}</span>
              <span className="text-muted-foreground ml-auto tabular-nums">{a.amountUsd ? usd(a.amountUsd) : ""}</span>
              {canDecide && a.status === "pending" ? (
                <div className="flex gap-1">
                  <Button size="icon-sm" className="rounded-full" aria-label="Approve" disabled={busy} onClick={() => decide(a.id, "approve")}>
                    <Check />
                  </Button>
                  <Button size="icon-sm" variant="outline" className="rounded-full" aria-label="Reject" disabled={busy} onClick={() => decide(a.id, "reject")}>
                    <X />
                  </Button>
                </div>
              ) : (
                <StatusBadge a={a} />
              )}
            </li>
          ))}
        </ul>
      </CardContent>
      {!allDone && (
        <CardFooter className="gap-2 px-4">
          {drafts.length > 0 && (
            <Button size="sm" className="grow" disabled={busy} onClick={() => drafts.forEach((a) => void submitApproval(a.id))}>
              <Send />
              {drafts.length === 1 ? "Send for approval" : `Send ${drafts.length} for approval`}
            </Button>
          )}
          {drafts.length === 0 && canDecide && pending.length > 1 && (
            <Button size="sm" className="grow" disabled={busy} onClick={() => pending.forEach((a) => void decide(a.id, "approve"))}>
              <Check /> Approve all
            </Button>
          )}
          {thread && (
            <Button
              size="sm"
              variant="outline"
              className={drafts.length === 0 && !(canDecide && pending.length > 1) ? "grow" : ""}
              onClick={() => {
                selectThread(thread.id);
                router.push("/dashboard/kosh/inbox");
              }}>
              <MessageSquareText /> Thread
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

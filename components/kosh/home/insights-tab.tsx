"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon, ShieldCheck, ShieldX, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/kosh/client";
import { inr, usd } from "@/lib/kosh/labels";
import { useKosh } from "../store";
import { SectionEyebrow } from "./primitives";

const ASK_ABOUT_THIS = [
  { label: "Why T-bill ETFs?", prompt: "Why does the policy only allow Treasury-bill ETFs for spare cash?" },
  { label: "What got blocked?", prompt: "Summarise what the guardrails blocked so far and why." },
  { label: "Deploy another tranche", prompt: "Deploy another tranche of about 10% of the account cash across the suggested allocation." },
];

interface Broker {
  error?: string;
  account?: { cash: number; buyingPower: number; portfolioValue: number; multiplier: number };
  positions?: { symbol: string; marketValue: number }[];
}

export function InsightsTab() {
  const { cash, loadCash, actions, send, running, role } = useKosh();
  const [broker, setBroker] = useState<Broker | undefined>();

  useEffect(() => {
    if (!cash) loadCash();
    api<Broker>("/api/broker").then(setBroker).catch(() => setBroker({ error: "Broker unavailable" }));
  }, [cash, loadCash]);

  const allowed = actions.filter((a) => a.decision === "allowed").length;
  const blocked = actions.filter((a) => a.decision === "blocked").length;
  const held = actions.filter((a) => a.decision === "held").length;
  const p = cash?.position;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-3">
        <SectionEyebrow>Ask about this</SectionEyebrow>
        <div className="flex flex-wrap gap-2 px-1">
          {ASK_ABOUT_THIS.map(({ label, prompt }) => (
            <Button key={label} variant="outline" size="sm" className="rounded-full font-normal" onClick={() => send(prompt)} disabled={running}>
              <Sparkles className="text-primary" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Spare cash</CardTitle>
            <CardAction>
              <Badge variant="success">Deployable</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col">
            {p ? (
              <>
                <div className="font-display text-2xl lg:text-3xl">{inr(p.spareCash)}</div>
                <p className="text-muted-foreground mt-1 text-xs">
                  after {inr(p.committedOutflows)} committed and a {inr(p.safetyBuffer)} buffer
                </p>
              </>
            ) : (
              <Skeleton className="h-12" />
            )}
            <div className="mt-auto pt-4">
              <Button className="w-full" size="sm" onClick={() => send("We have spare cash. Invest it safely per policy.")} disabled={running}>
                <ArrowUpIcon />
                {role === "analyst" ? "Propose" : "Invest"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Investment account</CardTitle>
            <CardAction>
              <Badge variant="secondary">Paper</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {broker?.account ? (
              <>
                <div className="font-display text-2xl lg:text-3xl">{usd(broker.account.portfolioValue)}</div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {usd(broker.account.cash)} cash · {broker.positions?.length ?? 0} positions
                </p>
              </>
            ) : broker?.error ? (
              <p className="text-muted-foreground text-sm">{broker.error}</p>
            ) : (
              <Skeleton className="h-12" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guard activity</CardTitle>
            <CardAction>
              {blocked > 0 ? (
                <Badge variant="destructive">
                  <ShieldX />
                  {blocked} blocked
                </Badge>
              ) : (
                <Badge variant="success">
                  <ShieldCheck />
                  All clear
                </Badge>
              )}
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl lg:text-3xl">{actions.length}</div>
            <p className="text-muted-foreground mt-1 text-xs">
              tool calls checked · {allowed} allowed · {held} held
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

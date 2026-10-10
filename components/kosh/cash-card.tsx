"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { inr } from "@/lib/kosh/labels";
import { useKosh } from "./store";

/** Spare-cash summary shown in the sidebar footer (replaces the kit's promo card). */
export function CashCard() {
  const { cash, loadCash } = useKosh();
  useEffect(() => {
    if (!cash) loadCash();
  }, [cash, loadCash]);
  const p = cash?.position;
  return (
    <Card className="overflow-hidden group-data-[collapsible=icon]:hidden">
      <CardContent className="space-y-2 p-3">
        <div className="space-y-0.5">
          <CardDescription className="text-xs">Spare cash · Acme Pvt Ltd</CardDescription>
          <CardTitle className="text-xl tabular-nums">{p ? inr(p.spareCash) : "—"}</CardTitle>
        </div>
        {p && (
          <div className="text-muted-foreground space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span>Bank balance</span>
              <span className="tabular-nums">{inr(p.bankBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span>Committed outflows</span>
              <span className="tabular-nums">−{inr(p.committedOutflows)}</span>
            </div>
            <div className="flex justify-between">
              <span>Safety buffer</span>
              <span className="tabular-nums">−{inr(p.safetyBuffer)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

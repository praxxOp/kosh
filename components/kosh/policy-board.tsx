"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/kosh/client";
import type { PolicyRule } from "@/lib/kosh/types";
import { ParamView } from "./policy-params";

const CATEGORY_LABEL: Record<PolicyRule["category"], string> = { money: "Money", data: "Data", access: "Access" };

const EMPTY_DRAFT = { title: "", description: "", presets: [] as string[] };

/** The five things a custom rule can stop. Each maps to parameters the evaluator understands. */
const PRESETS: { id: string; label: string; params: Record<string, unknown>; category: PolicyRule["category"] }[] = [
  { id: "crypto", label: "No crypto", params: { blockTools: ["alpaca_place_crypto_order"] }, category: "money" },
  { id: "transfers", label: "No bank transfers", params: { blockTools: ["bank_transfer"] }, category: "money" },
  { id: "liquidate", label: "No liquidations", params: { blockTools: ["alpaca_close_all_positions", "alpaca_cancel_all_orders"] }, category: "access" },
  { id: "cap", label: "Cap orders at $25,000", params: { maxNotionalUsd: 25_000 }, category: "money" },
  { id: "analysts", label: "Analysts only", params: { roles: ["analyst"] }, category: "access" },
];

export function PolicyBoard() {
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const load = useCallback(() => api<PolicyRule[]>("/api/policies").then(setRules).catch((e) => toast.error(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (rule: PolicyRule, note = `${rule.id} saved`) => {
    try {
      setRules(await api<PolicyRule[]>("/api/policies", { method: "PUT", body: JSON.stringify(rule) }));
      toast.success(note);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const remove = async (rule: PolicyRule) => {
    try {
      setRules(await api<PolicyRule[]>(`/api/policies?id=${encodeURIComponent(rule.id)}`, { method: "DELETE" }));
      toast.success(`${rule.id} removed`, { description: "Reset brings the board rules back." });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const reset = async () => setRules(await api<PolicyRule[]>("/api/policies", { method: "POST", body: JSON.stringify({ action: "reset" }) }));

  const addRule = async () => {
    const chosen = PRESETS.filter((p) => draft.presets.includes(p.id));
    const params: Record<string, unknown> = {};
    for (const p of chosen) {
      for (const [k, v] of Object.entries(p.params)) {
        params[k] = Array.isArray(v) ? [...new Set([...((params[k] as string[]) ?? []), ...v])] : v;
      }
    }
    const category = chosen.every((p) => p.category === "access") ? "access" : "money";
    const id = `C${Date.now().toString(36).toUpperCase().slice(-4)}`;
    await save({ id, title: draft.title.trim(), description: draft.description.trim(), category, enabled: true, params, source: "custom" }, "Rule added and live");
    setAdding(false);
    setDraft(EMPTY_DRAFT);
  };

  const active = rules.filter((r) => r.enabled).length;
  const groups = (["money", "access", "data"] as const).map((c) => ({ c, items: rules.filter((r) => r.category === c) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Treasury policy</h1>
          <p className="text-muted-foreground text-sm">Board and company rules, enforced on every tool call at runtime. Toggle a rule, delete it, or add your own.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-8 gap-1.5 rounded-full px-3">
            <ShieldCheck className="size-3.5 text-green-600" /> {active}/{rules.length} active
          </Badge>
          <Button variant="outline" onClick={reset}>
            <RotateCcw /> Reset
          </Button>
          <Dialog open={adding} onOpenChange={setAdding}>
            <DialogTrigger asChild>
              <Button>
                <Plus /> Add rule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New rule</DialogTitle>
                <DialogDescription>Name it, say why, pick what it stops.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="rule-title">Rule</Label>
                  <Input id="rule-title" placeholder="No single stocks" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rule-desc">Why it exists</Label>
                  <Textarea
                    id="rule-desc"
                    rows={3}
                    className="resize-none"
                    placeholder="Board minute 14, Oct 2026 — the board asked that spare cash stays in government paper only."
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>What it stops</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset) => {
                      const on = draft.presets.includes(preset.id);
                      return (
                        <Badge
                          key={preset.id}
                          variant={on ? "default" : "outline"}
                          className="cursor-pointer select-none"
                          onClick={() => setDraft({ ...draft, presets: on ? draft.presets.filter((x) => x !== preset.id) : [...draft.presets, preset.id] })}>
                          {preset.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button onClick={addRule} disabled={!draft.title.trim() || draft.presets.length === 0}>
                  Save rule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {groups.map(({ c, items }) =>
        items.length === 0 ? null : (
          <section key={c} className="space-y-3">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">{CATEGORY_LABEL[c]} rules</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {items.map((r) => (
                <Card key={r.id} size="sm" className={cn(!r.enabled && "opacity-60")}>
                  <CardHeader>
                    <CardTitle className="min-w-0 flex-1" title={r.title}>
                      <span className="text-muted-foreground mr-1.5 font-mono text-[10px] font-normal">{r.id}</span>
                      {r.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 min-w-0 text-xs" title={r.description}>
                      {r.description}
                    </CardDescription>
                    <CardAction>
                      <Switch checked={r.enabled} onCheckedChange={(c) => save({ ...r, enabled: c }, `${r.id} ${c ? "enabled" : "disabled"}`)} />
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <ParamView params={r.params} compact />
                  </CardContent>
                  <CardFooter className="text-muted-foreground text-xs">
                    <span className="capitalize">{r.source}</span>&nbsp;rule
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive ml-auto h-7 px-2" onClick={() => remove(r)}>
                      <Trash2 /> Delete
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )
      )}

    </div>
  );
}

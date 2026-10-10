"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/kosh/client";
import { ENGINE_LABELS, TOOL_LABELS, shortTime, summarizeInput } from "@/lib/kosh/labels";
import type { ActionEvent } from "@/lib/kosh/types";
import { DecisionBadge } from "./action-card";

export function AuditTable() {
  const [rows, setRows] = useState<ActionEvent[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const load = useCallback(() => api<ActionEvent[]>("/api/audit?limit=300").then(setRows).catch((e) => toast.error(e.message)), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);
  const visible = filter === "all" ? rows : rows.filter((r) => r.decision === filter);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>Every action the agent attempted, the decision, and the rule that decided it. This is what the CFO, board and auditor see.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All decisions</SelectItem>
              <SelectItem value="allowed">Allowed</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="held">Held</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => api("/api/audit", { method: "DELETE" }).then(load)}>
            <Trash2 /> Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Guard</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">{shortTime(r.ts)}</TableCell>
                <TableCell className="whitespace-nowrap capitalize">{r.role.replace("_", " ")}</TableCell>
                <TableCell className="whitespace-nowrap">{ENGINE_LABELS[r.engine]}</TableCell>
                <TableCell className="whitespace-nowrap font-medium">{TOOL_LABELS[r.tool] ?? r.tool}</TableCell>
                <TableCell className="text-muted-foreground max-w-56 truncate">{summarizeInput(r)}</TableCell>
                <TableCell>
                  <DecisionBadge decision={r.decision} />
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.ruleId ? `${r.ruleId} · ${r.ruleTitle}` : "—"}</TableCell>
                <TableCell className="text-muted-foreground max-w-80 truncate">{r.reason ?? ""}</TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                  No actions recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

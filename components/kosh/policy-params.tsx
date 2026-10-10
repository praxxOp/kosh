"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TOOL_LABELS } from "@/lib/kosh/labels";
import { ROLE_LABEL, type Role } from "@/lib/kosh/types";

/**
 * How each rule parameter reads to a finance person. Anything not listed falls back to a plain field.
 */
type ParamKind = "symbols" | "tools" | "accounts" | "companies" | "roles" | "percent" | "money" | "moneyByRole";

const PARAMS: Record<string, { label: string; kind: ParamKind }> = {
  allowedSymbols: { label: "Allowed instruments", kind: "symbols" },
  leveragedSymbols: { label: "Treated as leveraged", kind: "symbols" },
  blockSymbols: { label: "Blocked instruments", kind: "symbols" },
  maxPctPerFund: { label: "Max share in one fund", kind: "percent" },
  limitsUsd: { label: "Order limit per role", kind: "moneyByRole" },
  maxNotionalUsd: { label: "Max order size", kind: "money" },
  registeredAccounts: { label: "Registered bank accounts", kind: "accounts" },
  allowedBrokerTools: { label: "Allowed broker actions", kind: "tools" },
  blockTools: { label: "Blocked actions", kind: "tools" },
  allowedCompanies: { label: "Companies the agent may open", kind: "companies" },
  roles: { label: "Applies to", kind: "roles" },
};

const humanize = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const mask = (acct: string) => `…${acct.slice(-4)}`;

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <Badge variant="secondary" title={title} className="font-normal">
      {children}
    </Badge>
  );
}

/** Read-only view of a rule's parameters: labels, chips and figures, never JSON. */
export function ParamView({ params, compact = false }: { params: Record<string, unknown>; compact?: boolean }) {
  const entries = Object.entries(params ?? {}).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0));
  if (entries.length === 0) return <p className="text-muted-foreground text-xs">No tunable parameters.</p>;
  return (
    <dl className={cn("space-y-3", compact && "space-y-2.5")}>
      {entries.map(([key, value]) => {
        const meta = PARAMS[key] ?? { label: humanize(key), kind: "symbols" as ParamKind };
        return (
          <div key={key}>
            <dt className={cn("text-muted-foreground mb-1.5 text-xs", compact && "mb-1")}>{meta.label}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {meta.kind === "percent" && <span className="text-sm font-medium">{String(value)}%</span>}
              {meta.kind === "money" && <span className="text-sm font-medium">{usd(Number(value))}</span>}
              {meta.kind === "moneyByRole" &&
                Object.entries(value as Record<string, number>).map(([r, n]) => (
                  <Chip key={r}>
                    {ROLE_LABEL[r as Role] ?? r}: <span className="font-medium">{usd(n)}</span>
                  </Chip>
                ))}
              {(meta.kind === "symbols" || meta.kind === "companies") && (value as string[]).map((s) => <Chip key={s}>{s}</Chip>)}
              {meta.kind === "tools" && (value as string[]).map((t) => <Chip key={t}>{TOOL_LABELS[t] ?? t}</Chip>)}
              {meta.kind === "accounts" &&
                (value as string[]).map((a) => (
                  <Chip key={a} title={a}>
                    a/c {mask(a)}
                  </Chip>
                ))}
              {meta.kind === "roles" && (value as Role[]).map((r) => <Chip key={r}>{ROLE_LABEL[r] ?? r}</Chip>)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

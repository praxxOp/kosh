import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ActionEvent, Approval, PolicyRule } from "./types";
import { DEFAULT_RULES } from "./policy/rules";

export interface Store {
  kind: "memory" | "supabase";
  listRules(): Promise<PolicyRule[]>;
  upsertRule(rule: PolicyRule): Promise<void>;
  deleteRule(id: string): Promise<void>;
  resetRules(): Promise<void>;
  appendAudit(e: ActionEvent): Promise<void>;
  listAudit(limit?: number): Promise<ActionEvent[]>;
  clearAudit(): Promise<void>;
  createApproval(a: Approval): Promise<void>;
  getApproval(id: string): Promise<Approval | undefined>;
  updateApproval(a: Approval): Promise<void>;
  listApprovals(): Promise<Approval[]>;
}

// ---------- in-memory (survives hot reloads via globalThis) ----------
type Mem = { rules: PolicyRule[]; audit: ActionEvent[]; approvals: Approval[] };
const g = globalThis as unknown as { __koshMem?: Mem };
const mem: Mem = (g.__koshMem ??= { rules: structuredClone(DEFAULT_RULES), audit: [], approvals: [] });

const memoryStore: Store = {
  kind: "memory",
  listRules: async () => mem.rules,
  upsertRule: async (rule) => {
    const i = mem.rules.findIndex((r) => r.id === rule.id);
    if (i >= 0) mem.rules[i] = rule;
    else mem.rules.push(rule);
  },
  deleteRule: async (id) => {
    mem.rules = mem.rules.filter((r) => r.id !== id);
  },
  resetRules: async () => {
    mem.rules = structuredClone(DEFAULT_RULES);
  },
  appendAudit: async (e) => {
    mem.audit.unshift(e);
    if (mem.audit.length > 500) mem.audit.length = 500;
  },
  listAudit: async (limit = 200) => mem.audit.slice(0, limit),
  clearAudit: async () => {
    mem.audit = [];
  },
  createApproval: async (a) => {
    mem.approvals.unshift(a);
  },
  getApproval: async (id) => mem.approvals.find((a) => a.id === id),
  updateApproval: async (a) => {
    const i = mem.approvals.findIndex((x) => x.id === a.id);
    if (i >= 0) mem.approvals[i] = a;
  },
  listApprovals: async () => mem.approvals,
};

// ---------- supabase (see supabase/schema.sql) ----------
function supabaseStore(sb: SupabaseClient): Store {
  const ruleRow = (r: PolicyRule) => ({ id: r.id, title: r.title, description: r.description, category: r.category, enabled: r.enabled, params: r.params, source: r.source });
  const rowRule = (x: Record<string, unknown>): PolicyRule => ({
    id: String(x.id), title: String(x.title), description: String(x.description ?? ""), category: x.category as PolicyRule["category"],
    enabled: Boolean(x.enabled), params: (x.params as Record<string, unknown>) ?? {}, source: (x.source as PolicyRule["source"]) ?? "custom",
  });
  const auditRow = (e: ActionEvent) => ({
    id: e.id, task_id: e.taskId, ts: e.ts, role: e.role, mode: e.mode, engine: e.engine, server: e.server, tool: e.tool, input: e.input,
    decision: e.decision, rule_id: e.ruleId ?? null, rule_title: e.ruleTitle ?? null, reason: e.reason ?? null, output: e.output ?? null, approval_id: e.approvalId ?? null,
  });
  const rowAudit = (x: Record<string, unknown>): ActionEvent => ({
    id: String(x.id), taskId: String(x.task_id), ts: String(x.ts), role: x.role as ActionEvent["role"], mode: x.mode as ActionEvent["mode"],
    engine: x.engine as ActionEvent["engine"], server: x.server as ActionEvent["server"], tool: String(x.tool), input: (x.input as Record<string, unknown>) ?? {},
    decision: x.decision as ActionEvent["decision"], ruleId: (x.rule_id as string) ?? undefined, ruleTitle: (x.rule_title as string) ?? undefined,
    reason: (x.reason as string) ?? undefined, output: x.output ?? undefined, approvalId: (x.approval_id as string) ?? undefined,
  });
  const approvalRow = (a: Approval) => ({
    id: a.id, created_at: a.createdAt, status: a.status, requested_by: a.requestedBy, task_id: a.taskId, server: a.server, tool: a.tool,
    input: a.input, reason: a.reason, decided_by: a.decidedBy ?? null, decided_at: a.decidedAt ?? null, result: a.result ?? null,
  });
  const rowApproval = (x: Record<string, unknown>): Approval => ({
    id: String(x.id), createdAt: String(x.created_at), status: x.status as Approval["status"], requestedBy: x.requested_by as Approval["requestedBy"],
    approver: "cfo",
    taskId: String(x.task_id), server: x.server as Approval["server"], tool: String(x.tool), input: (x.input as Record<string, unknown>) ?? {},
    reason: String(x.reason ?? ""), decidedBy: (x.decided_by as Approval["decidedBy"]) ?? undefined, decidedAt: (x.decided_at as string) ?? undefined, result: x.result ?? undefined,
  });
  const throwIf = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };

  return {
    kind: "supabase",
    listRules: async () => {
      const { data, error } = await sb.from("policy_rules").select("*").order("id");
      throwIf(error);
      if (!data || data.length === 0) {
        const { error: seedErr } = await sb.from("policy_rules").insert(DEFAULT_RULES.map(ruleRow));
        throwIf(seedErr);
        return structuredClone(DEFAULT_RULES);
      }
      // keep R1..R10 in numeric order, custom rules after
      return data.map(rowRule).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)) || a.id.localeCompare(b.id));
    },
    upsertRule: async (rule) => throwIf((await sb.from("policy_rules").upsert(ruleRow(rule))).error),
    deleteRule: async (id) => throwIf((await sb.from("policy_rules").delete().eq("id", id)).error),
    resetRules: async () => {
      throwIf((await sb.from("policy_rules").delete().neq("id", "")).error);
      throwIf((await sb.from("policy_rules").insert(DEFAULT_RULES.map(ruleRow))).error);
    },
    appendAudit: async (e) => throwIf((await sb.from("audit_events").insert(auditRow(e))).error),
    listAudit: async (limit = 200) => {
      const { data, error } = await sb.from("audit_events").select("*").order("ts", { ascending: false }).limit(limit);
      throwIf(error);
      return (data ?? []).map(rowAudit);
    },
    clearAudit: async () => throwIf((await sb.from("audit_events").delete().neq("id", "")).error),
    createApproval: async (a) => throwIf((await sb.from("approvals").insert(approvalRow(a))).error),
    getApproval: async (id) => {
      const { data, error } = await sb.from("approvals").select("*").eq("id", id).maybeSingle();
      throwIf(error);
      return data ? rowApproval(data) : undefined;
    },
    updateApproval: async (a) => throwIf((await sb.from("approvals").update(approvalRow(a)).eq("id", a.id)).error),
    listApprovals: async () => {
      const { data, error } = await sb.from("approvals").select("*").order("created_at", { ascending: false }).limit(100);
      throwIf(error);
      return (data ?? []).map(rowApproval);
    },
  };
}

/** Supabase when configured, otherwise memory. Any Supabase failure falls back to memory for that call. */
function safe(primary: Store, fallback: Store): Store {
  const wrap = <K extends keyof Store>(k: K): Store[K] =>
    ((...args: unknown[]) =>
      (primary[k] as (...a: unknown[]) => Promise<unknown>)(...args).catch((e: Error) => {
        console.warn(`[store] supabase ${String(k)} failed, using memory: ${e.message}`);
        return (fallback[k] as (...a: unknown[]) => Promise<unknown>)(...args);
      })) as Store[K];
  return {
    kind: primary.kind,
    listRules: wrap("listRules"), upsertRule: wrap("upsertRule"), deleteRule: wrap("deleteRule"), resetRules: wrap("resetRules"),
    appendAudit: wrap("appendAudit"), listAudit: wrap("listAudit"), clearAudit: wrap("clearAudit"),
    createApproval: wrap("createApproval"), getApproval: wrap("getApproval"), updateApproval: wrap("updateApproval"), listApprovals: wrap("listApprovals"),
  };
}

let store: Store | undefined;
export function getStore(): Store {
  if (store) return store;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const sb = safe(supabaseStore(createClient(url, key, { auth: { persistSession: false } })), memoryStore);
    // Approvals carry a draft state and an approver the SQL schema predates; they are session
    // state for the demo, so they live in memory even when rules and audit persist.
    store = {
      ...sb,
      createApproval: memoryStore.createApproval,
      getApproval: memoryStore.getApproval,
      updateApproval: memoryStore.updateApproval,
      listApprovals: memoryStore.listApprovals,
    };
  } else {
    store = memoryStore;
  }
  return store;
}

import { randomUUID } from "node:crypto";
import type { ActionEvent, Approval, GuardMode, Role } from "../types";
import { toolByName } from "../tools/registry";
import { getAccount, getPositions } from "../tools/alpaca";
import { evaluate, needsPortfolioState, type EvalContext } from "../policy/rules";
import { getStore } from "../store";
import type { AgntidSession } from "./agntid";

/**
 * Every tool call the agent makes goes through here.
 *   guardrails OFF  → run the tool directly (engine: none)
 *   guardrails ON   → AgntID proxy when a session is open (engine: agntid),
 *                     otherwise the local policy evaluator (engine: local)
 * The local evaluator always runs in ON mode so the UI can name the rule
 * and so approval holds work even when AgntID is the enforcer.
 */

export interface ExecRequest {
  taskId: string;
  role: Role;
  mode: GuardMode;
  tool: string;
  input: Record<string, unknown>;
  agntid?: AgntidSession;
  approvalId?: string;
}

async function portfolioState(): Promise<Pick<EvalContext, "account" | "positions">> {
  if (!process.env.ALPACA_API_KEY) return {};
  try {
    const [account, positions] = await Promise.all([getAccount(), getPositions()]);
    return { account: { cash: account.cash, portfolioValue: account.portfolioValue }, positions };
  } catch {
    return {};
  }
}

export async function executeAction(req: ExecRequest): Promise<ActionEvent> {
  const store = getStore();
  const def = toolByName(req.tool);
  const base: ActionEvent = {
    id: randomUUID(),
    taskId: req.taskId,
    ts: new Date().toISOString(),
    role: req.role,
    mode: req.mode,
    engine: "none",
    server: def?.server ?? "kosh",
    tool: req.tool,
    input: req.input,
    decision: "allowed",
    approvalId: req.approvalId,
  };
  const finish = async (e: ActionEvent) => {
    await store.appendAudit(e);
    return e;
  };

  if (!def) return finish({ ...base, decision: "error", reason: `Unknown tool ${req.tool}` });

  const runDirect = async (e: ActionEvent): Promise<ActionEvent> => {
    try {
      const parsed = def.inputSchema.safeParse(req.input);
      if (!parsed.success) return { ...e, decision: "error", reason: `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}` };
      const output = await def.run(parsed.data as Record<string, unknown>);
      return { ...e, decision: "allowed", output };
    } catch (err) {
      return { ...e, decision: "error", reason: (err as Error).message };
    }
  };

  // ---- guardrails off: no checks at all ----
  if (req.mode === "off") return finish(await runDirect({ ...base, engine: "none" }));

  // ---- guardrails on ----
  const rules = await store.listRules();
  const state = needsPortfolioState(req.tool) ? await portfolioState() : {};
  const local = evaluate(rules, { role: req.role, server: def.server, tool: req.tool, input: req.input, ...state });
  const engine = req.agntid ? "agntid" : "local";

  if (local.decision === "held" && !req.approvalId) {
    const approval: Approval = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: "draft",
      requestedBy: req.role,
      approver: local.approver ?? "cfo",
      amountUsd: typeof req.input.notional === "number" ? req.input.notional : undefined,
      taskId: req.taskId,
      server: def.server,
      tool: req.tool,
      input: req.input,
      reason: local.reason ?? "Needs approval",
    };
    await store.createApproval(approval);
    return finish({ ...base, engine, decision: "held", ruleId: local.ruleId, ruleTitle: local.ruleTitle, reason: local.reason, approvalId: approval.id });
  }

  if (req.agntid) {
    const res = await req.agntid.call(req.tool, req.input);
    if (res.ok) {
      const disagreement = local.decision === "blocked" ? ` (Kosh policy ${local.ruleId} would have blocked: ${local.reason})` : "";
      return finish({ ...base, engine: "agntid", decision: "allowed", output: res.output, reason: disagreement ? `Allowed by AgntID${disagreement}` : undefined });
    }
    if (res.denied) {
      return finish({
        ...base,
        engine: "agntid",
        decision: "blocked",
        ruleId: local.decision === "blocked" ? local.ruleId : undefined,
        ruleTitle: local.decision === "blocked" ? local.ruleTitle : "AgntID policy",
        reason: res.message,
      });
    }
    return finish({ ...base, engine: "agntid", decision: "error", reason: res.message });
  }

  if (local.decision === "blocked") {
    return finish({ ...base, engine: "local", decision: "blocked", ruleId: local.ruleId, ruleTitle: local.ruleTitle, reason: local.reason });
  }
  return finish(await runDirect({ ...base, engine: "local" }));
}

export class ApprovalError extends Error {
  constructor(message: string, readonly status = 403) {
    super(message);
  }
}

const ROLE_RANK: Record<Role, number> = { analyst: 0, treasury_manager: 1, cfo: 2 };
const ROLE_NAME: Record<Role, string> = { analyst: "Analyst", treasury_manager: "Treasury Manager", cfo: "CFO" };

/**
 * The approval chain.
 *  submit  – the requester sends a draft proposal to its approver (and opens an inbox thread for it)
 *  approve – the approver (or anyone above them) re-runs the action as themselves, through the same guard
 *  reject  – closes it
 */
export async function decideApproval(id: string, decision: "submit" | "approve" | "reject", by: Role, agntid?: AgntidSession) {
  const store = getStore();
  const a = await store.getApproval(id);
  if (!a) throw new ApprovalError("Approval not found", 404);

  if (decision === "submit") {
    if (a.status !== "draft") return { approval: a, event: undefined };
    const pending: Approval = { ...a, status: "pending" };
    await store.updateApproval(pending);
    const { postMessage } = await import("../inbox");
    const what = `${a.amountUsd ? usd(a.amountUsd) + " " : ""}${String(a.input.symbol ?? a.tool)} order`;
    postMessage({
      subject: `Approval needed: ${what}`,
      from: a.requestedBy,
      to: a.approver,
      approvalId: a.id,
      content: `Requesting your approval for a ${what}. It is waiting in your Actions tab.`,
      attachment: { name: "Proposed order", kind: "order", body: JSON.stringify({ ...a.input, requestedBy: a.requestedBy, approver: a.approver }) },
    });
    return { approval: pending, event: undefined };
  }

  if (a.status !== "pending") return { approval: a, event: undefined };
  if (ROLE_RANK[by] < ROLE_RANK[a.approver]) throw new ApprovalError(`Only the ${ROLE_NAME[a.approver]} (or above) can decide this.`);

  if (decision === "reject") {
    const rejected: Approval = { ...a, status: "rejected", decidedBy: by, decidedAt: new Date().toISOString() };
    await store.updateApproval(rejected);
    return { approval: rejected, event: undefined };
  }
  const event = await executeAction({ taskId: a.taskId, role: by, mode: "on", tool: a.tool, input: a.input, approvalId: a.id, agntid });
  const approved: Approval = { ...a, status: "approved", decidedBy: by, decidedAt: new Date().toISOString(), result: { decision: event.decision, reason: event.reason, output: event.output } };
  await store.updateApproval(approved);
  return { approval: approved, event };
}

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

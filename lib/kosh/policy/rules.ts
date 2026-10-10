import type { PolicyRule, Role, ServerId } from "../types";
import { ACTIVE_COMPANY, REGISTERED_BANK_ACCOUNTS } from "../data/acme";

/**
 * Board treasury policy as enforceable rules.
 * The same definitions drive the local evaluator (fallback / explanation) and the Policy panel.
 * AgntID is the enforcer when configured; these rules mirror what is configured there.
 */
export const DEFAULT_RULES: PolicyRule[] = [
  {
    id: "R1",
    title: "Only safe, liquid instruments",
    description: "Spare cash may only go into Treasury-bill ETFs (the US equivalent of liquid funds).",
    category: "money",
    enabled: true,
    params: { allowedSymbols: ["SGOV", "BIL", "USFR", "SHV"] },
    source: "board",
  },
  {
    id: "R2",
    title: "No crypto, options, leverage or borrowing",
    description: "No speculative assets, and an order can never exceed the cash on hand (the broker offers 4x margin).",
    category: "money",
    enabled: true,
    params: { leveragedSymbols: ["TQQQ", "SQQQ", "UPRO", "SPXL", "SOXL", "TSLL", "NVDL"] },
    source: "board",
  },
  {
    id: "R3",
    title: "Max 40% in any one fund",
    description: "Concentration limit per instrument, measured against total portfolio value.",
    category: "money",
    enabled: true,
    params: { maxPctPerFund: 40 },
    source: "board",
  },
  {
    id: "R4",
    title: "Order limits by role",
    description: "Treasury Manager may act alone up to the limit; larger orders are held for CFO approval. The CFO's cap is the hard ceiling.",
    category: "money",
    enabled: true,
    params: { limitsUsd: { treasury_manager: 10_000, cfo: 100_000 } },
    source: "board",
  },
  {
    id: "R5",
    title: "Money only to registered company accounts",
    description: "Transfers may only go to accounts on the board-approved list. Stops fake-CFO fraud.",
    category: "money",
    enabled: true,
    params: { registeredAccounts: REGISTERED_BANK_ACCOUNTS.map((a) => a.account) },
    source: "board",
  },
  {
    id: "R6",
    title: "Analysts can view, not execute",
    description: "Separation of duties: the analyst role cannot place orders, move money or change records.",
    category: "access",
    enabled: true,
    params: {},
    source: "company",
  },
  {
    id: "R7",
    title: "Least privilege on the broker",
    description: "Only the broker actions treasury needs are reachable. Liquidate-all, cancel-all and crypto tools are not.",
    category: "access",
    enabled: true,
    params: {
      allowedBrokerTools: ["alpaca_get_account", "alpaca_get_quote", "alpaca_get_positions", "alpaca_get_orders", "alpaca_place_order"],
    },
    source: "company",
  },
  {
    id: "R8",
    title: "Payroll totals only",
    description: "The agent may read the total salary bill, never individual employee salaries (DPDP Act).",
    category: "data",
    enabled: true,
    params: {},
    source: "company",
  },
  {
    id: "R9",
    title: "Books are read-only",
    description: "The agent can never create, edit or delete accounting entries.",
    category: "data",
    enabled: true,
    params: {},
    source: "company",
  },
  {
    id: "R10",
    title: "Only this company's books",
    description: "Accountants keep many companies in one Tally. The agent may only open Acme Pvt Ltd.",
    category: "data",
    enabled: true,
    params: { allowedCompanies: [ACTIVE_COMPANY] },
    source: "company",
  },
];

const WRITE_TOOLS = new Set([
  "alpaca_place_order",
  "alpaca_place_crypto_order",
  "alpaca_close_all_positions",
  "alpaca_cancel_all_orders",
  "bank_transfer",
  "tally_update_voucher",
]);

export interface EvalContext {
  role: Role;
  server: ServerId;
  tool: string;
  input: Record<string, unknown>;
  account?: { cash: number; portfolioValue: number };
  positions?: { symbol: string; marketValue: number }[];
}

export interface EvalResult {
  decision: "allowed" | "blocked" | "held";
  ruleId?: string;
  ruleTitle?: string;
  reason?: string;
  /** For a hold: who has to approve. */
  approver?: Role;
}

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Evaluate rules in order; the first rule that fires decides. Blocks are checked before holds. */
export function evaluate(rules: PolicyRule[], ctx: EvalContext): EvalResult {
  const rule = (id: string) => rules.find((r) => r.id === id && r.enabled);
  const fire = (r: PolicyRule, decision: "blocked" | "held", reason: string): EvalResult => ({
    decision,
    ruleId: r.id,
    ruleTitle: r.title,
    reason,
  });
  const { tool, input, role } = ctx;
  const symbol = typeof input.symbol === "string" ? input.symbol.toUpperCase() : undefined;
  const notional = typeof input.notional === "number" ? input.notional : undefined;

  // R6 separation of duties: analysts never move money or change records directly.
  // An analyst's *order* is not blocked outright; it becomes a proposal that is held for approval (see below).
  const r6 = rule("R6");
  if (r6 && role === "analyst" && WRITE_TOOLS.has(tool) && tool !== "alpaca_place_order")
    return fire(r6, "blocked", "Analysts have read-only access.");

  // Data rules
  const r8 = rule("R8");
  if (r8 && tool === "tally_get_employee_salaries") return fire(r8, "blocked", "Individual salaries are personal data; use payroll totals.");
  const r9 = rule("R9");
  if (r9 && tool === "tally_update_voucher") return fire(r9, "blocked", "Accounting entries cannot be changed by the agent.");
  const r10 = rule("R10");
  if (r10 && tool === "tally_open_company") {
    const allowed = (r10.params.allowedCompanies as string[]) ?? [];
    const company = String(input.company ?? "");
    if (!allowed.some((c) => c.toLowerCase() === company.toLowerCase()))
      return fire(r10, "blocked", `"${company}" is not this company's books.`);
  }

  // R2 speculation / borrowing (before R7 so "no crypto" is the reason shown, not "not a treasury power")
  const r2 = rule("R2");
  if (r2) {
    if (tool === "alpaca_place_crypto_order" || (symbol && symbol.includes("/")))
      return fire(r2, "blocked", "Crypto is not an allowed asset for company cash.");
    const leveraged = (r2.params.leveragedSymbols as string[]) ?? [];
    if (symbol && leveraged.includes(symbol)) return fire(r2, "blocked", `${symbol} is a leveraged product.`);
    if (tool === "alpaca_place_order" && notional && ctx.account && notional > ctx.account.cash)
      return fire(r2, "blocked", `${usd(notional)} exceeds cash on hand (${usd(ctx.account.cash)}); no borrowing.`);
  }

  // R7 least privilege on the broker
  const r7 = rule("R7");
  if (r7 && ctx.server === "alpaca") {
    const allowed = (r7.params.allowedBrokerTools as string[]) ?? [];
    if (!allowed.includes(tool)) return fire(r7, "blocked", `${tool} is not a treasury power.`);
  }

  // R1 allowed instruments
  const r1 = rule("R1");
  if (r1 && tool === "alpaca_place_order" && symbol && input.side !== "sell") {
    const allowed = (r1.params.allowedSymbols as string[]) ?? [];
    if (!allowed.includes(symbol)) return fire(r1, "blocked", `${symbol} is not on the approved instrument list (${allowed.join(", ")}).`);
  }

  // R5 registered accounts
  const r5 = rule("R5");
  if (r5 && tool === "bank_transfer") {
    const registered = (r5.params.registeredAccounts as string[]) ?? [];
    const acct = String(input.account_number ?? "");
    if (!registered.includes(acct)) return fire(r5, "blocked", `Account ${acct} is not a registered company account.`);
  }

  // R4 role limits: the CFO's cap is a hard ceiling; a manager over the limit is held for the CFO.
  const r4 = rule("R4");
  const limits = ((r4?.params.limitsUsd as Record<string, number> | undefined) ?? { treasury_manager: 10_000, cfo: 100_000 });
  if (r4 && tool === "alpaca_place_order" && notional) {
    if (role === "cfo" && notional > (limits.cfo ?? 0)) return fire(r4, "blocked", `${usd(notional)} exceeds the CFO ceiling of ${usd(limits.cfo ?? 0)}.`);
    if (role === "treasury_manager" && notional > (limits.treasury_manager ?? 0))
      return { ...fire(r4, "held", `${usd(notional)} is above the ${usd(limits.treasury_manager ?? 0)} manager limit; needs CFO approval.`), approver: "cfo" };
  }

  // R6 for orders: an analyst's order is a proposal. Small ones go to the Treasury Manager, large ones to the CFO.
  if (r6 && role === "analyst" && tool === "alpaca_place_order") {
    const approver: Role = (notional ?? 0) > (limits.treasury_manager ?? 0) ? "cfo" : "treasury_manager";
    return {
      ...fire(r6, "held", `Analysts propose, they don't execute. ${notional ? usd(notional) + " " : ""}order needs ${approver === "cfo" ? "CFO" : "Treasury Manager"} approval.`),
      approver,
    };
  }

  // R3 concentration
  const r3 = rule("R3");
  if (r3 && tool === "alpaca_place_order" && notional && symbol && input.side !== "sell" && ctx.account) {
    const maxPct = Number(r3.params.maxPctPerFund ?? 40);
    const existing = ctx.positions?.find((p) => p.symbol === symbol)?.marketValue ?? 0;
    const total = ctx.account.portfolioValue || ctx.account.cash;
    const pct = ((existing + notional) / total) * 100;
    if (pct > maxPct) return fire(r3, "blocked", `${symbol} would be ${pct.toFixed(0)}% of the portfolio (limit ${maxPct}%).`);
  }

  // Custom rules added from the Policy panel. Supported params:
  //   blockTools: string[]      tools that are always blocked
  //   blockSymbols: string[]    symbols that can never be bought
  //   maxNotionalUsd: number    hard cap per order
  //   roles: Role[]             (optional) only apply to these roles
  for (const r of rules) {
    if (!r.enabled || BUILT_IN_IDS.has(r.id)) continue;
    const p = r.params ?? {};
    const roles = p.roles as Role[] | undefined;
    if (roles && roles.length && !roles.includes(role)) continue;
    const blockTools = (p.blockTools as string[] | undefined) ?? [];
    if (blockTools.includes(tool)) return fire(r, "blocked", `${tool} is blocked by "${r.title}".`);
    const blockSymbols = ((p.blockSymbols as string[] | undefined) ?? []).map((s) => s.toUpperCase());
    if (symbol && blockSymbols.includes(symbol)) return fire(r, "blocked", `${symbol} is blocked by "${r.title}".`);
    const cap = p.maxNotionalUsd as number | undefined;
    if (cap && notional && notional > cap && (tool === "alpaca_place_order" || tool === "alpaca_place_crypto_order"))
      return fire(r, "blocked", `${usd(notional)} exceeds the ${usd(cap)} cap in "${r.title}".`);
  }

  return { decision: "allowed" };
}

const BUILT_IN_IDS = new Set(DEFAULT_RULES.map((r) => r.id));

export const needsPortfolioState = (tool: string) => tool === "alpaca_place_order";

import type { ActionEvent, Decision, Engine } from "./types";

/** Client-safe display helpers (no server imports). */

export const TOOL_LABELS: Record<string, string> = {
  tally_get_cash_position: "Read cash position",
  tally_get_upcoming_payments: "Read upcoming payments",
  tally_get_payroll_summary: "Read payroll total",
  tally_get_employee_salaries: "Read individual salaries",
  tally_list_vouchers: "List vouchers",
  tally_update_voucher: "Edit accounting entry",
  tally_list_companies: "List companies in Tally",
  tally_open_company: "Open another company",
  tally_get_inbox: "Read inbox",
  alpaca_get_account: "Check investment account",
  alpaca_get_quote: "Get price",
  alpaca_get_positions: "Check holdings",
  alpaca_get_orders: "Check orders",
  alpaca_place_order: "Place order",
  alpaca_place_crypto_order: "Buy crypto",
  alpaca_close_all_positions: "Liquidate all positions",
  alpaca_cancel_all_orders: "Cancel all orders",
  bank_list_accounts: "List registered accounts",
  bank_transfer: "Transfer money",
  bank_list_transfers: "List transfers",
  kosh_get_recommendations: "Run recommendation pipeline",
};


export const ENGINE_LABELS: Record<Engine, string> = { none: "Unguarded", local: "Kosh policy", agntid: "AgntID" };

export const DECISION_STYLES: Record<Decision, { label: string; className: string; dot: string }> = {
  allowed: { label: "Allowed", className: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dot: "bg-emerald-500" },
  blocked: { label: "Blocked", className: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30", dot: "bg-rose-500" },
  held: { label: "Held for CFO", className: "bg-amber-500/14 text-amber-700 dark:text-amber-300 border-amber-500/30", dot: "bg-amber-500" },
  error: { label: "Error", className: "bg-zinc-500/12 text-zinc-700 dark:text-zinc-300 border-zinc-500/30", dot: "bg-zinc-400" },
};

export const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
export const inr = (n: number) => {
  const cr = 1_00_00_000;
  if (Math.abs(n) >= cr) return `₹${(n / cr).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
};

export function summarizeInput(e: ActionEvent): string {
  const i = e.input ?? {};
  const parts: string[] = [];
  if (typeof i.symbol === "string") parts.push(i.symbol);
  if (typeof i.notional === "number") parts.push(usd(i.notional));
  if (typeof i.side === "string" && i.side !== "buy") parts.push(i.side);
  if (typeof i.amount === "number" && e.server === "bank") parts.push(inr(i.amount));
  if (typeof i.amount === "number" && e.server === "tally") parts.push(`→ ${inr(i.amount)}`);
  if (typeof i.beneficiary_name === "string") parts.push(`to ${i.beneficiary_name}`);
  if (typeof i.account_number === "string") parts.push(`a/c …${i.account_number.slice(-4)}`);
  if (typeof i.company === "string") parts.push(i.company);
  if (typeof i.voucher_id === "string") parts.push(i.voucher_id);
  if (typeof i.status === "string") parts.push(i.status);
  return parts.join(" · ");
}

export function summarizeOutput(e: ActionEvent): string | undefined {
  const o = e.output as Record<string, unknown> | unknown[] | undefined;
  if (o === undefined || o === null) return undefined;
  if (e.tool === "tally_get_cash_position" && !Array.isArray(o)) return `Spare cash ${inr(Number(o.spareCash))}`;
  if ((e.tool === "alpaca_place_order" || e.tool === "alpaca_place_crypto_order") && !Array.isArray(o))
    return `Order ${String(o.status)} · ${String(o.symbol)} ${o.notional ? usd(Number(o.notional)) : ""} · id ${String(o.id).slice(0, 8)}`;
  if (e.tool === "alpaca_get_account" && !Array.isArray(o)) return `Cash ${usd(Number(o.cash))} · buying power ${usd(Number(o.buyingPower))}`;
  if (e.tool === "alpaca_get_quote" && !Array.isArray(o)) return `${String(o.symbol)} @ $${Number(o.price).toLocaleString("en-US")}`;
  if (e.tool === "bank_transfer" && !Array.isArray(o)) {
    const t = o.transfer as Record<string, unknown> | undefined;
    return t ? `Sent ${inr(Number(t.amount))} to ${String(t.to)} (${String(t.id)})` : "Transfer done";
  }
  if (e.tool === "tally_get_employee_salaries" && Array.isArray(o)) return `${o.length} salary records exposed`;
  if (e.tool === "tally_update_voucher") return "Entry changed in the books";
  if (e.tool === "tally_open_company" && !Array.isArray(o)) return `Opened ${String(o.opened)}`;
  if (e.tool === "kosh_get_recommendations" && !Array.isArray(o)) {
    const a = (o.suggestedAllocation as { symbol: string; pct: number }[] | undefined) ?? [];
    return a.length ? `Suggests ${a.map((x) => `${x.symbol} ${x.pct}%`).join(", ")}` : "Pipeline ran";
  }
  if (Array.isArray(o)) return `${o.length} records`;
  const s = JSON.stringify(o);
  return s.length > 90 ? `${s.slice(0, 90)}…` : s;
}

export const shortTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });


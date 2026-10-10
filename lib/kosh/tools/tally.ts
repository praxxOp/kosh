import { z } from "zod";
import type { ToolDef } from "./types";
import {
  ACTIVE_COMPANY,
  COMPANIES,
  EMPLOYEES,
  HEADCOUNT,
  INBOX,
  MONTHLY_PAYROLL_TOTAL,
  UPCOMING_PAYMENTS,
  VOUCHERS,
  cashPosition,
} from "../data/acme";

// Mutable in-memory copy so "edits" show up if a tool is ever allowed through.
const vouchers = VOUCHERS.map((v) => ({ ...v }));

export const tallyTools: ToolDef[] = [
  {
    server: "tally",
    name: "tally_get_cash_position",
    description:
      "Read the company's cash position from the books: bank balances, committed outflows for the next 60 days, safety buffer and the resulting spare cash (INR).",
    inputSchema: z.object({}),
    run: async () => cashPosition(),
  },
  {
    server: "tally",
    name: "tally_get_upcoming_payments",
    description: "List committed upcoming payments (payroll, GST, vendors, EMIs, advance tax) with due dates.",
    inputSchema: z.object({ days: z.number().int().min(1).max(365).optional().describe("Horizon in days, default 90") }),
    run: async ({ days }) => {
      const horizon = (days as number | undefined) ?? 90;
      const cutoff = new Date("2026-10-10");
      cutoff.setDate(cutoff.getDate() + horizon);
      return UPCOMING_PAYMENTS.filter((p) => new Date(p.due) <= cutoff);
    },
  },
  {
    server: "tally",
    name: "tally_get_payroll_summary",
    description: "Total monthly payroll bill and headcount. Aggregate only, no individual salaries.",
    inputSchema: z.object({}),
    run: async () => ({ headcount: HEADCOUNT, monthlyPayrollTotal: MONTHLY_PAYROLL_TOTAL, currency: "INR" }),
  },
  {
    server: "tally",
    name: "tally_get_employee_salaries",
    description: "Individual employee salary records (name, title, monthly salary). Sensitive personal data.",
    inputSchema: z.object({ limit: z.number().int().min(1).max(50).optional() }),
    run: async ({ limit }) => EMPLOYEES.slice(0, (limit as number | undefined) ?? EMPLOYEES.length),
  },
  {
    server: "tally",
    name: "tally_list_vouchers",
    description: "List recent accounting vouchers (entries) in the books.",
    inputSchema: z.object({}),
    run: async () => vouchers,
  },
  {
    server: "tally",
    name: "tally_update_voucher",
    description: "Edit an existing accounting voucher's amount or narration. This changes the books.",
    inputSchema: z.object({
      voucher_id: z.string(),
      amount: z.number().optional(),
      narration: z.string().optional(),
    }),
    run: async ({ voucher_id, amount, narration }) => {
      const v = vouchers.find((x) => x.id === voucher_id);
      if (!v) throw new Error(`Voucher ${voucher_id} not found`);
      if (typeof amount === "number") v.amount = amount;
      if (typeof narration === "string") v.narration = narration;
      return { updated: v };
    },
  },
  {
    server: "tally",
    name: "tally_list_companies",
    description: "List the companies whose books are loaded in this Tally instance.",
    inputSchema: z.object({}),
    run: async () => COMPANIES.map((c) => ({ ...c, active: c.name === ACTIVE_COMPANY })),
  },
  {
    server: "tally",
    name: "tally_open_company",
    description: "Switch the active company whose books are being read.",
    inputSchema: z.object({ company: z.string() }),
    run: async ({ company }) => {
      const c = COMPANIES.find((x) => x.name.toLowerCase() === String(company).toLowerCase());
      if (!c) throw new Error(`Company "${company}" not found`);
      return { opened: c.name, books: c.books };
    },
  },
  {
    server: "tally",
    name: "tally_get_inbox",
    description: "Read the treasury team's inbox: recent emails with instructions from colleagues.",
    inputSchema: z.object({}),
    // Flags are UI hints for the audience; the agent must judge the email on its own.
    run: async () => INBOX.map((m) => ({ id: m.id, from: m.from, subject: m.subject, receivedAt: m.receivedAt, body: m.body })),
  },
];

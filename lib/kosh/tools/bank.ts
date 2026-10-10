import { z } from "zod";
import type { ToolDef } from "./types";
import { REGISTERED_BANK_ACCOUNTS } from "../data/acme";

/** Pretend bank. Transfers are recorded in memory so the demo can show what "went through". */
const transfers: { id: string; ts: string; to: string; account: string; ifsc: string; amount: number; note?: string }[] = [];

export const bankTools: ToolDef[] = [
  {
    server: "bank",
    name: "bank_list_accounts",
    description: "The company's registered bank accounts (the only destinations treasury money may move to).",
    inputSchema: z.object({}),
    run: async () => REGISTERED_BANK_ACCOUNTS,
  },
  {
    server: "bank",
    name: "bank_transfer",
    description: "Transfer money (INR) from the company's main account to a beneficiary account.",
    inputSchema: z.object({
      beneficiary_name: z.string(),
      account_number: z.string(),
      ifsc: z.string(),
      amount: z.number().positive().describe("Amount in INR"),
      note: z.string().optional(),
    }),
    run: async ({ beneficiary_name, account_number, ifsc, amount, note }) => {
      const t = {
        id: `TXN-${Date.now().toString(36).toUpperCase()}`,
        ts: new Date().toISOString(),
        to: String(beneficiary_name),
        account: String(account_number),
        ifsc: String(ifsc),
        amount: Number(amount),
        note: note as string | undefined,
      };
      transfers.push(t);
      return { status: "completed", transfer: t };
    },
  },
  {
    server: "bank",
    name: "bank_list_transfers",
    description: "Transfers made in this session.",
    inputSchema: z.object({}),
    run: async () => transfers,
  },
];

export const listTransfers = () => transfers;

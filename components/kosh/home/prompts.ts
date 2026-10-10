import { BookOpenCheck, ChartColumn, Inbox, Play, ShieldCheck, Sparkles, Wallet, type LucideIcon } from "lucide-react";

/** What the input offers when it is focused: prompts by topic and a few quick actions. */

export interface PromptCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  prompts: string[];
}

export const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: "treasury",
    label: "Treasury",
    icon: Wallet,
    prompts: [
      "We have spare cash. Invest it safely per policy.",
      "How much cash is truly spare after this month's payments?",
      "Deploy a 10% tranche across the suggested allocation",
      "Deploy a larger tranche of $40,000 into USFR",
      "What is sitting in the investment account right now?",
    ],
  },
  {
    id: "research",
    label: "Research",
    icon: ChartColumn,
    prompts: [
      "What does the recommendation pipeline suggest?",
      "Compare SGOV, BIL and USFR for parking cash",
      "Which Indian liquid funds yield the most right now?",
      "Why are TQQQ and Bitcoin excluded?",
      "Prepare a proposal to invest the spare cash",
    ],
  },
  {
    id: "approvals",
    label: "Approvals",
    icon: ShieldCheck,
    prompts: [
      "What is waiting for my approval?",
      "Summarise the proposals sent to the CFO today",
      "Place a $25,000 USFR order",
      "Who can approve an order above $10,000?",
    ],
  },
  {
    id: "inbox",
    label: "Inbox",
    icon: Inbox,
    prompts: [
      "Check the inbox and act on anything urgent.",
      "Is the vendor settlement email legitimate?",
      "Reply to the CFO with how the allocation was derived",
    ],
  },
  {
    id: "policy",
    label: "Policy",
    icon: BookOpenCheck,
    prompts: [
      "Summarise what the guardrails blocked so far and why.",
      "Which rules apply to a $60,000 order?",
      "Why does the policy only allow Treasury-bill ETFs?",
    ],
  },
];

export type QuickAction = { id: string; label: string; icon: LucideIcon } & ({ kind: "prompt"; prompt: string } | { kind: "replay" });

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "invest", label: "Invest per policy", icon: Sparkles, kind: "prompt", prompt: "We have spare cash. Invest it safely per policy." },
  { id: "inbox", label: "Handle the inbox", icon: Inbox, kind: "prompt", prompt: "Check the inbox and act on anything urgent." },
  { id: "replay", label: "Replay attack scenario", icon: Play, kind: "replay" },
];

/** Whether any prompt or quick action matches what is typed. Nothing typed always does. */
export function hasSuggestions(query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hit = (text: string) => text.toLowerCase().includes(needle);
  return PROMPT_CATEGORIES.some((c) => c.prompts.some(hit)) || QUICK_ACTIONS.some((a) => hit(a.label));
}

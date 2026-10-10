"use client";

import { create } from "zustand";
import { toast } from "sonner";
import { api, streamSse } from "@/lib/kosh/client";
import type { ActionEvent, Approval, ConnectorStatus, Engine, GuardMode, InboxSender, InboxThread, Role } from "@/lib/kosh/types";

export interface CashData {
  position: {
    company: string;
    bankBalance: number;
    committedOutflows: number;
    safetyBuffer: number;
    spareCash: number;
    breakdown: { head: string; due: string; amount: number }[];
  };
  inbox: { id: string; from: string; subject: string; receivedAt: string; body: string; flags: string[] }[];
}

export type HomeTab = "actions" | "insights";

export type ChatMsg = { kind: "message"; id: string; role: "user" | "assistant"; content: string; streaming?: boolean; ts: string };
export type ActionItem = { kind: "action"; id: string; event: ActionEvent; ts: string };
export type TimelineItem = ChatMsg | ActionItem;

type AgentEvent =
  | { type: "task"; taskId: string; engine: Engine }
  | { type: "text"; delta: string }
  | { type: "status"; text: string }
  | { type: "action"; event: ActionEvent }
  | { type: "step"; index: number; label: string }
  | { type: "done"; stopReason?: string | null }
  | { type: "error"; message: string };

const uid = () => Math.random().toString(36).slice(2, 10);

interface KoshState {
  role: Role;
  mode: GuardMode;
  engine: Engine;
  running: boolean;
  status: string;
  lastPrompt?: string;

  tab: HomeTab;
  /** The Home card shows the chat transcript instead of the tabs. */
  chatOpen: boolean;
  /** Top-right switch on Home: the conversation, or the live agent flow. */
  chatView: "chat" | "flow";

  timeline: TimelineItem[];
  /** Each person's own conversation, parked while someone else is acting. */
  byRole: Partial<Record<Role, { timeline: TimelineItem[]; chatOpen: boolean; lastPrompt?: string }>>;
  actions: ActionEvent[];
  approvals: Approval[];
  busyApproval?: string;
  connectors: ConnectorStatus[];
  cash?: CashData;
  threads: InboxThread[];
  selectedThreadId?: string;

  setRole: (r: Role) => void;
  setMode: (m: GuardMode) => void;
  setTab: (t: HomeTab) => void;
  setChatView: (v: "chat" | "flow") => void;
  openChat: () => void;
  closeChat: () => void;
  selectThread: (id: string) => void;

  loadConnectors: () => Promise<void>;
  loadCash: () => Promise<void>;
  loadApprovals: () => Promise<void>;
  loadInbox: () => Promise<void>;

  send: (text: string) => Promise<void>;
  replay: () => Promise<void>;
  submitApproval: (id: string) => Promise<void>;
  decide: (approvalId: string, decision: "approve" | "reject") => Promise<void>;
  sendInbox: (opts: { threadId?: string; subject?: string; to?: InboxSender; content: string }) => Promise<void>;
  clear: () => void;
}

export const useKosh = create<KoshState>((set, get) => {
  const pushAction = (event: ActionEvent) =>
    set((s) => ({
      actions: [event, ...s.actions],
      timeline: [...s.timeline, { kind: "action", id: event.id, event, ts: event.ts }],
    }));

  const handle = (e: AgentEvent, assistantId?: string) => {
    switch (e.type) {
      case "task":
        set({ engine: e.engine });
        break;
      case "text":
        if (assistantId)
          set((s) => ({
            timeline: s.timeline.map((m) => (m.kind === "message" && m.id === assistantId ? { ...m, content: m.content + e.delta } : m)),
          }));
        break;
      case "action":
        pushAction(e.event);
        if (e.event.decision === "held") void get().loadApprovals();
        break;
      case "status":
        set({ status: e.text });
        break;
      case "step":
        set({ status: `Step ${e.index + 1}: ${e.label}` });
        break;
      case "error":
        toast.error(e.message);
        break;
      case "done":
        set({ status: "" });
        break;
    }
  };

  return {
    role: "treasury_manager",
    mode: "on",
    engine: "local",
    running: false,
    status: "",
    tab: "actions",
    chatOpen: false,
    chatView: "chat",
    timeline: [],
    byRole: {},
    actions: [],
    approvals: [],
    connectors: [],
    threads: [],

    // A chat belongs to the person who had it. Switching people parks this one and restores theirs.
    setRole: (role) =>
      set((s) => {
        if (role === s.role) return {};
        const byRole = { ...s.byRole, [s.role]: { timeline: s.timeline, chatOpen: s.chatOpen, lastPrompt: s.lastPrompt } };
        const next = byRole[role] ?? { timeline: [], chatOpen: false, lastPrompt: undefined };
        return { role, byRole, timeline: next.timeline, chatOpen: next.chatOpen, lastPrompt: next.lastPrompt, chatView: "chat", status: "" };
      }),
    setMode: (mode) => set({ mode }),
    setTab: (tab) => set({ tab, chatOpen: false }),
    setChatView: (chatView) => set({ chatView }),
    openChat: () => set({ chatOpen: true, chatView: "chat" }),
    closeChat: () => set({ chatOpen: false }),
    selectThread: (id) => set({ selectedThreadId: id }),

    loadConnectors: async () => {
      try {
        set({ connectors: await api<ConnectorStatus[]>("/api/connectors") });
      } catch {
        /* keep previous */
      }
    },
    loadCash: async () => {
      try {
        set({ cash: await api<CashData>("/api/cash") });
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    loadApprovals: async () => {
      try {
        set({ approvals: await api<Approval[]>("/api/approvals") });
      } catch {
        /* ignore */
      }
    },
    loadInbox: async () => {
      try {
        const threads = await api<InboxThread[]>("/api/inbox");
        set((s) => ({ threads, selectedThreadId: s.selectedThreadId ?? threads[0]?.id }));
      } catch {
        /* ignore */
      }
    },

    send: async (text) => {
      const s = get();
      if (s.running || !text.trim()) return;
      const history = [
        ...s.timeline.filter((t): t is ChatMsg => t.kind === "message" && !!t.content).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];
      const assistantId = uid();
      const now = new Date().toISOString();
      set((st) => ({
        running: true,
        chatOpen: true,
        chatView: "chat",
        status: "",
        lastPrompt: text,
        timeline: [
          ...st.timeline,
          { kind: "message", id: uid(), role: "user", content: text, ts: now },
          { kind: "message", id: assistantId, role: "assistant", content: "", streaming: true, ts: now },
        ],
      }));
      try {
        await streamSse<AgentEvent>("/api/chat", { role: s.role, mode: s.mode, history }, (e) => handle(e, assistantId));
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        set((st) => ({
          running: false,
          status: "",
          timeline: st.timeline.map((m) => (m.kind === "message" && m.id === assistantId ? { ...m, streaming: false } : m)),
        }));
      }
    },

    replay: async () => {
      const s = get();
      if (s.running) return;
      set((st) => ({
        running: true,
        chatOpen: true,
        lastPrompt: "Replay attack scenario",
        timeline: [...st.timeline, { kind: "message", id: uid(), role: "user", content: "Replay the attack scenario", ts: new Date().toISOString() }],
      }));
      try {
        await streamSse<AgentEvent>("/api/scenario", { mode: s.mode }, (e) => handle(e));
        toast.success(s.mode === "on" ? "Scenario finished. Every risky step was stopped." : "Scenario finished unguarded. Check Broker & bank.");
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        set({ running: false, status: "" });
        void get().loadApprovals();
      }
    },

    submitApproval: async (id) => {
      set({ busyApproval: id });
      try {
        const res = await api<{ approval: Approval }>("/api/approvals", { method: "POST", body: JSON.stringify({ id, decision: "submit", role: get().role }) });
        toast.success(`Sent to the ${res.approval.approver === "cfo" ? "CFO" : "Treasury Manager"} for approval. Switch role to see it in their Actions.`);
        await Promise.all([get().loadApprovals(), get().loadInbox()]);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        set({ busyApproval: undefined });
      }
    },

    decide: async (approvalId, decision) => {
      set({ busyApproval: approvalId });
      try {
        const res = await api<{ approval: Approval; event?: ActionEvent }>("/api/approvals", {
          method: "POST",
          body: JSON.stringify({ id: approvalId, decision, role: get().role }),
        });
        if (res.event) {
          set((s) => ({ actions: [res.event!, ...s.actions] }));
          if (res.event.decision === "allowed") toast.success("Approved and executed.");
          else toast.warning(`Approved, but the order was ${res.event.decision}: ${res.event.reason ?? ""}`);
        } else toast(decision === "reject" ? "Rejected." : "Done.");
        await get().loadApprovals();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        set({ busyApproval: undefined });
      }
    },

    sendInbox: async (opts) => {
      try {
        const thread = await api<InboxThread>("/api/inbox", { method: "POST", body: JSON.stringify({ ...opts, from: get().role }) });
        await get().loadInbox();
        set({ selectedThreadId: thread.id });
      } catch (e) {
        toast.error((e as Error).message);
      }
    },

    clear: () => set({ timeline: [], status: "", chatOpen: false }),
  };
});

// Dev-only handle so scripted demos and recordings can drive the store: window.__kosh.getState().replay()
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") (window as unknown as { __kosh?: typeof useKosh }).__kosh = useKosh;

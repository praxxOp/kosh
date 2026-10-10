export type Role = "analyst" | "treasury_manager" | "cfo";
export type GuardMode = "off" | "on";
export type Engine = "none" | "local" | "agntid";
export type Decision = "allowed" | "blocked" | "held" | "error";
export type ServerId = "tally" | "alpaca" | "bank" | "kosh";

export const ROLE_LABEL: Record<Role, string> = {
  analyst: "Finance Analyst",
  treasury_manager: "Treasury Manager",
  cfo: "CFO",
};

/** The identity AgntID sees for each role (policies key on user_id). */
export const ROLE_USER_ID: Record<Role, string> = {
  analyst: "analyst@acme.demo",
  treasury_manager: "treasury@acme.demo",
  cfo: "cfo@acme.demo",
};

export interface ActionEvent {
  id: string;
  taskId: string;
  ts: string;
  role: Role;
  mode: GuardMode;
  engine: Engine;
  server: ServerId;
  tool: string;
  input: Record<string, unknown>;
  decision: Decision;
  ruleId?: string;
  ruleTitle?: string;
  reason?: string;
  output?: unknown;
  approvalId?: string;
}

export type RuleCategory = "money" | "data" | "access";

export interface PolicyRule {
  id: string;
  title: string;
  description: string;
  category: RuleCategory;
  enabled: boolean;
  /** Tunable numbers/lists the evaluator reads (limits, allow-lists). */
  params: Record<string, unknown>;
  source: "board" | "company" | "custom";
}

/** draft = proposed in chat, not yet sent; pending = waiting on the approver. */
export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";

export interface Approval {
  id: string;
  createdAt: string;
  status: ApprovalStatus;
  requestedBy: Role;
  /** Who has to say yes: the Treasury Manager for small orders, the CFO above the manager's limit. */
  approver: Role;
  amountUsd?: number;
  taskId: string;
  server: ServerId;
  tool: string;
  input: Record<string, unknown>;
  reason: string;
  decidedBy?: Role;
  decidedAt?: string;
  result?: unknown;
}

export type InboxSender = Role | "kosh" | "external";

export interface InboxAttachment {
  name: string;
  kind: "order";
  body: string;
}

export interface InboxMessage {
  id: string;
  from: InboxSender;
  fromName: string;
  ts: string;
  content?: string;
  attachment?: InboxAttachment;
}

export interface InboxThread {
  id: string;
  subject: string;
  /** Who is in the conversation, by display name. */
  participants: string[];
  createdAt: string;
  updatedAt: string;
  approvalId?: string;
  messages: InboxMessage[];
}

export const SENDER_NAME: Record<InboxSender, string> = {
  analyst: "Kavya Iyer (Analyst)",
  treasury_manager: "Arjun Shah (Treasury Manager)",
  cfo: "Priya Nair (CFO)",
  kosh: "Kosh",
  external: "External",
};

export interface ConnectorStatus {
  id: "tally" | "alpaca" | "agntid" | "supabase" | "model";
  label: string;
  connected: boolean;
  detail: string;
}

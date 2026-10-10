import { randomUUID } from "node:crypto";
import { SENDER_NAME, type InboxAttachment, type InboxMessage, type InboxSender, type InboxThread } from "./types";

/**
 * Role-to-role conversations (and the external email trap). In-memory, seeded once.
 * Threads are shared across roles; what differs is which side of the bubble you sit on.
 */

type Store = { threads: InboxThread[] };
const g = globalThis as unknown as { __koshInbox3?: Store };

// Nothing is seeded: the inbox only holds approval requests and the replies people send.
// Keyed by seed version so a running dev server picks up the change on reload.
const store: Store = (g.__koshInbox3 ??= { threads: [] });

export function listThreads(): InboxThread[] {
  return [...store.threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getThread(id: string) {
  return store.threads.find((t) => t.id === id);
}

/** Wipes every conversation. Approvals are untouched; their "Thread" link simply has nothing to open. */
export function clearThreads() {
  const n = store.threads.length;
  store.threads.length = 0;
  return n;
}

export function postMessage(opts: {
  threadId?: string;
  subject?: string;
  from: InboxSender;
  to?: InboxSender;
  content?: string;
  attachment?: InboxAttachment;
  approvalId?: string;
}): InboxThread {
  const now = new Date().toISOString();
  const msg: InboxMessage = {
    id: randomUUID().slice(0, 8),
    from: opts.from,
    fromName: SENDER_NAME[opts.from],
    ts: now,
    content: opts.content,
    attachment: opts.attachment,
  };
  let thread = opts.threadId ? getThread(opts.threadId) : undefined;
  if (!thread) {
    thread = {
      id: `T-${randomUUID().slice(0, 6).toUpperCase()}`,
      subject: opts.subject ?? "New conversation",
      participants: [SENDER_NAME[opts.from], ...(opts.to ? [SENDER_NAME[opts.to]] : [])],
      createdAt: now,
      updatedAt: now,
      approvalId: opts.approvalId,
      messages: [],
    };
    store.threads.unshift(thread);
  }
  if (!thread.participants.includes(msg.fromName)) thread.participants.push(msg.fromName);
  thread.messages.push(msg);
  thread.updatedAt = now;
  return thread;
}

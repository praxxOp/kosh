"use client";

import { useEffect, useState } from "react";
import { PlusIcon, Search, SendIcon } from "lucide-react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { shortTime } from "@/lib/kosh/labels";
import { ROLE_LABEL, SENDER_NAME, type InboxMessage, type InboxSender, type InboxThread, type Role } from "@/lib/kosh/types";
import { useKosh } from "../store";

const initials = (name: string) =>
  name
    .replace(/<.*>|\(.*\)/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
const INITIALS: Record<Role, string> = { analyst: "KI", treasury_manager: "AS", cfo: "PN" };
const PERSON: Record<Role, string> = { analyst: "Kavya Iyer", treasury_manager: "Arjun Shah", cfo: "Priya Nair" };

/* ---------------- Sidebar: the conversation list, in the kit's chat-app layout ---------------- */

/** Only the conversations this person is part of. */
const mine = (threads: InboxThread[], role: Role) => threads.filter((t) => t.participants.includes(SENDER_NAME[role]));

function ThreadsSidebar({ onCompose }: { onCompose: () => void }) {
  const { threads, selectedThreadId, selectThread, role } = useKosh();
  const [q, setQ] = useState("");
  const list = mine(threads, role).filter((t) => t.subject.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Card className="hidden w-80 shrink-0 pb-0 lg:flex">
      <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
        <div className="space-y-4 p-(--card-spacing)">
          <div className="flex items-center justify-between gap-2">
            <div className="font-display text-xl">Inbox</div>
            <Button variant="outline" size="icon-sm" className="rounded-full" onClick={onCompose} aria-label="New conversation">
              <PlusIcon />
            </Button>
          </div>
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput type="text" placeholder="Search conversations..." value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>
        </div>
        <ScrollArea className="min-h-0 min-w-0 flex-1 border-t [&>[data-slot=scroll-area-viewport]>div]:block!">
          <div className="divide-y">
            {list.map((t) => {
              const last = t.messages[t.messages.length - 1];
              const other = t.participants.find((p) => p !== SENDER_NAME[role]) ?? t.participants[0];
              const active = t.id === selectedThreadId;
              return (
                <div
                  key={t.id}
                  onClick={() => selectThread(t.id)}
                  className={cn("group/item hover:bg-muted relative flex min-w-0 cursor-pointer items-center gap-4 px-6 py-3", active && "dark:bg-muted! bg-gray-200!")}>
                  <Avatar>
                    <AvatarFallback>{initials(other ?? "?")}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 grow">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium">{t.subject}</span>
                      <span className="text-muted-foreground flex-none text-xs">{time(t.updatedAt)}</span>
                    </div>
                    <span className="text-muted-foreground block truncate text-start text-sm">
                      {last?.content ?? last?.attachment?.name ?? ""}
                    </span>
                  </div>
                </div>
              );
            })}
            {list.length === 0 && <div className="text-muted-foreground mt-4 text-center text-sm">No conversation found</div>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

/* ---------------- Messages ---------------- */

/** A proposed order, as a card rather than its JSON. */
function OrderCard({ body }: { body: string }) {
  let o: Record<string, unknown> = {};
  try {
    o = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return <pre className="text-[11px] whitespace-pre-wrap">{body}</pre>;
  }
  const rows: [string, string][] = [
    ["Instrument", String(o.symbol ?? "—")],
    ["Amount", typeof o.notional === "number" ? `$${(o.notional as number).toLocaleString("en-US")}` : "—"],
    ["Side", String(o.side ?? "buy")],
    ...(o.requestedBy ? ([["Requested by", ROLE_LABEL[o.requestedBy as Role] ?? String(o.requestedBy)]] as [string, string][]) : []),
    ...(o.approver ? ([["Needs approval from", ROLE_LABEL[o.approver as Role] ?? String(o.approver)]] as [string, string][]) : []),
  ];
  return (
    <div className="bg-background/70 w-64 rounded-lg border">
      <div className="border-b px-3 py-2 text-xs font-semibold">Proposed order</div>
      <dl className="divide-y">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-3 py-1.5 text-xs">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium capitalize">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A text bubble, plus the order card the approval flow attaches to its request. */
function MessageBubble({ m, own }: { m: InboxMessage; own: boolean }) {
  return (
    <div className={cn("flex w-full flex-col gap-1", own && "items-end")}>
      <Bubble variant={own ? "default" : "muted"} align={own ? "end" : "start"} className="lg:max-w-[60%]">
        {!own && <span className="text-muted-foreground px-1 text-xs font-medium">{m.fromName}</span>}
        {m.content && <BubbleContent className="whitespace-pre-wrap">{m.content}</BubbleContent>}
        {m.attachment?.kind === "order" && (
          <BubbleContent className="p-2">
            <OrderCard body={m.attachment.body} />
          </BubbleContent>
        )}
      </Bubble>
      <time className="text-muted-foreground text-xs">{shortTime(m.ts)}</time>
    </div>
  );
}

function ThreadContent() {
  const { role, threads, selectedThreadId, sendInbox } = useKosh();
  const [draft, setDraft] = useState("");
  const thread = mine(threads, role).find((t) => t.id === selectedThreadId);

  const sendText = async () => {
    if (!thread || !draft.trim()) return;
    const content = draft.trim();
    setDraft("");
    await sendInbox({ threadId: thread.id, content });
  };

  if (!thread)
    return (
      <div className="bg-card flex h-full items-center justify-center rounded-xl border">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SendIcon />
            </EmptyMedia>
            <EmptyTitle>Nothing here yet</EmptyTitle>
            <EmptyDescription>Approval requests and replies from colleagues land here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );

  const other = thread.participants.find((p) => p !== SENDER_NAME[role]) ?? thread.participants[0];
  return (
    <div className="bg-card flex h-full flex-col rounded-xl border p-4">
      <div className="flex min-w-0 items-center gap-3 border-b pb-4">
        <Avatar className="size-10">
          <AvatarFallback>{initials(other ?? "?")}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate font-medium">{thread.subject}</div>
          <div className="text-muted-foreground truncate text-xs">{thread.participants.join(" · ")}</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto lg:px-4">
        <div className="flex flex-col gap-6 py-6">
          {thread.messages.map((m) => (
            <MessageBubble key={m.id} m={m} own={m.from === role} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t pt-4">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendText();
            }
          }}
          placeholder={`Message as ${ROLE_LABEL[role]}…`}
          className="rounded-full"
        />
        <Button size="icon" className="rounded-full" onClick={sendText} disabled={!draft.trim()} aria-label="Send">
          <SendIcon />
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */

export function InboxPage() {
  const { role, threads, selectedThreadId, selectThread, loadInbox, sendInbox } = useKosh();
  const [composing, setComposing] = useState(false);
  const [newTo, setNewTo] = useState<InboxSender>(role === "cfo" ? "analyst" : "cfo");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  // Switching person: land on that person's first conversation if the current one isn't theirs.
  useEffect(() => {
    const visible = mine(threads, role);
    if (visible.length && !visible.some((t) => t.id === selectedThreadId)) selectThread(visible[0].id);
  }, [role, threads, selectedThreadId, selectThread]);

  const createThread = async () => {
    if (!newSubject.trim() || !newBody.trim()) return;
    await sendInbox({ subject: newSubject.trim(), to: newTo, content: newBody.trim() });
    setComposing(false);
    setNewSubject("");
    setNewBody("");
  };

  return (
    <div className="flex h-(--content-full-height) w-full gap-4">
      <ThreadsSidebar onCompose={() => setComposing(true)} />
      <div className="min-w-0 grow">
        <ThreadContent />
      </div>

      <Dialog open={composing} onOpenChange={setComposing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New conversation</DialogTitle>
            <DialogDescription>Ask a colleague about an analysis, an approval or an order.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="new-to">To</Label>
              <Select value={newTo} onValueChange={(v) => setNewTo(v as InboxSender)}>
                <SelectTrigger id="new-to" className="h-10 w-full">
                  {/* One line in the trigger; the two-line person card is only for the list. */}
                  <SelectValue>
                    {newTo in PERSON && (
                      <>
                        <Avatar className="size-6">
                          <AvatarFallback className="text-[10px]">{INITIALS[newTo as Role]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{PERSON[newTo as Role]}</span>
                        <span className="text-muted-foreground">· {ROLE_LABEL[newTo as Role]}</span>
                      </>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["analyst", "treasury_manager", "cfo"] as Role[])
                    .filter((r) => r !== role)
                    .map((r) => (
                      <SelectItem key={r} value={r} className="py-2">
                        <span className="flex items-center gap-2.5">
                          <Avatar className="size-7">
                            <AvatarFallback className="text-[11px]">{INITIALS[r]}</AvatarFallback>
                          </Avatar>
                          <span className="leading-tight">
                            <span className="block text-sm font-medium">{PERSON[r]}</span>
                            <span className="text-muted-foreground block text-xs">{ROLE_LABEL[r]}</span>
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-subject">Subject</Label>
              <Input id="new-subject" placeholder="e.g. How was the USFR allocation derived?" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-body">Message</Label>
              <Textarea id="new-body" rows={4} placeholder="Write your message…" value={newBody} onChange={(e) => setNewBody(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposing(false)}>
              Cancel
            </Button>
            <Button onClick={createThread} disabled={!newSubject.trim() || !newBody.trim()}>
              <SendIcon /> Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

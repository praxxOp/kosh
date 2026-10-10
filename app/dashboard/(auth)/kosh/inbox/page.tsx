import type { Metadata } from "next";
import { InboxPage } from "@/components/kosh/inbox/inbox-page";

export const metadata: Metadata = { title: "Inbox" };

export default function Page() {
  return <InboxPage />;
}

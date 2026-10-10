import type { Metadata } from "next";
import { AuditTable } from "@/components/kosh/audit-table";

export const metadata: Metadata = { title: "Audit log" };

export default function Page() {
  return <AuditTable />;
}

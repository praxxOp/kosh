import type { Metadata } from "next";
import { PolicyBoard } from "@/components/kosh/policy-board";

export const metadata: Metadata = { title: "Policy" };

export default function Page() {
  return <PolicyBoard />;
}

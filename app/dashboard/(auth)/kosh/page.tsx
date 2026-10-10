import type { Metadata } from "next";
import { HomeShell } from "@/components/kosh/home/home-shell";

export const metadata: Metadata = { title: "Home" };

export default function Page() {
  return <HomeShell />;
}

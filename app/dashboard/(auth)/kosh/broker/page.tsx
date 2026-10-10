import type { Metadata } from "next";
import { BrokerView } from "@/components/kosh/broker-view";

export const metadata: Metadata = { title: "Broker & bank" };

export default function Page() {
  return <BrokerView />;
}

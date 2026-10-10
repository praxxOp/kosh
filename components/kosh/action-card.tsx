"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DECISION_STYLES } from "@/lib/kosh/labels";
import type { ActionEvent } from "@/lib/kosh/types";

export function DecisionBadge({ decision, label }: { decision: ActionEvent["decision"]; label?: string }) {
  const d = DECISION_STYLES[decision];
  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full font-medium", d.className)}>
      <span className={cn("size-1.5 rounded-full", d.dot)} />
      {label ?? d.label}
    </Badge>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

const PRICING_URL = "https://shadcnuikit.com/pricing";
const REMINDER_THRESHOLD = 3;

// First path segment after /dashboard for every entry in the "Dashboards" nav group.
const dashboardSlugs = new Set([
  "default",
  "ecommerce",
  "payment",
  "hotel",
  "project-management",
  "real-estate",
  "sales",
  "hr",
  "crm",
  "website-analytics",
  "ai-analytics",
  "file-manager",
  "crypto",
  "academy",
  "hospital-management",
  "finance"
]);

const messages = {
  intro: {
    title: "Like what you see?",
    description: "Get the full source code of all 16 dashboards and 73+ pages."
  },
  // Replaces the intro once the visitor has opened REMINDER_THRESHOLD different dashboards.
  reminder: {
    title: "Every dashboard you've seen is included.",
    description: "All 16 dashboards and 73+ pages come in one package."
  }
};

type Mode = keyof typeof messages;

export function PromoToast() {
  const pathname = usePathname();
  const viewed = useRef(new Set<string>());
  // Both live in memory only, so the toast is back after a page reload.
  const [mode, setMode] = useState<Mode | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const slug = pathname.split("/")[2];
    if (dashboardSlugs.has(slug)) viewed.current.add(slug);

    const nextMode: Mode = viewed.current.size >= REMINDER_THRESHOLD ? "reminder" : "intro";

    // Let the page settle first.
    const timer = setTimeout(() => setMode(nextMode), 1500);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (!mode || dismissed) return null;

  const { title, description } = messages[mode];

  // Rendered as a plain fixed element rather than a sonner toast: z-40 keeps it
  // below dialogs, sheets and the theme customizer (z-50) instead of covering them.
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 fixed inset-x-4 bottom-4 z-40 duration-300 sm:right-6 sm:bottom-6 sm:left-auto sm:w-89">
      {/* Rendered before the card so the strings tuck behind its top edge. */}
      <img
        src="/images/summer-party-balloon.png"
        alt=""
        className="pointer-events-none absolute bottom-full left-3 size-20 translate-y-4 -rotate-6 select-none"
      />
      <div className="relative rounded-xl bg-linear-to-r from-violet-600 via-fuchsia-600 to-cyan-600 p-[3px] shadow-lg">
        <div className="bg-popover text-popover-foreground relative rounded-[calc(var(--radius)+1px)] p-4 pr-10">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          <div className="mt-3 flex items-center gap-3">
            <Button asChild>
              <a href={PRICING_URL} target="_blank" rel="noreferrer">
                Get the Code
                <ArrowRightIcon />
              </a>
            </Button>
            <p className="text-sm font-semibold">
              <s className="text-muted-foreground font-normal">$129</s> $79
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="text-muted-foreground absolute top-2 right-2 size-7">
            <XIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { ExternalLinkIcon, LifeBuoyIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { useUiStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";

const SHORTCUTS = [
  { label: "Open command palette", keys: ["⌘", "K"] },
  { label: "Toggle sidebar", keys: ["⌘", "B"] },
  { label: "Close any panel", keys: ["Esc"] },
  { label: "Move between results", keys: ["↑", "↓"] },
];

export function HelpSheet() {
  const open = useUiStore((state) => state.helpOpen);
  const setOpen = useUiStore((state) => state.setHelpOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[420px]">
        <SheetHeader className="border-b border-border/70 pb-5">
          <p className="eyebrow mb-1.5">Support</p>
          <SheetTitle className="display-serif text-[26px]">Help & support</SheetTitle>
          <SheetDescription className="text-[12.5px] leading-relaxed">
            NEXUS is a self-contained demo workspace. Everything runs locally in your
            browser — there are no external services connected.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6">
          <section aria-labelledby="shortcuts-heading">
            <h3 id="shortcuts-heading" className="eyebrow mb-3">
              Keyboard shortcuts
            </h3>
            <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70 bg-card">
              {SHORTCUTS.map((shortcut) => (
                <li
                  key={shortcut.label}
                  className="flex items-center justify-between gap-4 px-3 py-2.5"
                >
                  <span className="text-[12.5px] text-muted-foreground">
                    {shortcut.label}
                  </span>
                  <span className="flex items-center gap-1">
                    {shortcut.keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <Separator />

          <section aria-labelledby="demo-heading" className="space-y-2">
            <h3 id="demo-heading" className="eyebrow">
              About this build
            </h3>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Projects, tasks, messages and preferences are seeded with a realistic
              demo dataset and saved to <span className="font-mono text-[11px]">localStorage</span>.
              Clearing your browser storage resets the workspace.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface/60 px-3 py-2.5">
              <RotateCcwIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-[11.5px] text-muted-foreground">
                Reset demo data from Settings → Data.
              </span>
            </div>
          </section>

          <Separator />

          <section aria-labelledby="links-heading" className="space-y-2">
            <h3 id="links-heading" className="eyebrow">
              Go to
            </h3>
            <div className="grid gap-1.5">
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/settings">
                  <LifeBuoyIcon className="size-4 text-muted-foreground" />
                  Open workspace settings
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/reports">
                  <ExternalLinkIcon className="size-4 text-muted-foreground" />
                  View delivery reports
                </Link>
              </Button>
            </div>
          </section>
        </div>

        <SheetFooter className="border-t border-border/70">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>NEXUS · Demo workspace</span>
            <span className="font-mono">v0.1.0</span>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

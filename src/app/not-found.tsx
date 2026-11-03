import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";
import { NexusMark, NexusWordmark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link
          href="/dashboard"
          className="mb-10 inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <NexusMark className="size-4" />
          </span>
          <NexusWordmark />
        </Link>

        <p className="eyebrow mb-4">Error 404</p>
        <h1 className="display-serif text-[40px] leading-[1.02] tracking-[-0.02em]">
          This page slipped
          <br />
          out of the workspace.
        </h1>
        <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          The address you followed doesn&apos;t exist here. Head back to your dashboard and
          pick up where you left off.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href="/dashboard">
              <ArrowLeftIcon className="size-4" />
              Back to dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/projects">Browse projects</Link>
          </Button>
        </div>

        <div className="mt-12 border-t border-border/70 pt-5">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground/70 uppercase">
            NEXUS · Local demo workspace
          </p>
        </div>
      </div>
    </div>
  );
}

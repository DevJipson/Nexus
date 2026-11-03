import type { LucideIcon } from "lucide-react";
import { CheckIcon } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";

export interface ModuleCapability {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface ModulePreviewProps {
  eyebrow: string;
  title: string;
  description: string;
  moduleIcon: LucideIcon;
  capabilities: ModuleCapability[];
  note: string;
}

/**
 * Interim module surface used only while the application shell is being
 * validated. Every module replaces this with its real, data-backed screen in
 * the next implementation gate.
 */
export function ModulePreview({
  eyebrow,
  title,
  description,
  moduleIcon: ModuleIcon,
  capabilities,
  note,
}: ModulePreviewProps) {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={<StatusPill label="In build" tone="warning" />}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {capabilities.map((capability) => {
          const Icon = capability.icon;
          return (
            <Card key={capability.title} className="gap-0 p-5">
              <CardHeader className="gap-3 p-0">
                <span className="flex size-9 items-center justify-center rounded-lg border border-border/70 bg-surface text-muted-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <CardTitle>{capability.title}</CardTitle>
                <CardDescription>{capability.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-surface/40 p-5 sm:flex-row sm:items-start">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-primary shadow-card">
          <ModuleIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow mb-2">Implementation note</p>
          <p className="max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
            {note}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {[
              "Design system connected",
              "Navigation and breadcrumbs live",
              "Theme and preferences persist",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <CheckIcon className="size-3 text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

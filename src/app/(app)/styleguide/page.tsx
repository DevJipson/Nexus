import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  FolderKanbanIcon,
  InboxIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill, PriorityIndicator } from "@/components/shared/status-pill";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { TASK_LABELS } from "@/lib/domain-meta";
import { seedMembers } from "@/data/seed/shell";

export const metadata: Metadata = {
  title: "Styleguide",
  description: "The NEXUS design language: tokens, type, colour and components.",
  robots: { index: false, follow: false },
};

function Section({
  eyebrow,
  title,
  description,
  children,
  id,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="border-t border-border/70 pt-8">
      <div className="mb-5 max-w-xl">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h2 className="text-[17px] font-medium tracking-[-0.01em]">{title}</h2>
        {description ? (
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, token }: { name: string; token: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <div className="h-14 w-full" style={{ backgroundColor: `var(${token})` }} />
      <div className="border-t border-border/70 px-2.5 py-2">
        <p className="text-[11.5px] font-medium">{name}</p>
        <p className="font-mono text-[9.5px] text-muted-foreground">{token}</p>
      </div>
    </div>
  );
}

const SURFACES = [
  ["Background", "--background"],
  ["Surface", "--surface"],
  ["Surface raised", "--surface-raised"],
  ["Surface sunken", "--surface-sunken"],
  ["Card", "--card"],
  ["Border", "--border"],
] as const;

const SEMANTICS = [
  ["Primary", "--primary"],
  ["Info", "--info"],
  ["Success", "--success"],
  ["Warning", "--warning"],
  ["Danger", "--danger"],
  ["Accent", "--accent"],
] as const;

const CHARTS = [
  ["Chart 1", "--chart-1"],
  ["Chart 2", "--chart-2"],
  ["Chart 3", "--chart-3"],
  ["Chart 4", "--chart-4"],
  ["Chart 5", "--chart-5"],
  ["Chart 6", "--chart-6"],
] as const;

export default function StyleguidePage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Design system"
        title="The quiet instrument."
        description="The working reference for NEXUS: warm paper surfaces, a single cobalt signal, status-only colour, editorial serif display type and a compact, mono-labelled information layer."
        actions={
          <Button variant="outline" asChild>
            <a href="#tokens">Jump to tokens</a>
          </Button>
        }
      />

      <Section
        eyebrow="Typography"
        title="Three voices"
        description="Instrument Serif carries the editorial voice. Geist handles interface text. Geist Mono is reserved for labels, numerals and metadata."
      >
        <div className="space-y-6 rounded-xl border border-border/70 bg-card p-6 shadow-card">
          <div>
            <p className="eyebrow mb-2">Display · Instrument Serif</p>
            <p className="display-serif text-[44px] leading-[1.02] tracking-[-0.02em] sm:text-[56px]">
              Calm is a feature.
            </p>
          </div>
          <Separator />
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="eyebrow mb-2">Heading · Geist 500</p>
              <p className="text-[17px] font-medium tracking-[-0.01em]">
                A considered workspace
              </p>
            </div>
            <div>
              <p className="eyebrow mb-2">Body · Geist 400</p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                NEXUS keeps the interface quiet so the work stays loud. Type is
                compact, rhythm is consistent, and colour only carries meaning.
              </p>
            </div>
            <div>
              <p className="eyebrow mb-2">Label · Geist Mono</p>
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase">
                Workspace · v0.1
              </p>
            </div>
            <div>
              <p className="eyebrow mb-2">Numerals · tabular</p>
              <p className="tnum text-[26px] leading-none">1,284</p>
            </div>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Colour"
        title="One signal, honest status"
        description="Cobalt is the only brand colour. Everything else is a warm neutral or a status with meaning."
        id="tokens"
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {SURFACES.map(([name, token]) => (
            <Swatch key={token} name={name} token={token} />
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {SEMANTICS.map(([name, token]) => (
            <Swatch key={token} name={name} token={token} />
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {CHARTS.map(([name, token]) => (
            <Swatch key={token} name={name} token={token} />
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Actions"
        title="Buttons"
        description="One primary action per view. Everything else recedes. The loading state is built into the primitive."
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <Button>
            <PlusIcon className="size-4" />
            New project
          </Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button isLoading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <Button size="xs" variant="outline">
            Extra small
          </Button>
          <Button size="sm" variant="outline">
            Small
          </Button>
          <Button variant="outline">Default</Button>
          <Button size="lg" variant="outline">
            Large
          </Button>
          <Button size="icon" variant="outline" aria-label="Icon button">
            <SparklesIcon className="size-4" />
          </Button>
        </div>
      </Section>

      <Section
        eyebrow="Status"
        title="Pills, priorities and labels"
        description="Status colour always means something. Tones are derived from semantic tokens rather than hardcoded hues."
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label="Active" tone="info" />
          <StatusPill label="In progress" tone="warning" />
          <StatusPill label="In review" tone="accent" />
          <StatusPill label="Completed" tone="success" />
          <StatusPill label="Blocked" tone="danger" />
          <StatusPill label="Backlog" tone="neutral" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          {(["urgent", "high", "medium", "low"] as const).map((priority) => (
            <PriorityIndicator key={priority} priority={priority} withLabel />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TASK_LABELS.map((label) => (
            <Badge key={label} variant="soft" className="capitalize">
              {label}
            </Badge>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Forms"
        title="Inputs with restraint"
        description="Fields sit on raised surfaces with hairline borders. Focus is a cobalt ring, never a colour flood."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sg-name">Project name</Label>
            <Input id="sg-name" placeholder="Atlas design system" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sg-email">Email</Label>
            <Input id="sg-email" type="email" placeholder="maya@nexus.studio" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sg-brief">Brief</Label>
            <Textarea
              id="sg-brief"
              placeholder="What are we making, and why now?"
              rows={3}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-[12.5px]">
            <Checkbox defaultChecked /> Notify assignees
          </label>
          <label className="flex items-center gap-2 text-[12.5px]">
            <Switch defaultChecked /> Weekly digest
          </label>
          <div className="flex min-w-40 items-center gap-2">
            <Progress value={62} className="h-1.5" />
            <span className="tnum font-mono text-[10px] text-muted-foreground">62%</span>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Containers"
        title="Cards and surfaces"
        description="Hairline borders, a single soft shadow and generous internal rhythm. Cards never float without purpose."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <p className="eyebrow mb-2">Project</p>
              <CardTitle>Atlas design language</CardTitle>
              <CardDescription>
                A unified visual system for every surface in the product.
              </CardDescription>
              <CardAction>
                <StatusPill label="Active" tone="info" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
                <span>Progress</span>
                <span className="tnum">68%</span>
              </div>
              <Progress value={68} className="mt-2 h-1.5" />
            </CardContent>
            <CardFooter className="justify-between">
              <div className="flex -space-x-1.5">
                {seedMembers.slice(0, 3).map((member) => (
                  <EntityAvatar
                    key={member.id}
                    name={member.name}
                    hue={member.avatarHue}
                    size="sm"
                    ring
                  />
                ))}
              </div>
              <Button variant="ghost" size="xs">
                Open
                <ArrowRightIcon className="size-3" />
              </Button>
            </CardFooter>
          </Card>

          <Card data-size="sm" className="justify-center text-center">
            <CardContent className="space-y-3">
              <span className="mx-auto flex size-10 items-center justify-center rounded-lg border border-border/70 bg-surface text-muted-foreground">
                <FolderKanbanIcon className="size-4" />
              </span>
              <div>
                <p className="text-[13px] font-medium">Project colour</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  Project hues tint avatars and markers, never backgrounds.
                </p>
              </div>
              <div className="flex justify-center gap-1.5">
                {[264, 168, 38, 318, 25].map((hue) => (
                  <span
                    key={hue}
                    className="size-5 rounded-md"
                    style={{
                      backgroundColor: `oklch(0.62 0.12 ${hue})`,
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface/50">
            <CardHeader>
              <p className="eyebrow mb-2">Note</p>
              <CardTitle>Editorial voice</CardTitle>
              <CardDescription>
                Serif display type appears once per screen. It is the only place the
                interface allows itself a flourish.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="display-serif text-[28px] leading-tight">
                “Make it calm, then make it fast.”
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        eyebrow="People"
        title="Avatars"
        description="Initials with hue-tinted surfaces keep the directory human without stock photography."
      >
        <div className="flex flex-wrap items-end gap-5">
          {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <EntityAvatar name="Maya Chen" hue={264} size={size} presence="online" />
              <span className="font-mono text-[9px] text-muted-foreground uppercase">
                {size}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="States"
        title="Loading and emptiness"
        description="Skeletons mirror final layout. Empty states explain the next action rather than apologising."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <Skeleton className="h-5 w-14 rounded-md" />
            </div>
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-4/5" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
          <EmptyState
            icon={InboxIcon}
            title="Nothing waiting"
            description="When work is assigned, mentioned or due, it will surface here with the context you need."
            action={
              <Button size="sm" variant="outline">
                Browse projects
              </Button>
            }
          />
        </div>
      </Section>

      <p className="border-t border-border/70 pt-5 font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground/60 uppercase">
        NEXUS design system · Not indexed · Reference only
      </p>
    </div>
  );
}

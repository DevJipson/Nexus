"use client";

import { useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  parseISO,
} from "date-fns";
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CalendarRangeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EVENT_TYPE_META, toneVar } from "@/lib/domain-meta";
import { formatTime, pluralize } from "@/lib/format";
import { eventsOnDay, workspaceEvents } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { useComposeStore } from "@/store/compose-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { CalendarEvent, CalendarView } from "@/types/domain";

export function CalendarScreen() {
  const state = useWorkspaceStore();
  const openComposer = useComposeStore((store) => store.open);

  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());

  const events = workspaceEvents(state, state.activeWorkspaceId);
  const weekOpts = { weekStartsOn: state.preferences.startOfWeek } as const;

  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor), weekOpts),
    end: endOfWeek(endOfMonth(anchor), weekOpts),
  });

  const weekDays = eachDayOfInterval({
    start: startOfWeek(anchor, weekOpts),
    end: endOfWeek(anchor, weekOpts),
  });

  const dayEvents = eventsOnDay(events, selected);
  const upcoming = events.filter(
    (event) => parseISO(event.end).getTime() >= startOfDay(new Date()).getTime(),
  );

  const step = (direction: 1 | -1) => {
    if (view === "month") setAnchor((value) => addMonths(value, direction));
    else if (view === "week") setAnchor((value) => addWeeks(value, direction));
    else setAnchor((value) => addDays(value, direction));
  };

  const goToday = () => {
    const today = new Date();
    setAnchor(today);
    setSelected(today);
  };

  const pickDay = (day: Date) => {
    setSelected(day);
    if (!isSameMonth(day, anchor)) setAnchor(startOfMonth(day));
  };

  const pickDayAndShow = (day: Date) => {
    pickDay(day);
    setView("day");
    setAnchor(day);
  };

  const heading =
    view === "month"
      ? format(anchor, "MMMM yyyy")
      : view === "week"
        ? `${format(weekDays[0], "d MMM")} – ${format(weekDays[6], "d MMM yyyy")}`
        : format(anchor, "EEEE, d MMMM yyyy");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Time, made legible."
        description="Meetings, deadlines, milestones and focus time — one month grid, one week, one honest day."
        actions={
          <Button onClick={() => openComposer("event", { date: selected })}>
            <PlusIcon className="size-4" />
            New event
          </Button>
        }
        meta={
          <span className="text-[11.5px] text-muted-foreground">
            {pluralize(events.length, "event")} in this workspace
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous" onClick={() => step(-1)}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Next" onClick={() => step(1)}>
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday} className="ml-1">
            Today
          </Button>
        </div>

        <h2 className="display-serif tnum min-w-0 flex-1 text-center text-[19px] leading-none">
          {heading}
        </h2>

        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(value) => {
            if (!value) return;
            const next = value as CalendarView;
            if (next === "day") setAnchor(selected);
            setView(next);
          }}
          aria-label="Calendar view"
        >
          <ToggleGroupItem value="month" aria-label="Month view" className="h-8 gap-1.5 px-2.5 text-[11.5px]">
            <CalendarDaysIcon className="size-3.5" />
            <span className="hidden sm:inline">Month</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="week" aria-label="Week view" className="h-8 gap-1.5 px-2.5 text-[11.5px]">
            <CalendarRangeIcon className="size-3.5" />
            <span className="hidden sm:inline">Week</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="day" aria-label="Day view" className="h-8 gap-1.5 px-2.5 text-[11.5px]">
            <CalendarClockIcon className="size-3.5" />
            <span className="hidden sm:inline">Day</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-label={view === "month" ? "Month grid" : view === "week" ? "Week grid" : "Day timeline"}
          className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-card"
        >
          {view === "month" ? (
            <MonthGrid
              anchor={anchor}
              monthDays={monthDays}
              events={events}
              selected={selected}
              onPick={pickDay}
              onMore={pickDayAndShow}
              weekOpts={weekOpts}
            />
          ) : view === "week" ? (
            <WeekGrid
              weekDays={weekDays}
              events={events}
              selected={selected}
              onPick={pickDay}
              onOpenDay={pickDayAndShow}
            />
          ) : (
            <DayTimeline day={anchor} events={eventsOnDay(events, anchor)} state={state} />
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-border/80 bg-card shadow-card">
            <header className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3.5">
              <div>
                <p className="eyebrow mb-1.5">Agenda</p>
                <h3 className="text-[13.5px] font-medium">{format(selected, "EEEE, d MMMM, yyyy")}</h3>
              </div>
              <Button size="icon-xs" variant="outline" aria-label="Schedule event on this day" onClick={() => openComposer("event", { date: selected })}>
                <PlusIcon className="size-3.5" />
              </Button>
            </header>
            <div className="p-3">
              {dayEvents.length === 0 ? (
                <EmptyState
                  icon={CalendarDaysIcon}
                  title="Nothing scheduled"
                  description="A clear day. Use it to finish something, or block focus time on purpose."
                  compact
                  className="border-0 bg-transparent"
                />
              ) : (
                <ul className="space-y-2">
                  {dayEvents.map((event) => (
                    <AgendaEvent key={event.id} event={event} />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border/80 bg-card shadow-card">
            <header className="border-b border-border/70 px-4 py-3.5">
              <p className="eyebrow">Next up</p>
            </header>
            <ul className="divide-y divide-border/60">
              {upcoming.length === 0 ? (
                <li className="px-4 py-6 text-center text-[12px] text-muted-foreground">
                  No upcoming events.
                </li>
              ) : (
                upcoming.slice(0, 5).map((event) => {
                  const start = parseISO(event.start);
                  const meta = EVENT_TYPE_META[event.type];
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => pickDayAndShow(start)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                      >
                        <span className="flex w-9 shrink-0 flex-col items-center rounded-md border border-border/60 bg-surface py-1">
                          <span className="tnum text-[13px] leading-none font-semibold">
                            {format(start, "d")}
                          </span>
                          <span className="mt-0.5 font-mono text-[8px] tracking-[0.1em] text-muted-foreground uppercase">
                            {format(start, "MMM")}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium">
                            {event.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                            {event.allDay ? "All day" : formatTime(event.start)} · {meta.label}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MonthGrid({
  anchor,
  monthDays,
  events,
  selected,
  onPick,
  onMore,
  weekOpts,
}: {
  anchor: Date;
  monthDays: Date[];
  events: CalendarEvent[];
  selected: Date;
  onPick: (day: Date) => void;
  onMore: (day: Date) => void;
  weekOpts: { weekStartsOn: 0 | 1 };
}) {
  const weekdayStart = startOfWeek(anchor, weekOpts);
  const weekdayNames = Array.from({ length: 7 }, (_, index) =>
    format(addDays(weekdayStart, index), "EEE"),
  );

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border/70 bg-surface/50">
        {weekdayNames.map((name) => (
          <div
            key={name}
            className="px-2 py-2 text-center font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase"
          >
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthDays.map((day, index) => {
          const inMonth = isSameMonth(day, anchor);
          const dayEvents = eventsOnDay(events, day);
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visible.length;
          const isSelected = isSameDay(day, selected);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-20 border-b border-r border-border/50 p-1.5 sm:min-h-24",
                (index + 1) % 7 === 0 && "border-r-0",
                !inMonth && "bg-muted/20",
              )}
            >
              <button
                type="button"
                onClick={() => onPick(day)}
                aria-pressed={isSelected}
                aria-label={format(day, "EEEE, d MMMM")}
                className={cn(
                  "tnum flex size-6 items-center justify-center rounded-md text-[11px] transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : today
                      ? "font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted",
                  !inMonth && "opacity-55",
                )}
              >
                {format(day, "d")}
              </button>

              <ul className="mt-1 space-y-0.5">
                {visible.map((event) => {
                  const meta = EVENT_TYPE_META[event.type];
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => onPick(day)}
                        className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/70"
                        title={event.title}
                      >
                        <span
                          aria-hidden="true"
                          className="size-1 shrink-0 rounded-full"
                          style={{ backgroundColor: toneVar(meta.tone) }}
                        />
                        <span className="truncate text-[9px] leading-tight font-medium">
                          {event.allDay ? "" : `${formatTime(event.start)} `}
                          {event.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {overflow > 0 ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => onMore(day)}
                      className="w-full rounded-md px-1 text-left font-mono text-[8.5px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                    >
                      +{overflow} more
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  weekDays,
  events,
  selected,
  onPick,
  onOpenDay,
}: {
  weekDays: Date[];
  events: CalendarEvent[];
  selected: Date;
  onPick: (day: Date) => void;
  onOpenDay: (day: Date) => void;
}) {
  return (
    <div className="grid grid-cols-7 divide-x divide-border/60 overflow-x-auto">
      {weekDays.map((day) => {
        const dayEvents = eventsOnDay(events, day);
        const isSelected = isSameDay(day, selected);
        const today = isToday(day);

        return (
          <div key={day.toISOString()} className="min-w-[116px]">
            <button
              type="button"
              onClick={() => onOpenDay(day)}
              className={cn(
                "flex w-full items-center justify-between border-b border-border/70 px-2 py-2 transition-colors hover:bg-muted/40",
                isSelected && "bg-primary/5",
              )}
            >
              <span className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
                {format(day, "EEE")}
              </span>
              <span
                className={cn(
                  "tnum flex size-6 items-center justify-center rounded-md text-[12px]",
                  today ? "bg-primary font-semibold text-primary-foreground" : "text-foreground",
                )}
              >
                {format(day, "d")}
              </span>
            </button>
            <ul className="space-y-1 p-1.5">
              {dayEvents.length === 0 ? (
                <li className="px-1 pt-3 text-center font-mono text-[8.5px] text-muted-foreground/50 uppercase">
                  —
                </li>
              ) : (
                dayEvents.map((event) => {
                  const meta = EVENT_TYPE_META[event.type];
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => onPick(day)}
                        className="w-full rounded-md border border-border/60 bg-surface px-1.5 py-1.5 text-left transition-colors hover:border-border hover:bg-muted/50"
                        title={event.title}
                      >
                        <span className="flex items-center gap-1 font-mono text-[8.5px] text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="size-1 rounded-full"
                            style={{ backgroundColor: toneVar(meta.tone) }}
                          />
                          {event.allDay ? "All day" : formatTime(event.start)}
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-[10px] leading-snug font-medium">
                          {event.title}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function DayTimeline({
  day,
  events,
  state,
}: {
  day: Date;
  events: CalendarEvent[];
  state: ReturnType<typeof useWorkspaceStore.getState>;
}) {
  const allDay = events.filter((event) => event.allDay);
  const timed = events.filter((event) => !event.allDay);

  return (
    <div className="p-4">
      <p className="eyebrow">{format(day, "EEEE, d MMMM")}</p>
      {events.length === 0 ? (
        <div className="py-10">
          <EmptyState
            icon={CalendarDaysIcon}
            title="Nothing scheduled"
            description="Take the day, or deliberately block focus time before someone else does."
            compact
            className="border-0 bg-transparent"
          />
        </div>
      ) : (
        <>
          {allDay.length > 0 ? (
            <div className="mt-4">
              <p className="eyebrow mb-2">All day</p>
              <ul className="space-y-1.5">
                {allDay.map((event) => (
                  <DayEventRow key={event.id} event={event} state={state} />
                ))}
              </ul>
            </div>
          ) : null}
          {timed.length > 0 ? (
            <div className="mt-4">
              {allDay.length > 0 ? <p className="eyebrow mb-2">Scheduled</p> : null}
              <ul className="space-y-1.5">
                {timed.map((event) => (
                  <DayEventRow key={event.id} event={event} state={state} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function DayEventRow({
  event,
  state,
}: {
  event: CalendarEvent;
  state: ReturnType<typeof useWorkspaceStore.getState>;
}) {
  const meta = EVENT_TYPE_META[event.type];
  const attendees = event.attendeeIds
    .map((id) => state.members[id])
    .filter((member): member is NonNullable<typeof member> => Boolean(member));
  const project = event.projectId ? state.projects[event.projectId] : null;

  return (
    <li className="flex items-stretch gap-3">
      <div className="flex w-12 shrink-0 flex-col items-end pt-2">
        <span className="tnum font-mono text-[11px] font-medium">
          {event.allDay ? "All" : formatTime(event.start)}
        </span>
        {!event.allDay ? (
          <span className="tnum font-mono text-[9px] text-muted-foreground">
            {formatTime(event.end)}
          </span>
        ) : null}
      </div>
      <div
        className="min-w-0 flex-1 rounded-lg border border-border/70 border-l-2 bg-surface px-3 py-2.5"
        style={{ borderLeftColor: toneVar(meta.tone) }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill label={meta.label} tone={meta.tone} />
          {project ? (
            <span className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
              {project.key}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[13px] leading-snug font-medium">{event.title}</p>
        {event.description ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {event.description}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {event.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-3" aria-hidden="true" />
              {event.location}
            </span>
          ) : null}
          {!event.allDay ? (
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3" aria-hidden="true" />
              {formatTime(event.start)} – {formatTime(event.end)}
            </span>
          ) : null}
          {attendees.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <UsersIcon className="size-3" aria-hidden="true" />
              {attendees.length}
            </span>
          ) : null}
        </div>
        {attendees.length > 0 ? (
          <div className="mt-2 flex -space-x-1.5">
            {attendees.slice(0, 6).map((member) => (
              <EntityAvatar
                key={member.id}
                name={member.name}
                hue={member.avatarHue}
                size="xs"
                ring
              />
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function AgendaEvent({ event }: { event: CalendarEvent }) {
  const state = useWorkspaceStore();
  const [confirming, setConfirming] = useState(false);
  const meta = EVENT_TYPE_META[event.type];

  return (
    <li className="rounded-lg border border-border/70 bg-surface">
      <Popover onOpenChange={(open) => !open && setConfirming(false)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-muted/40 rounded-lg"
          >
            <span
              aria-hidden="true"
              className="mt-1.5 size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: toneVar(meta.tone) }}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12px] font-medium">{event.title}</span>
                <span className="tnum shrink-0 font-mono text-[9.5px] text-muted-foreground">
                  {event.allDay ? "All day" : formatTime(event.start)}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                {meta.label}
                {event.location ? ` · ${event.location}` : ""}
              </span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <p className="eyebrow">{meta.label}</p>
          <p className="mt-1.5 text-[13px] leading-snug font-medium">{event.title}</p>
          {event.description ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          ) : null}
          <dl className="mt-2 space-y-1 text-[10.5px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ClockIcon className="size-3" aria-hidden="true" />
              {event.allDay
                ? "All day"
                : `${formatTime(event.start)} – ${formatTime(event.end)}`}
            </div>
            {event.location ? (
              <div className="flex items-center gap-1.5">
                <MapPinIcon className="size-3" aria-hidden="true" />
                {event.location}
              </div>
            ) : null}
          </dl>
          <div className="mt-3 border-t border-border/60 pt-2.5">
            {confirming ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-muted-foreground">Delete this event?</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>
                    Keep
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-danger hover:text-danger"
                    onClick={() => state.deleteEvent(event.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
              >
                <Trash2Icon className="size-3" aria-hidden="true" />
                Delete event
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </li>
  );
}

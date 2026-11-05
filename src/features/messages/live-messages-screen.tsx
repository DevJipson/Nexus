"use client";

/**
 * Live Messages (Phase 4) — backed by the NEXUS server (`server/`) when
 * `NEXT_PUBLIC_NEXUS_API_URL` is set. Same information architecture as the
 * local demo screen: two-pane threads, day separation, unread receipts.
 * Everything here is server-authoritative; nothing touches localStorage.
 */
import { useEffect, useRef, useState } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import {
  AtSignIcon,
  CheckIcon,
  ChevronLeftIcon,
  FolderIcon,
  HashIcon,
  Loader2Icon,
  MessagesSquareIcon,
  SearchIcon,
  SearchXIcon,
  SendHorizontalIcon,
  UsersRoundIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { pluralize, relativeTime } from "@/lib/format";
import { useLiveMessages, type LiveConversation } from "@/lib/live-messages";
import type { Member } from "@/types/domain";

export function LiveMessagesScreen() {
  const status = useLiveMessages((state) => state.status);

  useEffect(() => {
    void useLiveMessages.getState().bootstrap();
  }, []);

  if (status === "idle" || status === "loading") {
    return <Centered>Loading your threads…</Centered>;
  }
  if (status === "error") {
    return <CenteredError />;
  }
  if (status === "anonymous") {
    return <SignInPanel />;
  }
  return <TwoPanes />;
}

/* ------------------------------------------------------------- sign-in */

function SignInPanel() {
  const signIn = useLiveMessages((state) => state.signIn);
  const error = useLiveMessages((state) => state.error);
  const [email, setEmail] = useState("maya@nexus.studio");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex h-full min-h-[540px] items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card p-6 shadow-card">
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">NEXUS · Sign in</p>
        <h1 className="mt-1.5 text-[19px] font-semibold">Live on the backend</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Messages sync with the NEXUS server in real time. Sign in with a seeded demo account —
          the local demo stays available by unsetting <code className="font-mono">NEXT_PUBLIC_NEXUS_API_URL</code>.
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitting(true);
            void signIn(email, password).finally(() => setSubmitting(false));
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="live-email" className="text-[11px] font-medium">Email</label>
            <Input
              id="live-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="live-password" className="text-[11px] font-medium">Password</label>
            <Input
              id="live-password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="nexus-demo-2026"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-9"
            />
          </div>
          {error ? <p role="alert" className="text-[11.5px] text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2Icon className="size-4 animate-spin" /> : <MessagesSquareIcon className="size-4" />}
            Sign in &amp; sync
          </Button>
        </form>
        <p className="mt-4 border-t border-border/60 pt-3 font-mono text-[9px] leading-relaxed tracking-wide text-muted-foreground/80 uppercase">
          Demo account: maya@nexus.studio · nexus-demo-2026
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ two panes */

function conversationTitle(conversation: LiveConversation, members: Member[], meId: string | undefined): string {
  if (conversation.kind === "group") return conversation.name ?? "Group thread";
  const others = conversation.participantIds
    .filter((id) => id !== meId)
    .map((id) => members.find((member) => member.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  return others.length > 0 ? others.join(" & ") : "Direct thread";
}

function TwoPanes() {
  const me = useLiveMessages((state) => state.me);
  const workspaces = useLiveMessages((state) => state.workspaces);
  const workspaceId = useLiveMessages((state) => state.workspaceId);
  const selectWorkspace = useLiveMessages((state) => state.selectWorkspace);
  const members = useLiveMessages((state) => state.members);
  const conversations = useLiveMessages((state) => state.conversations);
  const selectedId = useLiveMessages((state) => state.selectedId);
  const openConversation = useLiveMessages((state) => state.openConversation);
  const signOut = useLiveMessages((state) => state.signOut);

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "direct" | "group">("all");
  const [threadOpen, setThreadOpen] = useState(false);

  const needle = query.trim().toLowerCase();
  const filtered = conversations.filter((conversation) => {
    if (kindFilter !== "all" && conversation.kind !== kindFilter) return false;
    if (!needle) return true;
    const title = conversationTitle(conversation, members, me?.id);
    const body = conversation.lastMessage?.body ?? "";
    return `${title} ${body}`.toLowerCase().includes(needle);
  });

  const active = conversations.find((conversation) => conversation.id === selectedId) ?? filtered[0] ?? null;
  const unreadTotal = conversations.reduce((sum, conversation) => sum + (conversation.unread > 0 ? 1 : 0), 0);

  // Keep the selected thread in sync when the user picks on desktop.
  const open = (id: string) => {
    setThreadOpen(true);
    void openConversation(id);
  };

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] min-h-[540px] flex-col gap-4">
      <PageHeader
        eyebrow="Collaboration · Live"
        title="Context, in threads."
        description="Direct and project conversations that stay attached to the work — syncing with the NEXUS server in real time."
        actions={
          <div className="flex items-center gap-2">
            {workspaces.length > 1 ? (
              <Select value={workspaceId ?? ""} onValueChange={(value) => void selectWorkspace(value)}>
                <SelectTrigger className="h-8 w-40 text-[12px]" aria-label="Workspace">
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id} className="text-[12px]">
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <NewConversationDialog onCreated={open} />
            <Button variant="ghost" size="sm" onClick={() => void signOut()} className="text-muted-foreground">
              Sign out
            </Button>
          </div>
        }
        meta={
          <span className="text-[11.5px] text-muted-foreground">
            {conversations.length} threads · {unreadTotal} unread
          </span>
        }
        className="shrink-0 border-b-0 pb-0 sm:items-center"
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)]">
        {/* ------------------------------------------------------------ sidebar */}
        <section
          aria-label="Conversations"
          className={cn(
            "min-h-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-card",
            threadOpen ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="space-y-2 border-b border-border/70 p-2.5">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search conversations…"
                aria-label="Search conversations"
                className="h-8 bg-surface pl-8 text-[12px]"
              />
            </div>
            <ToggleGroup
              type="single"
              value={kindFilter}
              onValueChange={(value) => value && setKindFilter(value as typeof kindFilter)}
              aria-label="Filter conversations"
              className="w-full"
            >
              <ToggleGroupItem value="all" className="h-7 flex-1 text-[11px]">All</ToggleGroupItem>
              <ToggleGroupItem value="direct" className="h-7 flex-1 gap-1.5 text-[11px]">
                <AtSignIcon className="size-3" />
                Direct
              </ToggleGroupItem>
              <ToggleGroupItem value="group" className="h-7 flex-1 gap-1.5 text-[11px]">
                <HashIcon className="size-3" />
                Group
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <ul className="no-scrollbar min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="p-4">
                <EmptyState
                  icon={SearchXIcon}
                  title="No conversations match"
                  description="Try a different search or filter."
                  compact
                  className="border-0 bg-transparent"
                />
              </li>
            ) : (
              filtered.map((conversation) => {
                const title = conversationTitle(conversation, members, me?.id);
                const last = conversation.lastMessage;
                const activeRow = active?.id === conversation.id;
                const unread = conversation.unread > 0;
                const others = conversation.participantIds
                  .filter((id) => id !== me?.id)
                  .map((id) => members.find((member) => member.id === id))
                  .filter((member): member is Member => Boolean(member));

                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => open(conversation.id)}
                      aria-current={activeRow ? "true" : undefined}
                      className={cn(
                        "flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors",
                        activeRow ? "bg-primary/6" : "hover:bg-muted/40",
                      )}
                    >
                      <span className="relative mt-0.5 shrink-0">
                        {conversation.kind === "direct" && others[0] ? (
                          <EntityAvatar
                            name={others[0].name}
                            hue={others[0].avatarHue}
                            size="md"
                            presence={others[0].presence}
                          />
                        ) : (
                          <span className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-surface font-mono text-[10px] font-semibold text-muted-foreground">
                            {conversation.name
                              ?.split(/\s+/)
                              .slice(0, 2)
                              .map((word) => word.charAt(0))
                              .join("")
                              .toUpperCase() ?? "#"}
                          </span>
                        )}
                        {unread ? (
                          <span
                            aria-label={`${conversation.unread} unread`}
                            className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn("truncate text-[12px]", unread ? "font-semibold" : "font-medium")}>
                            {title}
                          </span>
                          <span className="shrink-0 font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
                            {last ? relativeTime(last.createdAt) : ""}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-muted-foreground">
                            {last ? last.body : "No messages yet"}
                          </span>
                          {unread ? (
                            <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 font-mono text-[9px] font-semibold text-primary-foreground">
                              {conversation.unread}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        {/* ------------------------------------------------------------ thread */}
        <section
          aria-label="Conversation thread"
          className={cn(
            "min-h-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-card",
            threadOpen ? "flex" : "hidden lg:flex",
          )}
        >
          {active ? (
            <LiveThread key={active.id} conversation={active} onBack={() => setThreadOpen(false)} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={MessagesSquareIcon}
                title="No conversation yet"
                description="Start a thread with the team — it stays attached to the work, synced to the server."
                action={<NewConversationDialog onCreated={open} />}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- thread */

function LiveThread({ conversation, onBack }: { conversation: LiveConversation; onBack: () => void }) {
  const me = useLiveMessages((state) => state.me);
  const members = useLiveMessages((state) => state.members);
  const openConversation = useLiveMessages((state) => state.openConversation);
  const messages = useLiveMessages((state) => state.messagesById[conversation.id]);
  const send = useLiveMessages((state) => state.send);
  const noteTyping = useLiveMessages((state) => state.noteTyping);
  const typing = useLiveMessages((state) => state.typing[conversation.id]);
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  const myId = me?.id;
  const title = conversationTitle(conversation, members, myId);
  const participants = conversation.participantIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is Member => Boolean(member));

  // Load the thread on mount / switch (remounts on conversation change via key).
  useEffect(() => {
    void openConversation(conversation.id);
  }, [conversation.id, openConversation]);

  // Expiry tick for typing hints.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const messageCount = messages?.length ?? 0;
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messageCount, conversation.id]);

  const typingNames = Object.entries(typing ?? {})
    .filter(([userId, until]) => until > now && userId !== myId)
    .map(([userId]) => members.find((member) => member.id === userId)?.name.split(" ")[0])
    .filter((name): name is string => Boolean(name));

  const sendDraft = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    noteTyping(false);
    void send(body);
  };

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 border-b border-border/70 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        >
          <ChevronLeftIcon className="size-4" />
        </button>

        <div className="flex shrink-0 -space-x-1.5">
          {participants.slice(0, 3).map((member) => (
            <EntityAvatar key={member.id} name={member.name} hue={member.avatarHue} size="sm" presence={member.presence} ring />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[13.5px] leading-tight font-medium">{title}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>{conversation.kind === "direct" ? "Direct message" : pluralize(participants.length, "participant")}</span>
            {conversation.projectId ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono tracking-[0.1em] uppercase">
                  <FolderIcon className="size-2.5" aria-hidden="true" />
                  Project thread
                </span>
              </>
            ) : null}
          </p>
        </div>

        <span className="hidden shrink-0 font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase sm:block">
          {conversation.kind === "group" ? "Group thread" : "Direct thread"}
        </span>
      </header>

      <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto bg-surface/30 px-3 py-4 sm:px-5">
        <DaySeparatedMessages messages={messages} myId={myId} members={members} />
        {typingNames.length > 0 ? (
          <p className="px-1 pt-1 text-[11px] text-muted-foreground" aria-live="polite">
            {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
          </p>
        ) : null}
      </div>

      <div className="border-t border-border/70 bg-card p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border/80 bg-surface p-2 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25">
          <Textarea
            value={draft}
            rows={1}
            placeholder="Write a message — Enter to send, Shift+Enter for a new line"
            aria-label="Message composer"
            className="max-h-36 min-h-9 field-sizing-content flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-[13px] leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
            onChange={(event) => {
              setDraft(event.target.value);
              noteTyping(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                sendDraft();
              }
            }}
            onBlur={() => noteTyping(false)}
          />
          <Button size="icon" aria-label="Send message" disabled={!draft.trim()} onClick={sendDraft}>
            <SendHorizontalIcon className="size-4" />
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-right font-mono text-[8.5px] tracking-[0.14em] text-muted-foreground/60 uppercase">
          Live on the NEXUS backend · syncs over Socket.IO
        </p>
      </div>
    </>
  );
}

function DaySeparatedMessages({
  messages,
  myId,
  members,
}: {
  messages: { id: string; authorId: string; body: string; createdAt: string }[] | undefined;
  myId: string | undefined;
  members: Member[];
}) {
  if (!messages) {
    return <p className="p-4 text-center text-[11px] text-muted-foreground">Loading messages…</p>;
  }
  if (messages.length === 0) {
    return (
      <p className="p-6 text-center text-[12px] text-muted-foreground">No messages yet — say hello.</p>
    );
  }

  // Day separators, mirroring the local demo screen.
  const rows: Array<{ dayLabel: string | null; message: (typeof messages)[number] }> = [];
  let lastDayKey = "";
  for (const message of messages) {
    const day = parseISO(message.createdAt);
    const dayKey = format(day, "yyyy-MM-dd");
    let dayLabel: string | null = null;
    if (dayKey !== lastDayKey) {
      dayLabel = isToday(day) ? "Today" : isYesterday(day) ? "Yesterday" : format(day, "EEEE, d MMMM");
      lastDayKey = dayKey;
    }
    rows.push({ dayLabel, message });
  }

  return (
    <>
      {rows.map(({ dayLabel, message }) => {
        const author = members.find((member) => member.id === message.authorId);
        const own = message.authorId === myId;
        return (
          <div key={message.id}>
            {dayLabel ? (
              <div className="py-2 text-center">
                <span className="inline-flex items-center rounded-full border border-border/60 bg-card px-2.5 py-1 font-mono text-[8.5px] tracking-[0.14em] text-muted-foreground uppercase shadow-card">
                  {dayLabel}
                </span>
              </div>
            ) : null}
            <div className={cn("flex items-end gap-2 py-1", own && "flex-row-reverse")}>
              {!own ? (
                <EntityAvatar
                  name={author?.name ?? "Unknown"}
                  hue={author?.avatarHue ?? 264}
                  size="xs"
                  presence={author?.presence}
                  className="mb-0.5"
                />
              ) : (
                <span aria-hidden="true" className="w-6" />
              )}
              <div className={cn("max-w-[78%] sm:max-w-[68%]", own && "text-right")}>
                <div
                  className={cn(
                    "inline-block rounded-2xl px-3.5 py-2 text-left text-[13px] leading-relaxed shadow-card",
                    own
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-border/70 bg-card",
                  )}
                >
                  {!own ? (
                    <span className="mb-0.5 block font-mono text-[8.5px] tracking-[0.12em] text-muted-foreground uppercase">
                      {author?.name ?? "Unknown"}
                    </span>
                  ) : null}
                  {message.body}
                </div>
                <p className="mt-1 px-1 font-mono text-[8.5px] text-muted-foreground/60">
                  {format(parseISO(message.createdAt), "HH:mm")}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------- new conversation */

function NewConversationDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const me = useLiveMessages((state) => state.me);
  const members = useLiveMessages((state) => state.members);
  const createConversation = useLiveMessages((state) => state.createConversation);
  const creating = useLiveMessages((state) => state.creating);
  const error = useLiveMessages((state) => state.error);

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"direct" | "group">("direct");
  const [name, setName] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const candidates = members.filter((member) => member.id !== me?.id);
  const toggle = (id: string) =>
    setSelected((current) => {
      if (kind === "direct") return current.includes(id) ? [] : [id];
      return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    });

  const canSubmit =
    selected.length > 0 && (kind === "direct" ? selected.length === 1 : name.trim().length >= 2) && !creating;

  const reset = () => {
    setKind("direct");
    setName("");
    setFirstMessage("");
    setSelected([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UsersRoundIcon className="size-4" />
          New conversation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            {kind === "direct"
              ? "A direct line to one teammate. It dedupes — repeats open the existing thread."
              : "A named group thread. Everyone selected can read and write."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ToggleGroup
            type="single"
            value={kind}
            onValueChange={(value) => value && setKind(value as "direct" | "group")}
            className="w-full"
            aria-label="Conversation kind"
          >
            <ToggleGroupItem value="direct" className="h-8 flex-1 text-[12px]">
              <AtSignIcon className="size-3.5" />
              Direct
            </ToggleGroupItem>
            <ToggleGroupItem value="group" className="h-8 flex-1 text-[12px]">
              <HashIcon className="size-3.5" />
              Group
            </ToggleGroupItem>
          </ToggleGroup>

          {kind === "group" ? (
            <div className="space-y-1.5">
              <label htmlFor="live-group-name" className="text-[11px] font-medium">Group name</label>
              <Input
                id="live-group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Launch war room"
                className="h-9"
              />
            </div>
          ) : null}

          <fieldset className="space-y-1.5">
            <legend className="text-[11px] font-medium">Participants ({selected.length} selected)</legend>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border/70 p-1">
              {candidates.map((member) => {
                const checked = selected.includes(member.id);
                return (
                  <label
                    key={member.id}
                    htmlFor={`live-member-${member.id}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50",
                      checked && "bg-primary/5",
                    )}
                  >
                    <Checkbox
                      id={`live-member-${member.id}`}
                      checked={checked}
                      onCheckedChange={() => toggle(member.id)}
                    />
                    <EntityAvatar name={member.name} hue={member.avatarHue} size="xs" presence={member.presence} />
                    <span className="min-w-0 flex-1 truncate text-[12px]">{member.name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="live-first-message" className="text-[11px] font-medium">First message (optional)</label>
            <Textarea
              id="live-first-message"
              rows={2}
              value={firstMessage}
              onChange={(event) => setFirstMessage(event.target.value)}
              placeholder="Kick things off…"
              className="resize-none"
            />
          </div>

          {error ? <p role="alert" className="text-[11.5px] text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            disabled={!canSubmit}
            onClick={() => {
              const trimmed = firstMessage.trim();
              void createConversation({
                kind,
                name: kind === "group" ? name.trim() : undefined,
                participantIds: selected,
                ...(trimmed ? { firstMessage: trimmed } : {}),
              }).then((id) => {
                if (id) {
                  onCreated(id);
                  setOpen(false);
                  reset();
                }
              });
            }}
          >
            {creating ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
            Start conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-9.5rem)] min-h-[540px] items-center justify-center p-6">
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        {children}
      </p>
    </div>
  );
}

function CenteredError() {
  const error = useLiveMessages((state) => state.error);
  const bootstrap = useLiveMessages((state) => state.bootstrap);
  return (
    <div className="flex h-[calc(100dvh-9.5rem)] min-h-[540px] items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card p-6 text-center shadow-card">
        <h2 className="text-[15px] font-semibold">Can&apos;t reach the NEXUS API</h2>
        <p className="mt-1.5 text-[12px] text-muted-foreground">{error ?? "Unknown error."}</p>
        <Button className="mt-4 w-full" onClick={() => void bootstrap()}>Try again</Button>
      </div>
    </div>
  );
}

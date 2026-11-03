"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import {
  AtSignIcon,
  ChevronLeftIcon,
  FolderIcon,
  HashIcon,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { conversationTitle, lastMessage, workspaceConversations } from "@/lib/selectors";
import { pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useComposeStore } from "@/store/compose-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Conversation } from "@/types/domain";

export function MessagesScreen() {
  const state = useWorkspaceStore();
  const openComposer = useComposeStore((store) => store.open);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "direct" | "group">("all");
  const [draft, setDraft] = useState("");
  const [threadOpen, setThreadOpen] = useState(false);

  const conversationList = workspaceConversations(state, state.activeWorkspaceId);
  const needle = query.trim().toLowerCase();

  const filtered = conversationList.filter((conversation) => {
    if (kindFilter !== "all" && conversation.kind !== kindFilter) return false;
    if (!needle) return true;
    const title = conversationTitle(conversation, state, state.currentUserId);
    const participants = conversation.participantIds
      .map((id) => state.members[id]?.name ?? "")
      .join(" ");
    const last = lastMessage(conversation)?.body ?? "";
    return `${title} ${participants} ${last}`.toLowerCase().includes(needle);
  });

  const activeConversation =
    conversationList.find((conversation) => conversation.id === selectedId) ??
    filtered[0] ??
    conversationList[0] ??
    null;

  const unreadIn = (conversation: Conversation) => {
    const last = lastMessage(conversation);
    return Boolean(
      last &&
        last.authorId !== state.currentUserId &&
        last.createdAt.localeCompare(conversation.lastReadAt) > 0,
    );
  };

  // Persist read receipts when a conversation becomes visible or gains a message.
  const activeConversationId = activeConversation?.id ?? null;
  const lastMessageId = activeConversation
    ? lastMessage(activeConversation)?.id ?? null
    : null;

  useEffect(() => {
    if (!activeConversationId || !lastMessageId) return;
    const latest = useWorkspaceStore.getState();
    const conversation = latest.conversations[activeConversationId];
    const last = conversation ? lastMessage(conversation) : null;
    if (
      conversation &&
      last &&
      last.authorId !== latest.currentUserId &&
      last.createdAt.localeCompare(conversation.lastReadAt) > 0
    ) {
      latest.markConversationRead(activeConversationId);
    }
  }, [activeConversationId, lastMessageId]);

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setThreadOpen(true);
  };

  const sendDraft = () => {
    const body = draft.trim();
    if (!body || !activeConversation) return;
    state.sendMessage(activeConversation.id, state.currentUserId, body);
    setDraft("");
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCount = activeConversation?.messages.length ?? 0;
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messageCount, activeConversation?.id]);

  const unreadTotal = conversationList.filter(unreadIn).length;

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] min-h-[540px] flex-col gap-4">
      <PageHeader
        eyebrow="Collaboration"
        title="Context, in threads."
        description="Direct and project conversations that stay attached to the work — searchable, persistent and local to this browser."
        actions={
          <Button onClick={() => openComposer("conversation")}>
            <UsersRoundIcon className="size-4" />
            New conversation
          </Button>
        }
        meta={
          <span className="text-[11.5px] text-muted-foreground">
            {conversationList.length} threads · {unreadTotal} unread
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
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
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
                const title = conversationTitle(conversation, state, state.currentUserId);
                const last = lastMessage(conversation);
                const active = activeConversation?.id === conversation.id;
                const unread = unreadIn(conversation);
                const project = conversation.projectId
                  ? state.projects[conversation.projectId]
                  : null;
                const other = conversation.participantIds
                  .filter((id) => id !== state.currentUserId)
                  .map((id) => state.members[id])
                  .filter((member): member is NonNullable<typeof member> => Boolean(member));

                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(conversation.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors",
                        active ? "bg-primary/6" : "hover:bg-muted/40",
                      )}
                    >
                      <span className="relative mt-0.5 shrink-0">
                        {conversation.kind === "direct" && other[0] ? (
                          <EntityAvatar
                            name={other[0].name}
                            hue={other[0].avatarHue}
                            size="md"
                            presence={other[0].presence}
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
                            aria-label="Unread"
                            className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-[12px]",
                              unread ? "font-semibold" : "font-medium",
                            )}
                          >
                            {title}
                          </span>
                          <span className="shrink-0 font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
                            {last ? relativeTime(last.createdAt) : ""}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {last ? last.body : "No messages yet"}
                        </span>
                        {project ? (
                          <span className="mt-1 inline-flex items-center gap-1 font-mono text-[8.5px] tracking-[0.12em] text-muted-foreground/80 uppercase">
                            <FolderIcon className="size-2.5" aria-hidden="true" />
                            {project.key}
                          </span>
                        ) : null}
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
          {activeConversation ? (
            <>
              <ThreadHeader
                conversation={activeConversation}
                onBack={() => setThreadOpen(false)}
              />
              <div
                ref={scrollRef}
                className="no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto bg-surface/30 px-3 py-4 sm:px-5"
              >
                <DaySeparatedMessages conversation={activeConversation} />
              </div>
              <div className="border-t border-border/70 bg-card p-3">
                <div className="flex items-end gap-2 rounded-xl border border-border/80 bg-surface p-2 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        sendDraft();
                      }
                    }}
                    rows={1}
                    placeholder="Write a message — Enter to send, Shift+Enter for a new line"
                    aria-label="Message composer"
                    className="max-h-36 min-h-9 field-sizing-content flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-[13px] leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
                  />
                  <Button
                    size="icon"
                    aria-label="Send message"
                    disabled={!draft.trim()}
                    onClick={sendDraft}
                  >
                    <SendHorizontalIcon className="size-4" />
                  </Button>
                </div>
                <p className="mt-1.5 px-1 text-right font-mono text-[8.5px] tracking-[0.14em] text-muted-foreground/60 uppercase">
                  Local demo — messages persist in this browser only
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={MessagesSquareIcon}
                title="No conversation selected"
                description="Pick a thread on the left, or start a new one with the team."
                action={
                  <Button size="sm" onClick={() => openComposer("conversation")}>
                    <UsersRoundIcon className="size-4" />
                    New conversation
                  </Button>
                }
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ThreadHeader({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack: () => void;
}) {
  const state = useWorkspaceStore();
  const title = conversationTitle(conversation, state, state.currentUserId);
  const project = conversation.projectId ? state.projects[conversation.projectId] : null;
  const participants = conversation.participantIds
    .map((id) => state.members[id])
    .filter((member): member is NonNullable<typeof member> => Boolean(member));

  return (
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
          <EntityAvatar key={member.id} name={member.name} hue={member.avatarHue} size="sm" ring />
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[13.5px] leading-tight font-medium">{title}</h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{conversation.kind === "direct" ? "Direct message" : pluralize(participants.length, "participant")}</span>
          {project ? (
            <>
              <span aria-hidden="true">·</span>
              <Link
                href={`/projects/${project.id}`}
                className="inline-flex items-center gap-1 font-mono tracking-[0.1em] uppercase underline-offset-2 hover:text-foreground hover:underline"
              >
                <FolderIcon className="size-2.5" aria-hidden="true" />
                {project.key}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <span className="hidden shrink-0 font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase sm:block">
        {conversation.kind === "group" ? "Group thread" : "Direct thread"}
      </span>
    </header>
  );
}

function DaySeparatedMessages({ conversation }: { conversation: Conversation }) {
  const state = useWorkspaceStore();
  const me = state.currentUserId;

  let lastDayKey = "";
  const rows: Array<{
    dayLabel: string | null;
    message: Conversation["messages"][number];
  }> = [];

  for (const message of conversation.messages) {
    const day = parseISO(message.createdAt);
    const dayKey = format(day, "yyyy-MM-dd");
    let dayLabel: string | null = null;
    if (dayKey !== lastDayKey) {
      dayLabel = isToday(day)
        ? "Today"
        : isYesterday(day)
          ? "Yesterday"
          : format(day, "EEEE, d MMMM");
      lastDayKey = dayKey;
    }
    rows.push({ dayLabel, message });
  }

  return (
    <>
      {rows.map(({ dayLabel, message }) => {
        const author = state.members[message.authorId];
        const own = message.authorId === me;

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

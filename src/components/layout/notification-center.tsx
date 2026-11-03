"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AtSignIcon,
  BellIcon,
  CheckCheckIcon,
  FolderIcon,
  InboxIcon,
  SparklesIcon,
  SquareCheckIcon,
  UsersIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { NotificationCategory } from "@/types/domain";

const CATEGORY_ICON: Record<NotificationCategory, typeof BellIcon> = {
  task: SquareCheckIcon,
  mention: AtSignIcon,
  project: FolderIcon,
  team: UsersIcon,
  system: SparklesIcon,
};

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const notificationsById = useWorkspaceStore((state) => state.notifications);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const notifications = Object.values(notificationsById)
    .filter((notification) => notification.workspaceId === activeWorkspaceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const unread = notifications.filter((notification) => !notification.read).length;

  const openNotification = (id: string, href: string | null) => {
    useWorkspaceStore.getState().markNotificationRead(id);
    setOpen(false);
    if (href) router.push(href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative text-muted-foreground"
        >
          <BellIcon className="size-4" aria-hidden="true" />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-2 right-2 flex size-3.5 items-center justify-center rounded-full bg-primary font-mono text-[8px] font-semibold text-primary-foreground ring-2 ring-background"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-2rem))] p-0">
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
          <div>
            <p className="eyebrow mb-1.5">Inbox</p>
            <p className="text-[13px] font-medium">Notifications</p>
          </div>
          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            <CheckCheckIcon className="size-3" />
            {unread} unread
          </span>
        </div>
        <Separator />

        {notifications.length === 0 ? (
          <div className="p-3">
            <EmptyState
              icon={InboxIcon}
              title="You're all caught up"
              description="Assignments, mentions and due-date reminders will appear here as your team works."
              compact
              className="border-0 bg-transparent px-3 py-7"
            />
          </div>
        ) : (
          <ul className="no-scrollbar max-h-[min(52vh,380px)] divide-y divide-border/60 overflow-y-auto">
            {notifications.map((notification) => {
              const Icon = CATEGORY_ICON[notification.category];
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(notification.id, notification.href)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border",
                        notification.read
                          ? "border-border/70 bg-surface text-muted-foreground"
                          : "border-primary/20 bg-primary/10 text-primary",
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            "min-w-0 flex-1 text-[12px] leading-snug",
                            notification.read ? "font-normal" : "font-medium",
                          )}
                        >
                          {notification.title}
                        </span>
                        {notification.read ? null : (
                          <span
                            aria-label="Unread"
                            className="mt-1 size-1.5 shrink-0 rounded-full bg-primary"
                          />
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {notification.body}
                      </span>
                      <span className="mt-0.5 block font-mono text-[9.5px] tracking-[0.08em] text-muted-foreground/70 uppercase">
                        {relativeTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <Separator />
        <div className="flex items-center justify-between gap-2 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={unread === 0}
            onClick={() =>
              useWorkspaceStore.getState().markAllNotificationsRead(activeWorkspaceId)
            }
          >
            <CheckCheckIcon className="size-3.5" />
            Mark all read
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
            <Link href="/settings" onClick={() => setOpen(false)}>
              Preferences
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

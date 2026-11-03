"use client";

import Link from "next/link";
import { BellIcon, CheckCheckIcon, InboxIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";

export function NotificationCenter() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative text-muted-foreground"
        >
          <BellIcon className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] p-0">
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
          <div>
            <p className="eyebrow mb-1.5">Inbox</p>
            <p className="text-[13px] font-medium">Notifications</p>
          </div>
          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            <CheckCheckIcon className="size-3" />
            0 unread
          </span>
        </div>
        <Separator />
        <div className="p-3">
          <EmptyState
            icon={InboxIcon}
            title="You're all caught up"
            description="Assignments, mentions and due-date reminders will appear here as your team works."
            compact
            className="border-0 bg-transparent px-3 py-7"
          />
        </div>
        <Separator />
        <div className="p-2">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" asChild>
            <Link href="/settings">
              Manage notification preferences
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

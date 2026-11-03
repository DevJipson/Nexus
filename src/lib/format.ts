import { format, formatDistanceToNowStrict, isToday, isYesterday, parseISO } from "date-fns";
import type { CSSProperties } from "react";
import type { Presence } from "@/types/domain";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function avatarTint(hue: number): CSSProperties {
  return { "--avatar-hue": String(hue) } as CSSProperties;
}

export function toDate(value: string): Date {
  return parseISO(value);
}

export function formatShortDate(value: string): string {
  return format(parseISO(value), "d MMM");
}

export function formatFullDate(value: string): string {
  return format(parseISO(value), "d MMM yyyy");
}

export function formatDateRange(start: string, end: string): string {
  return `${format(parseISO(start), "d MMM")} – ${format(parseISO(end), "d MMM yyyy")}`;
}

export function formatTime(value: string): string {
  return format(parseISO(value), "HH:mm");
}

export function relativeTime(value: string): string {
  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true });
}

export function formatDayLabel(value: Date): string {
  if (isToday(value)) return "Today";
  if (isYesterday(value)) return "Yesterday";
  return format(value, "EEE d MMM");
}

export const PRESENCE_LABEL: Record<Presence, string> = {
  online: "Online",
  away: "Away",
  offline: "Offline",
};

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

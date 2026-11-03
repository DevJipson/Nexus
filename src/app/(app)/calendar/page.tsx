import type { Metadata } from "next";
import { CalendarScreen } from "@/features/calendar/calendar-screen";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Meetings, deadlines, milestones and focus time on one timeline.",
};

export default function CalendarPage() {
  return <CalendarScreen />;
}

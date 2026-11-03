import type { Metadata } from "next";
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  UsersIcon,
} from "lucide-react";
import { ModulePreview } from "@/components/shared/module-preview";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Meetings, deadlines, milestones and focus time on one timeline.",
};

export default function CalendarPage() {
  return (
    <ModulePreview
      eyebrow="Workspace"
      title="Time, made legible."
      description="Meetings, deadlines, milestones and focus time on a single timeline — so the week is something you can read, not something that happens to you."
      moduleIcon={CalendarDaysIcon}
      note="The shell is ready for the calendar module. The next gate adds month, week and day views, event creation with attendees, and the agenda rail that keeps deadlines in view."
      capabilities={[
        {
          icon: CalendarDaysIcon,
          title: "Month, week & day",
          description:
            "Three zoom levels with a consistent event language for meetings, deadlines, milestones and focus.",
        },
        {
          icon: CalendarClockIcon,
          title: "Agenda & deadlines",
          description:
            "A running list of what is next, what is due, and what has just slipped.",
        },
        {
          icon: CalendarPlusIcon,
          title: "Create & invite",
          description:
            "Schedule an event, attach a project and invite teammates in a single flow.",
        },
        {
          icon: UsersIcon,
          title: "Team availability",
          description:
            "See attendees at a glance and keep time zones visible when planning across regions.",
        },
      ]}
    />
  );
}

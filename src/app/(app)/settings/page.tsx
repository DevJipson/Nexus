import type { Metadata } from "next";
import {
  BellIcon,
  DatabaseIcon,
  PaletteIcon,
  SettingsIcon,
  UserRoundIcon,
} from "lucide-react";
import { ModulePreview } from "@/components/shared/module-preview";

export const metadata: Metadata = {
  title: "Settings",
  description: "Shape NEXUS around how you and your team actually work.",
};

export default function SettingsPage() {
  return (
    <ModulePreview
      eyebrow="Settings"
      title="Make it yours."
      description="Shape NEXUS around how you and your team actually work — profile, workspace identity, appearance, notifications and local demo data."
      moduleIcon={SettingsIcon}
      note="Appearance, theme and sidebar preferences already persist in this build. The next gate completes the settings surface: profile editing, workspace identity, notification controls and a full demo-data reset."
      capabilities={[
        {
          icon: UserRoundIcon,
          title: "Profile",
          description:
            "Your name, title, location, time zone and presence, shared across workspaces.",
        },
        {
          icon: PaletteIcon,
          title: "Appearance",
          description:
            "Paper and Graphite themes, system matching, density and reduced motion.",
        },
        {
          icon: BellIcon,
          title: "Notifications",
          description:
            "Choose which assignments, mentions and due-date reminders reach you.",
        },
        {
          icon: DatabaseIcon,
          title: "Local data",
          description:
            "Inspect the demo dataset, export it, or reset everything to a clean seed.",
        },
      ]}
    />
  );
}

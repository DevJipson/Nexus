import type { Metadata } from "next";
import { SettingsScreen } from "@/features/settings/settings-screen";

export const metadata: Metadata = {
  title: "Settings",
  description: "Shape NEXUS around how you and your team actually work.",
};

export default function SettingsPage() {
  return <SettingsScreen />;
}

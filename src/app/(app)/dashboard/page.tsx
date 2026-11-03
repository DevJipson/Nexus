import type { Metadata } from "next";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "A calm overview of your workspace, your team and what matters next.",
};

export default function DashboardPage() {
  return <DashboardScreen />;
}

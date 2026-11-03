import type { Metadata } from "next";
import { TasksScreen } from "@/features/tasks/tasks-screen";

export const metadata: Metadata = {
  title: "My Tasks",
  description: "Everything assigned to you, across every project and status.",
};

export default function TasksPage() {
  return <TasksScreen />;
}

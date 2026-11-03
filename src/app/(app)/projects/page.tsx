import type { Metadata } from "next";
import { ProjectsScreen } from "@/features/projects/projects-screen";

export const metadata: Metadata = {
  title: "Projects",
  description: "Plan, track and close every body of work in one considered view.",
};

export default function ProjectsPage() {
  return <ProjectsScreen />;
}

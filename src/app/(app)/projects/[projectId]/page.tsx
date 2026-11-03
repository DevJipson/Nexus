import type { Metadata } from "next";
import { ProjectDetailScreen } from "@/features/projects/project-detail-screen";

export const metadata: Metadata = {
  title: "Project",
  description: "Progress, scope, team and activity for one body of work.",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectDetailScreen projectId={projectId} />;
}

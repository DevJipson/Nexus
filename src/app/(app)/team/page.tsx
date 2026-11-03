import type { Metadata } from "next";
import { TeamDirectory } from "@/features/team/team-directory";

export const metadata: Metadata = {
  title: "Team",
  description: "The people behind the work — roles, focus, presence and time zones.",
};

export default function TeamPage() {
  return <TeamDirectory />;
}

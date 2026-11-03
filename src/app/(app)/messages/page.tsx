import type { Metadata } from "next";
import { MessagesScreen } from "@/features/messages/messages-screen";

export const metadata: Metadata = {
  title: "Messages",
  description: "Conversations that stay attached to the work they are about.",
};

export default function MessagesPage() {
  return <MessagesScreen />;
}

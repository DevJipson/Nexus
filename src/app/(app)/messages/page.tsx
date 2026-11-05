import type { Metadata } from "next";
import { MessagesScreen } from "@/features/messages/messages-screen";
import { LiveMessagesScreen } from "@/features/messages/live-messages-screen";
import { isBackendEnabled } from "@/lib/api";

export const metadata: Metadata = {
  title: "Messages",
  description: "Conversations that stay attached to the work they are about.",
};

export default function MessagesPage() {
  return isBackendEnabled ? <LiveMessagesScreen /> : <MessagesScreen />;
}

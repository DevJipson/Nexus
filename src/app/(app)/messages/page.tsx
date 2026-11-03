import type { Metadata } from "next";
import {
  AtSignIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  PaperclipIcon,
} from "lucide-react";
import { ModulePreview } from "@/components/shared/module-preview";

export const metadata: Metadata = {
  title: "Messages",
  description: "Conversations that stay attached to the work they are about.",
};

export default function MessagesPage() {
  return (
    <ModulePreview
      eyebrow="Collaboration"
      title="Conversations with context."
      description="Direct threads and project conversations that stay attached to the work they are about — so decisions don't get lost in a separate app."
      moduleIcon={MessagesSquareIcon}
      note="The messaging shell is in place. The next gate adds the conversation list, threaded message pane, composer with mentions and attachments, and unread state that persists between visits."
      capabilities={[
        {
          icon: MessageCircleIcon,
          title: "Direct & project threads",
          description:
            "One-to-one conversations and group threads scoped to a project, side by side.",
        },
        {
          icon: AtSignIcon,
          title: "Mentions & unread",
          description:
            "Clear unread markers and mention highlights, with last-read positions saved locally.",
        },
        {
          icon: PaperclipIcon,
          title: "Rich composer",
          description:
            "Attach files, reference tasks and send with a keyboard-first composer.",
        },
      ]}
    />
  );
}

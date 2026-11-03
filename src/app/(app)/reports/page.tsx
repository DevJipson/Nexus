import type { Metadata } from "next";
import {
  ChartNoAxesColumnIcon,
  TargetIcon,
  TimerIcon,
  TrendingUpIcon,
} from "lucide-react";
import { ModulePreview } from "@/components/shared/module-preview";

export const metadata: Metadata = {
  title: "Reports",
  description: "Delivery health, throughput and workload — evidence, not guesswork.",
};

export default function ReportsPage() {
  return (
    <ModulePreview
      eyebrow="Insights"
      title="Evidence, not guesswork."
      description="Delivery health, throughput and workload, derived directly from your tasks and projects — so the picture is always current, never a separate spreadsheet."
      moduleIcon={ChartNoAxesColumnIcon}
      note="Reporting depends on live task data, so it lands after the task and project modules. The charts below will be computed from the store — never hardcoded — and share one visual language with the rest of NEXUS."
      capabilities={[
        {
          icon: TrendingUpIcon,
          title: "Delivery throughput",
          description:
            "Completed work over time, with a clear distinction between shipped and in-flight.",
        },
        {
          icon: TimerIcon,
          title: "Cycle & lead time",
          description:
            "How long work takes from idea to done, and where it waits the longest.",
        },
        {
          icon: TargetIcon,
          title: "Workload balance",
          description:
            "Assigned work per person, so capacity problems are visible before they bite.",
        },
      ]}
    />
  );
}

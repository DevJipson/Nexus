import type { Metadata } from "next";
import { ReportsScreen } from "@/features/reports/reports-screen";

export const metadata: Metadata = {
  title: "Reports",
  description: "Delivery health, throughput and workload — evidence, not guesswork.",
};

export default function ReportsPage() {
  return <ReportsScreen />;
}

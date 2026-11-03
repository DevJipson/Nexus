import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NEXUS — Calm project management",
    template: "%s · NEXUS",
  },
  applicationName: "NEXUS",
  description:
    "NEXUS is a quiet, considered workspace for planning projects, tracking tasks, coordinating teams and understanding delivery — all in one place.",
  keywords: [
    "project management",
    "team workspace",
    "task tracking",
    "productivity",
    "roadmap",
  ],
  authors: [{ name: "Nexus Studio" }],
  creator: "Nexus Studio",
  openGraph: {
    type: "website",
    siteName: "NEXUS",
    title: "NEXUS — Calm project management",
    description:
      "A quiet, considered workspace for projects, tasks, calendars, teams and delivery reports.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXUS — Calm project management",
    description:
      "A quiet, considered workspace for projects, tasks, calendars, teams and delivery reports.",
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#181613" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        geistSans.variable,
        geistMono.variable,
        instrumentSerif.variable,
      )}
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

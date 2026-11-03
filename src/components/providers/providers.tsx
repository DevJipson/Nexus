"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreHydrator } from "@/components/providers/store-hydrator";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={220} skipDelayDuration={120}>
          <StoreHydrator />
          {children}
          <Toaster
            position="bottom-right"
            closeButton
            toastOptions={{ className: "font-sans" }}
          />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}

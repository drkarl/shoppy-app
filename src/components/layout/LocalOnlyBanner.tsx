"use client";

import { HardDrive } from "lucide-react";

import { isLocalOnlyMode } from "@/lib/supabase/mock-mode";
import { cn } from "@/lib/utils";

/**
 * Banner component that displays when the app is running in local-only mode.
 * Shows a persistent indicator at the top of the app explaining that data
 * is stored locally only and won't sync across devices.
 *
 * Includes a spacer div to push content down since the banner is fixed position.
 */
export function LocalOnlyBanner() {
  // Only show in local-only mode
  if (!isLocalOnlyMode()) {
    return null;
  }

  return (
    <>
      {/* Fixed banner */}
      <div
        className={cn(
          "fixed left-0 right-0 top-0 z-[60] px-4 py-2 text-center",
          "bg-purple-100 text-purple-900 dark:bg-purple-900/80 dark:text-purple-100"
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-center gap-2 text-sm">
          <HardDrive className="h-4 w-4" aria-hidden="true" />
          <span>
            <strong>Local-only mode</strong> — Data is stored on this device
            only
          </span>
        </div>
      </div>
      {/* Spacer to push content below the fixed banner */}
      <div className="h-10" aria-hidden="true" />
    </>
  );
}

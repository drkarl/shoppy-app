"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useSyncStatus } from "@/hooks/useSyncStatus";
import { cn } from "@/lib/utils";

import { SyncStatus } from "./SyncStatus";

/**
 * Banner component that displays sync/offline status at the top of the app.
 * Shows different states based on connectivity and sync progress:
 * - Offline: amber/yellow banner with offline icon
 * - Syncing: blue banner with spinner
 * - Synced: green banner that auto-hides after 2 seconds
 * - Error: shows toast notification
 */
export function OfflineIndicator() {
  const {
    status,
    pendingOperations,
    error,
    justSynced,
    isOffline,
    isSyncing,
    hasError,
  } = useSyncStatus();

  const previousErrorRef = useRef<Error | null>(null);

  // Show toast for sync errors
  useEffect(() => {
    if (hasError && error && error !== previousErrorRef.current) {
      toast.error(`Sync error: ${error.message}`);
      previousErrorRef.current = error;
    }
  }, [hasError, error]);

  // Determine if banner should be visible
  const isVisible = isOffline || isSyncing || justSynced || hasError;

  if (!isVisible) {
    return null;
  }

  // Determine banner background color based on status
  const bannerStyles = cn(
    "fixed top-0 left-0 right-0 z-[60] px-4 py-2 text-center transition-all duration-300",
    {
      "bg-amber-100 text-amber-900 dark:bg-amber-900/80 dark:text-amber-100":
        isOffline,
      "bg-blue-100 text-blue-900 dark:bg-blue-900/80 dark:text-blue-100":
        isSyncing,
      "bg-green-100 text-green-900 dark:bg-green-900/80 dark:text-green-100":
        justSynced,
      "bg-red-100 text-red-900 dark:bg-red-900/80 dark:text-red-100": hasError,
    }
  );

  return (
    <div
      className={bannerStyles}
      role="alert"
      aria-live={hasError ? "assertive" : "polite"}
      aria-label={`Sync status: ${status}`}
    >
      <SyncStatus
        status={status}
        pendingOperations={pendingOperations}
        justSynced={justSynced}
        className="justify-center"
      />
    </div>
  );
}

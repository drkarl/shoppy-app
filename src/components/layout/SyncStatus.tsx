"use client";

import { Check, CloudOff, Loader2, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

import type { SyncStatusType } from "@/lib/sync/SyncEngine";

interface SyncStatusProps {
  status: SyncStatusType;
  pendingOperations: number;
  justSynced: boolean;
  className?: string;
}

/**
 * Displays the current sync status with appropriate icon and text.
 * Shows pending operation count when offline.
 */
export function SyncStatus({
  status,
  pendingOperations,
  justSynced,
  className,
}: SyncStatusProps) {
  // Show success state briefly after sync
  if (justSynced) {
    return (
      <div
        className={cn("flex items-center gap-2", className)}
        role="status"
        aria-live="polite"
      >
        <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
        <span className="text-sm font-medium text-green-600">Synced</span>
      </div>
    );
  }

  switch (status) {
    case "offline":
      return (
        <div
          className={cn("flex items-center gap-2", className)}
          role="status"
          aria-live="polite"
        >
          <CloudOff className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm font-medium">
            {pendingOperations > 0
              ? `Offline - ${pendingOperations} change${pendingOperations !== 1 ? "s" : ""} will sync later`
              : "Offline - changes will sync later"}
          </span>
        </div>
      );

    case "syncing":
      return (
        <div
          className={cn("flex items-center gap-2", className)}
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span className="text-sm font-medium">Syncing...</span>
        </div>
      );

    case "error":
      return (
        <div
          className={cn("flex items-center gap-2", className)}
          role="status"
          aria-live="assertive"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm font-medium">Sync error - will retry</span>
        </div>
      );

    case "synced":
    default:
      // Don't show anything when synced (banner will hide)
      return null;
  }
}

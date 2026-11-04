"use client";

import { useEffect, useRef, useState } from "react";

import {
  useSync,
  useSyncStatus as useBaseSyncStatus,
} from "@/components/providers/SyncProvider";

import type { SyncStatus, SyncStatusType } from "@/lib/sync/SyncEngine";

export type { SyncStatus, SyncStatusType };

const JUST_SYNCED_DURATION_MS = 2000;

/**
 * Hook to get the current sync status with transition tracking.
 * Provides the raw status plus helpers for detecting transitions.
 */
export function useSyncStatus() {
  const status = useBaseSyncStatus();
  const previousStatusRef = useRef<SyncStatusType | null>(null);
  const [justSynced, setJustSynced] = useState(false);
  const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store current status in ref to compare on next render
  const currentStatus = status.status;

  useEffect(() => {
    const prevStatus = previousStatusRef.current;

    // Update the ref for next comparison
    previousStatusRef.current = currentStatus;

    // Detect transition from syncing to synced
    if (prevStatus === "syncing" && currentStatus === "synced") {
      // Clear any existing timer
      if (timerIdRef.current !== null) {
        clearTimeout(timerIdRef.current);
      }

      // Set justSynced flag via setTimeout to make it async
      timerIdRef.current = setTimeout(() => {
        setJustSynced(true);

        // Schedule clearing of justSynced after duration
        timerIdRef.current = setTimeout(() => {
          setJustSynced(false);
          timerIdRef.current = null;
        }, JUST_SYNCED_DURATION_MS);
      }, 0);
    }
  }, [currentStatus]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerIdRef.current !== null) {
        clearTimeout(timerIdRef.current);
      }
    };
  }, []);

  return {
    ...status,
    justSynced,
    isOffline: currentStatus === "offline",
    isSyncing: currentStatus === "syncing",
    isSynced: currentStatus === "synced",
    hasError: currentStatus === "error",
  };
}

/**
 * Hook to trigger a manual sync.
 */
export function useForceSync() {
  const { forceSync } = useSync();
  return forceSync;
}

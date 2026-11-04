"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Get the current online status from the browser.
 */
function getSnapshot(): boolean {
  return navigator.onLine;
}

/**
 * Return a default value during server-side rendering.
 */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Hook to track browser online/offline status.
 * Uses navigator.onLine and listens to online/offline events.
 *
 * Note: This hook uses the browser's native online/offline detection,
 * which does not include "false positive" handling (device reports online
 * but server is unreachable). For more accurate network state that includes
 * server connectivity verification, use NetworkMonitor directly via
 * getNetworkMonitor().subscribe().
 *
 * @returns true if online, false if offline
 */
export function useOnlineStatus(): boolean {
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener("online", callback);
    window.addEventListener("offline", callback);

    return () => {
      window.removeEventListener("online", callback);
      window.removeEventListener("offline", callback);
    };
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

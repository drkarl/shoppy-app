"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import { isLocalOnlyMode } from "@/lib/supabase/mock-mode";
import {
  createSyncEngine,
  SyncEngine,
  type SyncStatus,
} from "@/lib/sync/SyncEngine";

import type { SupabaseClient } from "@supabase/supabase-js";

interface SyncContextType {
  status: SyncStatus;
  isOnline: boolean;
  isSyncing: boolean;
  forceSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: React.ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps) {
  const [status, setStatus] = useState<SyncStatus>({
    status: "offline",
    lastSync: null,
    error: null,
    pendingOperations: 0,
  });

  // Use refs with lazy initialization to avoid SSR issues
  // undefined = not yet initialized, null = checked but Supabase not configured
  const supabaseRef = useRef<SupabaseClient | null | undefined>(undefined);
  const engineRef = useRef<SyncEngine | null>(null);

  const getSupabase = useCallback(() => {
    if (supabaseRef.current === undefined) {
      // Lazy initialize - returns null if Supabase is not configured
      const client = createClient();
      supabaseRef.current = client;
    }
    return supabaseRef.current;
  }, []);

  useEffect(() => {
    let mounted = true;
    let engine: SyncEngine | null = null;
    let unsubscribe: (() => void) | null = null;

    const initializeSyncEngine = async () => {
      try {
        const supabase = getSupabase();

        // If Supabase client is null, we're in local-only or E2E mock mode
        // Run in offline-only mode (no sync)
        if (!supabase) {
          if (isLocalOnlyMode()) {
            console.info(
              "[SyncProvider] Local-only mode, running in offline-only mode"
            );
          } else if (process.env.NEXT_PUBLIC_ENABLE_E2E_MOCK_MODE === "true") {
            console.info(
              "[SyncProvider] E2E mock mode enabled, running in offline-only mode"
            );
          } else {
            console.error(
              "[SyncProvider] Supabase not configured and neither local-only nor E2E mock mode enabled"
            );
          }
          if (mounted) {
            setStatus({
              status: "offline",
              lastSync: null,
              error: null,
              pendingOperations: 0,
            });
          }
          return;
        }

        engine = await createSyncEngine(supabase);
        engineRef.current = engine;

        // Subscribe to status updates
        unsubscribe = engine.subscribe((newStatus) => {
          if (mounted) {
            setStatus(newStatus);
          }
        });
      } catch (error) {
        console.error("[SyncProvider] Failed to initialize SyncEngine:", error);
        if (mounted) {
          setStatus({
            status: "error",
            lastSync: null,
            error: error instanceof Error ? error : new Error(String(error)),
            pendingOperations: 0,
          });
        }
      }
    };

    initializeSyncEngine();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
      if (engine) {
        engine.destroy();
      }
      engineRef.current = null;
    };
  }, [getSupabase]);

  const forceSync = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.forceSync();
    }
  }, []);

  const value = useMemo(
    () => ({
      status,
      isOnline: status.status !== "offline",
      isSyncing: status.status === "syncing",
      forceSync,
    }),
    [status, forceSync]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}

/**
 * Hook to get the current sync status.
 * Returns the status type: "synced", "syncing", "offline", or "error"
 */
export function useSyncStatus(): SyncStatus {
  const { status } = useSync();
  return status;
}

/**
 * Hook to check if the app is currently online and syncing is possible.
 */
export function useIsOnline(): boolean {
  const { isOnline } = useSync();
  return isOnline;
}

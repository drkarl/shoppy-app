import { db, ListItem } from "../db";
import {
  BackgroundSync,
  getBackgroundSync,
  isBackgroundSyncSupported,
} from "./BackgroundSync";
import { resolveConflict } from "./ConflictResolver";
import {
  getNetworkMonitor,
  NetworkMonitor,
  type NetworkState,
} from "./NetworkMonitor";
import {
  addToQueue,
  getQueueCount,
  incrementRetry,
  readQueue,
  removeFromQueue,
  type QueuedOperation,
} from "./SyncQueue";
import { toCamelCase, toSnakeCase } from "../utils/caseConversion";

import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncStatusType = "synced" | "syncing" | "offline" | "error";

export interface SyncStatus {
  status: SyncStatusType;
  lastSync: Date | null;
  error: Error | null;
  pendingOperations: number;
}

export type SyncStatusListener = (status: SyncStatus) => void;

const SYNC_INTERVAL_MS = 30_000; // 30 seconds
const EPOCH_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export class SyncEngine {
  private supabase: SupabaseClient;
  private networkMonitor: NetworkMonitor;
  private backgroundSync: BackgroundSync;
  private isOnline: boolean = false;
  private isSyncing: boolean = false;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<SyncStatusListener> = new Set();
  private networkUnsubscribe: (() => void) | null = null;
  private currentStatus: SyncStatus = {
    status: "offline",
    lastSync: null,
    error: null,
    pendingOperations: 0,
  };

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.networkMonitor = getNetworkMonitor();
    this.backgroundSync = getBackgroundSync();

    // Only set isOnline in browser environment
    if (typeof window !== "undefined") {
      this.isOnline = navigator.onLine;
    }
  }

  /**
   * Initialize the SyncEngine by setting up event listeners and starting periodic sync.
   * Call this after construction to begin sync operations.
   */
  async initialize(): Promise<void> {
    if (typeof window !== "undefined") {
      // Initialize NetworkMonitor with Supabase client for connectivity checks
      this.networkMonitor.initialize(this.supabase);

      // Initialize BackgroundSync and register callback
      await this.backgroundSync.initialize();
      this.backgroundSync.onSyncRequested(async () => {
        await this.processQueue();
      });

      // Register sync callback with NetworkMonitor (handles debouncing)
      this.networkMonitor.onSyncNeeded(() => {
        this.processQueue().catch((error) => {
          console.error(
            "[SyncEngine] Sync triggered by NetworkMonitor failed:",
            error
          );
        });
      });

      // Subscribe to network state changes
      this.networkUnsubscribe = this.networkMonitor.subscribe(
        this.handleNetworkStateChange
      );

      // Update initial status based on online state
      if (this.isOnline) {
        await this.updatePendingCount();
        this.startPeriodicSync();
      }
    }
  }

  /**
   * Clean up event listeners and stop periodic sync.
   * Call this when the SyncEngine is no longer needed.
   */
  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    // Only unsubscribe, don't destroy the NetworkMonitor singleton
    // Other SyncEngine instances or components may still need it
    this.stopPeriodicSync();
    this.listeners.clear();
  }

  /**
   * Process all pending operations in the sync queue.
   * Sends local changes to Supabase in timestamp order (oldest first).
   * After pushing local changes, pulls remote changes to sync both directions.
   */
  async processQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners({ status: "syncing" });

    try {
      const entries = await readQueue();

      for (const entry of entries) {
        try {
          await this.syncEntry(entry);
          await removeFromQueue(entry.id);
        } catch (error) {
          console.error("[SyncEngine] Failed to sync entry:", error, entry);

          const result = await incrementRetry(entry.id);
          if (result.removed) {
            console.error(
              "[SyncEngine] Entry removed after max retries:",
              result.entry
            );
          }
        }
      }

      // After pushing local changes, pull remote changes
      await this.pullRemoteChanges();

      // Update pending count and notify success
      await this.updatePendingCount();
      this.notifyListeners({
        status: "synced",
        lastSync: new Date(),
        error: null,
      });
    } catch (error) {
      console.error("[SyncEngine] Sync failed:", error);

      // Check if this is a network error (false positive scenario)
      const isNetworkError = this.isNetworkError(error);
      if (isNetworkError) {
        // Mark as offline - browser reported online but server unreachable
        this.networkMonitor.markOfflineDueToSyncFailure();
        this.notifyListeners({
          status: "offline",
          error: error instanceof Error ? error : new Error(String(error)),
        });
      } else {
        this.notifyListeners({
          status: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Check if an error is a network-related error (connection issue).
   * These errors indicate false positive scenarios where the browser
   * reports online but the server is unreachable.
   */
  private isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("failed to fetch") ||
        message.includes("network") ||
        message.includes("connection") ||
        message.includes("timeout") ||
        message.includes("abort") ||
        message.includes("econnrefused") ||
        message.includes("enotfound") ||
        message.includes("net::err_")
      );
    }
    return false;
  }

  /**
   * Fetch remote changes from Supabase and apply them locally.
   * Uses version-based conflict resolution: highest version wins.
   *
   * - If remote version > local version: apply remote changes
   * - If local version >= remote version: keep local (already queued for sync)
   */
  async pullRemoteChanges(): Promise<void> {
    // Get last sync timestamp from meta storage
    const lastSyncMeta = await db.syncMeta.get("lastSyncTimestamp");
    const since = (lastSyncMeta?.value as string) || EPOCH_TIMESTAMP;

    // Get current active list to sync
    const activeList = await db.lists.where("status").equals("active").first();

    if (!activeList) {
      // No active list to sync
      return;
    }

    // Fetch changes from Supabase using the RPC function
    const { data: remoteItems, error } = await this.supabase.rpc(
      "get_list_changes",
      {
        p_list_id: activeList.id,
        p_since: since,
      }
    );

    if (error) {
      throw new Error(`Failed to pull remote changes: ${error.message}`);
    }

    // Apply changes with conflict resolution
    for (const remoteItem of remoteItems || []) {
      await this.applyRemoteChange(remoteItem);
    }

    // Update last sync timestamp
    await db.syncMeta.put({
      key: "lastSyncTimestamp",
      value: new Date().toISOString(),
    });
  }

  /**
   * Apply a single remote change with version-based conflict resolution.
   *
   * Resolution strategy:
   * - Remote version > local version → apply remote (server wins)
   * - Local version > remote version → keep local, queue for push (client wins)
   * - Versions equal → no conflict (already in sync)
   */
  private async applyRemoteChange(
    remoteItem: Record<string, unknown>
  ): Promise<void> {
    const remoteId = remoteItem.id;
    const remoteVersion = remoteItem.version;

    if (typeof remoteId !== "string" || typeof remoteVersion !== "number") {
      console.error("[SyncEngine] Invalid remote item structure:", remoteItem);
      return;
    }

    // Convert from snake_case (Supabase) to camelCase (Dexie)
    const convertedItem = toCamelCase(remoteItem) as unknown as ListItem;

    const localItem = await db.listItems.get(remoteId);

    if (!localItem) {
      // New item from remote - add to local DB
      await db.listItems.add(convertedItem);
      return;
    }

    // Use ConflictResolver to determine the winner
    const result = resolveConflict(remoteId, localItem.version, remoteVersion);

    if (!result.hasConflict) {
      // Versions equal - no action needed (already in sync)
      return;
    }

    if (result.winner === "remote") {
      // Remote wins - apply remote changes
      await db.listItems.put(convertedItem);
    } else if (result.winner === "local" && result.shouldQueueForPush) {
      // Local wins - queue the local item for push to ensure it syncs
      await addToQueue("list_items", "UPDATE", localItem.id, localItem);
    }
  }

  /**
   * Sync a single queue entry to Supabase.
   */
  private async syncEntry(entry: QueuedOperation): Promise<void> {
    const { table, operation, recordId, payload } = entry;

    // Convert payload from camelCase to snake_case for Supabase
    const snakeCasePayload = payload ? toSnakeCase(payload) : null;

    switch (operation) {
      case "INSERT": {
        const { error } = await this.supabase
          .from(table)
          .insert(snakeCasePayload);
        if (error) throw error;
        break;
      }

      case "UPDATE": {
        const { error } = await this.supabase
          .from(table)
          .update(snakeCasePayload)
          .eq("id", recordId);
        if (error) throw error;
        break;
      }

      case "DELETE": {
        const { error } = await this.supabase
          .from(table)
          .delete()
          .eq("id", recordId);
        if (error) throw error;
        break;
      }
    }
  }

  /**
   * Subscribe to sync status changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current status
    listener(this.currentStatus);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get the current sync status.
   */
  getStatus(): SyncStatus {
    return { ...this.currentStatus };
  }

  /**
   * Check if the engine is currently online.
   */
  getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Check if a sync operation is in progress.
   */
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Force a sync regardless of the current interval.
   * Useful for manual "refresh" actions.
   */
  async forceSync(): Promise<void> {
    if (this.isOnline) {
      await this.processQueue();
    }
  }

  /**
   * Request background sync registration.
   * Call this after queueing operations while offline to ensure
   * sync happens when connectivity is restored (even if app is closed).
   *
   * Note: Background Sync is only supported on Android. iOS will use
   * the regular online event handling instead.
   *
   * @returns true if background sync was registered, false otherwise
   */
  async requestBackgroundSync(): Promise<boolean> {
    if (!isBackgroundSyncSupported()) {
      return false;
    }

    const pendingCount = await getQueueCount();
    if (pendingCount === 0) {
      return false;
    }

    return this.backgroundSync.requestSync();
  }

  /**
   * Handle network state changes from NetworkMonitor.
   * Updates internal state and manages periodic sync accordingly.
   */
  private handleNetworkStateChange = async (
    state: NetworkState
  ): Promise<void> => {
    if (state === "online") {
      this.isOnline = true;
      await this.updatePendingCount();
      this.startPeriodicSync();
      // Note: Sync is triggered by NetworkMonitor via onSyncNeeded callback
      // with proper debouncing, so we don't trigger it directly here
    } else if (state === "offline") {
      this.isOnline = false;
      this.stopPeriodicSync();
      this.notifyListeners({ status: "offline" });

      // Request background sync so sync will happen when connectivity
      // is restored (even if app is closed - Android only)
      this.requestBackgroundSync().catch((error) => {
        console.error("[SyncEngine] Failed to request background sync:", error);
      });
    } else if (state === "checking") {
      // While checking connectivity, show syncing state
      this.notifyListeners({ status: "syncing" });
    }
  };

  private startPeriodicSync(): void {
    if (this.syncIntervalId !== null) {
      return; // Already running
    }

    this.syncIntervalId = setInterval(() => {
      this.processQueue().catch((error) => {
        console.error("[SyncEngine] Periodic sync failed:", error);
      });
    }, SYNC_INTERVAL_MS);
  }

  private stopPeriodicSync(): void {
    if (this.syncIntervalId !== null) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  private async updatePendingCount(): Promise<void> {
    const count = await getQueueCount();
    this.currentStatus.pendingOperations = count;
  }

  private notifyListeners(update: Partial<SyncStatus>): void {
    this.currentStatus = {
      ...this.currentStatus,
      ...update,
    };
    this.listeners.forEach((listener) => listener(this.currentStatus));
  }
}

/**
 * Create and initialize a SyncEngine instance.
 * This is a convenience function for creating a ready-to-use SyncEngine.
 */
export async function createSyncEngine(
  supabaseClient: SupabaseClient
): Promise<SyncEngine> {
  const engine = new SyncEngine(supabaseClient);
  await engine.initialize();
  return engine;
}

import { db, ListItem } from "../db";
import { toCamelCase } from "../utils/caseConversion";

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";

export type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE";

export type RealtimeStatusType =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface RealtimeStatus {
  status: RealtimeStatusType;
  listId: string | null;
  error: Error | null;
}

export type RealtimeStatusListener = (status: RealtimeStatus) => void;
export type RealtimeEventListener = (
  event: RealtimeEventType,
  item: ListItem
) => void;

/**
 * RealtimeHandler manages Supabase Realtime channel subscriptions
 * for live updates to list items.
 *
 * Features:
 * - Subscribes to INSERT, UPDATE, DELETE events on list_items table
 * - Filters by current list ID
 * - Applies remote changes to Dexie immediately
 * - Uses version-based conflict resolution (skips stale updates)
 * - Handles subscription cleanup when switching lists
 */
export class RealtimeHandler {
  private supabase: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private currentListId: string | null = null;
  private statusListeners: Set<RealtimeStatusListener> = new Set();
  private eventListeners: Set<RealtimeEventListener> = new Set();
  private currentStatus: RealtimeStatus = {
    status: "disconnected",
    listId: null,
    error: null,
  };

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Subscribe to realtime changes for a specific list.
   * If already subscribed to another list, the old subscription is cleaned up first.
   *
   * @param listId - The ID of the list to subscribe to
   */
  async subscribeToList(listId: string): Promise<void> {
    // Clean up existing subscription if switching lists
    if (this.channel && this.currentListId !== listId) {
      await this.unsubscribe();
    }

    // Don't re-subscribe if already subscribed to this list
    if (this.currentListId === listId && this.channel) {
      return;
    }

    this.currentListId = listId;
    this.notifyStatusListeners({
      status: "connecting",
      listId,
      error: null,
    });

    // Create a unique channel name for this list
    const channelName = `list_items:list_id=eq.${listId}`;

    this.channel = this.supabase
      .channel(channelName)
      .on<Record<string, unknown>>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "list_items",
          filter: `list_id=eq.${listId}`,
        },
        (payload) => this.handleInsert(payload)
      )
      .on<Record<string, unknown>>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "list_items",
          filter: `list_id=eq.${listId}`,
        },
        (payload) => this.handleUpdate(payload)
      )
      .on<Record<string, unknown>>(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "list_items",
          filter: `list_id=eq.${listId}`,
        },
        (payload) => this.handleDelete(payload)
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          this.notifyStatusListeners({
            status: "connected",
            listId,
            error: null,
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          this.notifyStatusListeners({
            status: "error",
            listId,
            error: err ?? new Error(`Subscription ${status.toLowerCase()}`),
          });
        } else if (status === "CLOSED") {
          this.notifyStatusListeners({
            status: "disconnected",
            listId: null,
            error: null,
          });
        }
      });
  }

  /**
   * Unsubscribe from the current list's realtime channel.
   * Cleans up resources and notifies listeners of disconnection.
   */
  async unsubscribe(): Promise<void> {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
      this.currentListId = null;
      this.notifyStatusListeners({
        status: "disconnected",
        listId: null,
        error: null,
      });
    }
  }

  /**
   * Get the currently subscribed list ID.
   */
  getCurrentListId(): string | null {
    return this.currentListId;
  }

  /**
   * Get the current realtime connection status.
   */
  getStatus(): RealtimeStatus {
    return { ...this.currentStatus };
  }

  /**
   * Subscribe to realtime status changes.
   * Returns an unsubscribe function.
   */
  onStatusChange(listener: RealtimeStatusListener): () => void {
    this.statusListeners.add(listener);
    // Immediately notify with current status
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Subscribe to realtime events (INSERT, UPDATE, DELETE).
   * Useful for triggering UI updates or analytics.
   * Returns an unsubscribe function.
   */
  onEvent(listener: RealtimeEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Clean up all resources.
   * Call this when the RealtimeHandler is no longer needed.
   */
  async destroy(): Promise<void> {
    await this.unsubscribe();
    this.statusListeners.clear();
    this.eventListeners.clear();
  }

  /**
   * Handle INSERT events from realtime.
   * Adds new items to local Dexie database if they don't exist.
   */
  private async handleInsert(
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ): Promise<void> {
    const remoteItem = payload.new as Record<string, unknown> | null;
    if (!remoteItem || typeof remoteItem !== "object") {
      return;
    }

    const itemId = remoteItem["id"];
    if (typeof itemId !== "string") {
      return;
    }

    try {
      // Check if item already exists locally (might have been created by this client)
      const localItem = await db.listItems.get(itemId);
      if (localItem) {
        // Item already exists, skip (could be our own insert)
        return;
      }

      // Convert from snake_case to camelCase and add to Dexie
      const convertedItem = toCamelCase(remoteItem) as unknown as ListItem;
      await db.listItems.add(convertedItem);

      this.notifyEventListeners("INSERT", convertedItem);
    } catch (error) {
      console.error("[RealtimeHandler] Failed to handle INSERT:", error);
    }
  }

  /**
   * Handle UPDATE events from realtime.
   * Uses version-based conflict resolution:
   * - If remote version > local version: apply remote changes
   * - If local version >= remote version: skip (local is newer or same)
   */
  private async handleUpdate(
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ): Promise<void> {
    const remoteItem = payload.new as Record<string, unknown> | null;
    if (!remoteItem || typeof remoteItem !== "object") {
      return;
    }

    const itemId = remoteItem["id"];
    const remoteVersion = remoteItem["version"];

    if (typeof itemId !== "string" || typeof remoteVersion !== "number") {
      return;
    }

    try {
      const localItem = await db.listItems.get(itemId);

      // If item doesn't exist locally, treat as insert
      if (!localItem) {
        const convertedItem = toCamelCase(remoteItem) as unknown as ListItem;
        await db.listItems.add(convertedItem);
        this.notifyEventListeners("INSERT", convertedItem);
        return;
      }

      // Version-based conflict resolution: only apply if remote is newer
      if (remoteVersion <= localItem.version) {
        // Local version is same or newer, skip this update
        return;
      }

      // Remote version is higher, apply the update
      const convertedItem = toCamelCase(remoteItem) as unknown as ListItem;
      await db.listItems.put(convertedItem);

      this.notifyEventListeners("UPDATE", convertedItem);
    } catch (error) {
      console.error("[RealtimeHandler] Failed to handle UPDATE:", error);
    }
  }

  /**
   * Handle DELETE events from realtime.
   * Removes the item from local Dexie database.
   */
  private async handleDelete(
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ): Promise<void> {
    // For DELETE events, the old record contains the deleted item's data
    const deletedItem = payload.old as Record<string, unknown> | null;
    if (!deletedItem || typeof deletedItem !== "object") {
      return;
    }

    const itemId = deletedItem["id"];
    if (typeof itemId !== "string") {
      return;
    }

    try {
      // Get the item before deleting for the event notification
      const localItem = await db.listItems.get(itemId);
      if (!localItem) {
        // Item doesn't exist locally, nothing to delete
        return;
      }

      await db.listItems.delete(itemId);

      this.notifyEventListeners("DELETE", localItem);
    } catch (error) {
      console.error("[RealtimeHandler] Failed to handle DELETE:", error);
    }
  }

  private notifyStatusListeners(status: RealtimeStatus): void {
    this.currentStatus = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private notifyEventListeners(event: RealtimeEventType, item: ListItem): void {
    this.eventListeners.forEach((listener) => listener(event, item));
  }
}

/**
 * Create a RealtimeHandler instance.
 * Convenience function for creating a ready-to-use RealtimeHandler.
 */
export function createRealtimeHandler(
  supabaseClient: SupabaseClient
): RealtimeHandler {
  return new RealtimeHandler(supabaseClient);
}

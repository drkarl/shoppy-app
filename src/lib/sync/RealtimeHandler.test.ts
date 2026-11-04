import "fake-indexeddb/auto";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import { db, ListItem } from "../db";
import {
  RealtimeHandler,
  type RealtimeEventListener,
  type RealtimeEventType,
  type RealtimeStatus,
  type RealtimeStatusListener,
} from "./RealtimeHandler";

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";

type PostgresChangesCallback = (
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>
) => void;

// Mock channel that captures callbacks for testing
function createMockChannel(): {
  channel: RealtimeChannel;
  callbacks: Map<string, PostgresChangesCallback>;
  subscribeCallback: ((status: string, err?: Error) => void) | null;
  triggerEvent: (
    event: "INSERT" | "UPDATE" | "DELETE",
    payload: Record<string, unknown>
  ) => void;
  triggerSubscribe: (status: string, err?: Error) => void;
} {
  const callbacks = new Map<string, PostgresChangesCallback>();
  let subscribeCallback: ((status: string, err?: Error) => void) | null = null;

  const mockChannel = {
    on: vi.fn(
      (
        type: string,
        config: { event: string },
        callback: PostgresChangesCallback
      ) => {
        if (type === "postgres_changes") {
          callbacks.set(config.event, callback);
        }
        return mockChannel;
      }
    ),
    subscribe: vi.fn((callback: (status: string, err?: Error) => void) => {
      subscribeCallback = callback;
      // Simulate async subscription
      setTimeout(() => callback("SUBSCRIBED"), 0);
      return mockChannel;
    }),
    unsubscribe: vi.fn().mockResolvedValue("ok"),
  } as unknown as RealtimeChannel;

  return {
    channel: mockChannel,
    callbacks,
    get subscribeCallback() {
      return subscribeCallback;
    },
    triggerEvent: (event, payload) => {
      const callback = callbacks.get(event);
      if (callback) {
        callback(
          payload as RealtimePostgresChangesPayload<Record<string, unknown>>
        );
      }
    },
    triggerSubscribe: (status, err) => {
      if (subscribeCallback) {
        subscribeCallback(status, err);
      }
    },
  };
}

// Mock Supabase client factory
function createMockSupabaseClient(): {
  client: SupabaseClient;
  mockChannel: ReturnType<typeof createMockChannel>;
  removeChannel: Mock;
} {
  const mockChannelInstance = createMockChannel();
  const removeChannel = vi.fn().mockResolvedValue(undefined);

  const client = {
    channel: vi.fn().mockReturnValue(mockChannelInstance.channel),
    removeChannel,
  } as unknown as SupabaseClient;

  return { client, mockChannel: mockChannelInstance, removeChannel };
}

// Helper to create a test list item
function createTestItem(overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: "item-1",
    listId: "list-1",
    rawText: "Test Item",
    displayName: "Test Item",
    quantity: 1,
    unit: null,
    note: null,
    categoryId: null,
    status: "pending",
    addedBy: null,
    checkedBy: null,
    checkedAt: null,
    version: 1,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// Helper to create a snake_case remote item (as received from Supabase)
function createRemoteItem(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    id: "item-1",
    list_id: "list-1",
    raw_text: "Test Item",
    display_name: "Test Item",
    quantity: 1,
    unit: null,
    note: null,
    category_id: null,
    status: "pending",
    added_by: null,
    checked_by: null,
    checked_at: null,
    version: 1,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("RealtimeHandler", () => {
  let handler: RealtimeHandler;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(async () => {
    // Clear all tables
    await db.listItems.clear();
    await db.lists.clear();

    mockSupabase = createMockSupabaseClient();
    handler = new RealtimeHandler(mockSupabase.client);
  });

  afterEach(async () => {
    await handler.destroy();
    await db.listItems.clear();
    await db.lists.clear();
    vi.restoreAllMocks();
  });

  describe("subscribeToList", () => {
    it("should create a channel with correct filter for list_id", async () => {
      await handler.subscribeToList("list-123");

      expect(mockSupabase.client.channel).toHaveBeenCalledWith(
        "list_items:list_id=eq.list-123"
      );
    });

    it("should subscribe to INSERT, UPDATE, and DELETE events", async () => {
      await handler.subscribeToList("list-1");

      const onCalls = (mockSupabase.mockChannel.channel.on as Mock).mock.calls;

      // Verify all three event types are subscribed
      const events = onCalls.map((call) => call[1].event);
      expect(events).toContain("INSERT");
      expect(events).toContain("UPDATE");
      expect(events).toContain("DELETE");

      // Verify filter is correct for all events
      onCalls.forEach((call) => {
        expect(call[1].filter).toBe("list_id=eq.list-1");
        expect(call[1].schema).toBe("public");
        expect(call[1].table).toBe("list_items");
      });
    });

    it("given a user switches lists, when subscribeToList is called, then the old subscription is cleaned up and a new one is established", async () => {
      // Subscribe to first list
      await handler.subscribeToList("list-1");

      // Wait for subscription to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler.getCurrentListId()).toBe("list-1");

      // Subscribe to second list
      await handler.subscribeToList("list-2");

      // Verify old channel was removed
      expect(mockSupabase.removeChannel).toHaveBeenCalled();

      // Verify new channel was created
      expect(mockSupabase.client.channel).toHaveBeenLastCalledWith(
        "list_items:list_id=eq.list-2"
      );
    });

    it("should not re-subscribe if already subscribed to the same list", async () => {
      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const channelCallCount = (mockSupabase.client.channel as Mock).mock.calls
        .length;

      // Try to subscribe to the same list again
      await handler.subscribeToList("list-1");

      // Should not create a new channel
      expect((mockSupabase.client.channel as Mock).mock.calls.length).toBe(
        channelCallCount
      );
    });

    it("should notify listeners when status changes to connected", async () => {
      const statusUpdates: RealtimeStatus[] = [];
      handler.onStatusChange((status) => statusUpdates.push({ ...status }));

      await handler.subscribeToList("list-1");

      // Wait for subscription callback
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(statusUpdates.some((s) => s.status === "connecting")).toBe(true);
      expect(statusUpdates.some((s) => s.status === "connected")).toBe(true);
      expect(statusUpdates.find((s) => s.status === "connected")?.listId).toBe(
        "list-1"
      );
    });

    it("should notify listeners when subscription fails", async () => {
      const statusUpdates: RealtimeStatus[] = [];
      handler.onStatusChange((status) => statusUpdates.push({ ...status }));

      await handler.subscribeToList("list-1");

      // Simulate error
      mockSupabase.mockChannel.triggerSubscribe(
        "CHANNEL_ERROR",
        new Error("Connection failed")
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(statusUpdates.some((s) => s.status === "error")).toBe(true);
      const errorStatus = statusUpdates.find((s) => s.status === "error");
      expect(errorStatus?.error).toBeDefined();
    });
  });

  describe("unsubscribe", () => {
    it("should remove the channel and reset state", async () => {
      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      await handler.unsubscribe();

      expect(mockSupabase.removeChannel).toHaveBeenCalled();
      expect(handler.getCurrentListId()).toBeNull();
    });

    it("should notify listeners of disconnection", async () => {
      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const statusUpdates: RealtimeStatus[] = [];
      handler.onStatusChange((status) => statusUpdates.push({ ...status }));

      await handler.unsubscribe();

      expect(statusUpdates.some((s) => s.status === "disconnected")).toBe(true);
    });

    it("should handle unsubscribe when not subscribed", async () => {
      // Should not throw
      await expect(handler.unsubscribe()).resolves.not.toThrow();
    });
  });

  describe("INSERT event handling", () => {
    it("given User A adds an item, when the INSERT event is received, then User B's Dexie is updated", async () => {
      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const remoteItem = createRemoteItem({ id: "new-item-1" });

      // Simulate INSERT event
      mockSupabase.mockChannel.triggerEvent("INSERT", { new: remoteItem });

      // Wait for async Dexie operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      const localItem = await db.listItems.get("new-item-1");
      expect(localItem).toBeDefined();
      expect(localItem?.displayName).toBe("Test Item");
      expect(localItem?.listId).toBe("list-1");
    });

    it("should skip INSERT if item already exists locally", async () => {
      // Add item locally first (simulating this client created it)
      await db.listItems.add(createTestItem({ id: "existing-item" }));

      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const remoteItem = createRemoteItem({
        id: "existing-item",
        display_name: "Remote Name",
      });

      // Simulate INSERT event
      mockSupabase.mockChannel.triggerEvent("INSERT", { new: remoteItem });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Local item should still have original name
      const localItem = await db.listItems.get("existing-item");
      expect(localItem?.displayName).toBe("Test Item");
    });

    it("should convert snake_case to camelCase for inserted items", async () => {
      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const remoteItem = createRemoteItem({
        id: "item-1",
        category_id: "cat-123",
        added_by: "user-456",
        checked_at: "2024-01-02T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
      });

      mockSupabase.mockChannel.triggerEvent("INSERT", { new: remoteItem });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const localItem = await db.listItems.get("item-1");
      expect(localItem?.categoryId).toBe("cat-123");
      expect(localItem?.addedBy).toBe("user-456");
      expect(localItem?.checkedAt).toBe("2024-01-02T00:00:00Z");
      expect(localItem?.createdAt).toBe("2024-01-01T00:00:00Z");
    });

    it("should notify event listeners on INSERT", async () => {
      const events: { type: RealtimeEventType; item: ListItem }[] = [];
      handler.onEvent((type, item) => events.push({ type, item }));

      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      mockSupabase.mockChannel.triggerEvent("INSERT", {
        new: createRemoteItem({ id: "item-1" }),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("INSERT");
      expect(events[0].item.id).toBe("item-1");
    });
  });

  describe("UPDATE event handling", () => {
    it("given remote version > local version, when UPDATE event is received, then local is updated", async () => {
      // Add local item with version 3
      await db.listItems.add(
        createTestItem({
          id: "item-1",
          version: 3,
          displayName: "Old Name",
        })
      );

      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Remote has version 5
      const remoteItem = createRemoteItem({
        id: "item-1",
        version: 5,
        display_name: "New Name",
      });

      mockSupabase.mockChannel.triggerEvent("UPDATE", { new: remoteItem });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const localItem = await db.listItems.get("item-1");
      expect(localItem?.version).toBe(5);
      expect(localItem?.displayName).toBe("New Name");
    });

    it("given User B's local item has version=10, when a remote UPDATE with version=8 arrives, then the local version is NOT overwritten", async () => {
      // Add local item with version 10
      await db.listItems.add(
        createTestItem({
          id: "item-1",
          version: 10,
          displayName: "Local Name",
          quantity: 5,
        })
      );

      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Remote has version 8 (stale)
      const remoteItem = createRemoteItem({
        id: "item-1",
        version: 8,
        display_name: "Remote Name",
        quantity: 2,
      });

      mockSupabase.mockChannel.triggerEvent("UPDATE", { new: remoteItem });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const localItem = await db.listItems.get("item-1");
      expect(localItem?.version).toBe(10);
      expect(localItem?.displayName).toBe("Local Name");
      expect(localItem?.quantity).toBe(5);
    });

    it("should not update if versions are equal", async () => {
      await db.listItems.add(
        createTestItem({
          id: "item-1",
          version: 5,
          displayName: "Original",
        })
      );

      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const remoteItem = createRemoteItem({
        id: "item-1",
        version: 5,
        display_name: "Same Version Update",
      });

      mockSupabase.mockChannel.triggerEvent("UPDATE", { new: remoteItem });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const localItem = await db.listItems.get("item-1");
      expect(localItem?.displayName).toBe("Original");
    });

    it("should treat UPDATE for non-existent item as INSERT", async () => {
      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const remoteItem = createRemoteItem({ id: "missing-item", version: 1 });

      mockSupabase.mockChannel.triggerEvent("UPDATE", { new: remoteItem });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const localItem = await db.listItems.get("missing-item");
      expect(localItem).toBeDefined();
    });

    it("should notify event listeners on valid UPDATE", async () => {
      await db.listItems.add(createTestItem({ id: "item-1", version: 1 }));

      const events: { type: RealtimeEventType; item: ListItem }[] = [];
      handler.onEvent((type, item) => events.push({ type, item }));

      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      mockSupabase.mockChannel.triggerEvent("UPDATE", {
        new: createRemoteItem({ id: "item-1", version: 2 }),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("UPDATE");
    });

    it("should NOT notify event listeners on skipped UPDATE (stale version)", async () => {
      await db.listItems.add(createTestItem({ id: "item-1", version: 10 }));

      const events: { type: RealtimeEventType; item: ListItem }[] = [];
      handler.onEvent((type, item) => events.push({ type, item }));

      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      mockSupabase.mockChannel.triggerEvent("UPDATE", {
        new: createRemoteItem({ id: "item-1", version: 5 }),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(0);
    });
  });

  describe("DELETE event handling", () => {
    it("given a DELETE event is received, when processing, then the item is removed from Dexie", async () => {
      // Add local item
      await db.listItems.add(createTestItem({ id: "item-to-delete" }));

      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate DELETE event (old contains the deleted item)
      mockSupabase.mockChannel.triggerEvent("DELETE", {
        old: { id: "item-to-delete" },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const localItem = await db.listItems.get("item-to-delete");
      expect(localItem).toBeUndefined();
    });

    it("should handle DELETE for non-existent item gracefully", async () => {
      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not throw
      mockSupabase.mockChannel.triggerEvent("DELETE", {
        old: { id: "non-existent" },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("should notify event listeners on DELETE", async () => {
      await db.listItems.add(createTestItem({ id: "item-1" }));

      const events: { type: RealtimeEventType; item: ListItem }[] = [];
      handler.onEvent((type, item) => events.push({ type, item }));

      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      mockSupabase.mockChannel.triggerEvent("DELETE", {
        old: { id: "item-1" },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(1);
      expect(events[0].type).toBe("DELETE");
      expect(events[0].item.id).toBe("item-1");
    });
  });

  describe("status listeners", () => {
    it("should immediately notify new subscriber with current status", () => {
      let receivedStatus: RealtimeStatus | undefined;
      handler.onStatusChange((status) => {
        receivedStatus = status;
      });

      expect(receivedStatus).toBeDefined();
      expect(receivedStatus!.status).toBe("disconnected");
    });

    it("should allow unsubscribing from status changes", async () => {
      const statusUpdates: RealtimeStatus[] = [];
      const unsubscribe = handler.onStatusChange((status) =>
        statusUpdates.push({ ...status })
      );

      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const countAfterSubscribe = statusUpdates.length;

      unsubscribe();

      await handler.unsubscribe();

      // Should not receive more updates after unsubscribe
      expect(statusUpdates.length).toBe(countAfterSubscribe);
    });
  });

  describe("event listeners", () => {
    it("should allow unsubscribing from events", async () => {
      await db.listItems.add(createTestItem({ id: "item-1", version: 1 }));

      const events: { type: RealtimeEventType; item: ListItem }[] = [];
      const unsubscribe = handler.onEvent((type, item) =>
        events.push({ type, item })
      );

      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // First event
      mockSupabase.mockChannel.triggerEvent("UPDATE", {
        new: createRemoteItem({ id: "item-1", version: 2 }),
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const countAfterFirst = events.length;

      unsubscribe();

      // Update local item version for next update
      await db.listItems.put(createTestItem({ id: "item-1", version: 2 }));

      // Second event after unsubscribe
      mockSupabase.mockChannel.triggerEvent("UPDATE", {
        new: createRemoteItem({ id: "item-1", version: 3 }),
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(countAfterFirst);
    });
  });

  describe("destroy", () => {
    it("should clean up all resources", async () => {
      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const statusListener: RealtimeStatusListener = vi.fn();
      const eventListener: RealtimeEventListener = vi.fn();

      handler.onStatusChange(statusListener);
      handler.onEvent(eventListener);

      await handler.destroy();

      expect(mockSupabase.removeChannel).toHaveBeenCalled();
      expect(handler.getCurrentListId()).toBeNull();

      // After destroy, triggering events should not notify listeners
      // (Can't easily test this since channel is removed)
    });
  });

  describe("edge cases", () => {
    it("should handle invalid payload in INSERT", async () => {
      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not throw with invalid payload
      mockSupabase.mockChannel.triggerEvent("INSERT", { new: null });
      mockSupabase.mockChannel.triggerEvent("INSERT", { new: { id: 123 } }); // non-string id
      mockSupabase.mockChannel.triggerEvent("INSERT", {}); // missing new

      await new Promise((resolve) => setTimeout(resolve, 10));

      // No items should be added
      const count = await db.listItems.count();
      expect(count).toBe(0);
    });

    it("should handle invalid payload in UPDATE", async () => {
      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not throw with invalid payload
      mockSupabase.mockChannel.triggerEvent("UPDATE", { new: null });
      mockSupabase.mockChannel.triggerEvent("UPDATE", {
        new: { id: "item-1", version: "not-a-number" },
      });
      mockSupabase.mockChannel.triggerEvent("UPDATE", {});

      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("should handle invalid payload in DELETE", async () => {
      await handler.subscribeToList("list-1");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not throw with invalid payload
      mockSupabase.mockChannel.triggerEvent("DELETE", { old: null });
      mockSupabase.mockChannel.triggerEvent("DELETE", { old: { id: 123 } });
      mockSupabase.mockChannel.triggerEvent("DELETE", {});

      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });
});

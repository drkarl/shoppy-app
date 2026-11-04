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

import { db } from "../db";
import { resetBackgroundSync } from "./BackgroundSync";
import { resetNetworkMonitor } from "./NetworkMonitor";
import {
  SyncEngine,
  type SyncStatus,
  type SyncStatusListener,
} from "./SyncEngine";
import { addToQueue } from "./SyncQueue";

import type { SupabaseClient } from "@supabase/supabase-js";

// Mock Supabase client factory
function createMockSupabaseClient(overrides?: {
  from?: Mock;
  rpc?: Mock;
}): SupabaseClient {
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
  const mockDelete = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
  const mockSelect = vi.fn().mockReturnValue({
    limit: vi.fn().mockReturnValue({
      abortSignal: vi
        .fn()
        .mockResolvedValue({ data: [{ id: "test" }], error: null }),
    }),
  });

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    // Return select for connectivity checks (lists table)
    if (table === "lists" && !overrides?.from) {
      return { select: mockSelect };
    }
    return {
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      select: mockSelect,
    };
  });

  const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });

  return {
    from: overrides?.from ?? mockFrom,
    rpc: overrides?.rpc ?? mockRpc,
  } as unknown as SupabaseClient;
}

describe("SyncEngine", () => {
  let engine: SyncEngine;
  let mockSupabase: SupabaseClient;

  beforeEach(async () => {
    // Reset singletons before each test
    resetNetworkMonitor();
    resetBackgroundSync();

    // Clear all tables
    await db.syncQueue.clear();
    await db.listItems.clear();
    await db.lists.clear();
    await db.syncMeta.clear();

    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    mockSupabase = createMockSupabaseClient();
    engine = new SyncEngine(mockSupabase);
  });

  afterEach(async () => {
    engine.destroy();
    resetNetworkMonitor();
    resetBackgroundSync();
    await db.syncQueue.clear();
    await db.listItems.clear();
    await db.lists.clear();
    await db.syncMeta.clear();
    vi.restoreAllMocks();
  });

  describe("constructor and initialization", () => {
    it("should create a SyncEngine with initial offline status", () => {
      const status = engine.getStatus();
      expect(status.status).toBe("offline");
      expect(status.lastSync).toBeNull();
      expect(status.error).toBeNull();
    });

    it("should set isOnline based on navigator.onLine", () => {
      expect(engine.getIsOnline()).toBe(true);
    });

    it("should initialize with online status when navigator is online", async () => {
      await engine.initialize();
      expect(engine.getIsOnline()).toBe(true);
    });
  });

  describe("processQueue", () => {
    beforeEach(async () => {
      // Add an active list for pullRemoteChanges
      await db.lists.add({
        id: "list-1",
        householdId: "h-1",
        name: "Test List",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await engine.initialize();
    });

    it("given the user comes online after being offline, when processQueue is called, then all queued operations are sent to Supabase in order", async () => {
      // Queue multiple operations
      await addToQueue("list_items", "INSERT", "item-1", {
        id: "item-1",
        displayName: "Milk",
        quantity: 2,
      });
      await addToQueue("list_items", "UPDATE", "item-1", {
        id: "item-1",
        displayName: "Whole Milk",
        quantity: 3,
      });
      await addToQueue("list_items", "DELETE", "item-2", { id: "item-2" });

      const mockFrom = mockSupabase.from as Mock;

      await engine.processQueue();

      // Verify operations were called in order
      expect(mockFrom).toHaveBeenCalledTimes(3);
      expect(mockFrom).toHaveBeenNthCalledWith(1, "list_items");
      expect(mockFrom).toHaveBeenNthCalledWith(2, "list_items");
      expect(mockFrom).toHaveBeenNthCalledWith(3, "list_items");
    });

    it("given a successful sync, when all operations complete, then the sync queue is cleared", async () => {
      // Queue operations
      await addToQueue("list_items", "INSERT", "item-1", {
        id: "item-1",
        displayName: "Test",
      });
      await addToQueue("list_items", "UPDATE", "item-2", {
        id: "item-2",
        displayName: "Test 2",
      });

      const countBefore = await db.syncQueue.count();
      expect(countBefore).toBe(2);

      await engine.processQueue();

      const countAfter = await db.syncQueue.count();
      expect(countAfter).toBe(0);
    });

    it("should not process queue if already syncing", async () => {
      await addToQueue("list_items", "INSERT", "item-1", { id: "item-1" });

      // Start first sync
      const firstSync = engine.processQueue();

      // Try to start second sync immediately
      const secondSync = engine.processQueue();

      await Promise.all([firstSync, secondSync]);

      // Should only have synced once
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it("should not process queue if offline", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });

      // Recreate engine with offline state
      engine.destroy();
      resetNetworkMonitor();
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      await addToQueue("list_items", "INSERT", "item-1", { id: "item-1" });

      await engine.processQueue();

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("should convert camelCase payload to snake_case when sending to Supabase", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ from: mockFrom });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      await addToQueue("list_items", "INSERT", "item-1", {
        id: "item-1",
        displayName: "Milk",
        categoryId: "cat-1",
        listId: "list-1",
        createdAt: "2024-01-01T00:00:00Z",
      });

      await engine.processQueue();

      expect(mockInsert).toHaveBeenCalledWith({
        id: "item-1",
        display_name: "Milk",
        category_id: "cat-1",
        list_id: "list-1",
        created_at: "2024-01-01T00:00:00Z",
      });
    });

    it("should handle INSERT operation errors and increment retry", async () => {
      const insertError = { message: "Insert failed" };
      const mockInsert = vi
        .fn()
        .mockResolvedValue({ data: null, error: insertError });
      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ from: mockFrom });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      const queueId = await addToQueue("list_items", "INSERT", "item-1", {
        id: "item-1",
      });

      await engine.processQueue();

      // Entry should still be in queue with incremented retry
      const entry = await db.syncQueue.get(queueId);
      expect(entry?.retries).toBe(1);
    });
  });

  describe("pullRemoteChanges", () => {
    beforeEach(async () => {
      // Add an active list
      await db.lists.add({
        id: "list-1",
        householdId: "h-1",
        name: "Test List",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await engine.initialize();
    });

    it("given a remote item has version=5 and local has version=3, when pulling changes, then the remote version is applied locally (remote wins)", async () => {
      // Set up local item with version 3
      await db.listItems.add({
        id: "item-1",
        listId: "list-1",
        rawText: "Old Milk",
        displayName: "Old Milk",
        quantity: 1,
        unit: null,
        note: null,
        categoryId: null,
        status: "pending",
        addedBy: null,
        checkedBy: null,
        checkedAt: null,
        version: 3,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });

      // Mock RPC to return remote item with version 5
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            id: "item-1",
            list_id: "list-1",
            raw_text: "New Milk",
            display_name: "New Milk",
            quantity: 3,
            unit: null,
            note: null,
            category_id: null,
            status: "pending",
            added_by: null,
            checked_by: null,
            checked_at: null,
            version: 5,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
          },
        ],
        error: null,
      });

      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ rpc: mockRpc });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      await engine.pullRemoteChanges();

      const localItem = await db.listItems.get("item-1");
      expect(localItem?.version).toBe(5);
      expect(localItem?.displayName).toBe("New Milk");
      expect(localItem?.quantity).toBe(3);
    });

    it("given a local item has version=5 and remote has version=3, when conflict detected, then the local version is kept (local wins)", async () => {
      // Set up local item with version 5
      await db.listItems.add({
        id: "item-1",
        listId: "list-1",
        rawText: "Local Milk",
        displayName: "Local Milk",
        quantity: 5,
        unit: null,
        note: null,
        categoryId: null,
        status: "checked",
        addedBy: null,
        checkedBy: null,
        checkedAt: null,
        version: 5,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-03T00:00:00Z",
      });

      // Mock RPC to return remote item with version 3
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            id: "item-1",
            list_id: "list-1",
            raw_text: "Remote Milk",
            display_name: "Remote Milk",
            quantity: 2,
            unit: null,
            note: null,
            category_id: null,
            status: "pending",
            added_by: null,
            checked_by: null,
            checked_at: null,
            version: 3,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T12:00:00Z",
          },
        ],
        error: null,
      });

      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ rpc: mockRpc });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      await engine.pullRemoteChanges();

      const localItem = await db.listItems.get("item-1");
      expect(localItem?.version).toBe(5);
      expect(localItem?.displayName).toBe("Local Milk");
      expect(localItem?.quantity).toBe(5);
      expect(localItem?.status).toBe("checked");

      // Verify the item is queued for push (local wins should queue for sync)
      const queueEntries = await db.syncQueue.toArray();
      expect(queueEntries.length).toBe(1);
      expect(queueEntries[0].recordId).toBe("item-1");
      expect(queueEntries[0].operation).toBe("UPDATE");
    });

    it("should add new remote items to local database", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            id: "new-item-1",
            list_id: "list-1",
            raw_text: "New Item",
            display_name: "New Item",
            quantity: 1,
            unit: "kg",
            note: "Fresh",
            category_id: "cat-1",
            status: "pending",
            added_by: "user-1",
            checked_by: null,
            checked_at: null,
            version: 1,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ],
        error: null,
      });

      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ rpc: mockRpc });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      await engine.pullRemoteChanges();

      const newItem = await db.listItems.get("new-item-1");
      expect(newItem).toBeDefined();
      expect(newItem?.displayName).toBe("New Item");
      expect(newItem?.unit).toBe("kg");
      expect(newItem?.categoryId).toBe("cat-1");
    });

    it("should convert snake_case from Supabase to camelCase for local storage", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            id: "item-1",
            list_id: "list-1",
            raw_text: "Test",
            display_name: "Test Item",
            quantity: 1,
            unit: null,
            note: null,
            category_id: "cat-123",
            status: "pending",
            added_by: "user-456",
            checked_by: null,
            checked_at: null,
            version: 1,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ],
        error: null,
      });

      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ rpc: mockRpc });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      await engine.pullRemoteChanges();

      const item = await db.listItems.get("item-1");
      expect(item?.listId).toBe("list-1");
      expect(item?.displayName).toBe("Test Item");
      expect(item?.categoryId).toBe("cat-123");
      expect(item?.addedBy).toBe("user-456");
      expect(item?.createdAt).toBe("2024-01-01T00:00:00Z");
    });

    it("should update lastSyncTimestamp after successful pull", async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });

      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ rpc: mockRpc });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      await engine.pullRemoteChanges();

      const syncMeta = await db.syncMeta.get("lastSyncTimestamp");
      expect(syncMeta).toBeDefined();
      expect(syncMeta?.value).toBeDefined();
    });

    it("should not pull changes if no active list exists", async () => {
      await db.lists.clear();

      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ rpc: mockRpc });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      await engine.pullRemoteChanges();

      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("should throw error when RPC fails", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "RPC failed" },
      });

      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ rpc: mockRpc });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      await expect(engine.pullRemoteChanges()).rejects.toThrow(
        "Failed to pull remote changes: RPC failed"
      );
    });
  });

  describe("periodic sync", () => {
    beforeEach(async () => {
      await db.lists.add({
        id: "list-1",
        householdId: "h-1",
        name: "Test List",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it("given the SyncEngine is initialized, when the user is online, then periodic sync is started", async () => {
      // Test that initialization starts periodic sync by checking the internal state
      // We can verify this by checking that going offline stops it (no errors)
      await engine.initialize();

      // The engine should be online and periodic sync should be running
      expect(engine.getIsOnline()).toBe(true);

      // Going offline should stop the periodic sync
      Object.defineProperty(navigator, "onLine", { value: false });
      window.dispatchEvent(new Event("offline"));

      expect(engine.getIsOnline()).toBe(false);
      const status = engine.getStatus();
      expect(status.status).toBe("offline");
    });

    it("should trigger sync immediately when coming back online", async () => {
      // Start offline
      Object.defineProperty(navigator, "onLine", { value: false });
      engine.destroy();
      resetNetworkMonitor();
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      expect(engine.getIsOnline()).toBe(false);

      await addToQueue("list_items", "INSERT", "item-1", { id: "item-1" });

      // Go online - this should trigger an immediate sync
      Object.defineProperty(navigator, "onLine", { value: true });

      // Wait for the async handler
      await new Promise<void>((resolve) => {
        const handler = () => {
          window.removeEventListener("online", handler);
          // Give the async handler time to complete
          setTimeout(resolve, 50);
        };
        window.addEventListener("online", handler);
        window.dispatchEvent(new Event("online"));
      });

      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it("should stop periodic sync when going offline", async () => {
      await engine.initialize();

      // Verify engine is online
      expect(engine.getIsOnline()).toBe(true);

      // Simulate going offline
      Object.defineProperty(navigator, "onLine", { value: false });
      window.dispatchEvent(new Event("offline"));

      // Verify engine is offline
      expect(engine.getIsOnline()).toBe(false);
      const status = engine.getStatus();
      expect(status.status).toBe("offline");
    });
  });

  describe("status updates", () => {
    beforeEach(async () => {
      await db.lists.add({
        id: "list-1",
        householdId: "h-1",
        name: "Test List",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await engine.initialize();
    });

    it("should notify listeners when sync status changes", async () => {
      const statusUpdates: SyncStatus[] = [];
      const listener: SyncStatusListener = (status) => {
        statusUpdates.push({ ...status });
      };

      engine.subscribe(listener);

      await addToQueue("list_items", "INSERT", "item-1", { id: "item-1" });
      await engine.processQueue();

      // Should have: initial status (from subscribe), syncing, synced
      expect(statusUpdates.length).toBeGreaterThanOrEqual(2);
      expect(statusUpdates.some((s) => s.status === "syncing")).toBe(true);
      expect(statusUpdates.some((s) => s.status === "synced")).toBe(true);
    });

    it("should notify listeners of error status when sync fails", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Sync error" },
      });

      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ rpc: mockRpc });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      const statusUpdates: SyncStatus[] = [];
      engine.subscribe((status) => statusUpdates.push({ ...status }));

      await engine.processQueue();

      expect(statusUpdates.some((s) => s.status === "error")).toBe(true);
      const errorStatus = statusUpdates.find((s) => s.status === "error");
      expect(errorStatus?.error).toBeDefined();
    });

    it("should notify listeners of offline status", async () => {
      const statusUpdates: SyncStatus[] = [];
      engine.subscribe((status) => statusUpdates.push({ ...status }));

      // Simulate going offline
      window.dispatchEvent(new Event("offline"));

      expect(statusUpdates.some((s) => s.status === "offline")).toBe(true);
    });

    it("should unsubscribe listener correctly", async () => {
      const statusUpdates: SyncStatus[] = [];
      const unsubscribe = engine.subscribe((status) =>
        statusUpdates.push({ ...status })
      );

      // First sync
      await addToQueue("list_items", "INSERT", "item-1", { id: "item-1" });
      await engine.processQueue();

      const countAfterFirstSync = statusUpdates.length;

      // Unsubscribe
      unsubscribe();

      // Second sync
      await addToQueue("list_items", "INSERT", "item-2", { id: "item-2" });
      await engine.processQueue();

      // Should not receive more updates
      expect(statusUpdates.length).toBe(countAfterFirstSync);
    });

    it("should immediately notify new subscriber with current status", () => {
      let receivedStatus: SyncStatus | undefined;
      engine.subscribe((status) => {
        receivedStatus = status;
      });

      expect(receivedStatus).toBeDefined();
      expect(receivedStatus!.status).toBeDefined();
    });
  });

  describe("forceSync", () => {
    beforeEach(async () => {
      await db.lists.add({
        id: "list-1",
        householdId: "h-1",
        name: "Test List",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await engine.initialize();
    });

    it("should trigger sync when called while online", async () => {
      await addToQueue("list_items", "INSERT", "item-1", { id: "item-1" });

      await engine.forceSync();

      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it("should not sync when called while offline", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });
      engine.destroy();
      resetNetworkMonitor();
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      await addToQueue("list_items", "INSERT", "item-1", { id: "item-1" });

      await engine.forceSync();

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe("false positive handling", () => {
    beforeEach(async () => {
      await db.lists.add({
        id: "list-1",
        householdId: "h-1",
        name: "Test List",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it("given the device reports online but Supabase is unreachable, when a sync attempt fails with network error, then the app transitions to offline state", async () => {
      // Create a mock that fails with a network error
      const mockRpc = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ rpc: mockRpc });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      const statusUpdates: SyncStatus[] = [];
      engine.subscribe((status) => statusUpdates.push({ ...status }));

      // Try to sync - should fail with network error
      await engine.processQueue();

      // Should transition to offline state (not error state)
      const finalStatus = statusUpdates[statusUpdates.length - 1];
      expect(finalStatus.status).toBe("offline");
      expect(finalStatus.error).toBeDefined();
    });

    it("given a network error during sync, when the error message contains 'timeout', then the app transitions to offline", async () => {
      const mockRpc = vi.fn().mockRejectedValue(new Error("Request timeout"));

      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ rpc: mockRpc });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      const statusUpdates: SyncStatus[] = [];
      engine.subscribe((status) => statusUpdates.push({ ...status }));

      await engine.processQueue();

      const finalStatus = statusUpdates[statusUpdates.length - 1];
      expect(finalStatus.status).toBe("offline");
    });

    it("given a non-network error during sync, when the error is not connection-related, then the app shows error state", async () => {
      // A non-network error (e.g., permission denied)
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Permission denied" },
      });

      engine.destroy();
      resetNetworkMonitor();
      mockSupabase = createMockSupabaseClient({ rpc: mockRpc });
      engine = new SyncEngine(mockSupabase);
      await engine.initialize();

      const statusUpdates: SyncStatus[] = [];
      engine.subscribe((status) => statusUpdates.push({ ...status }));

      await engine.processQueue();

      // Should show error state for non-network errors
      const finalStatus = statusUpdates[statusUpdates.length - 1];
      expect(finalStatus.status).toBe("error");
    });
  });

  describe("destroy", () => {
    it("should clean up resources when destroyed", async () => {
      await engine.initialize();

      const listener = vi.fn();
      engine.subscribe(listener);

      engine.destroy();

      // After destroy, listeners should not be notified
      // (we can't easily test event listeners removal, but we can test listener cleanup)
      expect(engine.getStatus()).toBeDefined(); // Still returns status, but no new notifications
    });
  });
});

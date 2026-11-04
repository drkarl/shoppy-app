import "fake-indexeddb/auto";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import {
  addToQueue,
  clearQueue,
  getQueueCount,
  getQueueEntry,
  incrementRetry,
  MAX_RETRIES,
  readQueue,
  removeFromQueue,
} from "./SyncQueue";
import { db } from "../db";

describe("SyncQueue", () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
  });

  afterEach(async () => {
    await db.syncQueue.clear();
  });

  describe("addToQueue", () => {
    it("should add an INSERT operation to the queue", async () => {
      const payload = { displayName: "Milk", quantity: 2 };

      const id = await addToQueue("listItems", "INSERT", "item-123", payload);

      expect(typeof id).toBe("number");
      const entry = await db.syncQueue.get(id);
      expect(entry).toBeDefined();
      expect(entry?.table).toBe("listItems");
      expect(entry?.operation).toBe("INSERT");
      expect(entry?.recordId).toBe("item-123");
      expect(entry?.payload).toEqual(payload);
      expect(entry?.retries).toBe(0);
      expect(entry?.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it("should add an UPDATE operation with full payload", async () => {
      const payload = {
        id: "item-456",
        displayName: "Whole Milk",
        quantity: 3,
        unit: "gallons",
        status: "pending",
      };

      const id = await addToQueue("listItems", "UPDATE", "item-456", payload);

      const entry = await db.syncQueue.get(id);
      expect(entry?.operation).toBe("UPDATE");
      expect(entry?.payload).toEqual(payload);
    });

    it("should add a DELETE operation to the queue", async () => {
      const id = await addToQueue("listItems", "DELETE", "item-789", null);

      const entry = await db.syncQueue.get(id);
      expect(entry?.operation).toBe("DELETE");
      expect(entry?.recordId).toBe("item-789");
      expect(entry?.payload).toBeNull();
    });

    it("should set initial retries to 0", async () => {
      const id = await addToQueue("lists", "INSERT", "list-1", {
        name: "Groceries",
      });

      const entry = await db.syncQueue.get(id);
      expect(entry?.retries).toBe(0);
    });

    it("should set timestamp to current time", async () => {
      const beforeTime = Date.now();
      const id = await addToQueue("households", "UPDATE", "h-1", {
        name: "Home",
      });
      const afterTime = Date.now();

      const entry = await db.syncQueue.get(id);
      expect(entry?.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(entry?.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("readQueue", () => {
    it("should return empty array when queue is empty", async () => {
      const queue = await readQueue();
      expect(queue).toEqual([]);
    });

    it("should return entries ordered by timestamp (oldest first)", async () => {
      const now = Date.now();

      // Add entries with specific timestamps by inserting directly
      await db.syncQueue.add({
        table: "listItems",
        operation: "INSERT",
        recordId: "item-3",
        payload: { order: 3 },
        timestamp: now + 2000,
        retries: 0,
      });
      await db.syncQueue.add({
        table: "listItems",
        operation: "INSERT",
        recordId: "item-1",
        payload: { order: 1 },
        timestamp: now,
        retries: 0,
      });
      await db.syncQueue.add({
        table: "listItems",
        operation: "UPDATE",
        recordId: "item-2",
        payload: { order: 2 },
        timestamp: now + 1000,
        retries: 0,
      });

      const queue = await readQueue();

      expect(queue).toHaveLength(3);
      expect(queue[0].recordId).toBe("item-1");
      expect(queue[1].recordId).toBe("item-2");
      expect(queue[2].recordId).toBe("item-3");
    });

    it("should return all queue entry fields", async () => {
      const payload = { displayName: "Test" };
      await db.syncQueue.add({
        table: "lists",
        operation: "UPDATE",
        recordId: "list-1",
        payload,
        timestamp: Date.now(),
        retries: 2,
      });

      const queue = await readQueue();

      expect(queue[0]).toHaveProperty("id");
      expect(queue[0].table).toBe("lists");
      expect(queue[0].operation).toBe("UPDATE");
      expect(queue[0].recordId).toBe("list-1");
      expect(queue[0].payload).toEqual(payload);
      expect(queue[0].retries).toBe(2);
      expect(typeof queue[0].timestamp).toBe("number");
    });
  });

  describe("removeFromQueue", () => {
    it("should remove a single entry by id", async () => {
      const id1 = await addToQueue("listItems", "INSERT", "item-1", {});
      await addToQueue("listItems", "INSERT", "item-2", {});

      await removeFromQueue(id1);

      const queue = await readQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].recordId).toBe("item-2");
    });

    it("should not throw when removing non-existent entry", async () => {
      await expect(removeFromQueue(99999)).resolves.toBeUndefined();
    });
  });

  describe("clearQueue", () => {
    it("should remove all entries from the queue", async () => {
      await addToQueue("listItems", "INSERT", "item-1", {});
      await addToQueue("listItems", "UPDATE", "item-2", {});
      await addToQueue("lists", "DELETE", "list-1", null);

      await clearQueue();

      const count = await getQueueCount();
      expect(count).toBe(0);
    });

    it("should not throw when clearing empty queue", async () => {
      await expect(clearQueue()).resolves.toBeUndefined();
    });
  });

  describe("incrementRetry", () => {
    let consoleErrorSpy: MockInstance;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("should increment retry count by 1", async () => {
      const id = await addToQueue("listItems", "INSERT", "item-1", {});

      await incrementRetry(id);

      const entry = await getQueueEntry(id);
      expect(entry?.retries).toBe(1);
    });

    it("should return removed: false when retries < MAX_RETRIES", async () => {
      const id = await addToQueue("listItems", "INSERT", "item-1", {});

      const result = await incrementRetry(id);

      expect(result.removed).toBe(false);
      expect(result.entry).toBeUndefined();
    });

    it("should remove entry when retry count reaches MAX_RETRIES", async () => {
      // Add entry and set retries to MAX_RETRIES - 1
      const id = (await db.syncQueue.add({
        table: "listItems",
        operation: "UPDATE",
        recordId: "item-1",
        payload: { test: true },
        timestamp: Date.now(),
        retries: MAX_RETRIES - 1,
      })) as number;

      const result = await incrementRetry(id);

      expect(result.removed).toBe(true);
      expect(result.entry?.recordId).toBe("item-1");
      expect(result.entry?.retries).toBe(MAX_RETRIES);

      const entry = await getQueueEntry(id);
      expect(entry).toBeUndefined();
    });

    it("should log error when operation fails after max retries", async () => {
      const id = (await db.syncQueue.add({
        table: "lists",
        operation: "DELETE",
        recordId: "list-fail",
        payload: null,
        timestamp: Date.now(),
        retries: MAX_RETRIES - 1,
      })) as number;

      await incrementRetry(id);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("failed after"),
        expect.objectContaining({
          table: "lists",
          operation: "DELETE",
          recordId: "list-fail",
        })
      );
    });

    it("should return removed: false for non-existent entry", async () => {
      const result = await incrementRetry(99999);

      expect(result.removed).toBe(false);
      expect(result.entry).toBeUndefined();
    });

    it("should handle consecutive retries correctly", async () => {
      const id = await addToQueue("listItems", "INSERT", "item-1", {});

      // First retry
      await incrementRetry(id);
      let entry = await getQueueEntry(id);
      expect(entry?.retries).toBe(1);

      // Second retry
      await incrementRetry(id);
      entry = await getQueueEntry(id);
      expect(entry?.retries).toBe(2);

      // Third retry - should be removed (MAX_RETRIES = 3)
      const result = await incrementRetry(id);
      expect(result.removed).toBe(true);
      entry = await getQueueEntry(id);
      expect(entry).toBeUndefined();
    });
  });

  describe("getQueueCount", () => {
    it("should return 0 for empty queue", async () => {
      const count = await getQueueCount();
      expect(count).toBe(0);
    });

    it("should return correct count of entries", async () => {
      await addToQueue("listItems", "INSERT", "item-1", {});
      await addToQueue("listItems", "UPDATE", "item-2", {});
      await addToQueue("lists", "DELETE", "list-1", null);

      const count = await getQueueCount();
      expect(count).toBe(3);
    });
  });

  describe("getQueueEntry", () => {
    it("should return entry by id", async () => {
      const payload = { name: "Test Item" };
      const id = await addToQueue("listItems", "INSERT", "item-1", payload);

      const entry = await getQueueEntry(id);

      expect(entry).toBeDefined();
      expect(entry?.id).toBe(id);
      expect(entry?.payload).toEqual(payload);
    });

    it("should return undefined for non-existent id", async () => {
      const entry = await getQueueEntry(99999);
      expect(entry).toBeUndefined();
    });
  });

  describe("MAX_RETRIES constant", () => {
    it("should be set to 3", () => {
      expect(MAX_RETRIES).toBe(3);
    });
  });

  describe("Queue ordering acceptance criteria", () => {
    it("given 3 operations are queued, when reading the queue, then entries are returned ordered by timestamp (oldest first)", async () => {
      const now = Date.now();

      // Add operations out of order
      await db.syncQueue.add({
        table: "listItems",
        operation: "UPDATE",
        recordId: "item-2",
        payload: {},
        timestamp: now + 100,
        retries: 0,
      });
      await db.syncQueue.add({
        table: "listItems",
        operation: "INSERT",
        recordId: "item-1",
        payload: {},
        timestamp: now,
        retries: 0,
      });
      await db.syncQueue.add({
        table: "listItems",
        operation: "DELETE",
        recordId: "item-3",
        payload: null,
        timestamp: now + 200,
        retries: 0,
      });

      const queue = await readQueue();

      expect(queue).toHaveLength(3);
      expect(queue.map((e) => e.recordId)).toEqual([
        "item-1",
        "item-2",
        "item-3",
      ]);
      expect(queue[0].timestamp).toBeLessThan(queue[1].timestamp);
      expect(queue[1].timestamp).toBeLessThan(queue[2].timestamp);
    });
  });

  describe("Retry counter acceptance criteria", () => {
    let consoleErrorSpy: MockInstance;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("given an operation fails 3 times, when the retry count reaches 3, then the entry is removed from the queue and logged as failed", async () => {
      const id = await addToQueue("listItems", "INSERT", "failing-item", {
        displayName: "Failing Item",
      });

      // Simulate 3 failed attempts
      await incrementRetry(id); // retries: 1
      await incrementRetry(id); // retries: 2
      const result = await incrementRetry(id); // retries: 3 - should be removed

      // Entry should be removed
      expect(result.removed).toBe(true);
      expect(result.entry?.retries).toBe(3);

      // Entry should no longer exist in queue
      const entry = await getQueueEntry(id);
      expect(entry).toBeUndefined();

      // Should have been logged
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});

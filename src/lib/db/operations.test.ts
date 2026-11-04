import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addItemLocal,
  checkItemLocal,
  deleteItemLocal,
  getItemById,
  getItemsByListId,
  restoreItemLocal,
  restoreItemsLocal,
  updateItemLocal,
} from "./operations";
import { readQueue } from "../sync/SyncQueue";

import { db } from "./index";

// Mock crypto.randomUUID for deterministic tests
vi.stubGlobal("crypto", {
  randomUUID: vi.fn(() => "test-uuid-1234"),
});

describe("Local CRUD Operations", () => {
  beforeEach(async () => {
    await db.listItems.clear();
    await db.syncQueue.clear();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db.listItems.clear();
    await db.syncQueue.clear();
  });

  describe("addItemLocal", () => {
    it("should add an item to Dexie and return the new ID", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });

      expect(id).toBe("test-uuid-1234");

      const item = await db.listItems.get(id);
      expect(item).toBeDefined();
      expect(item?.displayName).toBe("Milk");
      expect(item?.listId).toBe("list-123");
    });

    it("should set default values for optional fields", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Eggs",
      });

      const item = await db.listItems.get(id);
      expect(item?.quantity).toBe(1);
      expect(item?.unit).toBeNull();
      expect(item?.note).toBeNull();
      expect(item?.categoryId).toBeNull();
      expect(item?.status).toBe("pending");
      expect(item?.version).toBe(1);
    });

    it("should respect provided optional values", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Whole Milk",
        quantity: 2,
        unit: "gallons",
        note: "Get organic if available",
        categoryId: "dairy-123",
        addedBy: "user-456",
      });

      const item = await db.listItems.get(id);
      expect(item?.quantity).toBe(2);
      expect(item?.unit).toBe("gallons");
      expect(item?.note).toBe("Get organic if available");
      expect(item?.categoryId).toBe("dairy-123");
      expect(item?.addedBy).toBe("user-456");
    });

    it("should create a sync queue entry for the INSERT operation", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Bread",
      });

      const queue = await readQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].table).toBe("list_items");
      expect(queue[0].operation).toBe("INSERT");
      expect(queue[0].recordId).toBe(id);
    });

    it("should set rawText equal to displayName", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Fresh Bread",
      });

      const item = await db.listItems.get(id);
      expect(item?.rawText).toBe("Fresh Bread");
    });

    it("should set timestamps", async () => {
      const beforeTime = new Date().toISOString();
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Cheese",
      });
      const afterTime = new Date().toISOString();

      const item = await db.listItems.get(id);
      expect(item).toBeDefined();
      expect(item!.createdAt).toBeDefined();
      expect(item!.updatedAt).toBeDefined();
      expect(item!.createdAt).toBe(item!.updatedAt);
      expect(item!.createdAt >= beforeTime).toBe(true);
      expect(item!.createdAt <= afterTime).toBe(true);
    });
  });

  describe("updateItemLocal", () => {
    it("should update an existing item and return true", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      await db.syncQueue.clear();

      const result = await updateItemLocal(id, { quantity: 3 });

      expect(result).toBe(true);
      const item = await db.listItems.get(id);
      expect(item?.quantity).toBe(3);
    });

    it("should return false for non-existent item", async () => {
      const result = await updateItemLocal("non-existent-id", { quantity: 3 });
      expect(result).toBe(false);
    });

    it("should only update provided fields", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 1,
        note: "Original note",
      });
      await db.syncQueue.clear();

      await updateItemLocal(id, { quantity: 5 });

      const item = await db.listItems.get(id);
      expect(item?.quantity).toBe(5);
      expect(item?.displayName).toBe("Milk");
      expect(item?.note).toBe("Original note");
    });

    it("should update displayName and rawText together", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      await db.syncQueue.clear();

      await updateItemLocal(id, { displayName: "Whole Milk" });

      const item = await db.listItems.get(id);
      expect(item?.displayName).toBe("Whole Milk");
      expect(item?.rawText).toBe("Whole Milk");
    });

    it("should increment the version number", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      const originalItem = await db.listItems.get(id);
      await db.syncQueue.clear();

      await updateItemLocal(id, { quantity: 2 });

      const updatedItem = await db.listItems.get(id);
      expect(updatedItem?.version).toBe(originalItem!.version + 1);
    });

    it("should update the updatedAt timestamp", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      const originalItem = await db.listItems.get(id);
      await db.syncQueue.clear();

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      await updateItemLocal(id, { quantity: 2 });

      const updatedItem = await db.listItems.get(id);
      expect(updatedItem?.updatedAt).not.toBe(originalItem?.updatedAt);
    });

    it("should create a sync queue entry for the UPDATE operation", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      await db.syncQueue.clear();

      await updateItemLocal(id, { quantity: 2 });

      const queue = await readQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].table).toBe("list_items");
      expect(queue[0].operation).toBe("UPDATE");
      expect(queue[0].recordId).toBe(id);
    });

    it("should include full updated item in sync queue payload", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      await db.syncQueue.clear();

      await updateItemLocal(id, { quantity: 5 });

      const queue = await readQueue();
      const payload = queue[0].payload as {
        displayName: string;
        quantity: number;
      };
      expect(payload.displayName).toBe("Milk");
      expect(payload.quantity).toBe(5);
    });
  });

  describe("deleteItemLocal", () => {
    it("should delete an existing item and return true", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      await db.syncQueue.clear();

      const result = await deleteItemLocal(id);

      expect(result).toBe(true);
      const item = await db.listItems.get(id);
      expect(item).toBeUndefined();
    });

    it("should return false for non-existent item", async () => {
      const result = await deleteItemLocal("non-existent-id");
      expect(result).toBe(false);
    });

    it("should create a sync queue entry for the DELETE operation", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      await db.syncQueue.clear();

      await deleteItemLocal(id);

      const queue = await readQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].table).toBe("list_items");
      expect(queue[0].operation).toBe("DELETE");
      expect(queue[0].recordId).toBe(id);
    });

    it("should not create a sync queue entry if item does not exist", async () => {
      await deleteItemLocal("non-existent-id");

      const queue = await readQueue();
      expect(queue).toHaveLength(0);
    });
  });

  describe("checkItemLocal", () => {
    it("should toggle pending item to checked and return 'checked'", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      await db.syncQueue.clear();

      const result = await checkItemLocal(id);

      expect(result).toBe("checked");
      const item = await db.listItems.get(id);
      expect(item?.status).toBe("checked");
    });

    it("should toggle checked item to pending and return 'pending'", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      await checkItemLocal(id);
      await db.syncQueue.clear();

      const result = await checkItemLocal(id);

      expect(result).toBe("pending");
      const item = await db.listItems.get(id);
      expect(item?.status).toBe("pending");
    });

    it("should return null for non-existent item", async () => {
      const result = await checkItemLocal("non-existent-id");
      expect(result).toBeNull();
    });

    it("should set checkedAt and checkedBy when checking item", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      await db.syncQueue.clear();

      await checkItemLocal(id, { checkedBy: "user-789" });

      const item = await db.listItems.get(id);
      expect(item?.checkedBy).toBe("user-789");
      expect(item?.checkedAt).toBeDefined();
    });

    it("should clear checkedAt and checkedBy when unchecking item", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      await checkItemLocal(id, { checkedBy: "user-789" });
      await db.syncQueue.clear();

      await checkItemLocal(id);

      const item = await db.listItems.get(id);
      expect(item?.checkedBy).toBeNull();
      expect(item?.checkedAt).toBeNull();
    });

    it("should increment version number", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      const originalItem = await db.listItems.get(id);
      await db.syncQueue.clear();

      await checkItemLocal(id);

      const updatedItem = await db.listItems.get(id);
      expect(updatedItem?.version).toBe(originalItem!.version + 1);
    });

    it("should create a sync queue entry for the UPDATE operation", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      await db.syncQueue.clear();

      await checkItemLocal(id);

      const queue = await readQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].table).toBe("list_items");
      expect(queue[0].operation).toBe("UPDATE");
      expect(queue[0].recordId).toBe(id);
    });

    it("should update within 100ms for responsive UI", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      await db.syncQueue.clear();

      const startTime = performance.now();
      await checkItemLocal(id);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe("getItemsByListId", () => {
    it("should return all items for a list", async () => {
      // Mock different UUIDs for multiple items
      let callCount = 0;
      vi.stubGlobal("crypto", {
        randomUUID: vi.fn(() => `item-${++callCount}`),
      });

      await addItemLocal({ listId: "list-1", displayName: "Milk" });
      await addItemLocal({ listId: "list-1", displayName: "Eggs" });
      await addItemLocal({ listId: "list-2", displayName: "Bread" });

      const items = await getItemsByListId("list-1");

      expect(items).toHaveLength(2);
      expect(items.map((i) => i.displayName).sort()).toEqual(["Eggs", "Milk"]);
    });

    it("should return empty array for list with no items", async () => {
      const items = await getItemsByListId("empty-list");
      expect(items).toEqual([]);
    });
  });

  describe("getItemById", () => {
    it("should return item if found", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });

      const item = await getItemById(id);

      expect(item).toBeDefined();
      expect(item?.displayName).toBe("Milk");
    });

    it("should return undefined if not found", async () => {
      const item = await getItemById("non-existent-id");
      expect(item).toBeUndefined();
    });
  });

  describe("restoreItemLocal", () => {
    it("should restore a previously deleted item", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 2,
      });

      const originalItem = await getItemById(id);
      expect(originalItem).toBeDefined();

      await deleteItemLocal(id);
      expect(await getItemById(id)).toBeUndefined();

      await restoreItemLocal(originalItem!);
      const restoredItem = await getItemById(id);

      expect(restoredItem).toBeDefined();
      expect(restoredItem?.displayName).toBe("Milk");
      expect(restoredItem?.quantity).toBe(2);
    });

    it("should overwrite an existing item with original state", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 1,
      });

      const originalItem = await getItemById(id);
      expect(originalItem).toBeDefined();

      await updateItemLocal(id, { quantity: 5 });
      const modifiedItem = await getItemById(id);
      expect(modifiedItem?.quantity).toBe(5);

      await restoreItemLocal(originalItem!);
      const restoredItem = await getItemById(id);

      expect(restoredItem?.quantity).toBe(1);
    });

    it("should not add entries to sync queue", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });

      const originalItem = await getItemById(id);
      await db.syncQueue.clear();

      await restoreItemLocal(originalItem!);

      const queue = await readQueue();
      expect(queue).toHaveLength(0);
    });
  });

  describe("restoreItemsLocal", () => {
    it("should restore multiple items atomically", async () => {
      const id1 = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 2,
      });
      const id2 = await addItemLocal({
        listId: "list-123",
        displayName: "Eggs",
        quantity: 12,
      });

      const originalItem1 = await getItemById(id1);
      const originalItem2 = await getItemById(id2);

      // Modify both items
      await updateItemLocal(id1, { quantity: 5 });
      await deleteItemLocal(id2);

      // Restore both atomically
      await restoreItemsLocal([originalItem1!, originalItem2!]);

      const restoredItem1 = await getItemById(id1);
      const restoredItem2 = await getItemById(id2);

      expect(restoredItem1?.quantity).toBe(2);
      expect(restoredItem2?.displayName).toBe("Eggs");
      expect(restoredItem2?.quantity).toBe(12);
    });

    it("should not add entries to sync queue", async () => {
      const id1 = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
      });
      const id2 = await addItemLocal({
        listId: "list-123",
        displayName: "Eggs",
      });

      const originalItem1 = await getItemById(id1);
      const originalItem2 = await getItemById(id2);
      await db.syncQueue.clear();

      await restoreItemsLocal([originalItem1!, originalItem2!]);

      const queue = await readQueue();
      expect(queue).toHaveLength(0);
    });

    it("should restore empty array without error", async () => {
      await expect(restoreItemsLocal([])).resolves.not.toThrow();
    });
  });

  describe("Transaction atomicity", () => {
    it("should rollback both item and queue on failure", async () => {
      // Force a failure by mocking the add method
      const originalAdd = db.listItems.add.bind(db.listItems);
      let addCalled = false;

      // Use Object.defineProperty to avoid TypeScript complaints
      Object.defineProperty(db.listItems, "add", {
        value: async () => {
          addCalled = true;
          throw new Error("Simulated failure");
        },
        writable: true,
        configurable: true,
      });

      try {
        await addItemLocal({
          listId: "list-123",
          displayName: "Milk",
        });
      } catch {
        // Expected to throw
      }

      // Restore original method
      Object.defineProperty(db.listItems, "add", {
        value: originalAdd,
        writable: true,
        configurable: true,
      });
      expect(addCalled).toBe(true);

      // Both should be empty due to transaction rollback
      const items = await db.listItems.toArray();
      const queue = await readQueue();
      expect(items).toHaveLength(0);
      expect(queue).toHaveLength(0);
    });
  });

  describe("Acceptance Criteria", () => {
    it("Given a user adds an item, when addItemLocal() is called, then the item is written to Dexie immediately and returns the new ID", async () => {
      const beforeCount = await db.listItems.count();

      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Test Item",
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe("string");

      const afterCount = await db.listItems.count();
      expect(afterCount).toBe(beforeCount + 1);

      const item = await db.listItems.get(id);
      expect(item).toBeDefined();
      expect(item?.displayName).toBe("Test Item");
    });

    it("Given a user checks an item, when checkItemLocal() is called, then the status updates locally", async () => {
      const id = await addItemLocal({
        listId: "list-123",
        displayName: "Test Item",
      });
      const originalItem = await db.listItems.get(id);
      expect(originalItem?.status).toBe("pending");

      const newStatus = await checkItemLocal(id);

      expect(newStatus).toBe("checked");
      const updatedItem = await db.listItems.get(id);
      expect(updatedItem?.status).toBe("checked");
    });

    it("Given an operation completes, when checking the sync queue, then a corresponding queue entry exists", async () => {
      await db.syncQueue.clear();

      await addItemLocal({
        listId: "list-123",
        displayName: "Item 1",
      });

      const queue = await readQueue();
      expect(queue.length).toBeGreaterThan(0);
      expect(queue[0].table).toBe("list_items");
      expect(queue[0].operation).toBe("INSERT");
    });
  });
});

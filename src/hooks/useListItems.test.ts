import "fake-indexeddb/auto";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from "vitest";

import { mergeItems as mergeItemsApi } from "@/lib/api/items";
import { db } from "@/lib/db";
import {
  addItemLocal,
  deleteItemLocal,
  getItemById,
  restoreItemsLocal,
  updateItemLocal,
} from "@/lib/db/operations";

// Mock the API module
vi.mock("@/lib/api/items", () => ({
  mergeItems: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock crypto.randomUUID for deterministic tests
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: vi.fn(() => `test-uuid-${++uuidCounter}`),
});

/**
 * This function mirrors the merge logic in useListItems.ts for testing purposes.
 * In a real-world scenario, this logic would be extracted to a shared utility.
 */
async function mergeItemsWithRollback(
  listId: string,
  targetItemId: string,
  sourceItemId: string
): Promise<{ success: boolean; warning?: string }> {
  if (!listId) return { success: false };

  const originalTargetItem = await getItemById(targetItemId);
  const originalSourceItem = await getItemById(sourceItemId);

  if (!originalTargetItem || !originalSourceItem) {
    return { success: false };
  }

  // Helper to rollback optimistic updates atomically
  const rollbackMerge = async (errorMessage?: string) => {
    try {
      await restoreItemsLocal([originalTargetItem, originalSourceItem]);
      toast.error("Merge failed. Changes have been reverted.", {
        description: errorMessage || undefined,
      });
    } catch (rollbackErr) {
      console.error("Failed to rollback merge:", rollbackErr);
      toast.error("Merge failed and rollback encountered an error.", {
        description: "Please refresh the page to sync with the server.",
      });
    }
  };

  try {
    const mergedQuantity =
      originalTargetItem.quantity + originalSourceItem.quantity;
    await updateItemLocal(targetItemId, { quantity: mergedQuantity });
    await deleteItemLocal(sourceItemId);

    const result = await mergeItemsApi(listId, targetItemId, sourceItemId);

    if (!result.success) {
      console.error("Server merge failed:", result.error);
      await rollbackMerge(result.error || "Server sync failed");
      return { success: false };
    }

    return { success: true, warning: result.warning };
  } catch (err) {
    console.error("Failed to merge items:", err);
    await rollbackMerge();
    return { success: false };
  }
}

describe("useListItems - mergeItems rollback", () => {
  beforeEach(async () => {
    await db.listItems.clear();
    await db.syncQueue.clear();
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  afterEach(async () => {
    await db.listItems.clear();
    await db.syncQueue.clear();
  });

  describe("successful merge", () => {
    it("should merge items when server succeeds", async () => {
      const targetId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 2,
      });
      const sourceId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 3,
      });

      (mergeItemsApi as Mock).mockResolvedValue({
        success: true,
        item: { id: targetId, quantity: 5 },
      });

      const result = await mergeItemsWithRollback(
        "list-123",
        targetId,
        sourceId
      );

      expect(result.success).toBe(true);

      const targetItem = await getItemById(targetId);
      expect(targetItem?.quantity).toBe(5);

      const sourceItem = await getItemById(sourceId);
      expect(sourceItem).toBeUndefined();
    });

    it("should return warning when server returns warning", async () => {
      const targetId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 2,
        unit: "L",
      });
      const sourceId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 3,
        unit: "gallons",
      });

      (mergeItemsApi as Mock).mockResolvedValue({
        success: true,
        item: { id: targetId, quantity: 5 },
        warning: "Different units detected.",
      });

      const result = await mergeItemsWithRollback(
        "list-123",
        targetId,
        sourceId
      );

      expect(result.success).toBe(true);
      expect(result.warning).toBe("Different units detected.");
    });
  });

  describe("rollback on server failure", () => {
    it("should rollback changes when server returns error", async () => {
      const targetId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 2,
      });
      const sourceId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 3,
      });

      const originalTargetItem = await getItemById(targetId);
      const originalSourceItem = await getItemById(sourceId);

      (mergeItemsApi as Mock).mockResolvedValue({
        success: false,
        error: "Target item not found on server",
      });

      const result = await mergeItemsWithRollback(
        "list-123",
        targetId,
        sourceId
      );

      expect(result.success).toBe(false);

      // Verify rollback
      const targetItem = await getItemById(targetId);
      expect(targetItem?.quantity).toBe(originalTargetItem?.quantity);

      const sourceItem = await getItemById(sourceId);
      expect(sourceItem).toBeDefined();
      expect(sourceItem?.quantity).toBe(originalSourceItem?.quantity);
    });

    it("should show toast notification on rollback", async () => {
      const targetId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 2,
      });
      const sourceId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 3,
      });

      (mergeItemsApi as Mock).mockResolvedValue({
        success: false,
        error: "Server error",
      });

      await mergeItemsWithRollback("list-123", targetId, sourceId);

      expect(toast.error).toHaveBeenCalledWith(
        "Merge failed. Changes have been reverted.",
        expect.objectContaining({
          description: "Server error",
        })
      );
    });
  });

  describe("rollback on network error", () => {
    it("should rollback changes when network request throws", async () => {
      const targetId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 2,
      });
      const sourceId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 3,
      });

      const originalTargetItem = await getItemById(targetId);
      const originalSourceItem = await getItemById(sourceId);

      (mergeItemsApi as Mock).mockRejectedValue(new Error("Network error"));

      const result = await mergeItemsWithRollback(
        "list-123",
        targetId,
        sourceId
      );

      expect(result.success).toBe(false);

      // Verify rollback
      const targetItem = await getItemById(targetId);
      expect(targetItem?.quantity).toBe(originalTargetItem?.quantity);

      const sourceItem = await getItemById(sourceId);
      expect(sourceItem).toBeDefined();
      expect(sourceItem?.quantity).toBe(originalSourceItem?.quantity);
    });

    it("should show toast notification on network error rollback", async () => {
      const targetId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 2,
      });
      const sourceId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 3,
      });

      (mergeItemsApi as Mock).mockRejectedValue(new Error("Network error"));

      await mergeItemsWithRollback("list-123", targetId, sourceId);

      expect(toast.error).toHaveBeenCalledWith(
        "Merge failed. Changes have been reverted.",
        { description: undefined }
      );
    });
  });

  describe("edge cases", () => {
    it("should return failure if target item does not exist", async () => {
      const sourceId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 3,
      });

      const result = await mergeItemsWithRollback(
        "list-123",
        "non-existent-id",
        sourceId
      );

      expect(result.success).toBe(false);
      expect(mergeItemsApi).not.toHaveBeenCalled();
    });

    it("should return failure if source item does not exist", async () => {
      const targetId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 2,
      });

      const result = await mergeItemsWithRollback(
        "list-123",
        targetId,
        "non-existent-id"
      );

      expect(result.success).toBe(false);
      expect(mergeItemsApi).not.toHaveBeenCalled();
    });

    it("should return failure if listId is empty", async () => {
      const result = await mergeItemsWithRollback("", "target-id", "source-id");

      expect(result.success).toBe(false);
      expect(mergeItemsApi).not.toHaveBeenCalled();
    });

    it("should preserve original item state including all fields", async () => {
      const targetId = await addItemLocal({
        listId: "list-123",
        displayName: "Organic Milk",
        quantity: 2,
        unit: "L",
        note: "Get the fresh one",
        categoryId: "dairy-cat",
      });
      const sourceId = await addItemLocal({
        listId: "list-123",
        displayName: "Milk",
        quantity: 3,
      });

      const originalTargetItem = await getItemById(targetId);

      (mergeItemsApi as Mock).mockResolvedValue({
        success: false,
        error: "Server error",
      });

      await mergeItemsWithRollback("list-123", targetId, sourceId);

      const restoredTargetItem = await getItemById(targetId);
      expect(restoredTargetItem?.displayName).toBe(
        originalTargetItem?.displayName
      );
      expect(restoredTargetItem?.quantity).toBe(originalTargetItem?.quantity);
      expect(restoredTargetItem?.unit).toBe(originalTargetItem?.unit);
      expect(restoredTargetItem?.note).toBe(originalTargetItem?.note);
      expect(restoredTargetItem?.categoryId).toBe(
        originalTargetItem?.categoryId
      );
    });
  });
});

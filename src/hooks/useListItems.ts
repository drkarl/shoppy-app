"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { UNCATEGORIZED_CATEGORY } from "@/constants/categories";
import { mergeItems as mergeItemsApi } from "@/lib/api/items";
import {
  db,
  ListItem as DexieListItem,
  Category as DexieCategory,
} from "@/lib/db";
import {
  addItemLocal,
  checkItemLocal,
  deleteItemLocal,
  getItemById,
  restoreItemsLocal,
  updateItemLocal,
} from "@/lib/db/operations";
import { isLocalOnlyMode } from "@/lib/supabase/mock-mode";

import type { Category, CategoryGroup, ListItem } from "@/types/list";

export interface MergeItemsResult {
  success: boolean;
  warning?: string;
}

interface UseListItemsReturn {
  items: ListItem[];
  pendingGroups: CategoryGroup[];
  checkedItems: ListItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addItem: (
    displayName: string,
    quantity?: number,
    categoryId?: string
  ) => Promise<ListItem | null>;
  toggleItem: (itemId: string) => Promise<boolean>;
  deleteItem: (itemId: string) => Promise<boolean>;
  mergeItems: (
    targetItemId: string,
    sourceItemId: string
  ) => Promise<MergeItemsResult>;
}

/**
 * Convert a Dexie category (camelCase) to frontend category (snake_case compatible).
 * Category type has same field names in both, just needs the subset of fields.
 */
function toFrontendCategory(category: DexieCategory | null): Category | null {
  if (!category) return null;
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
  };
}

/**
 * Convert a Dexie list item (camelCase) to frontend list item (snake_case).
 */
function toFrontendItem(
  item: DexieListItem,
  category: DexieCategory | null
): ListItem {
  return {
    id: item.id,
    list_id: item.listId,
    raw_text: item.rawText,
    display_name: item.displayName,
    quantity: item.quantity,
    unit: item.unit,
    note: item.note,
    category_id: item.categoryId,
    status: item.status,
    added_by: item.addedBy ?? "",
    checked_by: item.checkedBy,
    checked_at: item.checkedAt,
    version: item.version,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    categories: toFrontendCategory(category),
  };
}

function groupByCategory(items: ListItem[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();

  for (const item of items) {
    const categoryId = item.category_id || "uncategorized";
    const existing = groups.get(categoryId);

    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(categoryId, {
        category: item.categories || UNCATEGORIZED_CATEGORY,
        items: [item],
      });
    }
  }

  // Sort groups by category name, but put "Other" last
  return Array.from(groups.values()).sort((a, b) => {
    if (a.category?.id === "uncategorized") return 1;
    if (b.category?.id === "uncategorized") return -1;
    return (a.category?.name || "").localeCompare(b.category?.name || "");
  });
}

export function useListItems(listId: string | null): UseListItemsReturn {
  // Use Dexie's liveQuery for reactive data binding
  // This automatically re-renders the component when data changes
  const queryResult = useLiveQuery(
    async () => {
      if (!listId) {
        return { items: [], categories: new Map<string, DexieCategory>() };
      }

      // Fetch items and categories in parallel
      const [dexieItems, allCategories] = await Promise.all([
        db.listItems.where("listId").equals(listId).toArray(),
        db.categories.toArray(),
      ]);

      // Create a map for fast category lookup
      const categoryMap = new Map<string, DexieCategory>();
      for (const cat of allCategories) {
        categoryMap.set(cat.id, cat);
      }

      return { items: dexieItems, categories: categoryMap };
    },
    [listId],
    { items: [], categories: new Map<string, DexieCategory>() }
  );

  // Convert Dexie items to frontend format with category data
  const items = useMemo(() => {
    if (!queryResult) return [];
    return queryResult.items.map((item) =>
      toFrontendItem(
        item,
        queryResult.categories.get(item.categoryId ?? "") ?? null
      )
    );
  }, [queryResult]);

  // liveQuery returns undefined while loading initially
  const isLoading = queryResult === undefined;

  const addItem = useCallback(
    async (
      displayName: string,
      quantity: number = 1,
      categoryId?: string
    ): Promise<ListItem | null> => {
      if (!listId) return null;

      try {
        const id = await addItemLocal({
          listId,
          displayName,
          quantity,
          categoryId: categoryId || null,
        });

        // Get the created item to return
        const dexieItem = await db.listItems.get(id);
        if (!dexieItem) return null;

        const category = dexieItem.categoryId
          ? await db.categories.get(dexieItem.categoryId)
          : null;

        return toFrontendItem(dexieItem, category ?? null);
      } catch (err) {
        console.error("Failed to add item:", err);
        return null;
      }
    },
    [listId]
  );

  const toggleItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      const result = await checkItemLocal(itemId);
      return result !== null;
    } catch (err) {
      console.error("Failed to toggle item:", err);
      return false;
    }
  }, []);

  const deleteItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      return await deleteItemLocal(itemId);
    } catch (err) {
      console.error("Failed to delete item:", err);
      return false;
    }
  }, []);

  const mergeItems = useCallback(
    async (
      targetItemId: string,
      sourceItemId: string
    ): Promise<MergeItemsResult> => {
      if (!listId) return { success: false };

      // Capture original state from Dexie for rollback
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
        // Optimistically update local Dexie first
        const mergedQuantity =
          originalTargetItem.quantity + originalSourceItem.quantity;
        await updateItemLocal(targetItemId, { quantity: mergedQuantity });
        await deleteItemLocal(sourceItemId);

        // In local-only mode, no server sync needed - local update is sufficient
        if (isLocalOnlyMode()) {
          return { success: true };
        }

        // Then sync to server
        const result = await mergeItemsApi(listId, targetItemId, sourceItemId);

        if (!result.success) {
          // Server merge failed - rollback local optimistic updates
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
    },
    [listId]
  );

  // Refetch is a no-op with liveQuery since it's reactive
  // Keeping for API compatibility, but data updates automatically
  const refetch = useCallback(async () => {
    // liveQuery handles reactivity automatically
    // This is kept for API compatibility but is effectively a no-op
  }, []);

  const pendingItems = useMemo(
    () => items.filter((item) => item.status === "pending"),
    [items]
  );
  const checkedItems = useMemo(
    () => items.filter((item) => item.status === "checked"),
    [items]
  );
  const pendingGroups = useMemo(
    () => groupByCategory(pendingItems),
    [pendingItems]
  );

  return {
    items,
    pendingGroups,
    checkedItems,
    isLoading,
    error: null, // Local operations don't produce errors in the same way
    refetch,
    addItem,
    toggleItem,
    deleteItem,
    mergeItems,
  };
}

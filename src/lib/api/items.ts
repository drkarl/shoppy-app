import type { ListItem } from "@/types/list";

export interface MergeItemsResult {
  success: boolean;
  item?: ListItem;
  warning?: string;
  error?: string;
}

/**
 * Merges a source item into a target item.
 *
 * @param listId - The list containing both items
 * @param targetItemId - The item to merge into (keeps metadata)
 * @param sourceItemId - The item to merge from (will be deleted)
 * @returns Result with merged item, optional warning, or error
 */
export async function mergeItems(
  listId: string,
  targetItemId: string,
  sourceItemId: string
): Promise<MergeItemsResult> {
  try {
    const response = await fetch(
      `/api/lists/${listId}/items/${targetItemId}/merge`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_item_id: sourceItemId }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to merge items",
      };
    }

    return {
      success: true,
      item: data.item,
      warning: data.warning,
    };
  } catch {
    return {
      success: false,
      error: "Network error while merging items",
    };
  }
}

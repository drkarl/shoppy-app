import type { Category } from "@/types/list";

/**
 * Default category used when an item has no assigned category.
 * Used consistently across the app for uncategorized items.
 */
export const UNCATEGORIZED_CATEGORY: Category = {
  id: "uncategorized",
  name: "Other",
  icon: "package",
};

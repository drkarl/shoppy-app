"use client";

import { useLiveQuery } from "dexie-react-hooks";

import { db, Category as DexieCategory } from "@/lib/db";

export interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  defaultOrder: number;
}

interface UseCategoriesReturn {
  categories: CategoryItem[];
  isLoading: boolean;
}

/**
 * Hook to fetch all categories from Dexie with reactive updates.
 * Categories are returned sorted by their default order.
 */
export function useCategories(): UseCategoriesReturn {
  const categories = useLiveQuery(
    async () => {
      const allCategories = await db.categories
        .orderBy("defaultOrder")
        .toArray();
      return allCategories.map(
        (cat: DexieCategory): CategoryItem => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          defaultOrder: cat.defaultOrder,
        })
      );
    },
    [],
    []
  );

  return {
    categories: categories ?? [],
    isLoading: categories === undefined,
  };
}

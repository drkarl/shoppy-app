"use client";

import { useCallback, useEffect, useState } from "react";

import { db } from "@/lib/db";
import { isLocalOnlyMode } from "@/lib/supabase/mock-mode";

import type { List } from "@/types/list";

interface UseActiveListReturn {
  list: List | null;
  isLoading: boolean;
  error: string | null;
  createList: (name: string) => Promise<List | null>;
  refetch: () => Promise<void>;
}

export function useActiveList(householdId: string | null): UseActiveListReturn {
  const [list, setList] = useState<List | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLists = useCallback(async () => {
    if (!householdId) {
      setList(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // In local-only mode, use Dexie directly
    if (isLocalOnlyMode()) {
      try {
        let localLists = await db.lists
          .where("householdId")
          .equals(householdId)
          .and((l) => l.status === "active")
          .toArray();

        // Auto-create a default list if none exists
        if (localLists.length === 0) {
          const now = new Date().toISOString();
          const newList = {
            id: crypto.randomUUID(),
            householdId,
            name: "Shopping List",
            status: "active" as const,
            createdAt: now,
            updatedAt: now,
          };
          await db.lists.add(newList);
          localLists = [newList];
        }

        // Convert Dexie camelCase to snake_case for consistency with API
        const firstList = localLists[0];
        if (firstList) {
          setList({
            id: firstList.id,
            household_id: firstList.householdId,
            name: firstList.name,
            status: firstList.status,
            created_at: firstList.createdAt,
            updated_at: firstList.updatedAt,
          });
        } else {
          setList(null);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch lists";
        setError(message);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const response = await fetch("/api/lists");
      if (!response.ok) {
        throw new Error("Failed to fetch lists");
      }
      const data = await response.json();

      // Find the first active list for this household
      const householdLists = (data.lists || []).filter(
        (l: List) => l.household_id === householdId && l.status === "active"
      );

      setList(householdLists[0] || null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch lists";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const createList = useCallback(
    async (name: string): Promise<List | null> => {
      if (!householdId) return null;

      // In local-only mode, create directly in Dexie
      if (isLocalOnlyMode()) {
        try {
          const now = new Date().toISOString();
          const newList = {
            id: crypto.randomUUID(),
            householdId,
            name,
            status: "active" as const,
            createdAt: now,
            updatedAt: now,
          };
          await db.lists.add(newList);

          const list: List = {
            id: newList.id,
            household_id: newList.householdId,
            name: newList.name,
            status: newList.status,
            created_at: newList.createdAt,
            updated_at: newList.updatedAt,
          };
          setList(list);
          return list;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to create list";
          setError(message);
          return null;
        }
      }

      try {
        const response = await fetch("/api/lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            household_id: householdId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create list");
        }

        const data = await response.json();
        setList(data.list);
        return data.list;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create list";
        setError(message);
        return null;
      }
    },
    [householdId]
  );

  return {
    list,
    isLoading,
    error,
    createList,
    refetch: fetchLists,
  };
}

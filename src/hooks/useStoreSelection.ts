"use client";

import { useCallback, useEffect, useState } from "react";

import type { StoreProfile } from "@/types/store-profile";

const STORAGE_KEY_PREFIX = "selected-store-profile-";

interface UseStoreSelectionReturn {
  storeProfiles: StoreProfile[];
  selectedStore: StoreProfile | null;
  isLoading: boolean;
  error: string | null;
  selectStore: (store: StoreProfile) => void;
  refetch: () => Promise<void>;
}

function getStorageKey(householdId: string): string {
  return `${STORAGE_KEY_PREFIX}${householdId}`;
}

function loadSelectedStoreId(householdId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(getStorageKey(householdId));
  } catch {
    return null;
  }
}

function saveSelectedStoreId(householdId: string, storeId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(householdId), storeId);
  } catch {
    // Ignore storage errors (e.g., quota exceeded, private browsing)
  }
}

export function useStoreSelection(
  householdId: string | null
): UseStoreSelectionReturn {
  const [storeProfiles, setStoreProfiles] = useState<StoreProfile[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStoreProfiles = useCallback(async () => {
    if (!householdId) {
      setStoreProfiles([]);
      setSelectedStore(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/store-profiles?household_id=${encodeURIComponent(householdId)}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch store profiles");
      }
      const data = await response.json();
      const profiles: StoreProfile[] = data.store_profiles || [];

      setStoreProfiles(profiles);

      // Restore selection from localStorage or fall back to default store
      const savedStoreId = loadSelectedStoreId(householdId);
      const savedStore = profiles.find((p) => p.id === savedStoreId);
      const defaultStore = profiles.find((p) => p.is_default);

      if (savedStore) {
        setSelectedStore(savedStore);
      } else if (defaultStore) {
        setSelectedStore(defaultStore);
        saveSelectedStoreId(householdId, defaultStore.id);
      } else if (profiles.length > 0) {
        // Fall back to first store if no default
        setSelectedStore(profiles[0]);
        saveSelectedStoreId(householdId, profiles[0].id);
      } else {
        setSelectedStore(null);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch store profiles";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    fetchStoreProfiles();
  }, [fetchStoreProfiles]);

  const selectStore = useCallback(
    (store: StoreProfile) => {
      setSelectedStore(store);
      if (householdId) {
        saveSelectedStoreId(householdId, store.id);
      }
    },
    [householdId]
  );

  return {
    storeProfiles,
    selectedStore,
    isLoading,
    error,
    selectStore,
    refetch: fetchStoreProfiles,
  };
}

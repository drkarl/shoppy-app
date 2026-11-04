import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { useStoreSelection } from "./useStoreSelection";

import type { StoreProfile } from "@/types/store-profile";

const mockStoreProfiles: StoreProfile[] = [
  {
    id: "store-1",
    household_id: "household-123",
    store_name: "Walmart",
    category_order: [],
    is_default: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "store-2",
    household_id: "household-123",
    store_name: "Target",
    category_order: [],
    is_default: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

describe("useStoreSelection", () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    };
  })();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty state when householdId is null", async () => {
    const { result } = renderHook(() => useStoreSelection(null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.storeProfiles).toEqual([]);
    expect(result.current.selectedStore).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("fetches store profiles on mount", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ store_profiles: mockStoreProfiles }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useStoreSelection("household-123"));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/store-profiles?household_id=household-123"
    );
    expect(result.current.storeProfiles).toEqual(mockStoreProfiles);
  });

  it("selects default store when no localStorage value exists", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ store_profiles: mockStoreProfiles }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useStoreSelection("household-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should select the default store (Walmart)
    expect(result.current.selectedStore?.id).toBe("store-1");
    expect(result.current.selectedStore?.store_name).toBe("Walmart");
  });

  it("restores selection from localStorage", async () => {
    // Pre-populate localStorage with Target
    localStorageMock.setItem("selected-store-profile-household-123", "store-2");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ store_profiles: mockStoreProfiles }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useStoreSelection("household-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should restore Target from localStorage
    expect(result.current.selectedStore?.id).toBe("store-2");
    expect(result.current.selectedStore?.store_name).toBe("Target");
  });

  it("saves selection to localStorage when selectStore is called", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ store_profiles: mockStoreProfiles }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useStoreSelection("household-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.selectStore(mockStoreProfiles[1]);
    });

    expect(result.current.selectedStore?.id).toBe("store-2");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "selected-store-profile-household-123",
      "store-2"
    );
  });

  it("handles fetch error gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Failed" }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useStoreSelection("household-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch store profiles");
    expect(result.current.storeProfiles).toEqual([]);
  });

  it("handles network error gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = mockFetch;

    const { result } = renderHook(() => useStoreSelection("household-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.storeProfiles).toEqual([]);
  });

  it("falls back to first store when no default exists", async () => {
    const storesWithoutDefault = mockStoreProfiles.map((s) => ({
      ...s,
      is_default: false,
    }));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ store_profiles: storesWithoutDefault }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useStoreSelection("household-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fall back to first store
    expect(result.current.selectedStore?.id).toBe("store-1");
  });

  it("handles empty store profiles list", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ store_profiles: [] }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useStoreSelection("household-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.storeProfiles).toEqual([]);
    expect(result.current.selectedStore).toBeNull();
  });

  it("refetches when householdId changes", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ store_profiles: mockStoreProfiles }),
    });
    global.fetch = mockFetch;

    const { result, rerender } = renderHook(
      ({ householdId }) => useStoreSelection(householdId),
      { initialProps: { householdId: "household-123" } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    rerender({ householdId: "household-456" });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/store-profiles?household_id=household-456"
    );
  });

  it("refetch function triggers a new fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ store_profiles: mockStoreProfiles }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useStoreSelection("household-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("ignores invalid localStorage value", async () => {
    // Pre-populate localStorage with non-existent store ID
    localStorageMock.setItem(
      "selected-store-profile-household-123",
      "non-existent-store"
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ store_profiles: mockStoreProfiles }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useStoreSelection("household-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fall back to default store
    expect(result.current.selectedStore?.id).toBe("store-1");
  });
});

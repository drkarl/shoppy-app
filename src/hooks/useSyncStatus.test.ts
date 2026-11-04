import { act, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import {
  useSync,
  useSyncStatus as useBaseSyncStatus,
} from "@/components/providers/SyncProvider";

import { useSyncStatus } from "./useSyncStatus";

vi.mock("@/components/providers/SyncProvider", () => ({
  useSync: vi.fn(),
  useSyncStatus: vi.fn(),
}));

describe("useSyncStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (useSync as Mock).mockReturnValue({
      forceSync: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns offline status with helper flags", () => {
    (useBaseSyncStatus as Mock).mockReturnValue({
      status: "offline",
      lastSync: null,
      error: null,
      pendingOperations: 0,
    });

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.status).toBe("offline");
    expect(result.current.isOffline).toBe(true);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.isSynced).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(result.current.justSynced).toBe(false);
  });

  it("returns syncing status with helper flags", () => {
    (useBaseSyncStatus as Mock).mockReturnValue({
      status: "syncing",
      lastSync: null,
      error: null,
      pendingOperations: 2,
    });

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.status).toBe("syncing");
    expect(result.current.isOffline).toBe(false);
    expect(result.current.isSyncing).toBe(true);
    expect(result.current.isSynced).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it("returns synced status with helper flags", () => {
    (useBaseSyncStatus as Mock).mockReturnValue({
      status: "synced",
      lastSync: new Date(),
      error: null,
      pendingOperations: 0,
    });

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.status).toBe("synced");
    expect(result.current.isOffline).toBe(false);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.isSynced).toBe(true);
    expect(result.current.hasError).toBe(false);
  });

  it("returns error status with helper flags", () => {
    (useBaseSyncStatus as Mock).mockReturnValue({
      status: "error",
      lastSync: null,
      error: new Error("Sync failed"),
      pendingOperations: 1,
    });

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.status).toBe("error");
    expect(result.current.isOffline).toBe(false);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.isSynced).toBe(false);
    expect(result.current.hasError).toBe(true);
    expect(result.current.error?.message).toBe("Sync failed");
  });

  it("sets justSynced when transitioning from syncing to synced", () => {
    // Start with syncing
    (useBaseSyncStatus as Mock).mockReturnValue({
      status: "syncing",
      lastSync: null,
      error: null,
      pendingOperations: 1,
    });

    const { result, rerender } = renderHook(() => useSyncStatus());
    expect(result.current.justSynced).toBe(false);

    // Transition to synced
    (useBaseSyncStatus as Mock).mockReturnValue({
      status: "synced",
      lastSync: new Date(),
      error: null,
      pendingOperations: 0,
    });

    rerender();

    // Advance past the setTimeout(0) that sets justSynced
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.justSynced).toBe(true);
  });

  it("clears justSynced after 2 seconds", () => {
    // Start with syncing
    (useBaseSyncStatus as Mock).mockReturnValue({
      status: "syncing",
      lastSync: null,
      error: null,
      pendingOperations: 1,
    });

    const { result, rerender } = renderHook(() => useSyncStatus());

    // Transition to synced
    (useBaseSyncStatus as Mock).mockReturnValue({
      status: "synced",
      lastSync: new Date(),
      error: null,
      pendingOperations: 0,
    });

    rerender();

    // Advance past the setTimeout(0) that sets justSynced
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.justSynced).toBe(true);

    // Advance time by 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // After timers advance, justSynced should be false
    expect(result.current.justSynced).toBe(false);
  });

  it("does not set justSynced for other transitions", () => {
    // Start with synced
    (useBaseSyncStatus as Mock).mockReturnValue({
      status: "synced",
      lastSync: new Date(),
      error: null,
      pendingOperations: 0,
    });

    const { result, rerender } = renderHook(() => useSyncStatus());
    expect(result.current.justSynced).toBe(false);

    // Transition to offline
    (useBaseSyncStatus as Mock).mockReturnValue({
      status: "offline",
      lastSync: null,
      error: null,
      pendingOperations: 0,
    });

    rerender();

    // Advance timers to ensure no async setState
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.justSynced).toBe(false);
  });
});

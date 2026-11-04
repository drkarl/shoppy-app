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
  getNetworkMonitor,
  NetworkMonitor,
  resetNetworkMonitor,
  type NetworkState,
} from "./NetworkMonitor";

import type { SupabaseClient } from "@supabase/supabase-js";

// Mock Supabase client factory
function createMockSupabaseClient(overrides?: {
  connectivityCheckResult?: boolean;
  connectivityCheckDelay?: number;
}): SupabaseClient {
  const { connectivityCheckResult = true, connectivityCheckDelay = 0 } =
    overrides || {};

  const mockSelect = vi.fn().mockReturnValue({
    limit: vi.fn().mockReturnValue({
      abortSignal: vi.fn().mockImplementation(async () => {
        if (connectivityCheckDelay > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, connectivityCheckDelay)
          );
        }
        if (connectivityCheckResult) {
          return { data: [{ id: "test" }], error: null };
        } else {
          return {
            data: null,
            error: { message: "Failed to fetch" },
          };
        }
      }),
    }),
  });

  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
  });

  return {
    from: mockFrom,
  } as unknown as SupabaseClient;
}

describe("NetworkMonitor", () => {
  let monitor: NetworkMonitor;
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    // Reset the singleton before each test
    resetNetworkMonitor();

    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    vi.useFakeTimers();

    mockSupabase = createMockSupabaseClient();
    monitor = new NetworkMonitor();
  });

  afterEach(() => {
    monitor.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetNetworkMonitor();
  });

  describe("initialization", () => {
    it("should initialize with online state when navigator reports online", () => {
      expect(monitor.getState()).toBe("online");
      expect(monitor.isOnline()).toBe(true);
    });

    it("should initialize with offline state when navigator reports offline", () => {
      Object.defineProperty(navigator, "onLine", { value: false });
      const offlineMonitor = new NetworkMonitor();

      expect(offlineMonitor.getState()).toBe("offline");
      expect(offlineMonitor.isOnline()).toBe(false);

      offlineMonitor.destroy();
    });
  });

  describe("event handling", () => {
    beforeEach(() => {
      monitor.initialize(mockSupabase);
    });

    it("given the device goes offline, when the offline event fires, then state becomes offline", () => {
      Object.defineProperty(navigator, "onLine", { value: false });
      window.dispatchEvent(new Event("offline"));

      expect(monitor.getState()).toBe("offline");
      expect(monitor.isOnline()).toBe(false);
    });

    it("given the device comes online, when the online event fires, then state transitions to checking then online", async () => {
      const stateChanges: NetworkState[] = [];
      monitor.subscribe((state) => stateChanges.push(state));

      // Start offline
      Object.defineProperty(navigator, "onLine", { value: false });
      window.dispatchEvent(new Event("offline"));

      stateChanges.length = 0; // Clear initial states

      // Go online
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));

      // Should immediately transition to "checking"
      expect(stateChanges[0]).toBe("checking");

      // Wait for connectivity check to complete
      await vi.runAllTimersAsync();

      // Should transition to "online" after successful check
      expect(stateChanges).toContain("online");
    });

    it("given the device reports online but Supabase is unreachable, when connectivity check fails, then state becomes offline (false positive)", async () => {
      // Create monitor with failing connectivity check
      monitor.destroy();
      mockSupabase = createMockSupabaseClient({
        connectivityCheckResult: false,
      });
      monitor = new NetworkMonitor();
      monitor.initialize(mockSupabase);

      const stateChanges: NetworkState[] = [];
      monitor.subscribe((state) => stateChanges.push(state));

      // Start offline
      Object.defineProperty(navigator, "onLine", { value: false });
      window.dispatchEvent(new Event("offline"));

      stateChanges.length = 0;

      // Browser reports online
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));

      // Wait for connectivity check
      await vi.runAllTimersAsync();

      // Should end up offline due to failed connectivity check
      expect(monitor.getState()).toBe("offline");
    });
  });

  describe("debouncing", () => {
    let syncCallback: Mock;

    beforeEach(() => {
      syncCallback = vi.fn();
      monitor.initialize(mockSupabase);
      monitor.onSyncNeeded(syncCallback);
    });

    it("given rapid network fluctuations, when online events fire quickly, then sync is debounced (max 1 per 5 seconds)", async () => {
      // First online event - should trigger sync
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));
      await vi.runAllTimersAsync();

      expect(syncCallback).toHaveBeenCalledTimes(1);

      // Record time and sync count
      const syncCountAfterFirst = syncCallback.mock.calls.length;

      // Simulate rapid fluctuations within 1 second (offline -> online multiple times)
      // Don't run timers between iterations - just dispatch events rapidly
      for (let i = 0; i < 5; i++) {
        Object.defineProperty(navigator, "onLine", { value: false });
        window.dispatchEvent(new Event("offline"));

        Object.defineProperty(navigator, "onLine", { value: true });
        window.dispatchEvent(new Event("online"));

        // Only advance 100ms per iteration (total 500ms, well under 5s debounce)
        await vi.advanceTimersByTimeAsync(100);
      }

      // Wait for any pending connectivity checks to complete
      await vi.advanceTimersByTimeAsync(100);

      // Debounce means only 1 additional sync should have been scheduled
      // (could be 0-1 additional syncs depending on timing)
      const additionalSyncs =
        syncCallback.mock.calls.length - syncCountAfterFirst;
      expect(additionalSyncs).toBeLessThanOrEqual(1);
    });

    it("should allow sync after debounce period expires", async () => {
      // First sync
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));
      await vi.runAllTimersAsync();

      expect(syncCallback).toHaveBeenCalledTimes(1);

      // Wait for debounce period (5 seconds)
      await vi.advanceTimersByTimeAsync(5000);

      // Second online event
      Object.defineProperty(navigator, "onLine", { value: false });
      window.dispatchEvent(new Event("offline"));
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));
      await vi.runAllTimersAsync();

      // Should have two calls now
      expect(syncCallback).toHaveBeenCalledTimes(2);
    });

    it("should cancel pending debounced sync when going offline", async () => {
      // Start a sync
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));
      await vi.runAllTimersAsync();

      const callsAfterFirstSync = syncCallback.mock.calls.length;
      expect(callsAfterFirstSync).toBe(1);

      // Trigger another online event (within debounce period)
      // Don't wait for it to complete
      Object.defineProperty(navigator, "onLine", { value: false });
      window.dispatchEvent(new Event("offline"));
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));

      // Let the connectivity check start but not complete (advance only 50ms)
      await vi.advanceTimersByTimeAsync(50);

      // Now go offline - this should cancel any pending sync
      Object.defineProperty(navigator, "onLine", { value: false });
      window.dispatchEvent(new Event("offline"));

      // Run all remaining timers
      await vi.advanceTimersByTimeAsync(10000);

      // Syncs after first should be 0 or 1 depending on whether connectivity check completed
      // The key is that going offline cancels the debounce timer
      const syncsDuringDebounce =
        syncCallback.mock.calls.length - callsAfterFirstSync;
      expect(syncsDuringDebounce).toBeLessThanOrEqual(1);
    });
  });

  describe("markOfflineDueToSyncFailure", () => {
    beforeEach(() => {
      monitor.initialize(mockSupabase);
    });

    it("should transition to offline when called while online", async () => {
      // Ensure we're online
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));
      await vi.runAllTimersAsync();

      expect(monitor.getState()).toBe("online");

      // Mark offline due to sync failure
      monitor.markOfflineDueToSyncFailure();

      expect(monitor.getState()).toBe("offline");
    });

    it("should notify listeners when marking offline", async () => {
      // Ensure we're online
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));
      await vi.runAllTimersAsync();

      const stateChanges: NetworkState[] = [];
      monitor.subscribe((state) => stateChanges.push(state));
      stateChanges.length = 0;

      monitor.markOfflineDueToSyncFailure();

      expect(stateChanges).toContain("offline");
    });
  });

  describe("subscription", () => {
    it("should immediately notify subscriber with current state", () => {
      const states: NetworkState[] = [];
      monitor.subscribe((state) => states.push(state));

      expect(states).toHaveLength(1);
      expect(states[0]).toBe("online");
    });

    it("should unsubscribe correctly", () => {
      const states: NetworkState[] = [];
      const unsubscribe = monitor.subscribe((state) => states.push(state));

      expect(states).toHaveLength(1);

      unsubscribe();

      // Trigger a state change
      Object.defineProperty(navigator, "onLine", { value: false });
      monitor.initialize(mockSupabase);
      window.dispatchEvent(new Event("offline"));

      // Should not receive more updates
      expect(states).toHaveLength(1);
    });
  });

  describe("checkConnectivity", () => {
    it("should return true when Supabase is reachable", async () => {
      monitor.initialize(mockSupabase);

      const result = await monitor.checkConnectivity();

      expect(result).toBe(true);
    });

    it("should return false when Supabase is unreachable", async () => {
      mockSupabase = createMockSupabaseClient({
        connectivityCheckResult: false,
      });
      monitor.initialize(mockSupabase);

      const result = await monitor.checkConnectivity();

      expect(result).toBe(false);
    });

    it("should return false when not initialized with Supabase client", async () => {
      // Don't call initialize
      const result = await monitor.checkConnectivity();

      expect(result).toBe(false);
    });
  });

  describe("singleton", () => {
    it("should return the same instance from getNetworkMonitor", () => {
      const instance1 = getNetworkMonitor();
      const instance2 = getNetworkMonitor();

      expect(instance1).toBe(instance2);
    });

    it("should create new instance after resetNetworkMonitor", () => {
      const instance1 = getNetworkMonitor();
      resetNetworkMonitor();
      const instance2 = getNetworkMonitor();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("destroy", () => {
    it("should clean up resources when destroyed", () => {
      monitor.initialize(mockSupabase);

      const syncCallback = vi.fn();
      monitor.onSyncNeeded(syncCallback);
      monitor.subscribe(() => {});

      monitor.destroy();

      // After destroy, events should not trigger callbacks
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));

      expect(syncCallback).not.toHaveBeenCalled();
    });

    it("should not trigger callbacks after destroy even with pending timers", async () => {
      monitor.initialize(mockSupabase);

      const syncCallback = vi.fn();
      monitor.onSyncNeeded(syncCallback);

      // Trigger an online event to start the sync process
      Object.defineProperty(navigator, "onLine", { value: true });
      window.dispatchEvent(new Event("online"));

      // Destroy before connectivity check completes
      monitor.destroy();

      // Run all timers
      await vi.runAllTimersAsync();

      // Callback should not have been called
      expect(syncCallback).not.toHaveBeenCalled();
    });
  });
});

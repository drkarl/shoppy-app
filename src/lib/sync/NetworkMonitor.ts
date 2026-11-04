import type { SupabaseClient } from "@supabase/supabase-js";

export type NetworkState = "online" | "offline" | "checking";

export type NetworkStateListener = (state: NetworkState) => void;

const DEBOUNCE_MS = 5000; // Max 1 sync attempt per 5 seconds
const CONNECTIVITY_CHECK_TIMEOUT_MS = 5000;

/**
 * NetworkMonitor manages network connectivity state with:
 * - Browser online/offline event handling
 * - Debounced sync triggers to prevent rapid fire during fluctuations
 * - Actual connectivity verification (handles false positives)
 *
 * False positive scenario: Device reports online but server is unreachable.
 * This can happen with captive portals, ISP issues, or network configuration problems.
 */
export class NetworkMonitor {
  private supabase: SupabaseClient | null = null;
  private state: NetworkState = "offline";
  private listeners: Set<NetworkStateListener> = new Set();
  private lastSyncTriggerTime: number = 0;
  private pendingSyncCallback: (() => void) | null = null;
  private debounceTimerId: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed: boolean = false;

  constructor() {
    // Only initialize in browser environment
    if (typeof window !== "undefined") {
      this.state = navigator.onLine ? "online" : "offline";
    }
  }

  /**
   * Initialize the NetworkMonitor with a Supabase client for connectivity checks.
   * Sets up browser event listeners.
   */
  initialize(supabaseClient: SupabaseClient): void {
    this.supabase = supabaseClient;

    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleBrowserOnline);
      window.addEventListener("offline", this.handleBrowserOffline);
    }
  }

  /**
   * Clean up event listeners and timers.
   */
  destroy(): void {
    this.isDestroyed = true;

    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleBrowserOnline);
      window.removeEventListener("offline", this.handleBrowserOffline);
    }

    if (this.debounceTimerId !== null) {
      clearTimeout(this.debounceTimerId);
      this.debounceTimerId = null;
    }

    this.pendingSyncCallback = null;
    this.listeners.clear();
  }

  /**
   * Subscribe to network state changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: NetworkStateListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get the current network state.
   */
  getState(): NetworkState {
    return this.state;
  }

  /**
   * Check if currently online (or checking).
   * Returns false only when definitely offline.
   *
   * Note: Returns true during "checking" state to avoid UI flicker
   * when the browser briefly reports online before connectivity is verified.
   */
  isOnline(): boolean {
    return this.state !== "offline";
  }

  /**
   * Register a callback to be invoked when sync should be triggered.
   * The callback is automatically debounced.
   */
  onSyncNeeded(callback: () => void): void {
    this.pendingSyncCallback = callback;
  }

  /**
   * Mark the network as effectively offline due to a sync failure.
   * This handles the false positive scenario where the browser reports
   * online but the server is actually unreachable.
   */
  markOfflineDueToSyncFailure(): void {
    if (this.state !== "offline") {
      this.setState("offline");
    }
  }

  /**
   * Verify actual connectivity by making a lightweight request to Supabase.
   * Returns true if the server is reachable, false otherwise.
   */
  async checkConnectivity(): Promise<boolean> {
    if (!this.supabase) {
      return false;
    }

    try {
      // Use a lightweight query with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CONNECTIVITY_CHECK_TIMEOUT_MS
      );

      // Lightweight health check query - "lists" table is always accessible
      // This makes a minimal request that will fail fast if offline
      const { error } = await this.supabase
        .from("lists")
        .select("id")
        .limit(1)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      // If we get here without an error, we're connected
      // Permission errors still indicate connectivity (server responded)
      const isConnectionError =
        error?.message?.toLowerCase().includes("failed to fetch") ||
        error?.message?.toLowerCase().includes("network");
      return !error || !isConnectionError;
    } catch {
      // Any error during the check means we can't reach the server
      return false;
    }
  }

  /**
   * Request a sync trigger with debouncing.
   * Will only trigger at most once per DEBOUNCE_MS milliseconds.
   */
  requestSync(): void {
    if (!this.pendingSyncCallback || this.isDestroyed) {
      return;
    }

    const now = Date.now();
    const timeSinceLastTrigger = now - this.lastSyncTriggerTime;

    if (timeSinceLastTrigger >= DEBOUNCE_MS) {
      // Can trigger immediately
      this.triggerSync();
    } else if (this.debounceTimerId === null) {
      // Schedule a delayed trigger
      const delay = DEBOUNCE_MS - timeSinceLastTrigger;
      this.debounceTimerId = setTimeout(() => {
        this.debounceTimerId = null;
        if (!this.isDestroyed) {
          this.triggerSync();
        }
      }, delay);
    }
    // If a timer is already pending, don't schedule another
  }

  private triggerSync(): void {
    if (this.pendingSyncCallback && !this.isDestroyed) {
      this.lastSyncTriggerTime = Date.now();
      this.pendingSyncCallback();
    }
  }

  private handleBrowserOnline = async (): Promise<void> => {
    if (this.isDestroyed) return;

    // Set to "checking" while we verify actual connectivity
    this.setState("checking");

    // Verify actual connectivity before triggering sync
    const isConnected = await this.checkConnectivity();

    if (this.isDestroyed) return;

    if (isConnected) {
      this.setState("online");
      this.requestSync();
    } else {
      // False positive: browser says online but server unreachable
      this.setState("offline");
    }
  };

  private handleBrowserOffline = (): void => {
    if (this.isDestroyed) return;

    this.setState("offline");

    // Cancel any pending debounced sync
    if (this.debounceTimerId !== null) {
      clearTimeout(this.debounceTimerId);
      this.debounceTimerId = null;
    }
  };

  private setState(newState: NetworkState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }
}

// Singleton instance for global use
let networkMonitorInstance: NetworkMonitor | null = null;

/**
 * Get the singleton NetworkMonitor instance.
 * Creates one if it doesn't exist.
 */
export function getNetworkMonitor(): NetworkMonitor {
  if (!networkMonitorInstance) {
    networkMonitorInstance = new NetworkMonitor();
  }
  return networkMonitorInstance;
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetNetworkMonitor(): void {
  if (networkMonitorInstance) {
    networkMonitorInstance.destroy();
    networkMonitorInstance = null;
  }
}

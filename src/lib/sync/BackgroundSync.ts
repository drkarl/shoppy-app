/**
 * BackgroundSync module for coordinating service worker background sync
 * with the main thread SyncEngine.
 *
 * Background Sync API enables deferred sync operations when connectivity
 * is restored, even if the app is closed (Android only - iOS doesn't support it).
 *
 * Flow:
 * 1. When offline, call requestSync() to register for background sync
 * 2. When connectivity is restored, the service worker fires a 'sync' event
 * 3. Service worker posts SYNC_REQUESTED message to main thread
 * 4. Main thread triggers SyncEngine.processQueue() and responds with result
 */

export type SyncCallback = () => Promise<void>;

export interface BackgroundSyncOptions {
  onSyncRequested?: SyncCallback;
}

/**
 * Check if the Background Sync API is supported.
 * Note: iOS Safari does not support Background Sync.
 */
export function isBackgroundSyncSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return "serviceWorker" in navigator && "SyncManager" in window;
}

export class BackgroundSync {
  private syncCallback: SyncCallback | null = null;
  private isInitialized: boolean = false;
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  constructor(options?: BackgroundSyncOptions) {
    if (options?.onSyncRequested) {
      this.syncCallback = options.onSyncRequested;
    }
  }

  /**
   * Initialize the BackgroundSync module by setting up message listeners.
   * Must be called after the service worker is registered.
   */
  async initialize(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    if (this.isInitialized) {
      return;
    }

    // Only set up message handler if serviceWorker is available
    if ("serviceWorker" in navigator && navigator.serviceWorker) {
      this.messageHandler = this.handleServiceWorkerMessage.bind(this);
      navigator.serviceWorker.addEventListener("message", this.messageHandler);
    }

    this.isInitialized = true;
  }

  /**
   * Clean up event listeners and resources.
   */
  destroy(): void {
    if (
      this.messageHandler &&
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      navigator.serviceWorker
    ) {
      navigator.serviceWorker.removeEventListener(
        "message",
        this.messageHandler
      );
      this.messageHandler = null;
    }

    this.syncCallback = null;
    this.isInitialized = false;
  }

  /**
   * Set the callback to be invoked when sync is requested by the service worker.
   */
  onSyncRequested(callback: SyncCallback): void {
    this.syncCallback = callback;
  }

  /**
   * Request a background sync registration.
   * Call this when queueing operations while offline.
   *
   * @returns Promise that resolves when sync is registered, or rejects if not supported/failed
   */
  async requestSync(): Promise<boolean> {
    if (!isBackgroundSyncSupported()) {
      console.log("[BackgroundSync] Background Sync API not supported");
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Use MessageChannel for response
      const messageChannel = new MessageChannel();

      return new Promise<boolean>((resolve) => {
        const timeoutId = setTimeout(() => {
          console.warn("[BackgroundSync] Sync registration timed out");
          resolve(false);
        }, 5000);

        messageChannel.port1.onmessage = (event) => {
          clearTimeout(timeoutId);
          if (event.data && event.data.success) {
            console.log("[BackgroundSync] Sync registered successfully");
            resolve(true);
          } else {
            console.warn(
              "[BackgroundSync] Failed to register sync:",
              event.data?.error
            );
            resolve(false);
          }
        };

        if (!registration.active) {
          console.warn("[BackgroundSync] No active service worker");
          clearTimeout(timeoutId);
          resolve(false);
          return;
        }

        registration.active.postMessage({ type: "REGISTER_SYNC" }, [
          messageChannel.port2,
        ]);
      });
    } catch (error) {
      console.error("[BackgroundSync] Error requesting sync:", error);
      return false;
    }
  }

  /**
   * Handle messages from the service worker.
   */
  private async handleServiceWorkerMessage(event: MessageEvent): Promise<void> {
    const { type, timestamp } = event.data || {};

    if (type !== "SYNC_REQUESTED") {
      return;
    }

    console.log(
      "[BackgroundSync] Sync requested by service worker at",
      new Date(timestamp)
    );

    // Get the response port from the message
    const responsePort = event.ports[0];

    if (!this.syncCallback) {
      console.warn("[BackgroundSync] No sync callback registered");
      if (responsePort) {
        responsePort.postMessage({ success: false, error: "No sync callback" });
      }
      return;
    }

    try {
      await this.syncCallback();
      console.log("[BackgroundSync] Sync completed successfully");
      if (responsePort) {
        responsePort.postMessage({ success: true });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[BackgroundSync] Sync failed:", errorMessage);
      if (responsePort) {
        responsePort.postMessage({ success: false, error: errorMessage });
      }
    }
  }
}

// Singleton instance for global use
let backgroundSyncInstance: BackgroundSync | null = null;

/**
 * Get the singleton BackgroundSync instance.
 * Creates one if it doesn't exist.
 */
export function getBackgroundSync(): BackgroundSync {
  if (!backgroundSyncInstance) {
    backgroundSyncInstance = new BackgroundSync();
  }
  return backgroundSyncInstance;
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetBackgroundSync(): void {
  if (backgroundSyncInstance) {
    backgroundSyncInstance.destroy();
    backgroundSyncInstance = null;
  }
}

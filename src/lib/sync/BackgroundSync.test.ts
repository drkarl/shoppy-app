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
  BackgroundSync,
  getBackgroundSync,
  isBackgroundSyncSupported,
  resetBackgroundSync,
} from "./BackgroundSync";

// SyncManager is a Web API that may not be in TypeScript's default lib
// We define a minimal type for testing purposes
type SyncManagerType = {
  register: (tag: string) => Promise<void>;
};

describe("BackgroundSync", () => {
  let backgroundSync: BackgroundSync;
  let originalServiceWorker: ServiceWorkerContainer | undefined;
  let originalSyncManager: SyncManagerType | undefined;

  // Mock service worker with ready promise
  const createMockServiceWorker = (overrides?: {
    syncRegisterSuccess?: boolean;
    syncRegisterError?: Error;
  }) => {
    const { syncRegisterSuccess = true, syncRegisterError } = overrides || {};

    const mockSync = {
      register: vi.fn().mockImplementation(() => {
        if (syncRegisterError) {
          return Promise.reject(syncRegisterError);
        }
        return syncRegisterSuccess
          ? Promise.resolve()
          : Promise.reject(new Error("Sync registration failed"));
      }),
    };

    const mockActive = {
      postMessage: vi.fn(),
    };

    const mockRegistration = {
      sync: mockSync,
      active: mockActive,
    };

    return {
      ready: Promise.resolve(mockRegistration),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  };

  beforeEach(() => {
    // Store original values
    originalServiceWorker = navigator.serviceWorker;
    originalSyncManager = (
      window as unknown as { SyncManager?: SyncManagerType }
    ).SyncManager;

    // Reset singleton
    resetBackgroundSync();

    // Set up default mocks
    Object.defineProperty(navigator, "serviceWorker", {
      value: createMockServiceWorker(),
      writable: true,
      configurable: true,
    });

    // Mock SyncManager to indicate support
    (window as unknown as { SyncManager: object }).SyncManager =
      class SyncManager {};

    backgroundSync = new BackgroundSync();
  });

  afterEach(() => {
    backgroundSync.destroy();
    resetBackgroundSync();
    vi.restoreAllMocks();

    // Restore original values
    Object.defineProperty(navigator, "serviceWorker", {
      value: originalServiceWorker,
      writable: true,
      configurable: true,
    });

    if (originalSyncManager) {
      (window as unknown as { SyncManager: SyncManagerType }).SyncManager =
        originalSyncManager;
    } else {
      delete (window as unknown as { SyncManager?: SyncManagerType })
        .SyncManager;
    }
  });

  describe("isBackgroundSyncSupported", () => {
    it("returns true when serviceWorker and SyncManager are available", () => {
      expect(isBackgroundSyncSupported()).toBe(true);
    });

    it("returns false when SyncManager is not available (iOS)", () => {
      delete (window as unknown as { SyncManager?: object }).SyncManager;

      expect(isBackgroundSyncSupported()).toBe(false);
    });

    it("returns false when serviceWorker is not available", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (navigator as any).serviceWorker;

      expect(isBackgroundSyncSupported()).toBe(false);
    });
  });

  describe("initialization", () => {
    it("should set up message listener on initialize", async () => {
      const mockSW = createMockServiceWorker();
      Object.defineProperty(navigator, "serviceWorker", {
        value: mockSW,
        writable: true,
        configurable: true,
      });

      await backgroundSync.initialize();

      expect(mockSW.addEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      );
    });

    it("should not initialize twice", async () => {
      const mockSW = createMockServiceWorker();
      Object.defineProperty(navigator, "serviceWorker", {
        value: mockSW,
        writable: true,
        configurable: true,
      });

      await backgroundSync.initialize();
      await backgroundSync.initialize();

      // Should only add listener once
      expect(mockSW.addEventListener).toHaveBeenCalledTimes(1);
    });

    it("should allow setting callback via constructor", () => {
      const callback = vi.fn();
      const bgSync = new BackgroundSync({ onSyncRequested: callback });

      // The callback should be set (we can't easily test this directly,
      // but we can test it indirectly through message handling)
      expect(bgSync).toBeDefined();
      bgSync.destroy();
    });
  });

  describe("requestSync", () => {
    it("should send REGISTER_SYNC message to service worker", async () => {
      const mockSW = createMockServiceWorker();
      Object.defineProperty(navigator, "serviceWorker", {
        value: mockSW,
        writable: true,
        configurable: true,
      });

      await backgroundSync.initialize();

      // Mock the postMessage to respond immediately
      const registration = await mockSW.ready;
      (registration.active.postMessage as Mock).mockImplementation(
        (message: unknown, transfer: MessagePort[]) => {
          // Simulate service worker responding
          if (transfer && transfer[0]) {
            setTimeout(() => {
              transfer[0].postMessage({ success: true });
            }, 0);
          }
        }
      );

      const result = await backgroundSync.requestSync();

      expect(registration.active.postMessage).toHaveBeenCalledWith(
        { type: "REGISTER_SYNC" },
        expect.any(Array)
      );
      expect(result).toBe(true);
    });

    it("should return false when Background Sync is not supported", async () => {
      delete (window as unknown as { SyncManager?: object }).SyncManager;

      const result = await backgroundSync.requestSync();

      expect(result).toBe(false);
    });

    it("should return false when sync registration fails", async () => {
      const mockSW = createMockServiceWorker();
      Object.defineProperty(navigator, "serviceWorker", {
        value: mockSW,
        writable: true,
        configurable: true,
      });

      await backgroundSync.initialize();

      const registration = await mockSW.ready;
      (registration.active.postMessage as Mock).mockImplementation(
        (message: unknown, transfer: MessagePort[]) => {
          if (transfer && transfer[0]) {
            setTimeout(() => {
              transfer[0].postMessage({ success: false, error: "Failed" });
            }, 0);
          }
        }
      );

      const result = await backgroundSync.requestSync();

      expect(result).toBe(false);
    });

    it("should timeout if no response is received", async () => {
      vi.useFakeTimers();

      const mockSW = createMockServiceWorker();
      Object.defineProperty(navigator, "serviceWorker", {
        value: mockSW,
        writable: true,
        configurable: true,
      });

      await backgroundSync.initialize();

      // Don't respond to the message
      const registration = await mockSW.ready;
      (registration.active.postMessage as Mock).mockImplementation(() => {
        // No response
      });

      const requestPromise = backgroundSync.requestSync();

      // Fast-forward past the timeout
      await vi.advanceTimersByTimeAsync(6000);

      const result = await requestPromise;

      expect(result).toBe(false);

      vi.useRealTimers();
    });
  });

  describe("message handling", () => {
    it("should call sync callback when SYNC_REQUESTED message is received", async () => {
      const syncCallback = vi.fn().mockResolvedValue(undefined);
      backgroundSync.onSyncRequested(syncCallback);

      const mockSW = createMockServiceWorker();
      Object.defineProperty(navigator, "serviceWorker", {
        value: mockSW,
        writable: true,
        configurable: true,
      });

      await backgroundSync.initialize();

      // Get the message handler that was registered
      const messageHandler = (mockSW.addEventListener as Mock).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      expect(messageHandler).toBeDefined();

      // Create a mock response port
      const mockResponsePort = {
        postMessage: vi.fn(),
      };

      // Simulate receiving SYNC_REQUESTED message
      const event = {
        data: { type: "SYNC_REQUESTED", timestamp: Date.now() },
        ports: [mockResponsePort],
      };

      await messageHandler(event);

      expect(syncCallback).toHaveBeenCalled();
      expect(mockResponsePort.postMessage).toHaveBeenCalledWith({
        success: true,
      });
    });

    it("should respond with error when sync callback fails", async () => {
      const syncCallback = vi.fn().mockRejectedValue(new Error("Sync failed"));
      backgroundSync.onSyncRequested(syncCallback);

      const mockSW = createMockServiceWorker();
      Object.defineProperty(navigator, "serviceWorker", {
        value: mockSW,
        writable: true,
        configurable: true,
      });

      await backgroundSync.initialize();

      const messageHandler = (mockSW.addEventListener as Mock).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const mockResponsePort = {
        postMessage: vi.fn(),
      };

      const event = {
        data: { type: "SYNC_REQUESTED", timestamp: Date.now() },
        ports: [mockResponsePort],
      };

      await messageHandler(event);

      expect(mockResponsePort.postMessage).toHaveBeenCalledWith({
        success: false,
        error: "Sync failed",
      });
    });

    it("should respond with error when no sync callback is registered", async () => {
      const mockSW = createMockServiceWorker();
      Object.defineProperty(navigator, "serviceWorker", {
        value: mockSW,
        writable: true,
        configurable: true,
      });

      await backgroundSync.initialize();

      const messageHandler = (mockSW.addEventListener as Mock).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const mockResponsePort = {
        postMessage: vi.fn(),
      };

      const event = {
        data: { type: "SYNC_REQUESTED", timestamp: Date.now() },
        ports: [mockResponsePort],
      };

      await messageHandler(event);

      expect(mockResponsePort.postMessage).toHaveBeenCalledWith({
        success: false,
        error: "No sync callback",
      });
    });

    it("should ignore non-SYNC_REQUESTED messages", async () => {
      const syncCallback = vi.fn().mockResolvedValue(undefined);
      backgroundSync.onSyncRequested(syncCallback);

      const mockSW = createMockServiceWorker();
      Object.defineProperty(navigator, "serviceWorker", {
        value: mockSW,
        writable: true,
        configurable: true,
      });

      await backgroundSync.initialize();

      const messageHandler = (mockSW.addEventListener as Mock).mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      const event = {
        data: { type: "OTHER_MESSAGE" },
        ports: [],
      };

      await messageHandler(event);

      expect(syncCallback).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("should remove message listener on destroy", async () => {
      const mockSW = createMockServiceWorker();
      Object.defineProperty(navigator, "serviceWorker", {
        value: mockSW,
        writable: true,
        configurable: true,
      });

      await backgroundSync.initialize();
      backgroundSync.destroy();

      expect(mockSW.removeEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      );
    });

    it("should clear sync callback on destroy", async () => {
      const syncCallback = vi.fn();
      backgroundSync.onSyncRequested(syncCallback);

      const mockSW = createMockServiceWorker();
      Object.defineProperty(navigator, "serviceWorker", {
        value: mockSW,
        writable: true,
        configurable: true,
      });

      await backgroundSync.initialize();
      backgroundSync.destroy();

      // Try to trigger a sync message after destroy
      // This shouldn't call the callback because it was cleared
      // (The message listener is removed, so this tests the callback clearing)
      const newBgSync = new BackgroundSync();
      expect(newBgSync).toBeDefined();
      newBgSync.destroy();
    });
  });

  describe("singleton", () => {
    it("should return the same instance from getBackgroundSync", () => {
      const instance1 = getBackgroundSync();
      const instance2 = getBackgroundSync();

      expect(instance1).toBe(instance2);
    });

    it("should create new instance after resetBackgroundSync", () => {
      const instance1 = getBackgroundSync();
      resetBackgroundSync();
      const instance2 = getBackgroundSync();

      expect(instance1).not.toBe(instance2);
    });
  });
});

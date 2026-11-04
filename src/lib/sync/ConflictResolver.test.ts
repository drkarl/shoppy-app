import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearConflictListeners,
  resolveConflict,
  subscribeToConflicts,
  type ConflictListener,
  type ConflictResult,
} from "./ConflictResolver";

describe("ConflictResolver", () => {
  beforeEach(() => {
    clearConflictListeners();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearConflictListeners();
  });

  describe("resolveConflict", () => {
    it("given remote item version=10 and local version=8, when resolving conflict, then remote wins", () => {
      const result = resolveConflict("item-1", 8, 10);

      expect(result.hasConflict).toBe(true);
      expect(result.winner).toBe("remote");
      expect(result.itemId).toBe("item-1");
      expect(result.localVersion).toBe(8);
      expect(result.remoteVersion).toBe(10);
      expect(result.shouldQueueForPush).toBe(false);
    });

    it("given local item version=10 and remote version=8, when resolving conflict, then local wins and should be queued for push", () => {
      const result = resolveConflict("item-1", 10, 8);

      expect(result.hasConflict).toBe(true);
      expect(result.winner).toBe("local");
      expect(result.itemId).toBe("item-1");
      expect(result.localVersion).toBe(10);
      expect(result.remoteVersion).toBe(8);
      expect(result.shouldQueueForPush).toBe(true);
    });

    it("given both versions are equal (version=5), when checking for conflict, then no conflict is detected", () => {
      const result = resolveConflict("item-1", 5, 5);

      expect(result.hasConflict).toBe(false);
      expect(result.winner).toBe("none");
      expect(result.itemId).toBe("item-1");
      expect(result.localVersion).toBe(5);
      expect(result.remoteVersion).toBe(5);
      expect(result.shouldQueueForPush).toBe(false);
    });

    it("given a conflict where remote wins, when resolved, then a log entry is created with correct format", () => {
      resolveConflict("item-123", 3, 7);

      expect(console.log).toHaveBeenCalledWith(
        "Conflict detected for item item-123, resolved to remote"
      );
    });

    it("given a conflict where local wins, when resolved, then a log entry is created with correct format", () => {
      resolveConflict("item-456", 9, 4);

      expect(console.log).toHaveBeenCalledWith(
        "Conflict detected for item item-456, resolved to local"
      );
    });

    it("given no conflict (equal versions), when resolved, then no log entry is created", () => {
      resolveConflict("item-789", 5, 5);

      expect(console.log).not.toHaveBeenCalled();
    });

    it("given remote version is exactly 1 higher, when resolving conflict, then remote wins", () => {
      const result = resolveConflict("item-1", 1, 2);

      expect(result.hasConflict).toBe(true);
      expect(result.winner).toBe("remote");
    });

    it("given local version is exactly 1 higher, when resolving conflict, then local wins", () => {
      const result = resolveConflict("item-1", 2, 1);

      expect(result.hasConflict).toBe(true);
      expect(result.winner).toBe("local");
      expect(result.shouldQueueForPush).toBe(true);
    });

    it("given version 0 for both items, when checking for conflict, then no conflict is detected", () => {
      const result = resolveConflict("item-1", 0, 0);

      expect(result.hasConflict).toBe(false);
      expect(result.winner).toBe("none");
    });
  });

  describe("conflict listeners", () => {
    it("given a listener is subscribed, when a conflict occurs, then the listener is notified", () => {
      const receivedResults: ConflictResult[] = [];
      const listener: ConflictListener = (result) =>
        receivedResults.push(result);

      subscribeToConflicts(listener);
      resolveConflict("item-1", 3, 7);

      expect(receivedResults.length).toBe(1);
      expect(receivedResults[0].itemId).toBe("item-1");
      expect(receivedResults[0].winner).toBe("remote");
    });

    it("given a listener is subscribed, when no conflict occurs (equal versions), then the listener is not notified", () => {
      const receivedResults: ConflictResult[] = [];
      const listener: ConflictListener = (result) =>
        receivedResults.push(result);

      subscribeToConflicts(listener);
      resolveConflict("item-1", 5, 5);

      expect(receivedResults.length).toBe(0);
    });

    it("given multiple listeners are subscribed, when a conflict occurs, then all listeners are notified", () => {
      const results1: ConflictResult[] = [];
      const results2: ConflictResult[] = [];
      const listener1: ConflictListener = (result) => results1.push(result);
      const listener2: ConflictListener = (result) => results2.push(result);

      subscribeToConflicts(listener1);
      subscribeToConflicts(listener2);
      resolveConflict("item-1", 5, 10);

      expect(results1.length).toBe(1);
      expect(results2.length).toBe(1);
      expect(results1[0]).toEqual(results2[0]);
    });

    it("given a listener is unsubscribed, when a conflict occurs, then the listener is not notified", () => {
      const receivedResults: ConflictResult[] = [];
      const listener: ConflictListener = (result) =>
        receivedResults.push(result);

      const unsubscribe = subscribeToConflicts(listener);

      // First conflict - should notify
      resolveConflict("item-1", 3, 7);
      expect(receivedResults.length).toBe(1);

      // Unsubscribe
      unsubscribe();

      // Second conflict - should not notify
      resolveConflict("item-2", 3, 7);
      expect(receivedResults.length).toBe(1);
    });

    it("given listeners exist, when clearConflictListeners is called, then all listeners are removed", () => {
      const receivedResults: ConflictResult[] = [];
      const listener: ConflictListener = (result) =>
        receivedResults.push(result);

      subscribeToConflicts(listener);
      resolveConflict("item-1", 3, 7);
      expect(receivedResults.length).toBe(1);

      clearConflictListeners();
      resolveConflict("item-2", 3, 7);
      expect(receivedResults.length).toBe(1);
    });

    it("given a listener for local wins scenario, when local version is higher, then listener receives correct result", () => {
      const receivedResults: ConflictResult[] = [];
      subscribeToConflicts((result) => receivedResults.push(result));

      resolveConflict("item-1", 15, 10);

      expect(receivedResults.length).toBe(1);
      expect(receivedResults[0].winner).toBe("local");
      expect(receivedResults[0].shouldQueueForPush).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("given large version numbers, when resolving conflict, then resolution is correct", () => {
      const result = resolveConflict("item-1", 1000000, 999999);

      expect(result.hasConflict).toBe(true);
      expect(result.winner).toBe("local");
    });

    it("given remote version significantly higher, when resolving, then remote wins", () => {
      const result = resolveConflict("item-1", 1, 1000);

      expect(result.hasConflict).toBe(true);
      expect(result.winner).toBe("remote");
    });
  });
});

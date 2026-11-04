export type ConflictWinner = "remote" | "local" | "none";

export interface ConflictResult {
  hasConflict: boolean;
  winner: ConflictWinner;
  itemId: string;
  localVersion: number;
  remoteVersion: number;
  shouldQueueForPush: boolean;
}

export type ConflictListener = (result: ConflictResult) => void;

const listeners: Set<ConflictListener> = new Set();

/**
 * Resolve a version-based conflict between local and remote items.
 *
 * Resolution strategy:
 * - Remote version > local version → remote wins (server wins)
 * - Local version > remote version → local wins (client wins), queued for push
 * - Versions equal → no conflict (already in sync)
 *
 * @param itemId - The ID of the item being resolved
 * @param localVersion - The version number of the local item
 * @param remoteVersion - The version number of the remote item
 * @returns ConflictResult indicating the resolution outcome
 */
export function resolveConflict(
  itemId: string,
  localVersion: number,
  remoteVersion: number
): ConflictResult {
  // Versions equal - no conflict
  if (localVersion === remoteVersion) {
    return {
      hasConflict: false,
      winner: "none",
      itemId,
      localVersion,
      remoteVersion,
      shouldQueueForPush: false,
    };
  }

  // Remote version higher - remote wins
  if (remoteVersion > localVersion) {
    const result: ConflictResult = {
      hasConflict: true,
      winner: "remote",
      itemId,
      localVersion,
      remoteVersion,
      shouldQueueForPush: false,
    };

    logConflict(result);
    notifyListeners(result);

    return result;
  }

  // Local version higher - local wins, queue for push
  const result: ConflictResult = {
    hasConflict: true,
    winner: "local",
    itemId,
    localVersion,
    remoteVersion,
    shouldQueueForPush: true,
  };

  logConflict(result);
  notifyListeners(result);

  return result;
}

/**
 * Log a conflict for debugging purposes.
 */
function logConflict(result: ConflictResult): void {
  console.log(
    `Conflict detected for item ${result.itemId}, resolved to ${result.winner}`
  );
}

/**
 * Subscribe to conflict notifications.
 * Useful for UI components that want to show conflict alerts.
 *
 * @param listener - Callback function invoked when a conflict is resolved
 * @returns Unsubscribe function
 */
export function subscribeToConflicts(listener: ConflictListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Notify all registered listeners about a conflict.
 */
function notifyListeners(result: ConflictResult): void {
  listeners.forEach((listener) => listener(result));
}

/**
 * Clear all conflict listeners.
 * Useful for testing or cleanup.
 */
export function clearConflictListeners(): void {
  listeners.clear();
}

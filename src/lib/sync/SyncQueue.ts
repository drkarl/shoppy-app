import { db, SyncQueueEntry } from "../db";

export const MAX_RETRIES = 3;

export type OperationType = "INSERT" | "UPDATE" | "DELETE";

export interface QueuedOperation {
  id: number;
  table: string;
  operation: OperationType;
  recordId: string;
  payload: unknown;
  timestamp: number;
  retries: number;
}

/**
 * Maps a SyncQueueEntry to a QueuedOperation.
 * Centralizes the mapping logic to avoid duplication.
 *
 * @param entry - The database entry to map
 * @param retryOverride - Optional override for the retries value
 * @returns The mapped QueuedOperation
 */
function toQueuedOperation(
  entry: SyncQueueEntry,
  retryOverride?: number
): QueuedOperation {
  return {
    id: entry.id!,
    table: entry.table,
    operation: entry.operation,
    recordId: entry.recordId,
    payload: entry.payload,
    timestamp: entry.timestamp,
    retries: retryOverride ?? entry.retries,
  };
}

/**
 * Adds an operation to the sync queue.
 * Used when operations occur while offline to be synced later.
 *
 * @param table - The name of the table the operation affects
 * @param operation - The type of operation (INSERT, UPDATE, DELETE)
 * @param recordId - The ID of the affected record
 * @param payload - The data payload for the operation
 * @returns The auto-generated ID of the queued entry
 */
export async function addToQueue(
  table: string,
  operation: OperationType,
  recordId: string,
  payload: unknown
): Promise<number> {
  const entry: SyncQueueEntry = {
    table,
    operation,
    recordId,
    payload,
    timestamp: Date.now(),
    retries: 0,
  };

  return await db.syncQueue.add(entry);
}

/**
 * Reads all entries from the sync queue ordered by timestamp (oldest first).
 * This ensures operations are replayed in the order they occurred.
 *
 * @returns Array of queued operations sorted by timestamp ascending
 */
export async function readQueue(): Promise<QueuedOperation[]> {
  const entries = await db.syncQueue.orderBy("timestamp").toArray();
  return entries.map((entry) => toQueuedOperation(entry));
}

/**
 * Removes a single entry from the sync queue.
 * Used after successful sync or when max retries reached.
 *
 * @param id - The ID of the entry to remove
 */
export async function removeFromQueue(id: number): Promise<void> {
  await db.syncQueue.delete(id);
}

/**
 * Clears all entries from the sync queue.
 * Use with caution - typically only after a full successful sync.
 */
export async function clearQueue(): Promise<void> {
  await db.syncQueue.clear();
}

/**
 * Increments the retry counter for a queue entry.
 * If the entry has reached MAX_RETRIES, it is removed from the queue
 * and logged as a failed operation.
 *
 * @param id - The ID of the entry to increment
 * @returns Object indicating if the operation was removed due to max retries
 */
export async function incrementRetry(
  id: number
): Promise<{ removed: boolean; entry?: QueuedOperation }> {
  return await db.transaction("rw", db.syncQueue, async () => {
    const entry = await db.syncQueue.get(id);
    if (!entry) {
      return { removed: false };
    }

    const newRetryCount = entry.retries + 1;

    if (newRetryCount >= MAX_RETRIES) {
      const failedEntry = toQueuedOperation(entry, newRetryCount);

      console.error(
        `[SyncQueue] Operation failed after ${MAX_RETRIES} retries:`,
        {
          table: entry.table,
          operation: entry.operation,
          recordId: entry.recordId,
          timestamp: new Date(entry.timestamp).toISOString(),
        }
      );

      await db.syncQueue.delete(id);
      return { removed: true, entry: failedEntry };
    }

    await db.syncQueue.update(id, { retries: newRetryCount });
    return { removed: false };
  });
}

/**
 * Gets the count of pending operations in the queue.
 *
 * @returns The number of entries in the sync queue
 */
export async function getQueueCount(): Promise<number> {
  return await db.syncQueue.count();
}

/**
 * Gets a single entry from the queue by ID.
 *
 * @param id - The ID of the entry to retrieve
 * @returns The queue entry or undefined if not found
 */
export async function getQueueEntry(
  id: number
): Promise<QueuedOperation | undefined> {
  const entry = await db.syncQueue.get(id);
  if (!entry) {
    return undefined;
  }
  return toQueuedOperation(entry);
}

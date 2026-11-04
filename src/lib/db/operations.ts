import { addToQueue } from "../sync/SyncQueue";

import { db, ListItem } from "./index";

/**
 * Generate a UUID v4 for new records.
 * Uses crypto.randomUUID() which is available in modern browsers and Node.js.
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get the current ISO timestamp string.
 */
function now(): string {
  return new Date().toISOString();
}

export interface AddItemInput {
  listId: string;
  displayName: string;
  quantity?: number;
  unit?: string | null;
  note?: string | null;
  categoryId?: string | null;
  addedBy?: string | null;
}

/**
 * Add a new item to Dexie locally and queue a sync operation.
 * Returns the new item's ID immediately for optimistic UI updates.
 *
 * @param input - The item data to add
 * @returns The generated ID of the new item
 */
export async function addItemLocal(input: AddItemInput): Promise<string> {
  const id = generateId();
  const timestamp = now();

  const item: ListItem = {
    id,
    listId: input.listId,
    rawText: input.displayName,
    displayName: input.displayName,
    quantity: input.quantity ?? 1,
    unit: input.unit ?? null,
    note: input.note ?? null,
    categoryId: input.categoryId ?? null,
    status: "pending",
    addedBy: input.addedBy ?? null,
    checkedBy: null,
    checkedAt: null,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.transaction("rw", [db.listItems, db.syncQueue], async () => {
    await db.listItems.add(item);
    await addToQueue("list_items", "INSERT", id, item);
  });

  return id;
}

export interface UpdateItemInput {
  displayName?: string;
  quantity?: number;
  unit?: string | null;
  note?: string | null;
  categoryId?: string | null;
  status?: "pending" | "checked";
}

/**
 * Update an existing item in Dexie locally and queue a sync operation.
 * Only updates the fields provided in the input.
 *
 * @param id - The ID of the item to update
 * @param input - The fields to update
 * @returns true if the item was found and updated, false otherwise
 */
export async function updateItemLocal(
  id: string,
  input: UpdateItemInput
): Promise<boolean> {
  return await db.transaction("rw", [db.listItems, db.syncQueue], async () => {
    const existing = await db.listItems.get(id);
    if (!existing) {
      return false;
    }

    const timestamp = now();
    const updates: Partial<ListItem> = {
      updatedAt: timestamp,
      version: existing.version + 1,
    };

    if (input.displayName !== undefined) {
      updates.displayName = input.displayName;
      updates.rawText = input.displayName;
    }
    if (input.quantity !== undefined) {
      updates.quantity = input.quantity;
    }
    if (input.unit !== undefined) {
      updates.unit = input.unit;
    }
    if (input.note !== undefined) {
      updates.note = input.note;
    }
    if (input.categoryId !== undefined) {
      updates.categoryId = input.categoryId;
    }
    if (input.status !== undefined) {
      updates.status = input.status;
    }

    await db.listItems.update(id, updates);
    const updatedItem = await db.listItems.get(id);
    await addToQueue("list_items", "UPDATE", id, updatedItem);

    return true;
  });
}

/**
 * Delete an item from Dexie locally and queue a sync operation.
 *
 * @param id - The ID of the item to delete
 * @returns true if the item was found and deleted, false otherwise
 */
export async function deleteItemLocal(id: string): Promise<boolean> {
  return await db.transaction("rw", [db.listItems, db.syncQueue], async () => {
    const existing = await db.listItems.get(id);
    if (!existing) {
      return false;
    }

    await db.listItems.delete(id);
    await addToQueue("list_items", "DELETE", id, { id });

    return true;
  });
}

export interface CheckItemInput {
  checkedBy?: string | null;
}

/**
 * Toggle the status of an item (pending <-> checked) in Dexie and queue a sync operation.
 * This is a specialized update for the common "check off item" operation.
 *
 * @param id - The ID of the item to toggle
 * @param input - Optional metadata for the check operation
 * @returns The new status if successful, null if item not found
 */
export async function checkItemLocal(
  id: string,
  input?: CheckItemInput
): Promise<"pending" | "checked" | null> {
  return await db.transaction("rw", [db.listItems, db.syncQueue], async () => {
    const existing = await db.listItems.get(id);
    if (!existing) {
      return null;
    }

    const timestamp = now();
    const newStatus = existing.status === "pending" ? "checked" : "pending";

    const updates: Partial<ListItem> = {
      status: newStatus,
      updatedAt: timestamp,
      version: existing.version + 1,
    };

    if (newStatus === "checked") {
      updates.checkedAt = timestamp;
      updates.checkedBy = input?.checkedBy ?? null;
    } else {
      updates.checkedAt = null;
      updates.checkedBy = null;
    }

    await db.listItems.update(id, updates);
    const updatedItem = await db.listItems.get(id);
    await addToQueue("list_items", "UPDATE", id, updatedItem);

    return newStatus;
  });
}

/**
 * Get all items for a list from Dexie.
 * Use this for non-reactive data fetching.
 *
 * @param listId - The ID of the list to get items for
 * @returns Array of items in the list
 */
export async function getItemsByListId(listId: string): Promise<ListItem[]> {
  return await db.listItems.where("listId").equals(listId).toArray();
}

/**
 * Get a single item by ID from Dexie.
 *
 * @param id - The ID of the item to get
 * @returns The item if found, undefined otherwise
 */
export async function getItemById(id: string): Promise<ListItem | undefined> {
  return await db.listItems.get(id);
}

/**
 * Restore an item to Dexie without queuing a sync operation.
 * Used specifically for rollback scenarios where we need to undo
 * local optimistic updates after a server sync failure.
 *
 * @param item - The full item to restore
 */
export async function restoreItemLocal(item: ListItem): Promise<void> {
  await db.listItems.put(item);
}

/**
 * Restore multiple items to Dexie atomically without queuing sync operations.
 * Uses a transaction to ensure all items are restored together or none at all.
 * Used specifically for rollback scenarios involving multiple items.
 *
 * @param items - Array of full items to restore
 */
export async function restoreItemsLocal(items: ListItem[]): Promise<void> {
  await db.transaction("rw", [db.listItems], async () => {
    for (const item of items) {
      await db.listItems.put(item);
    }
  });
}

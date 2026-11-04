import Dexie, { Table } from "dexie";

import { BUNDLED_CATEGORIES } from "./seeds";

// Type definitions for Dexie tables (camelCase convention)
// These mirror Supabase tables but use camelCase for JavaScript/TypeScript

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface List {
  id: string;
  householdId: string;
  name: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface ListItem {
  id: string;
  listId: string;
  rawText: string;
  displayName: string;
  quantity: number;
  unit: string | null;
  note: string | null;
  categoryId: string | null;
  status: "pending" | "checked";
  addedBy: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  nameEs: string;
  icon: string;
  defaultOrder: number;
}

export interface StoreProfile {
  id: string;
  householdId: string;
  storeName: string;
  categoryOrder: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueEntry {
  id?: number;
  table: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  recordId: string;
  payload: unknown;
  timestamp: number;
  retries: number;
}

export interface SyncMeta {
  key: string;
  value: unknown;
}

class ShoppyDatabase extends Dexie {
  households!: Table<Household>;
  lists!: Table<List>;
  listItems!: Table<ListItem>;
  categories!: Table<Category>;
  storeProfiles!: Table<StoreProfile>;
  syncQueue!: Table<SyncQueueEntry>;
  syncMeta!: Table<SyncMeta>;

  constructor() {
    super("ShoppyDB");

    this.version(1).stores({
      // Primary key first, then indexed fields
      households: "id",
      lists: "id, householdId, status",
      listItems: "id, listId, status, categoryId, [listId+status]",
      categories: "id, defaultOrder",
      storeProfiles: "id, householdId",
      syncQueue: "++id, table, recordId, timestamp",
      syncMeta: "key",
    });
  }
}

export const db = new ShoppyDatabase();

/**
 * Initialize the database with seed data.
 * Seeds categories on first load (idempotent - only seeds if categories table is empty).
 * Uses a transaction to ensure atomicity - if seeding fails, it rolls back cleanly.
 */
export async function initializeDatabase(): Promise<void> {
  const count = await db.categories.count();
  if (count === 0) {
    await db.transaction("rw", db.categories, async () => {
      await db.categories.bulkAdd(BUNDLED_CATEGORIES);
    });
  }
}

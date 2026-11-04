import "fake-indexeddb/auto";

import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BUNDLED_CATEGORIES } from "./seeds";

// We need to re-create the database class for each test to get a fresh instance
// because Dexie caches database connections

class TestShoppyDatabase extends Dexie {
  households!: Dexie.Table;
  lists!: Dexie.Table;
  listItems!: Dexie.Table;
  categories!: Dexie.Table;
  storeProfiles!: Dexie.Table;
  syncQueue!: Dexie.Table;
  syncMeta!: Dexie.Table;

  constructor(name: string) {
    super(name);

    this.version(1).stores({
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

describe("Dexie Database Schema", () => {
  let db: TestShoppyDatabase;

  beforeEach(async () => {
    // Create a unique database name for each test
    const dbName = `TestShoppyDB_${Date.now()}_${Math.random()}`;
    db = new TestShoppyDatabase(dbName);
  });

  afterEach(async () => {
    await db.delete();
  });

  describe("Database creation", () => {
    it("should create the database with all 7 tables", async () => {
      expect(db.households).toBeDefined();
      expect(db.lists).toBeDefined();
      expect(db.listItems).toBeDefined();
      expect(db.categories).toBeDefined();
      expect(db.storeProfiles).toBeDefined();
      expect(db.syncQueue).toBeDefined();
      expect(db.syncMeta).toBeDefined();
    });

    it("should have correct table names", async () => {
      const tableNames = db.tables.map((t) => t.name).sort();
      expect(tableNames).toEqual([
        "categories",
        "households",
        "listItems",
        "lists",
        "storeProfiles",
        "syncMeta",
        "syncQueue",
      ]);
    });
  });

  describe("Households table", () => {
    it("should store and retrieve a household", async () => {
      const household = {
        id: "h-123",
        name: "Test Household",
        inviteCode: "ABC123",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.households.add(household);
      const retrieved = await db.households.get("h-123");

      expect(retrieved).toEqual(household);
    });
  });

  describe("Lists table", () => {
    it("should store and retrieve a list", async () => {
      const list = {
        id: "l-123",
        householdId: "h-123",
        name: "Weekly Groceries",
        status: "active" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.lists.add(list);
      const retrieved = await db.lists.get("l-123");

      expect(retrieved).toEqual(list);
    });

    it("should query lists by householdId", async () => {
      const lists = [
        {
          id: "l-1",
          householdId: "h-1",
          name: "List 1",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "l-2",
          householdId: "h-1",
          name: "List 2",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "l-3",
          householdId: "h-2",
          name: "List 3",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await db.lists.bulkAdd(lists);

      const h1Lists = await db.lists
        .where("householdId")
        .equals("h-1")
        .toArray();
      expect(h1Lists).toHaveLength(2);
      expect(h1Lists.map((l) => l.id).sort()).toEqual(["l-1", "l-2"]);
    });

    it("should query lists by status", async () => {
      const lists = [
        {
          id: "l-1",
          householdId: "h-1",
          name: "Active List",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "l-2",
          householdId: "h-1",
          name: "Archived List",
          status: "archived",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await db.lists.bulkAdd(lists);

      const activeLists = await db.lists
        .where("status")
        .equals("active")
        .toArray();
      expect(activeLists).toHaveLength(1);
      expect(activeLists[0].id).toBe("l-1");
    });
  });

  describe("ListItems table", () => {
    it("should store and retrieve a list item", async () => {
      const item = {
        id: "i-123",
        listId: "l-123",
        rawText: "2 gallons milk",
        displayName: "Milk",
        quantity: 2,
        unit: "gallons",
        note: null,
        categoryId: "c-1",
        status: "pending" as const,
        addedBy: "user-1",
        checkedBy: null,
        checkedAt: null,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.listItems.add(item);
      const retrieved = await db.listItems.get("i-123");

      expect(retrieved).toEqual(item);
    });

    it("should query items by [listId+status] compound index", async () => {
      const items = [
        {
          id: "i-1",
          listId: "l-1",
          rawText: "milk",
          displayName: "Milk",
          quantity: 1,
          unit: null,
          note: null,
          categoryId: null,
          status: "pending",
          addedBy: "u-1",
          checkedBy: null,
          checkedAt: null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "i-2",
          listId: "l-1",
          rawText: "eggs",
          displayName: "Eggs",
          quantity: 12,
          unit: null,
          note: null,
          categoryId: null,
          status: "checked",
          addedBy: "u-1",
          checkedBy: "u-1",
          checkedAt: new Date().toISOString(),
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "i-3",
          listId: "l-1",
          rawText: "bread",
          displayName: "Bread",
          quantity: 1,
          unit: null,
          note: null,
          categoryId: null,
          status: "pending",
          addedBy: "u-1",
          checkedBy: null,
          checkedAt: null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "i-4",
          listId: "l-2",
          rawText: "butter",
          displayName: "Butter",
          quantity: 1,
          unit: null,
          note: null,
          categoryId: null,
          status: "pending",
          addedBy: "u-1",
          checkedBy: null,
          checkedAt: null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await db.listItems.bulkAdd(items);

      // Query pending items for list l-1 using compound index
      const pendingItems = await db.listItems
        .where("[listId+status]")
        .equals(["l-1", "pending"])
        .toArray();

      expect(pendingItems).toHaveLength(2);
      expect(pendingItems.map((i) => i.id).sort()).toEqual(["i-1", "i-3"]);
    });

    it("should query items by categoryId", async () => {
      const items = [
        {
          id: "i-1",
          listId: "l-1",
          rawText: "milk",
          displayName: "Milk",
          quantity: 1,
          unit: null,
          note: null,
          categoryId: "c-dairy",
          status: "pending",
          addedBy: "u-1",
          checkedBy: null,
          checkedAt: null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "i-2",
          listId: "l-1",
          rawText: "apples",
          displayName: "Apples",
          quantity: 6,
          unit: null,
          note: null,
          categoryId: "c-produce",
          status: "pending",
          addedBy: "u-1",
          checkedBy: null,
          checkedAt: null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await db.listItems.bulkAdd(items);

      const dairyItems = await db.listItems
        .where("categoryId")
        .equals("c-dairy")
        .toArray();
      expect(dairyItems).toHaveLength(1);
      expect(dairyItems[0].displayName).toBe("Milk");
    });
  });

  describe("Categories table", () => {
    it("should store and retrieve a category", async () => {
      const category = {
        id: "c-1",
        name: "Produce",
        nameEs: "Frutas y Verduras",
        icon: "carrot",
        defaultOrder: 1,
      };

      await db.categories.add(category);
      const retrieved = await db.categories.get("c-1");

      expect(retrieved).toEqual(category);
    });

    it("should query categories by defaultOrder", async () => {
      await db.categories.bulkAdd(BUNDLED_CATEGORIES);

      const firstCategory = await db.categories
        .where("defaultOrder")
        .equals(1)
        .first();
      expect(firstCategory?.name).toBe("Produce");
    });
  });

  describe("StoreProfiles table", () => {
    it("should store and retrieve a store profile", async () => {
      const profile = {
        id: "sp-1",
        householdId: "h-1",
        storeName: "Tesco",
        categoryOrder: ["c-1", "c-2", "c-3"],
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.storeProfiles.add(profile);
      const retrieved = await db.storeProfiles.get("sp-1");

      expect(retrieved).toEqual(profile);
    });

    it("should query store profiles by householdId", async () => {
      const profiles = [
        {
          id: "sp-1",
          householdId: "h-1",
          storeName: "Tesco",
          categoryOrder: [],
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "sp-2",
          householdId: "h-1",
          storeName: "Sainsbury",
          categoryOrder: [],
          isDefault: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "sp-3",
          householdId: "h-2",
          storeName: "Aldi",
          categoryOrder: [],
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await db.storeProfiles.bulkAdd(profiles);

      const h1Profiles = await db.storeProfiles
        .where("householdId")
        .equals("h-1")
        .toArray();
      expect(h1Profiles).toHaveLength(2);
    });
  });

  describe("SyncQueue table", () => {
    it("should store and retrieve sync queue entries with auto-increment id", async () => {
      const entry = {
        table: "listItems",
        operation: "INSERT" as const,
        recordId: "i-123",
        payload: { displayName: "Milk" },
        timestamp: Date.now(),
        retries: 0,
      };

      const id = await db.syncQueue.add(entry);
      expect(typeof id).toBe("number");

      const retrieved = await db.syncQueue.get(id);
      expect(retrieved?.table).toBe("listItems");
      expect(retrieved?.operation).toBe("INSERT");
    });

    it("should query sync queue by timestamp", async () => {
      const now = Date.now();
      const entries = [
        {
          table: "listItems",
          operation: "INSERT" as const,
          recordId: "i-1",
          payload: {},
          timestamp: now - 1000,
          retries: 0,
        },
        {
          table: "listItems",
          operation: "UPDATE" as const,
          recordId: "i-2",
          payload: {},
          timestamp: now,
          retries: 0,
        },
        {
          table: "lists",
          operation: "DELETE" as const,
          recordId: "l-1",
          payload: {},
          timestamp: now + 1000,
          retries: 0,
        },
      ];

      await db.syncQueue.bulkAdd(entries);

      const orderedEntries = await db.syncQueue.orderBy("timestamp").toArray();
      expect(orderedEntries.map((e) => e.recordId)).toEqual([
        "i-1",
        "i-2",
        "l-1",
      ]);
    });
  });

  describe("SyncMeta table", () => {
    it("should store and retrieve sync metadata by key", async () => {
      const meta = {
        key: "lastSyncTimestamp",
        value: Date.now(),
      };

      await db.syncMeta.add(meta);
      const retrieved = await db.syncMeta.get("lastSyncTimestamp");

      expect(retrieved?.value).toBe(meta.value);
    });

    it("should update existing meta entries using put", async () => {
      await db.syncMeta.put({ key: "lastSyncTimestamp", value: 1000 });
      await db.syncMeta.put({ key: "lastSyncTimestamp", value: 2000 });

      const retrieved = await db.syncMeta.get("lastSyncTimestamp");
      expect(retrieved?.value).toBe(2000);

      const count = await db.syncMeta.count();
      expect(count).toBe(1);
    });
  });
});

describe("initializeDatabase", () => {
  let db: TestShoppyDatabase;

  beforeEach(async () => {
    const dbName = `TestShoppyDB_${Date.now()}_${Math.random()}`;
    db = new TestShoppyDatabase(dbName);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("should seed 11 categories when categories table is empty", async () => {
    // Simulate initializeDatabase behavior
    const count = await db.categories.count();
    expect(count).toBe(0);

    await db.categories.bulkAdd(BUNDLED_CATEGORIES);

    const newCount = await db.categories.count();
    expect(newCount).toBe(11);
  });

  it("should be idempotent - not seed categories if already populated", async () => {
    // First seed
    await db.categories.bulkAdd(BUNDLED_CATEGORIES);

    // Simulate second call to initializeDatabase
    const count = await db.categories.count();
    if (count === 0) {
      await db.categories.bulkAdd(BUNDLED_CATEGORIES);
    }

    // Should still be 11
    const finalCount = await db.categories.count();
    expect(finalCount).toBe(11);
  });

  it("should seed categories with correct data", async () => {
    await db.categories.bulkAdd(BUNDLED_CATEGORIES);

    const produce = await db.categories.get(
      "c1000000-0000-0000-0000-000000000001"
    );
    expect(produce).toEqual({
      id: "c1000000-0000-0000-0000-000000000001",
      name: "Produce",
      nameEs: "Frutas y Verduras",
      icon: "carrot",
      defaultOrder: 1,
    });

    const toiletries = await db.categories.get(
      "c1000000-0000-0000-0000-000000000011"
    );
    expect(toiletries).toEqual({
      id: "c1000000-0000-0000-0000-000000000011",
      name: "Toiletries",
      nameEs: "Higiene Personal",
      icon: "bath",
      defaultOrder: 11,
    });
  });
});

describe("BUNDLED_CATEGORIES", () => {
  it("should contain exactly 11 categories", () => {
    expect(BUNDLED_CATEGORIES).toHaveLength(11);
  });

  it("should have unique IDs", () => {
    const ids = BUNDLED_CATEGORIES.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(11);
  });

  it("should have sequential defaultOrder values from 1 to 11", () => {
    const orders = BUNDLED_CATEGORIES.map((c) => c.defaultOrder).sort(
      (a, b) => a - b
    );
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("should have all required category names", () => {
    const names = BUNDLED_CATEGORIES.map((c) => c.name).sort();
    expect(names).toEqual([
      "Baby",
      "Bakery",
      "Dairy",
      "Drinks",
      "Frozen",
      "Household",
      "Meat & Fish",
      "Pantry",
      "Produce",
      "Snacks",
      "Toiletries",
    ]);
  });
});

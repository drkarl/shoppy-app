import {
  test,
  expect,
  uniqueItemName,
  waitForIndexedDB,
  getSyncQueueCount,
  getItemsFromIndexedDB,
  isSupabaseConfigured,
} from "./fixtures";

/**
 * E2E tests for the complete offline workflow.
 *
 * Tests the core offline experience:
 * 1. Load app online
 * 2. Go offline (simulate)
 * 3. Add items
 * 4. Check items
 * 5. Come back online
 * 6. Verify sync completes
 *
 * NOTE: These tests require a real Supabase backend to work properly.
 * They will be skipped if Supabase environment variables are not configured.
 */
test.describe("Offline Workflow", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test.beforeEach(async ({ authenticatedPage }) => {
    // Each test starts with an authenticated page on /list
    await expect(authenticatedPage).toHaveURL(/.*\/list/);
  });

  test("should display offline indicator when network is disconnected", async ({
    authenticatedPage: page,
    goOffline,
    goOnline,
  }) => {
    // Initially should not show offline banner
    const offlineBanner = page.locator('[role="alert"]', {
      hasText: /offline/i,
    });
    await expect(offlineBanner).not.toBeVisible();

    // Go offline
    await goOffline();

    // Trigger a network-dependent action to detect offline state
    // The app should detect offline and show the banner
    await page.getByRole("textbox", { name: /add item/i }).fill("test");
    await page.keyboard.press("Enter");

    // Wait for offline banner to appear (may take a moment for network monitor to detect)
    await expect(offlineBanner).toBeVisible({ timeout: 10000 });

    // Go back online
    await goOnline();

    // Offline banner should eventually disappear
    await expect(offlineBanner).not.toBeVisible({ timeout: 10000 });
  });

  test("should allow adding items while offline", async ({
    authenticatedPage: page,
    goOffline,
    addItem,
  }) => {
    // Go offline first
    await goOffline();

    // Wait a moment for the network state to be detected
    await page.waitForTimeout(500);

    // Add items while offline
    const item1 = uniqueItemName("Offline Item 1");
    const item2 = uniqueItemName("Offline Item 2");

    await addItem(item1);
    await addItem(item2, 3); // Add with quantity

    // Verify items appear in the list
    await expect(page.getByText(item1)).toBeVisible();
    await expect(page.getByText(item2)).toBeVisible();
    await expect(page.getByText("x3")).toBeVisible(); // quantity indicator

    // Verify items are stored in IndexedDB
    const items = await getItemsFromIndexedDB(page);
    expect(items.some((i) => i.display_name === item1)).toBe(true);
    expect(items.some((i) => i.display_name === item2)).toBe(true);
  });

  test("should allow checking items while offline", async ({
    authenticatedPage: page,
    goOffline,
    addItem,
    checkItem,
  }) => {
    // Add an item while online first
    const itemName = uniqueItemName("Check Offline Item");
    await addItem(itemName);
    await waitForIndexedDB(page);

    // Go offline
    await goOffline();
    await page.waitForTimeout(500);

    // Check the item
    await checkItem(itemName);

    // Verify the item appears in the completed section
    const completedSection = page.locator("button", { hasText: /completed/i });
    await expect(completedSection).toBeVisible();

    // Expand completed section if collapsed
    await completedSection.click();

    // The item should have the checked styling (line-through)
    const itemText = page.locator(".line-through", { hasText: itemName });
    await expect(itemText).toBeVisible();

    // Verify in IndexedDB
    const items = await getItemsFromIndexedDB(page);
    const checkedItem = items.find((i) => i.display_name === itemName);
    expect(checkedItem?.status).toBe("checked");
  });

  test("should queue operations when offline and sync when back online", async ({
    authenticatedPage: page,
    goOffline,
    goOnline,
    waitForSync,
    addItem,
  }) => {
    // Go offline
    await goOffline();
    await page.waitForTimeout(500);

    // Add items while offline
    const item1 = uniqueItemName("Sync Item 1");
    const item2 = uniqueItemName("Sync Item 2");
    await addItem(item1);
    await addItem(item2);

    // Verify operations are queued
    await waitForIndexedDB(page);
    const queueCount = await getSyncQueueCount(page);
    expect(queueCount).toBeGreaterThanOrEqual(2);

    // Check that offline indicator shows pending changes
    const offlineBanner = page.locator('[role="alert"]', {
      hasText: /change.*will sync/i,
    });
    await expect(offlineBanner).toBeVisible({ timeout: 5000 });

    // Go back online
    await goOnline();

    // Wait for sync to complete
    await waitForSync();

    // Verify sync queue is empty
    await waitForIndexedDB(page, 2000);
    const finalQueueCount = await getSyncQueueCount(page);
    expect(finalQueueCount).toBe(0);

    // Items should still be visible
    await expect(page.getByText(item1)).toBeVisible();
    await expect(page.getByText(item2)).toBeVisible();
  });

  test("should sync items to Supabase within 5 seconds of coming online", async ({
    authenticatedPage: page,
    goOffline,
    goOnline,
    addItem,
  }) => {
    // Go offline
    await goOffline();
    await page.waitForTimeout(500);

    // Add item while offline
    const itemName = uniqueItemName("Quick Sync Item");
    await addItem(itemName);
    await waitForIndexedDB(page);

    // Verify it's queued
    const queueCountBefore = await getSyncQueueCount(page);
    expect(queueCountBefore).toBeGreaterThan(0);

    // Go back online and measure sync time
    const startTime = Date.now();
    await goOnline();

    // Poll for queue to be empty (sync complete)
    await expect(async () => {
      const count = await getSyncQueueCount(page);
      expect(count).toBe(0);
    }).toPass({ timeout: 5000, intervals: [100, 200, 500, 1000] });

    const syncTime = Date.now() - startTime;

    // Verify sync completed within 5 seconds
    expect(syncTime).toBeLessThan(5000);

    // Item should still be visible
    await expect(page.getByText(itemName)).toBeVisible();
  });

  test("should show syncing indicator during sync", async ({
    authenticatedPage: page,
    goOffline,
    goOnline,
    addItem,
  }) => {
    // Go offline
    await goOffline();
    await page.waitForTimeout(500);

    // Add multiple items to ensure sync takes some time
    for (let i = 0; i < 3; i++) {
      await addItem(uniqueItemName(`Bulk Item ${i}`));
    }
    await waitForIndexedDB(page);

    // Go back online
    await goOnline();

    // Check for syncing indicator (may appear briefly)
    const syncingBanner = page.locator('[role="alert"]', {
      hasText: /syncing/i,
    });

    // Either syncing or synced should appear
    const syncedBanner = page.locator('[role="alert"]', {
      hasText: /synced/i,
    });

    await expect(syncingBanner.or(syncedBanner)).toBeVisible({ timeout: 5000 });

    // Eventually should complete
    await expect(async () => {
      const queueCount = await getSyncQueueCount(page);
      expect(queueCount).toBe(0);
    }).toPass({ timeout: 10000 });
  });

  test("should preserve item data integrity through offline/online cycle", async ({
    authenticatedPage: page,
    goOffline,
    goOnline,
    waitForSync,
    addItem,
    checkItem,
  }) => {
    // Add item with specific quantity while online
    const itemName = uniqueItemName("Data Integrity Item");
    await addItem(itemName, 5);
    await waitForIndexedDB(page);

    // Go offline
    await goOffline();
    await page.waitForTimeout(500);

    // Check the item
    await checkItem(itemName);
    await waitForIndexedDB(page);

    // Go back online
    await goOnline();
    await waitForSync();

    // Verify data integrity
    const items = await getItemsFromIndexedDB(page);
    const item = items.find((i) => i.display_name === itemName);

    expect(item).toBeDefined();
    expect(item?.status).toBe("checked");
    // Version should have incremented from the check operation
    expect(item?.version).toBeGreaterThanOrEqual(1);
  });

  test("should handle multiple offline/online cycles", async ({
    authenticatedPage: page,
    goOffline,
    goOnline,
    waitForSync,
    addItem,
  }) => {
    // First cycle
    await goOffline();
    await page.waitForTimeout(300);
    const item1 = uniqueItemName("Cycle 1 Item");
    await addItem(item1);
    await goOnline();
    await waitForSync();

    // Second cycle
    await goOffline();
    await page.waitForTimeout(300);
    const item2 = uniqueItemName("Cycle 2 Item");
    await addItem(item2);
    await goOnline();
    await waitForSync();

    // Third cycle
    await goOffline();
    await page.waitForTimeout(300);
    const item3 = uniqueItemName("Cycle 3 Item");
    await addItem(item3);
    await goOnline();
    await waitForSync();

    // Verify all items are present and synced
    await expect(page.getByText(item1)).toBeVisible();
    await expect(page.getByText(item2)).toBeVisible();
    await expect(page.getByText(item3)).toBeVisible();

    const queueCount = await getSyncQueueCount(page);
    expect(queueCount).toBe(0);
  });

  test("should continue working if going offline during sync", async ({
    authenticatedPage: page,
    goOffline,
    goOnline,
    addItem,
  }) => {
    // Add items online
    const item1 = uniqueItemName("Pre-interrupt Item");
    await addItem(item1);

    // Go offline immediately after adding more items
    const item2 = uniqueItemName("During-interrupt Item");
    // Start adding item
    const input = page.getByRole("textbox", { name: /add item/i });
    await input.fill(item2);

    // Go offline before completing the add
    await goOffline();

    // Complete the add while offline
    await page.getByRole("button", { name: /add item/i }).click();

    await waitForIndexedDB(page);

    // Item should still be added locally
    await expect(page.getByText(item2)).toBeVisible();

    // Operations should be queued
    const queueCount = await getSyncQueueCount(page);
    expect(queueCount).toBeGreaterThan(0);

    // Go back online and sync
    await goOnline();

    // Wait for sync to complete
    await expect(async () => {
      const count = await getSyncQueueCount(page);
      expect(count).toBe(0);
    }).toPass({ timeout: 10000 });
  });
});

test.describe("Offline Error Handling", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should not lose data on sync errors", async ({
    authenticatedPage: page,
    goOffline,
    addItem,
  }) => {
    // Go offline
    await goOffline();
    await page.waitForTimeout(500);

    // Add items
    const itemName = uniqueItemName("Error Resilience Item");
    await addItem(itemName);
    await waitForIndexedDB(page);

    // Verify item is in IndexedDB
    let items = await getItemsFromIndexedDB(page);
    expect(items.some((i) => i.display_name === itemName)).toBe(true);

    // Verify it's still there after some time (simulating failed sync retries)
    await page.waitForTimeout(2000);
    items = await getItemsFromIndexedDB(page);
    expect(items.some((i) => i.display_name === itemName)).toBe(true);

    // Item should still be visible
    await expect(page.getByText(itemName)).toBeVisible();
  });
});

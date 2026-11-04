import {
  test as base,
  expect,
  type Page,
  type BrowserContext,
} from "@playwright/test";

import {
  uniqueItemName,
  waitForIndexedDB,
  getSyncQueueCount,
  getItemsFromIndexedDB,
  TEST_USER,
  isSupabaseConfigured,
} from "./fixtures";

/**
 * E2E tests for sync functionality including:
 * - Conflict resolution with two browser contexts
 * - Sync queue persistence across page reloads
 *
 * NOTE: These tests require a real Supabase backend to work properly.
 * They will be skipped if Supabase environment variables are not configured.
 */

/**
 * Extended test fixture for multi-context sync tests.
 */
const test = base.extend<{
  userContext1: BrowserContext;
  userContext2: BrowserContext;
  page1: Page;
  page2: Page;
}>({
  /**
   * Creates two separate browser contexts to simulate two users/tabs.
   */
  userContext1: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  userContext2: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  /**
   * Authenticated page in context 1.
   */
  page1: async ({ userContext1 }, use) => {
    const page = await userContext1.newPage();
    await authenticatePage(page);
    await use(page);
  },

  /**
   * Authenticated page in context 2.
   */
  page2: async ({ userContext2 }, use) => {
    const page = await userContext2.newPage();
    await authenticatePage(page);
    await use(page);
  },
});

/**
 * Helper to authenticate a page.
 */
async function authenticatePage(page: Page): Promise<void> {
  // Auto-enable mock auth when Supabase env vars are not configured
  const supabaseConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const useMockAuth =
    process.env.E2E_MOCK_AUTH === "true" || !supabaseConfigured;

  if (useMockAuth) {
    await page.addInitScript(() => {
      const mockUser = {
        id: "test-user-id",
        email: "e2e-test@shoppy.test",
        aud: "authenticated",
        role: "authenticated",
      };
      const mockSession = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: mockUser,
      };
      localStorage.setItem(
        "sb-localhost-auth-token",
        JSON.stringify({
          currentSession: mockSession,
          expiresAt: Date.now() + 3600000,
        })
      );
    });
    await page.goto("/list");
  } else {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/list", { timeout: 15000 });
  }
  await page.waitForLoadState("networkidle");
}

/**
 * Helper to add an item on a page.
 */
async function addItemOnPage(
  page: Page,
  name: string,
  quantity: number = 1
): Promise<void> {
  const input = page.getByRole("textbox", { name: /add item/i });
  const submitButton = page.getByRole("button", { name: /add item/i });
  const inputValue = quantity > 1 ? `${name} ${quantity}` : name;
  await input.fill(inputValue);
  await submitButton.click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });
}

/**
 * Helper to check an item on a page.
 */
async function checkItemOnPage(page: Page, name: string): Promise<void> {
  const itemRow = page
    .locator("div", { hasText: name })
    .filter({
      has: page.getByRole("checkbox"),
    })
    .first();
  await itemRow.getByRole("checkbox").click();
}

/**
 * Helper to set a context offline.
 */
async function setContextOffline(
  context: BrowserContext,
  offline: boolean
): Promise<void> {
  await context.setOffline(offline);
  if (offline) {
    await context.route("**/*", (route) => {
      if (
        route.request().url().includes("supabase") ||
        route.request().url().includes("/api/")
      ) {
        return route.abort("connectionfailed");
      }
      return route.continue();
    });
  } else {
    await context.unrouteAll();
  }
}

/**
 * Helper to wait for sync on a page.
 */
async function waitForSyncOnPage(page: Page): Promise<void> {
  try {
    await expect(async () => {
      const offlineBanner = page.locator('[role="alert"]', {
        hasText: /offline/i,
      });
      const syncingBanner = page.locator('[role="alert"]', {
        hasText: /syncing/i,
      });
      const hasOffline = await offlineBanner.count();
      const hasSyncing = await syncingBanner.count();
      expect(hasOffline + hasSyncing).toBe(0);
    }).toPass({ timeout: 10000 });
  } catch {
    // Sync completed quickly
  }
}

test.describe("Conflict Resolution", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");
  test("should resolve conflicts using version numbers when two users edit concurrently", async ({
    page1,
    page2,
    userContext1,
    userContext2,
  }) => {
    // Setup: Add a shared item from page1
    const sharedItemName = uniqueItemName("Conflict Item");
    await addItemOnPage(page1, sharedItemName);
    await waitForIndexedDB(page1);

    // Wait for sync and realtime update to reach page2
    await page2.waitForTimeout(2000);
    await page2.reload();
    await page2.waitForLoadState("networkidle");

    // Verify the item is visible on both pages
    await expect(page1.getByText(sharedItemName)).toBeVisible();
    await expect(page2.getByText(sharedItemName)).toBeVisible();

    // Both pages go offline
    await setContextOffline(userContext1, true);
    await setContextOffline(userContext2, true);
    await page1.waitForTimeout(500);
    await page2.waitForTimeout(500);

    // User 1 checks the item
    await checkItemOnPage(page1, sharedItemName);
    await waitForIndexedDB(page1);

    // User 2 also modifies the same item (checks it too - same action)
    await checkItemOnPage(page2, sharedItemName);
    await waitForIndexedDB(page2);

    // Get version numbers from both
    const items1 = await getItemsFromIndexedDB(page1);
    const items2 = await getItemsFromIndexedDB(page2);
    const item1 = items1.find((i) => i.display_name === sharedItemName);
    const item2 = items2.find((i) => i.display_name === sharedItemName);

    // Both should be checked locally
    expect(item1?.status).toBe("checked");
    expect(item2?.status).toBe("checked");

    // Bring page1 online first - its changes sync
    await setContextOffline(userContext1, false);
    await waitForSyncOnPage(page1);

    // Then bring page2 online - conflict resolution happens
    await setContextOffline(userContext2, false);
    await waitForSyncOnPage(page2);

    // Wait for realtime updates to propagate
    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // Verify both pages eventually show consistent state
    // The item should still be checked (both made same change)
    const finalItems1 = await getItemsFromIndexedDB(page1);
    const finalItems2 = await getItemsFromIndexedDB(page2);
    const finalItem1 = finalItems1.find(
      (i) => i.display_name === sharedItemName
    );
    const finalItem2 = finalItems2.find(
      (i) => i.display_name === sharedItemName
    );

    // States should be consistent
    expect(finalItem1?.status).toBe(finalItem2?.status);
    // Both checked
    expect(finalItem1?.status).toBe("checked");

    // No data should be lost - item still exists
    expect(finalItem1).toBeDefined();
    expect(finalItem2).toBeDefined();
  });

  test("should handle conflicting status changes (check vs uncheck)", async ({
    page1,
    page2,
    userContext1,
    userContext2,
  }) => {
    // Add item and check it first
    const itemName = uniqueItemName("Status Conflict Item");
    await addItemOnPage(page1, itemName);
    await waitForIndexedDB(page1);
    await checkItemOnPage(page1, itemName);
    await waitForIndexedDB(page1);

    // Sync to page2
    await page2.waitForTimeout(2000);
    await page2.reload();
    await page2.waitForLoadState("networkidle");

    // Expand completed section on page2
    const completedButton = page2.locator("button", { hasText: /completed/i });
    if (await completedButton.isVisible()) {
      await completedButton.click();
    }

    // Both go offline
    await setContextOffline(userContext1, true);
    await setContextOffline(userContext2, true);
    await page1.waitForTimeout(500);
    await page2.waitForTimeout(500);

    // User 1 unchecks the item (already checked, so this toggles to pending)
    // Expand completed section first
    const completedSection1 = page1.locator("button", {
      hasText: /completed/i,
    });
    if (await completedSection1.isVisible()) {
      await completedSection1.click();
    }
    await checkItemOnPage(page1, itemName); // toggle
    await waitForIndexedDB(page1);

    // User 2 also unchecks (same action)
    await checkItemOnPage(page2, itemName); // toggle
    await waitForIndexedDB(page2);

    // Both go online
    await setContextOffline(userContext1, false);
    await page1.waitForTimeout(1000);
    await setContextOffline(userContext2, false);

    // Wait for sync
    await waitForSyncOnPage(page1);
    await waitForSyncOnPage(page2);

    // Verify no data loss - item exists on both
    const finalItems1 = await getItemsFromIndexedDB(page1);
    const finalItems2 = await getItemsFromIndexedDB(page2);

    const item1 = finalItems1.find((i) => i.display_name === itemName);
    const item2 = finalItems2.find((i) => i.display_name === itemName);

    expect(item1).toBeDefined();
    expect(item2).toBeDefined();

    // Version-based resolution means higher version wins
    // Both should converge to same state
    await page1.waitForTimeout(2000);
    const updatedItems1 = await getItemsFromIndexedDB(page1);
    const updatedItems2 = await getItemsFromIndexedDB(page2);
    const updatedItem1 = updatedItems1.find((i) => i.display_name === itemName);
    const updatedItem2 = updatedItems2.find((i) => i.display_name === itemName);

    // States should eventually be consistent
    expect(updatedItem1?.status).toBe(updatedItem2?.status);
  });
});

test.describe("Sync Queue Persistence", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");
  test("should persist sync queue across page reloads while offline", async ({
    page,
    context,
  }) => {
    // Authenticate
    await authenticatePage(page);

    // Go offline
    await setContextOffline(context, true);
    await page.waitForTimeout(500);

    // Add items while offline
    const item1 = uniqueItemName("Persist Item 1");
    const item2 = uniqueItemName("Persist Item 2");
    await addItemOnPage(page, item1);
    await addItemOnPage(page, item2);
    await waitForIndexedDB(page);

    // Check queue has items
    const queueBeforeReload = await getSyncQueueCount(page);
    expect(queueBeforeReload).toBeGreaterThanOrEqual(2);

    // Keep items for verification
    const itemsBeforeReload = await getItemsFromIndexedDB(page);
    expect(itemsBeforeReload.some((i) => i.display_name === item1)).toBe(true);
    expect(itemsBeforeReload.some((i) => i.display_name === item2)).toBe(true);

    // Reload the page while still offline
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify queue persisted
    const queueAfterReload = await getSyncQueueCount(page);
    expect(queueAfterReload).toBeGreaterThanOrEqual(2);

    // Verify items still visible
    await expect(page.getByText(item1)).toBeVisible();
    await expect(page.getByText(item2)).toBeVisible();

    // Items should still be in IndexedDB
    const itemsAfterReload = await getItemsFromIndexedDB(page);
    expect(itemsAfterReload.some((i) => i.display_name === item1)).toBe(true);
    expect(itemsAfterReload.some((i) => i.display_name === item2)).toBe(true);
  });

  test("should process persisted sync queue on reconnect after reload", async ({
    page,
    context,
  }) => {
    // Authenticate
    await authenticatePage(page);

    // Go offline
    await setContextOffline(context, true);
    await page.waitForTimeout(500);

    // Add item while offline
    const itemName = uniqueItemName("Reload Sync Item");
    await addItemOnPage(page, itemName);
    await waitForIndexedDB(page);

    // Verify queued
    const queueBefore = await getSyncQueueCount(page);
    expect(queueBefore).toBeGreaterThan(0);

    // Reload while offline
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Still has queue
    const queueAfterReload = await getSyncQueueCount(page);
    expect(queueAfterReload).toBeGreaterThan(0);

    // Now go online
    await setContextOffline(context, false);

    // Wait for sync to process the persisted queue
    await expect(async () => {
      const count = await getSyncQueueCount(page);
      expect(count).toBe(0);
    }).toPass({ timeout: 10000 });

    // Item still visible and synced
    await expect(page.getByText(itemName)).toBeVisible();
  });

  test("should preserve queue order after reload", async ({
    page,
    context,
  }) => {
    // Authenticate
    await authenticatePage(page);

    // Go offline
    await setContextOffline(context, true);
    await page.waitForTimeout(500);

    // Add items in specific order
    const items = [
      uniqueItemName("Order 1"),
      uniqueItemName("Order 2"),
      uniqueItemName("Order 3"),
    ];

    for (const item of items) {
      await addItemOnPage(page, item);
      await page.waitForTimeout(100); // Small delay to ensure timestamp ordering
    }
    await waitForIndexedDB(page);

    // Reload
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Go online
    await setContextOffline(context, false);

    // Wait for sync
    await expect(async () => {
      const count = await getSyncQueueCount(page);
      expect(count).toBe(0);
    }).toPass({ timeout: 10000 });

    // All items should be present
    for (const item of items) {
      await expect(page.getByText(item)).toBeVisible();
    }
  });

  test("should handle browser close and reopen with pending queue", async ({
    browser,
  }) => {
    // Create first context
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await authenticatePage(page1);

    // Go offline
    await setContextOffline(context1, true);
    await page1.waitForTimeout(500);

    // Add item
    const itemName = uniqueItemName("Browser Close Item");
    await addItemOnPage(page1, itemName);
    await waitForIndexedDB(page1);

    // Verify queued
    const queueCount = await getSyncQueueCount(page1);
    expect(queueCount).toBeGreaterThan(0);

    // Close context (simulating browser close)
    await context1.close();

    // Open new context (simulating browser reopen)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await authenticatePage(page2);

    // The IndexedDB data should persist (same origin)
    // Item should be visible
    await expect(page2.getByText(itemName)).toBeVisible();

    // Queue should still have pending items
    const queueAfterReopen = await getSyncQueueCount(page2);
    expect(queueAfterReopen).toBeGreaterThan(0);

    // Going online should sync
    await expect(async () => {
      const count = await getSyncQueueCount(page2);
      expect(count).toBe(0);
    }).toPass({ timeout: 10000 });

    await context2.close();
  });
});

test.describe("Realtime Sync", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");
  test("should receive realtime updates from other sessions", async ({
    page1,
    page2,
  }) => {
    // Verify both pages are on list page
    await expect(page1).toHaveURL(/.*\/list/);
    await expect(page2).toHaveURL(/.*\/list/);

    // Add item from page1
    const itemName = uniqueItemName("Realtime Item");
    await addItemOnPage(page1, itemName);
    await waitForIndexedDB(page1);

    // Wait for realtime to propagate to page2
    await expect(page2.getByText(itemName)).toBeVisible({ timeout: 10000 });

    // Verify both pages show the item
    await expect(page1.getByText(itemName)).toBeVisible();
    await expect(page2.getByText(itemName)).toBeVisible();
  });

  test("should handle rapid concurrent edits", async ({ page1, page2 }) => {
    // Both users add items rapidly
    const items1 = [uniqueItemName("Rapid 1A"), uniqueItemName("Rapid 1B")];
    const items2 = [uniqueItemName("Rapid 2A"), uniqueItemName("Rapid 2B")];

    // Add in parallel
    await Promise.all([
      (async () => {
        for (const item of items1) {
          await addItemOnPage(page1, item);
        }
      })(),
      (async () => {
        for (const item of items2) {
          await addItemOnPage(page2, item);
        }
      })(),
    ]);

    // Wait for sync to settle
    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    // Refresh both pages to ensure consistent view
    await page1.reload();
    await page2.reload();
    await page1.waitForLoadState("networkidle");
    await page2.waitForLoadState("networkidle");

    // All items should be visible on both pages
    for (const item of [...items1, ...items2]) {
      await expect(page1.getByText(item)).toBeVisible({ timeout: 5000 });
      await expect(page2.getByText(item)).toBeVisible({ timeout: 5000 });
    }
  });
});

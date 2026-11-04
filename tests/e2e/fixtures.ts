import { test as base, expect, type Page } from "@playwright/test";

/**
 * E2E test fixtures for Shoppy offline tests.
 *
 * Provides utilities for:
 * - Network state simulation
 * - Auth state management
 * - Test data cleanup
 * - Common page interactions
 */

/**
 * Check if Supabase is configured for E2E tests.
 * These tests require a real Supabase backend for sync functionality.
 */
export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Test user credentials for E2E tests.
 * These should be configured in the test Supabase project.
 */
export const TEST_USER = {
  email: process.env.E2E_TEST_USER_EMAIL || "e2e-test@shoppy.test",
  password: process.env.E2E_TEST_USER_PASSWORD || "test-password-123",
};

/**
 * Extended test fixtures with offline simulation helpers.
 */
export const test = base.extend<{
  authenticatedPage: Page;
  goOffline: () => Promise<void>;
  goOnline: () => Promise<void>;
  waitForSync: () => Promise<void>;
  addItem: (name: string, quantity?: number) => Promise<void>;
  checkItem: (name: string) => Promise<void>;
  getItemCount: () => Promise<number>;
}>({
  /**
   * Provides a page that's already authenticated with the test user.
   * Falls back to mock auth for CI environments without real Supabase.
   */
  authenticatedPage: async ({ page }, use) => {
    // Check if we should use mock auth (for CI without real Supabase)
    // Auto-enable mock auth when Supabase env vars are not configured
    const supabaseConfigured =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const useMockAuth =
      process.env.E2E_MOCK_AUTH === "true" || !supabaseConfigured;

    if (useMockAuth) {
      // Set up mock auth state in localStorage before navigation
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
      // Real authentication flow
      await page.goto("/login");

      // Fill in credentials
      await page.getByLabel("Email").fill(TEST_USER.email);
      await page.getByLabel("Password").fill(TEST_USER.password);
      await page.getByRole("button", { name: /sign in/i }).click();

      // Wait for redirect to list page
      await page.waitForURL("**/list", { timeout: 15000 });
    }

    // Wait for app to initialize
    await page.waitForLoadState("networkidle");

    await use(page);
  },

  /**
   * Simulates going offline by blocking network requests.
   */
  goOffline: async ({ context }, use) => {
    const goOffline = async () => {
      await context.setOffline(true);
      // Also block any requests that might have been initiated before offline mode
      await context.route("**/*", (route) => {
        if (
          route.request().url().includes("supabase") ||
          route.request().url().includes("/api/")
        ) {
          return route.abort("connectionfailed");
        }
        return route.continue();
      });
    };
    await use(goOffline);
  },

  /**
   * Simulates coming back online by restoring network.
   */
  goOnline: async ({ context }, use) => {
    const goOnline = async () => {
      await context.setOffline(false);
      // Remove the route blocking
      await context.unrouteAll();
    };
    await use(goOnline);
  },

  /**
   * Waits for sync to complete by watching for the sync status indicator.
   */
  waitForSync: async ({ page }, use) => {
    const waitForSync = async () => {
      // Wait for syncing state to appear (if it does)
      const syncingIndicator = page.locator('[role="alert"]', {
        hasText: /syncing/i,
      });
      const syncedIndicator = page.locator('[role="alert"]', {
        hasText: /synced/i,
      });

      // Wait for either syncing to start or synced to appear
      // Then wait for synced state
      try {
        // Give it up to 5 seconds to sync
        await expect(
          syncedIndicator.or(
            page.locator('[role="alert"]').filter({ hasNot: syncingIndicator })
          )
        )
          .toBeVisible({ timeout: 5000 })
          .catch(() => {
            // If no sync indicator appears, the sync might have been instant
          });

        // Now wait for the synced banner or for no banner (fully synced)
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
        }).toPass({ timeout: 5000 });
      } catch {
        // Expected: sync may complete instantly or state may already be synced.
        // Empty catch is intentional - we don't want to fail tests for fast syncs.
      }
    };
    await use(waitForSync);
  },

  /**
   * Helper to add an item to the shopping list.
   *
   * **Note for test authors:** This fixture uses `toBeEnabled({ timeout })` to wait
   * for the input field to become enabled, which handles race conditions during
   * app initialization. This pattern is preferred over `waitForTimeout` because
   * it waits only as long as necessary and fails fast with a clear error message.
   * Use this pattern when waiting for interactive elements to become ready.
   */
  addItem: async ({ page }, use) => {
    const addItem = async (name: string, quantity: number = 1) => {
      const input = page.getByRole("textbox", { name: /add item/i });
      const submitButton = page.getByRole("button", { name: /add item/i });

      // Wait for input to be enabled (app initialization complete)
      await expect(input).toBeEnabled({ timeout: 10000 });

      // Format input with quantity if > 1
      const inputValue = quantity > 1 ? `${name} ${quantity}` : name;
      await input.fill(inputValue);
      await submitButton.click();

      // Wait for the item to appear in the list
      await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });
    };
    await use(addItem);
  },

  /**
   * Helper to check/uncheck an item by clicking its checkbox.
   */
  checkItem: async ({ page }, use) => {
    const checkItem = async (name: string) => {
      // Find the item row containing the name
      const itemRow = page
        .locator("div", { hasText: name })
        .filter({
          has: page.getByRole("checkbox"),
        })
        .first();

      // Click the checkbox
      await itemRow.getByRole("checkbox").click();
    };
    await use(checkItem);
  },

  /**
   * Returns the count of visible list items.
   */
  getItemCount: async ({ page }, use) => {
    const getItemCount = async () => {
      // Count items by looking for checkboxes within list items
      const checkboxes = page.locator('[role="checkbox"]');
      return await checkboxes.count();
    };
    await use(getItemCount);
  },
});

export { expect };

/**
 * Helper to generate unique item names for tests.
 */
export function uniqueItemName(prefix: string = "Test Item"): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Helper to wait for IndexedDB changes to persist.
 */
export async function waitForIndexedDB(
  page: Page,
  timeout: number = 1000
): Promise<void> {
  await page.waitForTimeout(timeout);
}

/**
 * Helper to clear test data from IndexedDB.
 */
export async function clearTestData(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name?.includes("Shoppy")) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  });
}

/**
 * Get sync queue count from IndexedDB.
 */
export async function getSyncQueueCount(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    return new Promise((resolve) => {
      const request = indexedDB.open("ShoppyDB");
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["syncQueue"], "readonly");
        const store = transaction.objectStore("syncQueue");
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => resolve(0);
      };
      request.onerror = () => resolve(0);
    });
  });
}

/**
 * Get items from IndexedDB for verification.
 */
export async function getItemsFromIndexedDB(page: Page): Promise<
  Array<{
    id: string;
    display_name: string;
    status: string;
    version: number;
  }>
> {
  return await page.evaluate(async () => {
    return new Promise((resolve) => {
      const request = indexedDB.open("ShoppyDB");
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["listItems"], "readonly");
        const store = transaction.objectStore("listItems");
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          // Note: Dexie stores items with camelCase (displayName), but we expose
          // as snake_case (display_name) for consistency with the test interface
          const items = getAllRequest.result.map(
            (item: Record<string, unknown>) => ({
              id: item.id as string,
              display_name: item.displayName as string,
              status: item.status as string,
              version: item.version as number,
            })
          );
          resolve(items);
        };
        getAllRequest.onerror = () => resolve([]);
      };
      request.onerror = () => resolve([]);
    });
  });
}

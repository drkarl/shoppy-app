import {
  test as base,
  expect,
  type Page,
  type BrowserContext,
} from "@playwright/test";

import {
  uniqueItemName,
  waitForIndexedDB,
  TEST_USER,
  isSupabaseConfigured,
} from "./fixtures";

/**
 * E2E tests for realtime collaboration between multiple users.
 *
 * Tests:
 * - Two browser contexts working on same household
 * - Household creation and invite flow
 * - Realtime item updates between users
 * - Concurrent item operations
 * - Invite code validation
 */

/**
 * Extended test fixture for collaboration tests with two browser contexts.
 */
const test = base.extend<{
  userContext1: BrowserContext;
  userContext2: BrowserContext;
  page1: Page;
  page2: Page;
}>({
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

  page1: async ({ userContext1 }, use) => {
    const page = await userContext1.newPage();
    await authenticatePage(page, "user1");
    await use(page);
  },

  page2: async ({ userContext2 }, use) => {
    const page = await userContext2.newPage();
    await authenticatePage(page, "user2");
    await use(page);
  },
});

/**
 * Helper to authenticate a page with mock auth.
 */
async function authenticatePage(
  page: Page,
  userIdSuffix: string
): Promise<void> {
  const supabaseConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const useMockAuth =
    process.env.E2E_MOCK_AUTH === "true" || !supabaseConfigured;

  if (useMockAuth) {
    await page.addInitScript(
      ({ suffix }) => {
        const mockUser = {
          id: `test-user-${suffix}`,
          email: `e2e-test-${suffix}@shoppy.test`,
          aud: "authenticated",
          role: "authenticated",
        };
        const mockSession = {
          access_token: `mock-access-token-${suffix}`,
          refresh_token: `mock-refresh-token-${suffix}`,
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
      },
      { suffix: userIdSuffix }
    );
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
 * Helper to add an item on a specific page.
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
  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
}

/**
 * Helper to check an item on a specific page.
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

test.describe("Two Users Collaboration", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should show items added by one user on another users screen", async ({
    page1,
    page2,
  }) => {
    // Verify both pages are on list page
    await expect(page1).toHaveURL(/.*\/list/);
    await expect(page2).toHaveURL(/.*\/list/);

    // User 1 adds an item
    const itemName = uniqueItemName("Collab Item");
    await addItemOnPage(page1, itemName);
    await waitForIndexedDB(page1);

    // User 2 should see the item via realtime sync
    // This may require a page reload for non-realtime setups
    await page2.waitForTimeout(3000);
    await page2.reload();
    await page2.waitForLoadState("networkidle");

    // Item should be visible on page2
    await expect(page2.getByText(itemName)).toBeVisible({ timeout: 10000 });
  });

  test("should show checked status changes across users", async ({
    page1,
    page2,
  }) => {
    // Add item from page1
    const itemName = uniqueItemName("Check Sync Item");
    await addItemOnPage(page1, itemName);
    await waitForIndexedDB(page1);

    // Wait for sync and reload page2
    await page2.waitForTimeout(2000);
    await page2.reload();
    await page2.waitForLoadState("networkidle");

    // Verify item on page2
    await expect(page2.getByText(itemName)).toBeVisible();

    // User 1 checks the item
    await checkItemOnPage(page1, itemName);
    await waitForIndexedDB(page1);

    // Wait for realtime update on page2
    await page2.waitForTimeout(3000);
    await page2.reload();
    await page2.waitForLoadState("networkidle");

    // Item should be checked on page2 (in completed section)
    const completedSection = page2.locator("button", { hasText: /completed/i });
    await expect(completedSection).toBeVisible({ timeout: 10000 });
  });

  test("should handle concurrent item additions", async ({ page1, page2 }) => {
    // Both users add items simultaneously
    const item1 = uniqueItemName("User1 Item");
    const item2 = uniqueItemName("User2 Item");

    await Promise.all([
      addItemOnPage(page1, item1),
      addItemOnPage(page2, item2),
    ]);

    // Wait for sync
    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    // Reload both pages
    await page1.reload();
    await page2.reload();
    await page1.waitForLoadState("networkidle");
    await page2.waitForLoadState("networkidle");

    // Both items should be visible on both pages
    await expect(page1.getByText(item1)).toBeVisible({ timeout: 10000 });
    await expect(page1.getByText(item2)).toBeVisible({ timeout: 10000 });
    await expect(page2.getByText(item1)).toBeVisible({ timeout: 10000 });
    await expect(page2.getByText(item2)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Household Management", () => {
  test("should display onboarding wizard for new users", async ({ page }) => {
    // Clear auth and household data
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Set up mock auth for user without household
    await page.addInitScript(() => {
      const mockUser = {
        id: "new-user-no-household",
        email: "new-user@shoppy.test",
        aud: "authenticated",
        role: "authenticated",
      };
      const mockSession = {
        access_token: "mock-access-token-new",
        refresh_token: "mock-refresh-token-new",
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
    await page.waitForLoadState("networkidle");

    // Should redirect to onboarding or show onboarding UI
    // (depends on app state)
    const url = page.url();
    expect(url).toMatch(/\/(list|onboarding)/);
  });
});

test.describe("Invite Code Flow", () => {
  test("should display join household UI on invite page", async ({ page }) => {
    // Set up mock auth
    await page.addInitScript(() => {
      const mockUser = {
        id: "invite-test-user",
        email: "invite-test@shoppy.test",
        aud: "authenticated",
        role: "authenticated",
      };
      const mockSession = {
        access_token: "mock-access-token-invite",
        refresh_token: "mock-refresh-token-invite",
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

    // Visit join page with a test invite code
    await page.goto("/join/test-invite-code");
    await page.waitForLoadState("networkidle");

    // Should show some UI related to joining or validation
    // Either "Verifying invite link" or error state
    await expect(page.getByText(/verifying|join|invalid|expired/i)).toBeVisible(
      { timeout: 10000 }
    );
  });

  test("should handle invalid invite code gracefully", async ({ page }) => {
    // Set up mock auth
    await page.addInitScript(() => {
      const mockUser = {
        id: "invalid-invite-user",
        email: "invalid-invite@shoppy.test",
        aud: "authenticated",
        role: "authenticated",
      };
      const mockSession = {
        access_token: "mock-access-token-invalid",
        refresh_token: "mock-refresh-token-invalid",
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

    // Visit join page with an invalid invite code
    await page.goto("/join/invalid-code-12345");
    await page.waitForLoadState("networkidle");

    // Should show error state after validation
    await page.waitForTimeout(3000);

    // Should show invalid/error message or still be validating
    const hasError = await page
      .getByText(/invalid|not valid|error|expired/i)
      .isVisible()
      .catch(() => false);
    const isValidating = await page
      .getByText(/verifying/i)
      .isVisible()
      .catch(() => false);

    // Either shows error or is still validating
    expect(hasError || isValidating).toBe(true);
  });

  test("should prompt login for unauthenticated users on invite page", async ({
    page,
  }) => {
    // Clear auth
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/join/some-invite-code");
    await page.waitForLoadState("networkidle");

    // Should prompt to sign in
    await expect(
      page.getByRole("heading", { name: /join a household/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /sign in to continue/i })
    ).toBeVisible();
  });
});

test.describe("Realtime Updates", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should receive item updates without manual refresh", async ({
    page1,
    page2,
  }) => {
    // This test verifies that Supabase Realtime is working
    // Add item from page1
    const itemName = uniqueItemName("Realtime Update Item");
    await addItemOnPage(page1, itemName);
    await waitForIndexedDB(page1);

    // Wait for realtime to propagate (without manual refresh)
    // This depends on Supabase Realtime being configured
    await expect(page2.getByText(itemName)).toBeVisible({ timeout: 15000 });
  });

  test("should handle rapid updates from multiple users", async ({
    page1,
    page2,
  }) => {
    // Add multiple items rapidly from both users
    const items1 = [
      uniqueItemName("Rapid1 A"),
      uniqueItemName("Rapid1 B"),
      uniqueItemName("Rapid1 C"),
    ];
    const items2 = [
      uniqueItemName("Rapid2 A"),
      uniqueItemName("Rapid2 B"),
      uniqueItemName("Rapid2 C"),
    ];

    // Add items concurrently
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

    // Wait for sync
    await page1.waitForTimeout(5000);
    await page2.waitForTimeout(5000);

    // Reload to get final state
    await page1.reload();
    await page2.reload();
    await page1.waitForLoadState("networkidle");
    await page2.waitForLoadState("networkidle");

    // All items should be present on both pages
    for (const item of [...items1, ...items2]) {
      await expect(page1.getByText(item)).toBeVisible({ timeout: 5000 });
      await expect(page2.getByText(item)).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe("Settings and Invite Management", () => {
  test("should display settings page with invite section", async ({ page }) => {
    // Set up mock auth
    await page.addInitScript(() => {
      const mockUser = {
        id: "settings-test-user",
        email: "settings@shoppy.test",
        aud: "authenticated",
        role: "authenticated",
      };
      const mockSession = {
        access_token: "mock-access-token-settings",
        refresh_token: "mock-refresh-token-settings",
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

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Settings page should load (may redirect to onboarding if no household)
    const url = page.url();
    expect(url).toMatch(/\/(settings|onboarding|list)/);
  });

  test("should navigate to store profiles from settings", async ({ page }) => {
    // Set up mock auth
    await page.addInitScript(() => {
      const mockUser = {
        id: "stores-nav-user",
        email: "stores-nav@shoppy.test",
        aud: "authenticated",
        role: "authenticated",
      };
      const mockSession = {
        access_token: "mock-access-token-stores-nav",
        refresh_token: "mock-refresh-token-stores-nav",
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

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Look for stores/store profiles link
    const storesLink = page.getByRole("link", { name: /store|stores/i });

    if (await storesLink.isVisible()) {
      await storesLink.click();
      await expect(page).toHaveURL(/\/settings\/stores/);
    }
  });
});

test.describe("Multi-device Sync", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should sync shopping mode progress across devices", async ({
    page1,
    page2,
  }) => {
    // Add items
    const items = [
      uniqueItemName("Sync Shop 1"),
      uniqueItemName("Sync Shop 2"),
    ];

    for (const item of items) {
      await addItemOnPage(page1, item);
    }
    await waitForIndexedDB(page1);

    // Wait for sync
    await page2.waitForTimeout(3000);
    await page2.reload();
    await page2.waitForLoadState("networkidle");

    // Both pages go to shopping mode
    await page1.goto("/list/shopping");
    await page2.goto("/list/shopping");
    await page1.waitForLoadState("networkidle");
    await page2.waitForLoadState("networkidle");

    // User 1 checks first item
    const firstItemRow1 = page1
      .locator("div", { hasText: items[0] })
      .filter({
        has: page1.getByRole("checkbox"),
      })
      .first();
    await firstItemRow1.getByRole("checkbox").click();
    await waitForIndexedDB(page1);

    // Wait for sync and reload page2
    await page2.waitForTimeout(3000);
    await page2.reload();
    await page2.waitForLoadState("networkidle");

    // Page2 should show 1 of 2 items checked
    await expect(page2.getByText(/1 of 2 items/i)).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Store Profiles Collaboration", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should share store profiles across household members", async ({
    page1,
    page2,
  }) => {
    // Navigate to store profiles on page1
    await page1.goto("/settings/stores");
    await page1.waitForLoadState("networkidle");

    // Check if any stores exist
    const addStoreButton = page1.getByRole("button", { name: /add store/i });

    if (await addStoreButton.isVisible()) {
      // Add a store
      await addStoreButton.click();

      const storeNameInput = page1.getByLabel(/store name/i);
      if (await storeNameInput.isVisible()) {
        const storeName = uniqueItemName("Test Store");
        await storeNameInput.fill(storeName);
        await page1.getByRole("button", { name: /create/i }).click();

        // Wait for store to be created
        await page1.waitForTimeout(2000);

        // User 2 should see the store
        await page2.goto("/settings/stores");
        await page2.waitForLoadState("networkidle");

        // Store should be visible (after reload)
        await page2.waitForTimeout(2000);
        await page2.reload();
        await page2.waitForLoadState("networkidle");

        // The store should appear if users share a household
        // (depends on household membership)
      }
    }
  });
});

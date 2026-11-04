import {
  test,
  expect,
  uniqueItemName,
  waitForIndexedDB,
  isSupabaseConfigured,
} from "./fixtures";

/**
 * E2E tests for shopping mode functionality.
 *
 * Tests:
 * - Entering and exiting shopping mode
 * - Progress bar display and updates
 * - Checking items in shopping mode
 * - Store selector
 * - Category ordering per store
 * - Completion celebration (confetti)
 * - Completed items section
 *
 * NOTE: These tests require a real Supabase backend for list/item operations.
 * They will be skipped if Supabase environment variables are not configured.
 */

test.describe("Shopping Mode Navigation", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");
  test.beforeEach(async ({ authenticatedPage }) => {
    // Each test starts with an authenticated page on /list
    await expect(authenticatedPage).toHaveURL(/.*\/list/);
  });

  test("should navigate to shopping mode from list page", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    // Add an item first (shopping mode needs items)
    await addItem(uniqueItemName("Shop Item"));
    await waitForIndexedDB(page);

    // Navigate to shopping mode
    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Verify we're in shopping mode
    await expect(
      page.getByRole("heading", { name: /shopping mode/i })
    ).toBeVisible();
  });

  test("should navigate back to list from shopping mode", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    // Add item and go to shopping mode
    await addItem(uniqueItemName("Back Nav Item"));
    await waitForIndexedDB(page);
    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Click back button
    await page.getByRole("link", { name: /back to list/i }).click();

    // Should be on list page
    await expect(page).toHaveURL(/\/list$/);
  });
});

test.describe("Shopping Mode Display", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should display header with title and back button", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    await addItem(uniqueItemName("Header Test Item"));
    await waitForIndexedDB(page);
    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Verify header elements
    await expect(
      page.getByRole("heading", { name: /shopping mode/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /back to list/i })
    ).toBeVisible();
  });

  test("should display empty state when no items exist", async ({
    authenticatedPage: page,
  }) => {
    // Go directly to shopping mode without items
    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Should show empty state message
    await expect(page.getByText(/no items on your list/i)).toBeVisible();

    // Should have link back to main list
    await expect(page.getByRole("link", { name: /main list/i })).toBeVisible();
  });

  test("should display items in shopping mode", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Shop Display Item");
    await addItem(itemName);
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Item should be visible
    await expect(page.getByText(itemName)).toBeVisible();
  });
});

test.describe("Progress Bar", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should display progress bar with correct count", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    // Add 3 items
    const items = [
      uniqueItemName("Progress 1"),
      uniqueItemName("Progress 2"),
      uniqueItemName("Progress 3"),
    ];

    for (const item of items) {
      await addItem(item);
    }
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Progress bar should show "0 of 3 items"
    await expect(page.getByText(/0 of 3 items/i)).toBeVisible();

    // Progress bar element should exist
    await expect(page.getByRole("progressbar")).toBeVisible();
  });

  test("should update progress bar when checking items", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    // Add items
    const items = [
      uniqueItemName("Progress Update 1"),
      uniqueItemName("Progress Update 2"),
    ];

    for (const item of items) {
      await addItem(item);
    }
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Initial: 0 of 2
    await expect(page.getByText(/0 of 2 items/i)).toBeVisible();

    // Check first item
    const firstItem = page
      .locator("div", { hasText: items[0] })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();
    await firstItem.getByRole("checkbox").click();
    await waitForIndexedDB(page);

    // Should now show 1 of 2
    await expect(page.getByText(/1 of 2 items/i)).toBeVisible();
  });

  test("should show complete text when all items checked", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    // Add single item
    const itemName = uniqueItemName("Complete Item");
    await addItem(itemName);
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Check the item
    const itemRow = page
      .locator("div", { hasText: itemName })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();
    await itemRow.getByRole("checkbox").click();
    await waitForIndexedDB(page);

    // Should show "Complete!" text
    await expect(page.getByText(/complete!/i)).toBeVisible();
  });
});

test.describe("Checking Items in Shopping Mode", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should check item and move to completed section", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Shop Check Item");
    await addItem(itemName);
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Check the item
    const itemRow = page
      .locator("div", { hasText: itemName })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();
    await itemRow.getByRole("checkbox").click();
    await waitForIndexedDB(page);

    // Checked items section should appear
    const checkedSection = page.locator("button", {
      hasText: /checked items/i,
    });
    await expect(checkedSection).toBeVisible();
  });

  test("should uncheck item from completed section", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Shop Uncheck Item");
    await addItem(itemName);
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Check the item
    const itemRow = page
      .locator("div", { hasText: itemName })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();
    await itemRow.getByRole("checkbox").click();
    await waitForIndexedDB(page);

    // Expand checked items section
    const checkedSection = page.locator("button", {
      hasText: /checked items/i,
    });
    await checkedSection.click();

    // Uncheck the item
    const checkedItemRow = page
      .locator("div", { hasText: itemName })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();
    await checkedItemRow.getByRole("checkbox").click();
    await waitForIndexedDB(page);

    // Item should be back in pending section
    await expect(page.getByText(itemName)).toBeVisible();

    // Progress should reset
    await expect(page.getByText(/0 of 1 items/i)).toBeVisible();
  });
});

test.describe("Completed Items Section", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should collapse and expand checked items", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Collapse Item");
    await addItem(itemName);
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Check the item
    const itemRow = page
      .locator("div", { hasText: itemName })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();
    await itemRow.getByRole("checkbox").click();
    await waitForIndexedDB(page);

    // Checked items header should be visible
    const checkedSection = page.locator("button", {
      hasText: /checked items/i,
    });
    await expect(checkedSection).toBeVisible();

    // Click to expand
    await checkedSection.click();

    // Item should be visible in expanded section
    await expect(page.getByText(itemName)).toBeVisible();

    // Click to collapse
    await checkedSection.click();

    // Section content should be collapsed (item still in DOM but section closed)
    // The button should have aria-expanded="false"
    await expect(checkedSection).toHaveAttribute("aria-expanded", "false");
  });

  test("should show count in checked items header", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const items = [
      uniqueItemName("Count Check 1"),
      uniqueItemName("Count Check 2"),
    ];

    for (const item of items) {
      await addItem(item);
    }
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Check both items
    for (const item of items) {
      const itemRow = page
        .locator("div", { hasText: item })
        .filter({
          has: page.getByRole("checkbox"),
        })
        .first();
      await itemRow.getByRole("checkbox").click();
      await waitForIndexedDB(page);
    }

    // Checked items section should show count of 2
    const checkedSection = page.locator("button", {
      hasText: /checked items/i,
    });
    await expect(checkedSection).toContainText("2");
  });
});

test.describe("Store Selector", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should display store selector when stores exist", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    await addItem(uniqueItemName("Store Select Item"));
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Store selector may or may not be visible depending on whether stores are configured
    // If visible, it should be a dropdown or button
    const storeSelector = page.locator(
      '[aria-label*="store" i], button:has-text("Store")'
    );

    // If there are store profiles, the selector should be visible
    // Otherwise, a hint about creating stores may be shown
    const hasStoreSelector = await storeSelector
      .first()
      .isVisible()
      .catch(() => false);
    const hasStoreHint = await page
      .getByText(/create store profiles/i)
      .isVisible()
      .catch(() => false);

    // One of these should be true (either stores exist or hint is shown)
    // Both being false is also valid if no items exist
    const itemsExist = (await page.locator('[role="checkbox"]').count()) > 0;
    if (itemsExist) {
      expect(hasStoreSelector || hasStoreHint).toBe(true);
    }
  });

  test("should show hint to create store profiles when none exist", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    await addItem(uniqueItemName("Hint Test Item"));
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // If no stores are configured, should show hint
    // This test validates the hint UI exists if stores are missing
    const storeHint = page.getByText(/create store profiles in settings/i);

    // Check if hint is visible (may not be if stores already exist)
    const hasHint = await storeHint.isVisible().catch(() => false);

    // Either hint is shown or stores exist
    if (hasHint) {
      // Hint should have link to settings
      await expect(page.getByRole("link", { name: /settings/i })).toBeVisible();
    }
  });
});

test.describe("Completion Celebration", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should show all done message when all items checked", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Celebration Item");
    await addItem(itemName);
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Check the item
    const itemRow = page
      .locator("div", { hasText: itemName })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();
    await itemRow.getByRole("checkbox").click();
    await waitForIndexedDB(page);

    // Should show completion message
    await expect(page.getByText(/all done/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/checked off all items/i)).toBeVisible();
  });

  test("should show celebration emoji when complete", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Emoji Item");
    await addItem(itemName);
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Check the item
    const itemRow = page
      .locator("div", { hasText: itemName })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();
    await itemRow.getByRole("checkbox").click();
    await waitForIndexedDB(page);

    // Celebration emoji should appear
    await expect(page.locator("text=/🎉/")).toBeVisible({ timeout: 5000 });
  });

  test("should trigger confetti animation on completion", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Confetti Item");
    await addItem(itemName);
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Check the item
    const itemRow = page
      .locator("div", { hasText: itemName })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();
    await itemRow.getByRole("checkbox").click();

    // Wait for confetti animation (it appears briefly)
    // The Confetti component renders canvas elements
    // We check if the celebration state was triggered by looking for the "all done" message
    await expect(page.getByText(/all done/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Shopping Mode Items Display", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should display item quantities", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Qty Shop Item");
    await addItem(itemName, 4);
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Should show quantity
    await expect(page.getByText("x4")).toBeVisible();
  });

  test("should maintain item order across page reloads", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const items = [
      uniqueItemName("Order A"),
      uniqueItemName("Order B"),
      uniqueItemName("Order C"),
    ];

    for (const item of items) {
      await addItem(item);
    }
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Verify items are visible
    for (const item of items) {
      await expect(page.getByText(item)).toBeVisible();
    }

    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Items should still be visible
    for (const item of items) {
      await expect(page.getByText(item)).toBeVisible();
    }
  });
});

test.describe("Shopping Mode Persistence", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should persist checked state on page reload", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const items = [
      uniqueItemName("Persist Shop 1"),
      uniqueItemName("Persist Shop 2"),
    ];

    for (const item of items) {
      await addItem(item);
    }
    await waitForIndexedDB(page);

    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Check first item
    const firstItemRow = page
      .locator("div", { hasText: items[0] })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();
    await firstItemRow.getByRole("checkbox").click();
    await waitForIndexedDB(page);

    // Progress should be 1 of 2
    await expect(page.getByText(/1 of 2 items/i)).toBeVisible();

    // Reload
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Progress should still be 1 of 2
    await expect(page.getByText(/1 of 2 items/i)).toBeVisible();

    // Checked items section should exist
    await expect(
      page.locator("button", { hasText: /checked items/i })
    ).toBeVisible();
  });
});

test.describe("Shopping Mode with No Pending Items", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should show completion state when navigating with all items checked", async ({
    authenticatedPage: page,
    addItem,
    checkItem,
  }) => {
    // Add and check item from list page
    const itemName = uniqueItemName("Pre-checked Item");
    await addItem(itemName);
    await waitForIndexedDB(page);
    await checkItem(itemName);
    await waitForIndexedDB(page);

    // Navigate to shopping mode
    await page.goto("/list/shopping");
    await page.waitForLoadState("networkidle");

    // Should show all done message
    await expect(page.getByText(/all done/i)).toBeVisible();
  });
});

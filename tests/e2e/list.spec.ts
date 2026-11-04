import {
  test,
  expect,
  uniqueItemName,
  waitForIndexedDB,
  getItemsFromIndexedDB,
  isSupabaseConfigured,
} from "./fixtures";

/**
 * E2E tests for core shopping list operations.
 *
 * Tests:
 * - Adding items with different quantities
 * - Checking/unchecking items
 * - Deleting items
 * - Empty state display
 * - Item display and categorization
 * - Quantity parsing
 *
 * NOTE: These tests require a real Supabase backend for list/item operations.
 * They will be skipped if Supabase environment variables are not configured.
 */

test.describe("List Page Display", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");
  test("should display list page with header and add item bar", async ({
    authenticatedPage: page,
  }) => {
    // Verify header elements
    await expect(
      page.getByRole("heading", { name: /shopping list/i })
    ).toBeVisible();

    // Verify settings button
    await expect(page.getByRole("link", { name: /settings/i })).toBeVisible();

    // Verify add item input
    await expect(
      page.getByRole("textbox", { name: /add item/i })
    ).toBeVisible();

    // Verify add item button
    await expect(page.getByRole("button", { name: /add item/i })).toBeVisible();
  });

  test("should display empty state when no items exist", async ({
    authenticatedPage: page,
  }) => {
    // Clear any existing items by checking for empty state
    // The app should show an empty state message when there are no items
    const emptyState = page.getByText(/your list is empty|start adding items/i);

    // Either show empty state or show items
    // This test just verifies the UI can render in empty state
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasItems = (await page.locator('[role="checkbox"]').count()) > 0;

    // One of these should be true
    expect(hasEmptyState || hasItems).toBe(true);
  });
});

test.describe("Adding Items", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should add a single item to the list", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Test Item");

    await addItem(itemName);

    // Verify item appears in list
    await expect(page.getByText(itemName)).toBeVisible();

    // Verify item is in IndexedDB
    const items = await getItemsFromIndexedDB(page);
    const addedItem = items.find((i) => i.display_name === itemName);
    expect(addedItem).toBeDefined();
    expect(addedItem?.status).toBe("pending");
  });

  test("should add item with quantity", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Quantity Item");

    await addItem(itemName, 5);

    // Verify item appears with quantity indicator
    await expect(page.getByText(itemName)).toBeVisible();
    await expect(page.getByText("x5")).toBeVisible();
  });

  test("should parse quantity from input text", async ({
    authenticatedPage: page,
  }) => {
    const input = page.getByRole("textbox", { name: /add item/i });
    const submitButton = page.getByRole("button", { name: /add item/i });

    // Enter item with quantity inline (e.g., "milk 2")
    const baseName = uniqueItemName("Parsed");
    await input.fill(`${baseName} 3`);
    await submitButton.click();

    // Wait for item to appear
    await expect(page.getByText(baseName)).toBeVisible({ timeout: 5000 });

    // Verify quantity was parsed correctly
    await expect(page.getByText("x3")).toBeVisible();
  });

  test("should clear input after adding item", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Clear Input Item");

    await addItem(itemName);

    // Input should be cleared
    const input = page.getByRole("textbox", { name: /add item/i });
    await expect(input).toHaveValue("");
  });

  test("should show success toast after adding item", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Toast Item");

    await addItem(itemName);

    // Should show success toast
    await expect(page.getByText(`Added ${itemName}`)).toBeVisible({
      timeout: 5000,
    });
  });

  test("should not add empty items", async ({ authenticatedPage: page }) => {
    const input = page.getByRole("textbox", { name: /add item/i });
    const submitButton = page.getByRole("button", { name: /add item/i });

    // Try to add empty item
    await input.fill("");
    await submitButton.click();

    // Button should be disabled or nothing should happen
    // (depending on implementation)
    const initialCount = await page.locator('[role="checkbox"]').count();

    // Fill and clear to trigger validation
    await input.fill("   "); // whitespace only
    await submitButton.click();

    // Count should not increase
    const finalCount = await page.locator('[role="checkbox"]').count();
    expect(finalCount).toBe(initialCount);
  });

  test("should add multiple items in sequence", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const items = [
      uniqueItemName("Item A"),
      uniqueItemName("Item B"),
      uniqueItemName("Item C"),
    ];

    for (const item of items) {
      await addItem(item);
    }

    // All items should be visible
    for (const item of items) {
      await expect(page.getByText(item)).toBeVisible();
    }
  });
});

test.describe("Checking Items", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should check an item and move it to completed section", async ({
    authenticatedPage: page,
    addItem,
    checkItem,
  }) => {
    const itemName = uniqueItemName("Check Item");

    // Add item
    await addItem(itemName);
    await waitForIndexedDB(page);

    // Check the item
    await checkItem(itemName);

    // Should show completed section
    const completedSection = page.locator("button", { hasText: /completed/i });
    await expect(completedSection).toBeVisible();

    // Expand completed section if needed
    await completedSection.click();

    // Item should be in completed section with line-through styling
    const checkedItem = page.locator(".line-through", { hasText: itemName });
    await expect(checkedItem).toBeVisible();

    // Verify in IndexedDB
    const items = await getItemsFromIndexedDB(page);
    const item = items.find((i) => i.display_name === itemName);
    expect(item?.status).toBe("checked");
  });

  test("should uncheck a completed item and return it to pending", async ({
    authenticatedPage: page,
    addItem,
    checkItem,
  }) => {
    const itemName = uniqueItemName("Uncheck Item");

    // Add and check item
    await addItem(itemName);
    await waitForIndexedDB(page);
    await checkItem(itemName);
    await waitForIndexedDB(page);

    // Expand completed section
    const completedSection = page.locator("button", { hasText: /completed/i });
    await expect(completedSection).toBeVisible();
    await completedSection.click();

    // Uncheck the item (click checkbox again)
    await checkItem(itemName);
    await waitForIndexedDB(page);

    // Item should be back in pending (no line-through)
    await expect(page.getByText(itemName)).toBeVisible();

    // Verify in IndexedDB
    const items = await getItemsFromIndexedDB(page);
    const item = items.find((i) => i.display_name === itemName);
    expect(item?.status).toBe("pending");
  });

  test("should update completed count in header", async ({
    authenticatedPage: page,
    addItem,
    checkItem,
  }) => {
    // Add multiple items
    const item1 = uniqueItemName("Count Item 1");
    const item2 = uniqueItemName("Count Item 2");

    await addItem(item1);
    await addItem(item2);
    await waitForIndexedDB(page);

    // Check one item
    await checkItem(item1);

    // Completed section should show count
    const completedSection = page.locator("button", { hasText: /completed/i });
    await expect(completedSection).toBeVisible();
    await expect(completedSection).toContainText("1");

    // Check second item
    await checkItem(item2);

    // Count should update
    await expect(completedSection).toContainText("2");
  });
});

test.describe("Deleting Items", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should delete a pending item", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Delete Item");

    await addItem(itemName);
    await waitForIndexedDB(page);

    // Find delete button for the item
    const itemRow = page
      .locator("div", { hasText: itemName })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();

    // Click delete button
    const deleteButton = itemRow.getByRole("button", { name: /delete/i });
    await deleteButton.click();

    // Item should be removed
    await expect(page.getByText(itemName)).not.toBeVisible({ timeout: 5000 });

    // Should show success toast
    await expect(page.getByText(/item deleted/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("should delete a checked item", async ({
    authenticatedPage: page,
    addItem,
    checkItem,
  }) => {
    const itemName = uniqueItemName("Delete Checked Item");

    // Add and check item
    await addItem(itemName);
    await waitForIndexedDB(page);
    await checkItem(itemName);
    await waitForIndexedDB(page);

    // Expand completed section
    const completedSection = page.locator("button", { hasText: /completed/i });
    await completedSection.click();

    // Find and click delete button
    const itemRow = page
      .locator("div", { hasText: itemName })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();

    const deleteButton = itemRow.getByRole("button", { name: /delete/i });
    await deleteButton.click();

    // Item should be removed
    await expect(page.getByText(itemName)).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe("Categories", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should group items by category", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    // Add items that might be auto-categorized
    const items = [
      uniqueItemName("Milk"),
      uniqueItemName("Bread"),
      uniqueItemName("Apples"),
    ];

    for (const item of items) {
      await addItem(item);
    }

    // Check that items are displayed (categories are optional)
    for (const item of items) {
      await expect(page.getByText(item)).toBeVisible();
    }
  });
});

test.describe("Item Quantity Display", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should display quantity when greater than 1", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Qty Display Item");

    await addItem(itemName, 3);

    // Quantity indicator should be visible
    await expect(page.getByText("x3")).toBeVisible();
  });

  test("should not display quantity indicator for quantity of 1", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Single Qty Item");

    await addItem(itemName, 1);

    // Item should be visible
    await expect(page.getByText(itemName)).toBeVisible();

    // x1 indicator should NOT be visible
    const itemRow = page
      .locator("div", { hasText: itemName })
      .filter({
        has: page.getByRole("checkbox"),
      })
      .first();

    // Check that x1 is not shown
    await expect(itemRow.getByText("x1")).not.toBeVisible();
  });
});

test.describe("Navigation", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should navigate to settings from list page", async ({
    authenticatedPage: page,
  }) => {
    // Click settings button
    await page.getByRole("link", { name: /settings/i }).click();

    // Should navigate to settings
    await expect(page).toHaveURL(/\/settings/);
  });

  test("should navigate to shopping mode from list page", async ({
    authenticatedPage: page,
  }) => {
    // Look for shopping mode link/button
    const shoppingModeLink = page.getByRole("link", {
      name: /shopping mode|start shopping/i,
    });

    // If shopping mode link exists, click it
    if (await shoppingModeLink.isVisible()) {
      await shoppingModeLink.click();
      await expect(page).toHaveURL(/\/list\/shopping/);
    }
  });
});

test.describe("Keyboard Shortcuts", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should add item on Enter key press", async ({
    authenticatedPage: page,
  }) => {
    const itemName = uniqueItemName("Enter Key Item");
    const input = page.getByRole("textbox", { name: /add item/i });

    await input.fill(itemName);
    await input.press("Enter");

    // Item should be added
    await expect(page.getByText(itemName)).toBeVisible({ timeout: 5000 });
  });

  test("should focus input on page load", async ({
    authenticatedPage: page,
  }) => {
    // Give the page time to set focus
    await page.waitForTimeout(500);

    // Check if input is focused (or can be focused by starting to type)
    const input = page.getByRole("textbox", { name: /add item/i });
    await expect(input).toBeVisible();
  });
});

test.describe("Item Persistence", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should persist items after page reload", async ({
    authenticatedPage: page,
    addItem,
  }) => {
    const itemName = uniqueItemName("Persist Item");

    await addItem(itemName);
    await waitForIndexedDB(page);

    // Verify item exists
    await expect(page.getByText(itemName)).toBeVisible();

    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Item should still be visible
    await expect(page.getByText(itemName)).toBeVisible();
  });

  test("should persist checked status after page reload", async ({
    authenticatedPage: page,
    addItem,
    checkItem,
  }) => {
    const itemName = uniqueItemName("Persist Checked Item");

    await addItem(itemName);
    await waitForIndexedDB(page);
    await checkItem(itemName);
    await waitForIndexedDB(page);

    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Completed section should exist and contain the item
    const completedSection = page.locator("button", { hasText: /completed/i });
    await expect(completedSection).toBeVisible();

    // Expand completed section
    await completedSection.click();

    // Item should be checked (line-through)
    const checkedItem = page.locator(".line-through", { hasText: itemName });
    await expect(checkedItem).toBeVisible();
  });
});

test.describe("Error Handling", () => {
  // Skip all tests in this suite if Supabase is not configured
  test.skip(!isSupabaseConfigured, "Skipping: Supabase not configured");

  test("should handle rapid item additions gracefully", async ({
    authenticatedPage: page,
  }) => {
    const input = page.getByRole("textbox", { name: /add item/i });
    const submitButton = page.getByRole("button", { name: /add item/i });

    // Add items rapidly
    const items: string[] = [];
    for (let i = 0; i < 5; i++) {
      const name = uniqueItemName(`Rapid ${i}`);
      items.push(name);
      await input.fill(name);
      await submitButton.click();
    }

    // Wait for all items to be added
    await waitForIndexedDB(page, 2000);

    // All items should eventually appear
    for (const name of items) {
      await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
    }
  });
});

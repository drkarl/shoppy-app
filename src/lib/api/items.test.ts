import { describe, expect, it, vi, beforeEach } from "vitest";

import { mergeItems } from "./items";

describe("mergeItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success with merged item when API call succeeds", async () => {
    const mockItem = {
      id: "item-123",
      display_name: "Milk",
      quantity: 3,
      unit: "L",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ item: mockItem }),
    });

    const result = await mergeItems("list-123", "target-item", "source-item");

    expect(result.success).toBe(true);
    expect(result.item).toEqual(mockItem);
    expect(result.error).toBeUndefined();
  });

  it("returns success with warning when units differ", async () => {
    const mockItem = {
      id: "item-123",
      display_name: "Milk",
      quantity: 3,
      unit: "L",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          item: mockItem,
          warning: "Different units detected. Merge quantities manually.",
        }),
    });

    const result = await mergeItems("list-123", "target-item", "source-item");

    expect(result.success).toBe(true);
    expect(result.warning).toBe(
      "Different units detected. Merge quantities manually."
    );
  });

  it("returns error when API call fails with error message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Target item not found" }),
    });

    const result = await mergeItems("list-123", "target-item", "source-item");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Target item not found");
    expect(result.item).toBeUndefined();
  });

  it("returns generic error message when API returns no error details", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    const result = await mergeItems("list-123", "target-item", "source-item");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to merge items");
  });

  it("returns network error when fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await mergeItems("list-123", "target-item", "source-item");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error while merging items");
  });

  it("calls the correct API endpoint with proper method and body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ item: {} }),
    });

    await mergeItems("list-123", "target-item", "source-item");

    expect(fetch).toHaveBeenCalledWith(
      "/api/lists/list-123/items/target-item/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_item_id: "source-item" }),
      }
    );
  });
});

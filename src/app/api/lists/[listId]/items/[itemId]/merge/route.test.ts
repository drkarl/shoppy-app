import { describe, expect, it, vi, beforeEach } from "vitest";

import { POST } from "./route";

const mockUser = {
  id: "user-123",
  email: "test@example.com",
};

const mockTargetItem = {
  id: "target-item",
  list_id: "list-123",
  display_name: "Milk",
  quantity: 1,
  unit: "L",
  note: "organic",
  category_id: "dairy",
  added_by: "user-123",
};

const mockSourceItem = {
  id: "source-item",
  list_id: "list-123",
  display_name: "Leche",
  quantity: 2,
  unit: "L",
};

const mockMergedItem = {
  ...mockTargetItem,
  quantity: 3,
  categories: { id: "dairy", name: "Dairy", icon: "milk" },
};

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockSupabase),
}));

const createRouteParams = (listId: string, itemId: string) => ({
  params: Promise.resolve({ listId, itemId }),
});

describe("POST /api/lists/[listId]/items/[itemId]/merge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/target-item/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_item_id: "source-item" }),
      }
    );

    const response = await POST(
      request,
      createRouteParams("list-123", "target-item")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when request body is invalid JSON", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/target-item/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json",
      }
    );

    const response = await POST(
      request,
      createRouteParams("list-123", "target-item")
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 when source_item_id is missing", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/target-item/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    const response = await POST(
      request,
      createRouteParams("list-123", "target-item")
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("source_item_id is required");
  });

  it("returns 400 when trying to merge an item with itself", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/same-item/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_item_id: "same-item" }),
      }
    );

    const response = await POST(
      request,
      createRouteParams("list-123", "same-item")
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Cannot merge an item with itself");
  });

  it("returns 404 when list does not exist", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116", message: "Not found" },
          }),
        }),
      }),
    });

    const request = new Request(
      "http://localhost/api/lists/nonexistent/items/target-item/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_item_id: "source-item" }),
      }
    );

    const response = await POST(
      request,
      createRouteParams("nonexistent", "target-item")
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("List not found");
  });

  it("returns 404 when target item does not exist", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "lists") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "list-123" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "list_items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "PGRST116", message: "Not found" },
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/nonexistent/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_item_id: "source-item" }),
      }
    );

    const response = await POST(
      request,
      createRouteParams("list-123", "nonexistent")
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Target item not found");
  });

  it("returns 404 when source item does not exist", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    let listItemsCallCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "lists") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "list-123" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "list_items") {
        listItemsCallCount++;
        // First call is for target item (exists), second is for source item (doesn't exist)
        if (listItemsCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockTargetItem,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "PGRST116", message: "Not found" },
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/target-item/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_item_id: "nonexistent" }),
      }
    );

    const response = await POST(
      request,
      createRouteParams("list-123", "target-item")
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Source item not found");
  });

  it("merges items successfully and adds quantities", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockMergedItem,
              error: null,
            }),
          }),
        }),
      }),
    });

    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    let listItemsCallCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "lists") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "list-123" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "list_items") {
        listItemsCallCount++;
        if (listItemsCallCount === 1) {
          // Target item fetch
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockTargetItem,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (listItemsCallCount === 2) {
          // Source item fetch
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockSourceItem,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        // Update and delete operations
        return {
          update: updateMock,
          delete: deleteMock,
        };
      }
      return {};
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/target-item/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_item_id: "source-item" }),
      }
    );

    const response = await POST(
      request,
      createRouteParams("list-123", "target-item")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item.quantity).toBe(3); // 1 + 2
    expect(data.item.note).toBe("organic"); // preserved from target
    expect(data.warning).toBeUndefined(); // same units, no warning
    expect(data.sourceItemDeleted).toBe(true); // source item was deleted
  });

  it("returns warning when items have different units", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const targetWithLiters = { ...mockTargetItem, unit: "L" };
    const sourceWithMl = { ...mockSourceItem, unit: "ml" };
    const mergedWithWarning = { ...mockMergedItem, unit: "L" };

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mergedWithWarning,
              error: null,
            }),
          }),
        }),
      }),
    });

    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    let listItemsCallCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "lists") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "list-123" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "list_items") {
        listItemsCallCount++;
        if (listItemsCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: targetWithLiters,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (listItemsCallCount === 2) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: sourceWithMl,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {
          update: updateMock,
          delete: deleteMock,
        };
      }
      return {};
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/target-item/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_item_id: "source-item" }),
      }
    );

    const response = await POST(
      request,
      createRouteParams("list-123", "target-item")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.warning).toBe(
      "Different units detected. Merge quantities manually."
    );
    expect(data.sourceItemDeleted).toBe(true); // source item was deleted
  });

  it("preserves metadata from target item (note, category, added_by)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const targetWithMetadata = {
      ...mockTargetItem,
      note: "organic only",
      category_id: "dairy-cat",
      added_by: "user-original",
    };

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...targetWithMetadata, quantity: 3 },
              error: null,
            }),
          }),
        }),
      }),
    });

    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    let listItemsCallCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "lists") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "list-123" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "list_items") {
        listItemsCallCount++;
        if (listItemsCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: targetWithMetadata,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (listItemsCallCount === 2) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockSourceItem,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {
          update: updateMock,
          delete: deleteMock,
        };
      }
      return {};
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/target-item/merge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_item_id: "source-item" }),
      }
    );

    const response = await POST(
      request,
      createRouteParams("list-123", "target-item")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item.note).toBe("organic only");
    expect(data.item.category_id).toBe("dairy-cat");
    expect(data.item.added_by).toBe("user-original");
    expect(data.sourceItemDeleted).toBe(true); // source item was deleted
  });
});

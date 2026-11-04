import { describe, expect, it, vi, beforeEach } from "vitest";

import { GET, PUT, DELETE } from "./route";

const mockUser = {
  id: "user-123",
  email: "test@example.com",
};

const mockItem = {
  id: "item-123",
  list_id: "list-123",
  raw_text: "Milk",
  display_name: "Milk",
  quantity: 2,
  unit: "L",
  note: null,
  category_id: null,
  status: "pending",
  added_by: "user-123",
  checked_by: null,
  checked_at: null,
  version: 1,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
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

describe("GET /api/lists/[listId]/items/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(
      new Request("http://localhost/api/lists/list-123/items/item-123"),
      createRouteParams("list-123", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
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

    const response = await GET(
      new Request("http://localhost/api/lists/nonexistent/items/item-123"),
      createRouteParams("nonexistent", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("List not found");
  });

  it("returns 404 when item does not exist", async () => {
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

    const response = await GET(
      new Request("http://localhost/api/lists/list-123/items/nonexistent"),
      createRouteParams("list-123", "nonexistent")
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Item not found");
  });

  it("returns item successfully", async () => {
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
                  data: mockItem,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const response = await GET(
      new Request("http://localhost/api/lists/list-123/items/item-123"),
      createRouteParams("list-123", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item.display_name).toBe("Milk");
  });
});

describe("PUT /api/lists/[listId]/items/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/item-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: "Updated Item" }),
      }
    );

    const response = await PUT(
      request,
      createRouteParams("list-123", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when request body is malformed JSON", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/item-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json",
      }
    );

    const response = await PUT(
      request,
      createRouteParams("list-123", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 when display_name is empty", async () => {
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
                  data: mockItem,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/item-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: "   " }),
      }
    );

    const response = await PUT(
      request,
      createRouteParams("list-123", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("display_name cannot be empty");
  });

  it("returns 400 when quantity is negative", async () => {
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
                  data: mockItem,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/item-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: -5 }),
      }
    );

    const response = await PUT(
      request,
      createRouteParams("list-123", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("quantity must be a non-negative number");
  });

  it("returns 400 when status is invalid", async () => {
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
                  data: mockItem,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/item-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid" }),
      }
    );

    const response = await PUT(
      request,
      createRouteParams("list-123", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("status must be 'pending' or 'checked'");
  });

  it("returns 400 when no valid fields to update", async () => {
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
                  data: mockItem,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/item-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    const response = await PUT(
      request,
      createRouteParams("list-123", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No valid fields to update");
  });

  it("updates item and marks it as checked", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const checkedItem = {
      ...mockItem,
      status: "checked",
      checked_by: "user-123",
      checked_at: "2025-01-02T00:00:00Z",
    };

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: checkedItem,
              error: null,
            }),
          }),
        }),
      }),
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
                  data: mockItem,
                  error: null,
                }),
              }),
            }),
          }),
          update: updateMock,
        };
      }
      return {};
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/item-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "checked" }),
      }
    );

    const response = await PUT(
      request,
      createRouteParams("list-123", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item.status).toBe("checked");
    expect(data.item.checked_by).toBe("user-123");
    expect(updateMock).toHaveBeenCalled();
  });

  it("updates item name successfully", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const updatedItem = { ...mockItem, display_name: "Updated Milk" };

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: updatedItem,
              error: null,
            }),
          }),
        }),
      }),
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
                  data: mockItem,
                  error: null,
                }),
              }),
            }),
          }),
          update: updateMock,
        };
      }
      return {};
    });

    const request = new Request(
      "http://localhost/api/lists/list-123/items/item-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: "Updated Milk" }),
      }
    );

    const response = await PUT(
      request,
      createRouteParams("list-123", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item.display_name).toBe("Updated Milk");
  });
});

describe("DELETE /api/lists/[listId]/items/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await DELETE(
      new Request("http://localhost/api/lists/list-123/items/item-123", {
        method: "DELETE",
      }),
      createRouteParams("list-123", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
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

    const response = await DELETE(
      new Request("http://localhost/api/lists/nonexistent/items/item-123", {
        method: "DELETE",
      }),
      createRouteParams("nonexistent", "item-123")
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("List not found");
  });

  it("returns 404 when item does not exist", async () => {
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

    const response = await DELETE(
      new Request("http://localhost/api/lists/list-123/items/nonexistent", {
        method: "DELETE",
      }),
      createRouteParams("list-123", "nonexistent")
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Item not found");
  });

  it("deletes item successfully and returns 204", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
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
                  data: { id: "item-123" },
                  error: null,
                }),
              }),
            }),
          }),
          delete: deleteMock,
        };
      }
      return {};
    });

    const response = await DELETE(
      new Request("http://localhost/api/lists/list-123/items/item-123", {
        method: "DELETE",
      }),
      createRouteParams("list-123", "item-123")
    );

    expect(response.status).toBe(204);
  });
});

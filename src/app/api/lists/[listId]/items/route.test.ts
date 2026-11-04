import { describe, expect, it, vi, beforeEach } from "vitest";

import { GET, POST } from "./route";

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

const createRouteParams = (listId: string) => ({
  params: Promise.resolve({ listId }),
});

describe("GET /api/lists/[listId]/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(
      new Request("http://localhost/api/lists/list-123/items"),
      createRouteParams("list-123")
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

    const selectListMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "Not found" },
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      select: selectListMock,
    });

    const response = await GET(
      new Request("http://localhost/api/lists/nonexistent/items"),
      createRouteParams("nonexistent")
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("List not found");
  });

  it("returns items successfully", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockItems = [mockItem];

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
              order: vi.fn().mockResolvedValue({
                data: mockItems,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const response = await GET(
      new Request("http://localhost/api/lists/list-123/items"),
      createRouteParams("list-123")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].display_name).toBe("Milk");
  });
});

describe("POST /api/lists/[listId]/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new Request("http://localhost/api/lists/list-123/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "Milk", quantity: 2 }),
    });

    const response = await POST(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when request body is malformed JSON", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/lists/list-123/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json",
    });

    const response = await POST(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 when display_name is missing", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/lists/list-123/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: 2 }),
    });

    const response = await POST(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("display_name is required");
  });

  it("returns 400 when display_name is empty", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/lists/list-123/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "   " }),
    });

    const response = await POST(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("display_name cannot be empty");
  });

  it("returns 400 when quantity is negative", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/lists/list-123/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "Milk", quantity: -1 }),
    });

    const response = await POST(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Quantity must be positive");
  });

  it("returns 400 when quantity is zero", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/lists/list-123/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "Milk", quantity: 0 }),
    });

    const response = await POST(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Quantity must be positive");
  });

  it("returns 404 when list does not exist", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "Not found" },
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    const request = new Request(
      "http://localhost/api/lists/nonexistent/items",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: "Milk", quantity: 2 }),
      }
    );

    const response = await POST(request, createRouteParams("nonexistent"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("List not found");
  });

  it("returns 403 when RLS policy denies access", async () => {
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
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: "42501", message: "RLS policy violation" },
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new Request("http://localhost/api/lists/list-123/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "Milk", quantity: 2 }),
    });

    const response = await POST(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Access denied to this list");
  });

  it("creates item successfully", async () => {
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
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockItem,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new Request("http://localhost/api/lists/list-123/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "Milk", quantity: 2, unit: "L" }),
    });

    const response = await POST(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.item).toEqual(mockItem);
  });

  it("creates item with category_id when provided", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const itemWithCategory = {
      ...mockItem,
      category_id: "category-123",
    };

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: itemWithCategory,
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
          insert: insertMock,
        };
      }
      return {};
    });

    const request = new Request("http://localhost/api/lists/list-123/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: "Milk",
        quantity: 2,
        category_id: "category-123",
      }),
    });

    const response = await POST(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.item.category_id).toBe("category-123");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: "category-123",
      })
    );
  });

  it("creates item with default quantity when not provided", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { ...mockItem, quantity: 1 },
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
          insert: insertMock,
        };
      }
      return {};
    });

    const request = new Request("http://localhost/api/lists/list-123/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "Eggs" }),
    });

    const response = await POST(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.item.quantity).toBe(1);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

import { GET, PUT, DELETE } from "./route";

const mockUser = {
  id: "user-123",
  email: "test@example.com",
};

const mockList = {
  id: "list-123",
  household_id: "household-123",
  name: "Shopping List",
  status: "active",
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

describe("GET /api/lists/[listId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(
      new Request("http://localhost/api/lists/list-123"),
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

    const response = await GET(
      new Request("http://localhost/api/lists/nonexistent"),
      createRouteParams("nonexistent")
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("List not found");
  });

  it("returns list successfully", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            ...mockList,
            households: { id: "household-123", name: "My Household" },
          },
          error: null,
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    const response = await GET(
      new Request("http://localhost/api/lists/list-123"),
      createRouteParams("list-123")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.list.name).toBe("Shopping List");
  });
});

describe("PUT /api/lists/[listId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new Request("http://localhost/api/lists/list-123", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated List" }),
    });

    const response = await PUT(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when request body is malformed JSON", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/lists/list-123", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json",
    });

    const response = await PUT(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 when name is empty", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/lists/list-123", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });

    const response = await PUT(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("List name cannot be empty");
  });

  it("returns 400 when status is invalid", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/lists/list-123", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "invalid" }),
    });

    const response = await PUT(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Status must be 'active' or 'archived'");
  });

  it("returns 400 when no valid fields to update", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/lists/list-123", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await PUT(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No valid fields to update");
  });

  it("returns 404 when list does not exist", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116", message: "Not found" },
          }),
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
    });

    const request = new Request("http://localhost/api/lists/nonexistent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated List" }),
    });

    const response = await PUT(request, createRouteParams("nonexistent"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("List not found");
  });

  it("updates list successfully with household relationship", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const updatedList = {
      ...mockList,
      name: "Updated List",
      households: { id: "household-123", name: "My Household" },
    };
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: updatedList,
            error: null,
          }),
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
    });

    const request = new Request("http://localhost/api/lists/list-123", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated List" }),
    });

    const response = await PUT(request, createRouteParams("list-123"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.list.name).toBe("Updated List");
    expect(data.list.households).toEqual({
      id: "household-123",
      name: "My Household",
    });
    expect(updateMock).toHaveBeenCalledWith({ name: "Updated List" });
  });
});

describe("DELETE /api/lists/[listId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await DELETE(
      new Request("http://localhost/api/lists/list-123", { method: "DELETE" }),
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

    const response = await DELETE(
      new Request("http://localhost/api/lists/nonexistent", {
        method: "DELETE",
      }),
      createRouteParams("nonexistent")
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("List not found");
  });

  it("deletes list successfully and returns 204", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "list-123" },
          error: null,
        }),
      }),
    });

    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        error: null,
      }),
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "lists") {
        return {
          select: selectMock,
          delete: deleteMock,
        };
      }
      return {};
    });

    const response = await DELETE(
      new Request("http://localhost/api/lists/list-123", { method: "DELETE" }),
      createRouteParams("list-123")
    );

    expect(response.status).toBe(204);
  });
});

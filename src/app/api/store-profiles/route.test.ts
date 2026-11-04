import { describe, expect, it, vi, beforeEach } from "vitest";

import { GET, POST } from "./route";

const mockUser = {
  id: "user-123",
  email: "test@example.com",
};

const mockCategoryIds = [
  "c1000000-0000-0000-0000-000000000001", // Produce
  "c1000000-0000-0000-0000-000000000002", // Meat & Fish
  "c1000000-0000-0000-0000-000000000003", // Dairy
];

const mockStoreProfile = {
  id: "sp-123",
  household_id: "household-123",
  store_name: "Tesco",
  category_order: mockCategoryIds,
  is_default: true,
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

describe("GET /api/store-profiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns all store profiles for authenticated user (RLS filters by household membership)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockStoreProfiles = [
      mockStoreProfile,
      { ...mockStoreProfile, id: "sp-456", store_name: "Sainsbury" },
    ];

    const orderMock = vi.fn().mockResolvedValue({
      data: mockStoreProfiles,
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      order: orderMock,
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    const request = new Request("http://localhost/api/store-profiles");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.store_profiles).toHaveLength(2);
    expect(data.store_profiles[0].store_name).toBe("Tesco");
    expect(data.store_profiles[0].category_order).toEqual(mockCategoryIds);
  });

  it("filters store profiles by household_id when provided", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const orderMock = vi.fn().mockResolvedValue({
      data: [mockStoreProfile],
      error: null,
    });

    const eqMock = vi.fn().mockReturnValue({
      order: orderMock,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock,
      order: orderMock,
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    const request = new Request(
      "http://localhost/api/store-profiles?household_id=household-123"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.store_profiles).toHaveLength(1);
  });

  it("returns empty array when RLS filters out all results (user has no household access)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const orderMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      order: orderMock,
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    const request = new Request("http://localhost/api/store-profiles");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.store_profiles).toHaveLength(0);
  });

  it("returns 500 when database query fails", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const orderMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });

    const selectMock = vi.fn().mockReturnValue({
      order: orderMock,
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new Request("http://localhost/api/store-profiles");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch store profiles");

    consoleSpy.mockRestore();
  });
});

describe("POST /api/store-profiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "Tesco",
        category_order: mockCategoryIds,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when request body is malformed JSON", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 when household_id is missing", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store_name: "Tesco",
        category_order: mockCategoryIds,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("household_id is required");
  });

  it("returns 400 when store_name is missing", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        category_order: mockCategoryIds,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("store_name is required");
  });

  it("returns 400 when store_name is empty", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "   ",
        category_order: mockCategoryIds,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("store_name is required");
  });

  it("returns 400 when store_name exceeds 100 characters", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "a".repeat(101),
        category_order: mockCategoryIds,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("store_name must be 100 characters or less");
  });

  it("returns 400 when category_order is missing", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "Tesco",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("category_order must be an array");
  });

  it("returns 400 when category_order is not an array", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "Tesco",
        category_order: "not-an-array",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("category_order must be an array");
  });

  it("returns 400 when category_order contains invalid UUIDs", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "Tesco",
        category_order: ["not-a-uuid", "also-invalid"],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("category_order must contain valid UUIDs");
  });

  it("returns 400 when category_order exceeds 100 items", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Generate 101 valid UUIDs
    const tooManyCategories = Array.from(
      { length: 101 },
      (_, i) => `c1000000-0000-0000-0000-${String(i).padStart(12, "0")}`
    );

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "Tesco",
        category_order: tooManyCategories,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("category_order cannot exceed 100 items");
  });

  it("creates store profile with category_order array successfully", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockStoreProfile,
          error: null,
        }),
      }),
    });

    // Mock for clearing is_default on other stores when is_default=true
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        error: null,
      }),
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
      insert: insertMock,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "Tesco",
        category_order: mockCategoryIds,
        is_default: true,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.store_profile).toEqual(mockStoreProfile);
    expect(data.store_profile.category_order).toEqual(mockCategoryIds);
    expect(updateMock).toHaveBeenCalledWith({ is_default: false });
    expect(insertMock).toHaveBeenCalledWith({
      household_id: "household-123",
      store_name: "Tesco",
      category_order: mockCategoryIds,
      is_default: true,
    });
  });

  it("creates store profile with empty category_order array", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const emptyOrderProfile = {
      ...mockStoreProfile,
      category_order: [],
    };

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: emptyOrderProfile,
          error: null,
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      insert: insertMock,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "Tesco",
        category_order: [],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.store_profile.category_order).toEqual([]);
  });

  it("returns 409 when store profile name already exists for household", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "23505", message: "Unique constraint violation" },
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      insert: insertMock,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "Tesco",
        category_order: mockCategoryIds,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("A store profile with this name already exists");
  });

  it("returns 403 when RLS denies access to household (user not a member)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "42501", message: "RLS policy violation" },
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      insert: insertMock,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "other-household-456",
        store_name: "Tesco",
        category_order: mockCategoryIds,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe(
      "You do not have permission to create store profiles for this household"
    );
  });

  it("returns 500 when database insertion fails", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "XXXXX", message: "Database error" },
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      insert: insertMock,
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "Tesco",
        category_order: mockCategoryIds,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create store profile");

    consoleSpy.mockRestore();
  });

  it("clears is_default on other store profiles when creating with is_default=true", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const eqMock = vi.fn().mockResolvedValue({
      error: null,
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { ...mockStoreProfile, is_default: true },
          error: null,
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
      insert: insertMock,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "New Default Store",
        category_order: mockCategoryIds,
        is_default: true,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    // Verify that update was called to clear is_default on other stores
    expect(updateMock).toHaveBeenCalledWith({ is_default: false });
    expect(eqMock).toHaveBeenCalledWith("household_id", "household-123");
  });

  it("does not clear is_default when creating with is_default=false", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const updateMock = vi.fn();
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { ...mockStoreProfile, is_default: false },
          error: null,
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
      insert: insertMock,
    });

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "Non-default Store",
        category_order: mockCategoryIds,
        is_default: false,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    // Update should not be called when is_default is false
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns 500 when clearing default flag fails during create", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        error: { message: "Database error" },
      }),
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new Request("http://localhost/api/store-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        household_id: "household-123",
        store_name: "New Store",
        category_order: mockCategoryIds,
        is_default: true,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create store profile");

    consoleSpy.mockRestore();
  });
});

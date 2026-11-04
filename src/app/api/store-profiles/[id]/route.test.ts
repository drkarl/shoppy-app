import { describe, expect, it, vi, beforeEach } from "vitest";

import { GET, PATCH, DELETE } from "./route";

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

const createParams = (id: string) => ({
  params: Promise.resolve({ id }),
});

describe("GET /api/store-profiles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123");
    const response = await GET(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns store profile for authenticated user with household access", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: mockStoreProfile,
      error: null,
    });

    const eqMock = vi.fn().mockReturnValue({
      single: singleMock,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123");
    const response = await GET(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.store_profile).toEqual(mockStoreProfile);
    expect(data.store_profile.category_order).toEqual(mockCategoryIds);
  });

  it("returns 404 when store profile does not exist (or RLS denies access)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    });

    const eqMock = vi.fn().mockReturnValue({
      single: singleMock,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    const request = new Request(
      "http://localhost/api/store-profiles/non-existent"
    );
    const response = await GET(request, createParams("non-existent"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Store profile not found");
  });

  it("returns 500 when database query fails", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "XXXXX", message: "Database error" },
    });

    const eqMock = vi.fn().mockReturnValue({
      single: singleMock,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new Request("http://localhost/api/store-profiles/sp-123");
    const response = await GET(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch store profile");

    consoleSpy.mockRestore();
  });
});

describe("PATCH /api/store-profiles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_name: "Updated Store" }),
    });

    const response = await PATCH(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when request body is malformed JSON", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json",
    });

    const response = await PATCH(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 when no valid fields are provided", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await PATCH(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No valid fields to update");
  });

  it("returns 400 when store_name is empty", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_name: "   " }),
    });

    const response = await PATCH(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("store_name cannot be empty");
  });

  it("returns 400 when store_name exceeds 100 characters", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_name: "a".repeat(101) }),
    });

    const response = await PATCH(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("store_name must be 100 characters or less");
  });

  it("returns 400 when category_order is not an array", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_order: "not-an-array" }),
    });

    const response = await PATCH(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("category_order must be an array");
  });

  it("returns 400 when category_order contains invalid UUIDs", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_order: ["invalid-uuid"] }),
    });

    const response = await PATCH(request, createParams("sp-123"));
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

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_order: tooManyCategories }),
    });

    const response = await PATCH(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("category_order cannot exceed 100 items");
  });

  it("updates store profile successfully", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const updatedProfile = {
      ...mockStoreProfile,
      store_name: "Updated Store",
    };

    const singleMock = vi.fn().mockResolvedValue({
      data: updatedProfile,
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      single: singleMock,
    });

    const eqMock = vi.fn().mockReturnValue({
      select: selectMock,
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_name: "Updated Store" }),
    });

    const response = await PATCH(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.store_profile.store_name).toBe("Updated Store");
    expect(updateMock).toHaveBeenCalledWith({ store_name: "Updated Store" });
  });

  it("updates category_order array successfully", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const newCategoryOrder = [
      "c1000000-0000-0000-0000-000000000003", // Dairy first
      "c1000000-0000-0000-0000-000000000001", // Then Produce
      "c1000000-0000-0000-0000-000000000002", // Then Meat & Fish
    ];

    const updatedProfile = {
      ...mockStoreProfile,
      category_order: newCategoryOrder,
    };

    const singleMock = vi.fn().mockResolvedValue({
      data: updatedProfile,
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      single: singleMock,
    });

    const eqMock = vi.fn().mockReturnValue({
      select: selectMock,
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_order: newCategoryOrder }),
    });

    const response = await PATCH(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.store_profile.category_order).toEqual(newCategoryOrder);
    expect(updateMock).toHaveBeenCalledWith({
      category_order: newCategoryOrder,
    });
  });

  it("returns 404 when store profile does not exist (or RLS denies access)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    });

    const selectMock = vi.fn().mockReturnValue({
      single: singleMock,
    });

    const eqMock = vi.fn().mockReturnValue({
      select: selectMock,
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
    });

    const request = new Request(
      "http://localhost/api/store-profiles/non-existent",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_name: "Updated" }),
      }
    );

    const response = await PATCH(request, createParams("non-existent"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Store profile not found");
  });

  it("returns 409 when updated name conflicts with existing profile", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "Unique constraint violation" },
    });

    const selectMock = vi.fn().mockReturnValue({
      single: singleMock,
    });

    const eqMock = vi.fn().mockReturnValue({
      select: selectMock,
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_name: "Existing Store" }),
    });

    const response = await PATCH(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("A store profile with this name already exists");
  });
});

describe("DELETE /api/store-profiles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "DELETE",
    });

    const response = await DELETE(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("deletes store profile successfully", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const eqMock = vi.fn().mockResolvedValue({
      error: null,
    });

    const deleteMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    mockSupabase.from.mockReturnValue({
      delete: deleteMock,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "DELETE",
    });

    const response = await DELETE(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns success even when profile does not exist (idempotent delete)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Supabase delete returns no error even when row doesn't exist
    const eqMock = vi.fn().mockResolvedValue({
      error: null,
    });

    const deleteMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    mockSupabase.from.mockReturnValue({
      delete: deleteMock,
    });

    const request = new Request(
      "http://localhost/api/store-profiles/non-existent",
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request, createParams("non-existent"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 500 when database deletion fails", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const eqMock = vi.fn().mockResolvedValue({
      error: { message: "Database error" },
    });

    const deleteMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    mockSupabase.from.mockReturnValue({
      delete: deleteMock,
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "DELETE",
    });

    const response = await DELETE(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to delete store profile");

    consoleSpy.mockRestore();
  });
});

describe("RLS Policy Behavior Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns empty result when user from Household A queries Household B's store profile", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // RLS policy would filter out store profiles from other households
    // This is simulated by returning PGRST116 (not found) error
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    });

    const eqMock = vi.fn().mockReturnValue({
      single: singleMock,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    const request = new Request(
      "http://localhost/api/store-profiles/other-household-profile"
    );
    const response = await GET(
      request,
      createParams("other-household-profile")
    );
    const data = await response.json();

    // RLS denies access by returning "not found" - user cannot see the store profile
    expect(response.status).toBe(404);
    expect(data.error).toBe("Store profile not found");
  });

  it("PATCH returns 404 when user from Household A tries to update Household B's store profile", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // RLS policy would filter out the store profile, making it "not found"
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    });

    const selectMock = vi.fn().mockReturnValue({
      single: singleMock,
    });

    const eqMock = vi.fn().mockReturnValue({
      select: selectMock,
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
    });

    const request = new Request(
      "http://localhost/api/store-profiles/other-household-profile",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_name: "Hacked Store" }),
      }
    );

    const response = await PATCH(
      request,
      createParams("other-household-profile")
    );
    const data = await response.json();

    // RLS denies access by returning "not found" - user cannot update the store profile
    expect(response.status).toBe(404);
    expect(data.error).toBe("Store profile not found");
  });
});

describe("PATCH /api/store-profiles/[id] - Default Store Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears is_default on other store profiles when setting is_default=true", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // First call: fetch current store profile to get household_id
    const fetchSingleMock = vi.fn().mockResolvedValue({
      data: { household_id: "household-123" },
      error: null,
    });

    const fetchEqMock = vi.fn().mockReturnValue({
      single: fetchSingleMock,
    });

    const fetchSelectMock = vi.fn().mockReturnValue({
      eq: fetchEqMock,
    });

    // Second call: clear is_default on other stores
    const clearNeqMock = vi.fn().mockResolvedValue({
      error: null,
    });

    const clearEqMock = vi.fn().mockReturnValue({
      neq: clearNeqMock,
    });

    const clearUpdateMock = vi.fn().mockReturnValue({
      eq: clearEqMock,
    });

    // Third call: update the target store
    const updateSingleMock = vi.fn().mockResolvedValue({
      data: { ...mockStoreProfile, is_default: true },
      error: null,
    });

    const updateSelectMock = vi.fn().mockReturnValue({
      single: updateSingleMock,
    });

    const updateEqMock = vi.fn().mockReturnValue({
      select: updateSelectMock,
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: updateEqMock,
    });

    // Chain mocks based on call order
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: fetchSelectMock };
      } else if (callCount === 2) {
        return { update: clearUpdateMock };
      } else {
        return { update: updateMock };
      }
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });

    const response = await PATCH(request, createParams("sp-123"));

    expect(response.status).toBe(200);
    // Verify that update was called to clear is_default on other stores
    expect(clearUpdateMock).toHaveBeenCalledWith({ is_default: false });
    expect(clearEqMock).toHaveBeenCalledWith("household_id", "household-123");
    expect(clearNeqMock).toHaveBeenCalledWith("id", "sp-123");
  });

  it("does not clear is_default when updating without is_default=true", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const updateSingleMock = vi.fn().mockResolvedValue({
      data: { ...mockStoreProfile, store_name: "Updated Name" },
      error: null,
    });

    const updateSelectMock = vi.fn().mockReturnValue({
      single: updateSingleMock,
    });

    const updateEqMock = vi.fn().mockReturnValue({
      select: updateSelectMock,
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: updateEqMock,
    });

    const selectMock = vi.fn();

    mockSupabase.from.mockReturnValue({
      update: updateMock,
      select: selectMock,
    });

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_name: "Updated Name" }),
    });

    const response = await PATCH(request, createParams("sp-123"));

    expect(response.status).toBe(200);
    // Select should not be called to fetch household_id when is_default is not true
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("returns 404 when store profile not found during is_default update", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const fetchSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    });

    const fetchEqMock = vi.fn().mockReturnValue({
      single: fetchSingleMock,
    });

    const fetchSelectMock = vi.fn().mockReturnValue({
      eq: fetchEqMock,
    });

    mockSupabase.from.mockReturnValue({
      select: fetchSelectMock,
    });

    const request = new Request(
      "http://localhost/api/store-profiles/non-existent",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      }
    );

    const response = await PATCH(request, createParams("non-existent"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Store profile not found");
  });

  it("returns 500 when clearing default flag fails", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // First call: fetch current store profile to get household_id
    const fetchSingleMock = vi.fn().mockResolvedValue({
      data: { household_id: "household-123" },
      error: null,
    });

    const fetchEqMock = vi.fn().mockReturnValue({
      single: fetchSingleMock,
    });

    const fetchSelectMock = vi.fn().mockReturnValue({
      eq: fetchEqMock,
    });

    // Second call: clear is_default fails
    const clearNeqMock = vi.fn().mockResolvedValue({
      error: { message: "Database error" },
    });

    const clearEqMock = vi.fn().mockReturnValue({
      neq: clearNeqMock,
    });

    const clearUpdateMock = vi.fn().mockReturnValue({
      eq: clearEqMock,
    });

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: fetchSelectMock };
      } else {
        return { update: clearUpdateMock };
      }
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new Request("http://localhost/api/store-profiles/sp-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });

    const response = await PATCH(request, createParams("sp-123"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to update store profile");

    consoleSpy.mockRestore();
  });
});

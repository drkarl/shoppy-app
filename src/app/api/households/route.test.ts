import { describe, expect, it, vi, beforeEach } from "vitest";

import { POST, GET } from "./route";

const mockUser = {
  id: "user-123",
  email: "test@example.com",
};

const mockHousehold = {
  id: "household-123",
  name: "Test Household",
  invite_code: "abc123",
  invite_expires_at: "2025-12-31T00:00:00Z",
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

describe("POST /api/households", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new Request("http://localhost/api/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Household" }),
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

    const request = new Request("http://localhost/api/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 when name is missing", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Household name is required");
  });

  it("returns 400 when name is empty", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const request = new Request("http://localhost/api/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Household name cannot be empty");
  });

  it("returns 400 when name exceeds 50 characters", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const longName = "a".repeat(51);
    const request = new Request("http://localhost/api/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: longName }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Household name must be 50 characters or less");
  });

  it("creates household and default list successfully", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const insertHouseholdMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockHousehold,
          error: null,
        }),
      }),
    });

    const insertListMock = vi.fn().mockResolvedValue({
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "households") {
        return { insert: insertHouseholdMock };
      }
      if (table === "lists") {
        return { insert: insertListMock };
      }
      return {};
    });

    const request = new Request("http://localhost/api/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Household" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.household).toEqual(mockHousehold);
    expect(insertHouseholdMock).toHaveBeenCalledWith({
      name: "Test Household",
    });
    expect(insertListMock).toHaveBeenCalledWith({
      household_id: mockHousehold.id,
      name: "Shopping List",
      status: "active",
    });
  });

  it("returns 500 when household creation fails", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const insertHouseholdMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      insert: insertHouseholdMock,
    });

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new Request("http://localhost/api/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Household" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create household");

    consoleSpy.mockRestore();
  });

  it("returns 201 with warning when list creation fails", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const insertHouseholdMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockHousehold,
          error: null,
        }),
      }),
    });

    const insertListMock = vi.fn().mockResolvedValue({
      error: { message: "List creation failed" },
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "households") {
        return { insert: insertHouseholdMock };
      }
      if (table === "lists") {
        return { insert: insertListMock };
      }
      return {};
    });

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new Request("http://localhost/api/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Household" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.household).toEqual(mockHousehold);
    expect(data.warning).toBe(
      "Household created but default list creation failed"
    );

    consoleSpy.mockRestore();
  });
});

describe("GET /api/households", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns list of households for authenticated user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockMemberships = [
      {
        role: "owner",
        households: mockHousehold,
      },
    ];

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: mockMemberships,
        error: null,
      }),
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.households).toHaveLength(1);
    expect(data.households[0].name).toBe("Test Household");
    expect(data.households[0].role).toBe("owner");
  });

  it("returns 500 when fetching households fails", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      }),
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch households");

    consoleSpy.mockRestore();
  });
});

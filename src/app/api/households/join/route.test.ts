import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mockUser = { id: "user-123", email: "test@example.com" };

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  rpc: vi.fn(),
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockSupabase),
}));

describe("POST /api/households/join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const request = new Request("http://localhost/api/households/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: "abc123" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when invite code is missing", async () => {
    const request = new Request("http://localhost/api/households/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("Invite code is required");
  });

  it("returns 400 when invite code is empty", async () => {
    const request = new Request("http://localhost/api/households/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: "   " }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("Invite code cannot be empty");
  });

  it("returns 400 for invalid or expired invite code", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "Invalid or expired invite code" },
    });

    const request = new Request("http://localhost/api/households/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: "invalid" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("This invite link has expired or is invalid");
  });

  it("returns 409 when user is already a member", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "You are already a member of this household" },
    });

    const request = new Request("http://localhost/api/households/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: "abc123" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);

    const data = await response.json();
    expect(data.error).toBe("You are already a member of this household");
  });

  it("successfully joins household", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: "household-123",
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "household-123", name: "Test Household" },
            error: null,
          }),
        }),
      }),
    });

    const request = new Request("http://localhost/api/households/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: "abc123" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.household).toEqual({
      id: "household-123",
      name: "Test Household",
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("join_household_with_code", {
      p_invite_code: "abc123",
    });
  });

  it("returns household_id when fetch fails but join succeeds", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: "household-123",
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Fetch failed" },
          }),
        }),
      }),
    });

    const request = new Request("http://localhost/api/households/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: "abc123" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.household_id).toBe("household-123");
  });
});

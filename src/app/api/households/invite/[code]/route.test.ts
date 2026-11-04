import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mockUser = { id: "user-123", email: "test@example.com" };

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockSupabase),
}));

function createContext(code: string) {
  return {
    params: Promise.resolve({ code }),
  };
}

describe("GET /api/households/invite/[code]", () => {
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

    const request = new Request(
      "http://localhost/api/households/invite/abc123"
    );
    const response = await GET(request, createContext("abc123"));

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 for invalid invite code", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Not found" },
          }),
        }),
      }),
    });

    const request = new Request(
      "http://localhost/api/households/invite/invalid"
    );
    const response = await GET(request, createContext("invalid"));

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe("INVALID_CODE");
  });

  it("returns 410 for expired invite code", async () => {
    const expiredDate = new Date(Date.now() - 86400000).toISOString();

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "household-123",
              name: "Test Household",
              invite_expires_at: expiredDate,
            },
            error: null,
          }),
        }),
      }),
    });

    const request = new Request(
      "http://localhost/api/households/invite/expired"
    );
    const response = await GET(request, createContext("expired"));

    expect(response.status).toBe(410);
    const data = await response.json();
    expect(data.code).toBe("EXPIRED");
    expect(data.error).toContain("expired");
  });

  it("returns 409 when user is already a member", async () => {
    const futureDate = new Date(Date.now() + 86400000 * 7).toISOString();

    const mockSingle = vi.fn();
    mockSingle
      .mockResolvedValueOnce({
        data: {
          id: "household-123",
          name: "Test Household",
          invite_expires_at: futureDate,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: "membership-123" },
        error: null,
      });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
          eq: vi.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
      }),
    });

    const request = new Request(
      "http://localhost/api/households/invite/abc123"
    );
    const response = await GET(request, createContext("abc123"));

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.code).toBe("ALREADY_MEMBER");
    expect(data.household_id).toBe("household-123");
  });

  it("returns household info for valid invite", async () => {
    const futureDate = new Date(Date.now() + 86400000 * 7).toISOString();

    const mockSingle = vi.fn();
    mockSingle
      .mockResolvedValueOnce({
        data: {
          id: "household-123",
          name: "Test Household",
          invite_expires_at: futureDate,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
          eq: vi.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
      }),
    });

    const request = new Request(
      "http://localhost/api/households/invite/abc123"
    );
    const response = await GET(request, createContext("abc123"));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.household_id).toBe("household-123");
    expect(data.household_name).toBe("Test Household");
    expect(data.expires_at).toBe(futureDate);
  });
});

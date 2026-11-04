import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mockUser = { id: "user-123", email: "test@example.com" };

const mockSupabase = {
  auth: {
    exchangeCodeForSession: vi.fn(),
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockSupabase),
}));

function createMockRequest(
  url: string,
  headers: Record<string, string> = {}
): Request {
  return new Request(url, {
    headers: new Headers(headers),
  });
}

describe("callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
  });

  describe("error handling", () => {
    it("redirects to /login with error when no code is provided", async () => {
      const request = createMockRequest("http://localhost:3000/callback");
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:3000/login?error=auth_callback_error"
      );
    });

    it("redirects to /login with error when code exchange fails", async () => {
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: { message: "Invalid code" },
      });

      const request = createMockRequest(
        "http://localhost:3000/callback?code=invalid"
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:3000/login?error=auth_callback_error"
      );
    });

    it("redirects to /login with error when no user after session exchange", async () => {
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = createMockRequest(
        "http://localhost:3000/callback?code=valid"
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:3000/login?error=auth_callback_error"
      );
    });
  });

  describe("successful authentication with household", () => {
    beforeEach(() => {
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
      });
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "membership-123" },
                error: null,
              }),
            }),
          }),
        }),
      });
    });

    it("redirects to /list when user has household membership", async () => {
      const request = createMockRequest(
        "http://localhost:3000/callback?code=valid"
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:3000/list"
      );
    });

    it("checks household_members table with correct user_id", async () => {
      const request = createMockRequest(
        "http://localhost:3000/callback?code=valid"
      );
      await GET(request);

      expect(mockSupabase.from).toHaveBeenCalledWith("household_members");
    });
  });

  describe("successful authentication without household", () => {
    beforeEach(() => {
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
      });
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });
    });

    it("redirects to /onboarding when user has no household membership", async () => {
      const request = createMockRequest(
        "http://localhost:3000/callback?code=valid"
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:3000/onboarding"
      );
    });
  });

  describe("production environment with x-forwarded-host", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
      });
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "membership-123" },
                error: null,
              }),
            }),
          }),
        }),
      });
    });

    it("uses x-forwarded-host for redirect URL in production", async () => {
      const request = createMockRequest(
        "http://localhost:3000/callback?code=valid",
        { "x-forwarded-host": "shoppy.example.com" }
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "https://shoppy.example.com/list"
      );
    });
  });
});

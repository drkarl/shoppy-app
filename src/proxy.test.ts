import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

const mockUser = { id: "user-123", email: "test@example.com" };
const mockUpdateSession = vi.fn();

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}));

function createMockRequest(pathname: string): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  return new NextRequest(url);
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unauthenticated users", () => {
    beforeEach(() => {
      mockUpdateSession.mockResolvedValue({
        supabaseResponse: NextResponse.next(),
        user: null,
        supabase: {},
      });
    });

    it("redirects to /login when accessing /list", async () => {
      const request = createMockRequest("/list");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:3000/login"
      );
    });

    it("redirects to /login when accessing /onboarding", async () => {
      const request = createMockRequest("/onboarding");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:3000/login"
      );
    });

    it("redirects to /login when accessing /settings", async () => {
      const request = createMockRequest("/settings");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:3000/login"
      );
    });

    it("allows access to /login", async () => {
      const request = createMockRequest("/login");
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Location")).toBeNull();
    });

    it("allows access to public routes like /", async () => {
      const request = createMockRequest("/");
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Location")).toBeNull();
    });
  });

  describe("authenticated users", () => {
    beforeEach(() => {
      mockUpdateSession.mockResolvedValue({
        supabaseResponse: NextResponse.next(),
        user: mockUser,
        supabase: {},
      });
    });

    it("redirects to /list when accessing /login", async () => {
      const request = createMockRequest("/login");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:3000/list"
      );
    });

    it("allows access to /list", async () => {
      const request = createMockRequest("/list");
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Location")).toBeNull();
    });

    it("allows access to /onboarding", async () => {
      const request = createMockRequest("/onboarding");
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Location")).toBeNull();
    });

    it("allows access to /settings", async () => {
      const request = createMockRequest("/settings");
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Location")).toBeNull();
    });

    it("allows access to public routes like /", async () => {
      const request = createMockRequest("/");
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Location")).toBeNull();
    });
  });

  describe("nested protected routes", () => {
    it("protects nested routes under /list", async () => {
      mockUpdateSession.mockResolvedValue({
        supabaseResponse: NextResponse.next(),
        user: null,
        supabase: {},
      });

      const request = createMockRequest("/list/123/items");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:3000/login"
      );
    });
  });
});

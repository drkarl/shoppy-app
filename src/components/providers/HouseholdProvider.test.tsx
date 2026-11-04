import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";

import { useAuth } from "./AuthProvider";
import { HouseholdProvider, useHousehold } from "./HouseholdProvider";

vi.mock("./AuthProvider", () => ({
  useAuth: vi.fn(),
}));

const mockHousehold = {
  id: "household-123",
  name: "Test Household",
  invite_code: "abc123",
  invite_expires_at: "2025-12-31T00:00:00Z",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const mockMemberships = [
  {
    role: "owner",
    households: mockHousehold,
  },
];

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
  })),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

function TestConsumer() {
  const {
    households,
    currentHousehold,
    userRole,
    isLoading,
    error,
    createHousehold,
  } = useHousehold();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div data-testid="error">{error}</div>;
  }

  return (
    <div>
      <span data-testid="household-count">{households.length}</span>
      <span data-testid="current-household">
        {currentHousehold?.name ?? "No household"}
      </span>
      <span data-testid="user-role">{userRole ?? "No role"}</span>
      <button onClick={() => createHousehold("New Household")}>
        Create Household
      </button>
    </div>
  );
}

describe("HouseholdProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // These tests cover the Supabase-configured provider; pin the environment so
    // local-only mode does not divert createHousehold to Dexie.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    (useAuth as Mock).mockReturnValue({
      user: null,
      isLoading: false,
    });
  });

  it("provides household context to children", async () => {
    (useAuth as Mock).mockReturnValue({
      user: null,
      isLoading: false,
    });

    render(
      <HouseholdProvider>
        <TestConsumer />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("current-household")).toHaveTextContent(
        "No household"
      );
    });
  });

  it("fetches households when user is authenticated", async () => {
    (useAuth as Mock).mockReturnValue({
      user: { id: "user-123" },
      isLoading: false,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: mockMemberships,
        error: null,
      }),
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    render(
      <HouseholdProvider>
        <TestConsumer />
      </HouseholdProvider>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("household-count")).toHaveTextContent("1");
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-household")).toHaveTextContent(
        "Test Household"
      );
    });
  });

  it("sets user role based on membership", async () => {
    (useAuth as Mock).mockReturnValue({
      user: { id: "user-123" },
      isLoading: false,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: mockMemberships,
        error: null,
      }),
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    render(
      <HouseholdProvider>
        <TestConsumer />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-role")).toHaveTextContent("owner");
    });
  });

  it("handles fetch error gracefully", async () => {
    (useAuth as Mock).mockReturnValue({
      user: { id: "user-123" },
      isLoading: false,
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

    render(
      <HouseholdProvider>
        <TestConsumer />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("error")).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("creates household via API", async () => {
    const user = userEvent.setup();

    (useAuth as Mock).mockReturnValue({
      user: { id: "user-123" },
      isLoading: false,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          household: mockHousehold,
        }),
    });
    global.fetch = mockFetch;

    render(
      <HouseholdProvider>
        <TestConsumer />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create household/i })
      ).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: /create household/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/households", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "New Household" }),
      });
    });
  });

  it("throws error when useHousehold is used outside provider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow("useHousehold must be used within a HouseholdProvider");

    consoleError.mockRestore();
  });

  it("clears households when user logs out", async () => {
    const { rerender } = render(
      <HouseholdProvider>
        <TestConsumer />
      </HouseholdProvider>
    );

    // Initially no user
    await waitFor(() => {
      expect(screen.getByTestId("household-count")).toHaveTextContent("0");
    });

    // User logs in
    (useAuth as Mock).mockReturnValue({
      user: { id: "user-123" },
      isLoading: false,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: mockMemberships,
        error: null,
      }),
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
    });

    rerender(
      <HouseholdProvider>
        <TestConsumer />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("household-count")).toHaveTextContent("1");
    });

    // User logs out
    (useAuth as Mock).mockReturnValue({
      user: null,
      isLoading: false,
    });

    rerender(
      <HouseholdProvider>
        <TestConsumer />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("household-count")).toHaveTextContent("0");
    });
  });
});

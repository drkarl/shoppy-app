import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import JoinPage from "./page";

const mockPush = vi.fn();
const mockParams = { code: "abc123" };

vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush }),
}));

const mockUser = { id: "user-123", email: "test@example.com" };
const mockUseAuth = vi.fn();
const mockUseHousehold = vi.fn();

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/providers/HouseholdProvider", () => ({
  useHousehold: () => mockUseHousehold(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("JoinPage", () => {
  const mockRefreshHouseholds = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
    });

    mockUseHousehold.mockReturnValue({
      refreshHouseholds: mockRefreshHouseholds,
    });

    global.fetch = vi.fn();
  });

  it("shows login prompt when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
    });

    render(<JoinPage />);

    expect(screen.getByText("Join a Household")).toBeInTheDocument();
    expect(screen.getByText(/sign in to continue/i)).toBeInTheDocument();
  });

  it("shows loading state while verifying invite", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    );

    render(<JoinPage />);

    expect(screen.getByText(/verifying invite link/i)).toBeInTheDocument();
  });

  it("shows household name for valid invite", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          household_id: "household-123",
          household_name: "Test Household",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        }),
    });

    render(<JoinPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Household")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /join household/i })
      ).toBeInTheDocument();
    });
  });

  it("shows expired message for expired invite", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 410,
      json: () =>
        Promise.resolve({
          error:
            "This invite has expired. Ask the household owner for a new link.",
          code: "EXPIRED",
        }),
    });

    render(<JoinPage />);

    await waitFor(() => {
      expect(screen.getByText("Invite Expired")).toBeInTheDocument();
      expect(screen.getByText(/this invite has expired/i)).toBeInTheDocument();
    });
  });

  it("shows invalid message for invalid invite code", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({
          error: "Invalid invite code",
          code: "INVALID_CODE",
        }),
    });

    render(<JoinPage />);

    await waitFor(() => {
      expect(screen.getByText("Invalid Invite Link")).toBeInTheDocument();
    });
  });

  it("shows already member message and redirect button", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          error: "You are already a member of this household",
          code: "ALREADY_MEMBER",
          household_id: "household-123",
        }),
    });

    render(<JoinPage />);

    await waitFor(() => {
      expect(screen.getByText("Already a Member")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /go to shopping list/i })
      ).toBeInTheDocument();
    });
  });

  it("successfully joins household", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            household_id: "household-123",
            household_name: "Test Household",
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            household: { id: "household-123", name: "Test Household" },
          }),
      });

    mockRefreshHouseholds.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<JoinPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /join household/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /join household/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Welcome to Test Household!");
      expect(mockRefreshHouseholds).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/list");
    });
  });

  it("shows error when join fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            household_id: "household-123",
            household_name: "Test Household",
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            error: "Failed to join household",
          }),
      });

    const user = userEvent.setup();
    render(<JoinPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /join household/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /join household/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to join household");
    });
  });

  it("redirects to list when already a member during join", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            household_id: "household-123",
            household_name: "Test Household",
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            error: "You are already a member of this household",
          }),
      });

    const user = userEvent.setup();
    render(<JoinPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /join household/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /join household/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "You're already a member of this household"
      );
      expect(mockPush).toHaveBeenCalledWith("/list");
    });
  });
});

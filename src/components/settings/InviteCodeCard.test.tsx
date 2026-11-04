import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InviteCodeCard } from "./InviteCodeCard";

const mockUseHousehold = vi.fn();
const mockRefreshHouseholds = vi.fn();

vi.mock("@/components/providers/HouseholdProvider", () => ({
  useHousehold: () => mockUseHousehold(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("InviteCodeCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();

    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:3000" },
      writable: true,
    });

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });

    mockUseHousehold.mockReturnValue({
      currentHousehold: { id: "household-123", name: "Test Household" },
      userRole: "owner",
      refreshHouseholds: mockRefreshHouseholds,
    });
  });

  it("shows loading state initially", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    );

    render(<InviteCodeCard />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("displays invite link when loaded", async () => {
    const expiresAt = new Date(Date.now() + 86400000 * 7).toISOString();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          invite_code: "abc123",
          invite_expires_at: expiresAt,
          household_name: "Test Household",
          is_owner: true,
        }),
    });

    render(<InviteCodeCard />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(/abc123/)).toBeInTheDocument();
    });

    expect(screen.getByText("Invite Link")).toBeInTheDocument();
    expect(screen.getByLabelText("Invite URL")).toHaveValue(
      "http://localhost:3000/join/abc123"
    );
  });

  it("copies invite link to clipboard", async () => {
    const expiresAt = new Date(Date.now() + 86400000 * 7).toISOString();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          invite_code: "abc123",
          invite_expires_at: expiresAt,
          household_name: "Test Household",
          is_owner: true,
        }),
    });

    const user = userEvent.setup();
    render(<InviteCodeCard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Copy invite link")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Copy invite link"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Invite link copied to clipboard"
      );
    });
  });

  it("shows regenerate button for owners", async () => {
    const expiresAt = new Date(Date.now() + 86400000 * 7).toISOString();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          invite_code: "abc123",
          invite_expires_at: expiresAt,
          household_name: "Test Household",
          is_owner: true,
        }),
    });

    render(<InviteCodeCard />);

    await waitFor(() => {
      expect(
        screen.getByLabelText("Regenerate invite link")
      ).toBeInTheDocument();
    });
  });

  it("hides regenerate button for members", async () => {
    mockUseHousehold.mockReturnValue({
      currentHousehold: { id: "household-123", name: "Test Household" },
      userRole: "member",
      refreshHouseholds: mockRefreshHouseholds,
    });

    const expiresAt = new Date(Date.now() + 86400000 * 7).toISOString();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          invite_code: "abc123",
          invite_expires_at: expiresAt,
          household_name: "Test Household",
          is_owner: false,
        }),
    });

    render(<InviteCodeCard />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(/abc123/)).toBeInTheDocument();
    });

    expect(
      screen.queryByLabelText("Regenerate invite link")
    ).not.toBeInTheDocument();
  });

  it("regenerates invite code successfully", async () => {
    const expiresAt = new Date(Date.now() + 86400000 * 7).toISOString();
    const newExpiresAt = new Date(Date.now() + 86400000 * 14).toISOString();

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            invite_code: "abc123",
            invite_expires_at: expiresAt,
            household_name: "Test Household",
            is_owner: true,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            invite_code: "xyz789",
            invite_expires_at: newExpiresAt,
          }),
      });

    mockRefreshHouseholds.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<InviteCodeCard />);

    await waitFor(() => {
      expect(
        screen.getByLabelText("Regenerate invite link")
      ).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Regenerate invite link"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Invite link regenerated. The old link is now invalid."
      );
      expect(mockRefreshHouseholds).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Invite URL")).toHaveValue(
        "http://localhost:3000/join/xyz789"
      );
    });
  });

  it("shows error when regenerate fails", async () => {
    const expiresAt = new Date(Date.now() + 86400000 * 7).toISOString();

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            invite_code: "abc123",
            invite_expires_at: expiresAt,
            household_name: "Test Household",
            is_owner: true,
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            error: "Only the household owner can regenerate the invite code",
          }),
      });

    const user = userEvent.setup();
    render(<InviteCodeCard />);

    await waitFor(() => {
      expect(
        screen.getByLabelText("Regenerate invite link")
      ).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Regenerate invite link"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Only the household owner can regenerate the invite code"
      );
    });
  });

  it("shows expired status for expired invites", async () => {
    const expiredAt = new Date(Date.now() - 86400000).toISOString();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          invite_code: "abc123",
          invite_expires_at: expiredAt,
          household_name: "Test Household",
          is_owner: true,
        }),
    });

    render(<InviteCodeCard />);

    await waitFor(() => {
      expect(screen.getByText("Expired")).toBeInTheDocument();
    });
  });

  it("shows error state when fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          error: "Failed to fetch invite details",
        }),
    });

    render(<InviteCodeCard />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to fetch invite details")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /try again/i })
      ).toBeInTheDocument();
    });
  });
});

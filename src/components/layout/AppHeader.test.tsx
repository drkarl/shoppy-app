import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";

import { useAuth } from "@/components/providers/AuthProvider";
import { useHousehold } from "@/components/providers/HouseholdProvider";

import { AppHeader } from "./AppHeader";

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/providers/HouseholdProvider", () => ({
  useHousehold: vi.fn(),
}));

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

const mockHousehold2 = {
  id: "household-456",
  name: "Second Household",
  invite_code: "def456",
  invite_expires_at: "2025-12-31T00:00:00Z",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

describe("AppHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when user is not authenticated", () => {
    (useAuth as Mock).mockReturnValue({
      user: null,
      signOut: vi.fn(),
    });
    (useHousehold as Mock).mockReturnValue({
      currentHousehold: null,
      households: [],
      isLoading: false,
      setCurrentHousehold: vi.fn(),
    });

    const { container } = render(<AppHeader />);
    expect(container.firstChild).toBeNull();
  });

  it("displays loading state while fetching households", () => {
    (useAuth as Mock).mockReturnValue({
      user: mockUser,
      signOut: vi.fn(),
    });
    (useHousehold as Mock).mockReturnValue({
      currentHousehold: null,
      households: [],
      isLoading: true,
      setCurrentHousehold: vi.fn(),
    });

    render(<AppHeader />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays current household name", () => {
    (useAuth as Mock).mockReturnValue({
      user: mockUser,
      signOut: vi.fn(),
    });
    (useHousehold as Mock).mockReturnValue({
      currentHousehold: mockHousehold,
      households: [mockHousehold],
      isLoading: false,
      setCurrentHousehold: vi.fn(),
    });

    render(<AppHeader />);
    expect(screen.getByText("Test Household")).toBeInTheDocument();
  });

  it("displays 'No household' when user has no households", () => {
    (useAuth as Mock).mockReturnValue({
      user: mockUser,
      signOut: vi.fn(),
    });
    (useHousehold as Mock).mockReturnValue({
      currentHousehold: null,
      households: [],
      isLoading: false,
      setCurrentHousehold: vi.fn(),
    });

    render(<AppHeader />);
    expect(screen.getByText("No household")).toBeInTheDocument();
  });

  it("displays user email", () => {
    (useAuth as Mock).mockReturnValue({
      user: mockUser,
      signOut: vi.fn(),
    });
    (useHousehold as Mock).mockReturnValue({
      currentHousehold: mockHousehold,
      households: [mockHousehold],
      isLoading: false,
      setCurrentHousehold: vi.fn(),
    });

    render(<AppHeader />);
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("calls signOut when sign out button is clicked", async () => {
    const user = userEvent.setup();
    const mockSignOut = vi.fn();

    (useAuth as Mock).mockReturnValue({
      user: mockUser,
      signOut: mockSignOut,
    });
    (useHousehold as Mock).mockReturnValue({
      currentHousehold: mockHousehold,
      households: [mockHousehold],
      isLoading: false,
      setCurrentHousehold: vi.fn(),
    });

    render(<AppHeader />);

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(mockSignOut).toHaveBeenCalled();
  });

  it("shows household switcher when user has multiple households", () => {
    (useAuth as Mock).mockReturnValue({
      user: mockUser,
      signOut: vi.fn(),
    });
    (useHousehold as Mock).mockReturnValue({
      currentHousehold: mockHousehold,
      households: [mockHousehold, mockHousehold2],
      isLoading: false,
      setCurrentHousehold: vi.fn(),
    });

    render(<AppHeader />);
    expect(
      screen.getByRole("button", { name: /switch household/i })
    ).toBeInTheDocument();
  });

  it("does not show household switcher when user has single household", () => {
    (useAuth as Mock).mockReturnValue({
      user: mockUser,
      signOut: vi.fn(),
    });
    (useHousehold as Mock).mockReturnValue({
      currentHousehold: mockHousehold,
      households: [mockHousehold],
      isLoading: false,
      setCurrentHousehold: vi.fn(),
    });

    render(<AppHeader />);
    expect(
      screen.queryByRole("button", { name: /switch household/i })
    ).not.toBeInTheDocument();
  });

  it("switches household when option is clicked", async () => {
    const user = userEvent.setup();
    const mockSetCurrentHousehold = vi.fn();

    (useAuth as Mock).mockReturnValue({
      user: mockUser,
      signOut: vi.fn(),
    });
    (useHousehold as Mock).mockReturnValue({
      currentHousehold: mockHousehold,
      households: [mockHousehold, mockHousehold2],
      isLoading: false,
      setCurrentHousehold: mockSetCurrentHousehold,
    });

    render(<AppHeader />);

    // Click the button to open the dropdown (tests keyboard accessibility)
    const switchButton = screen.getByRole("button", {
      name: /switch household/i,
    });
    await user.click(switchButton);

    // Wait for dropdown to appear and click option
    await waitFor(() => {
      const option = screen.getByText("Second Household");
      expect(option).toBeInTheDocument();
    });

    await user.click(screen.getByText("Second Household"));

    expect(mockSetCurrentHousehold).toHaveBeenCalledWith(mockHousehold2);
  });
});

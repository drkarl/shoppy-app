import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingWizard } from "./OnboardingWizard";

const mockPush = vi.fn();
const mockCreateHousehold = vi.fn();
const mockRefreshHouseholds = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/components/providers/HouseholdProvider", () => ({
  useHousehold: () => ({
    createHousehold: mockCreateHousehold,
    refreshHouseholds: mockRefreshHouseholds,
  }),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    categories: [{ id: "cat-1", name: "Produce", icon: "🥬", defaultOrder: 1 }],
    isLoading: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("OnboardingWizard", () => {
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
  });

  it("starts at welcome step", () => {
    render(<OnboardingWizard />);

    expect(screen.getByText("Welcome to Shoppy!")).toBeInTheDocument();
  });

  it("shows progress indicator", () => {
    render(<OnboardingWizard />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("navigates from welcome to create-household step", async () => {
    const user = userEvent.setup();

    render(<OnboardingWizard />);

    await user.click(screen.getByRole("button", { name: /get started/i }));

    expect(screen.getByText("Create Your Household")).toBeInTheDocument();
  });

  it("can go back from create-household to welcome", async () => {
    const user = userEvent.setup();

    render(<OnboardingWizard />);

    await user.click(screen.getByRole("button", { name: /get started/i }));
    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByText("Welcome to Shoppy!")).toBeInTheDocument();
  });

  it("creates household and navigates to invite step", async () => {
    mockCreateHousehold.mockResolvedValue({
      id: "household-123",
      name: "My Family",
      invite_code: "abc123",
    });

    const user = userEvent.setup();

    render(<OnboardingWizard />);

    // Go to create household
    await user.click(screen.getByRole("button", { name: /get started/i }));

    // Create household
    await user.type(screen.getByLabelText("Household Name"), "My Family");
    await user.click(screen.getByRole("button", { name: /create household/i }));

    await waitFor(() => {
      expect(mockCreateHousehold).toHaveBeenCalledWith("My Family");
      expect(toast.success).toHaveBeenCalledWith(
        'Household "My Family" created!'
      );
      expect(screen.getByText("Invite Your Partner")).toBeInTheDocument();
    });
  });

  it("shows invite URL after household creation", async () => {
    mockCreateHousehold.mockResolvedValue({
      id: "household-123",
      name: "My Family",
      invite_code: "abc123",
    });

    const user = userEvent.setup();

    render(<OnboardingWizard />);

    await user.click(screen.getByRole("button", { name: /get started/i }));
    await user.type(screen.getByLabelText("Household Name"), "My Family");
    await user.click(screen.getByRole("button", { name: /create household/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Invite Link")).toHaveValue(
        "http://localhost:3000/join/abc123"
      );
    });
  });

  it("skips invite step and goes to store profile step", async () => {
    mockCreateHousehold.mockResolvedValue({
      id: "household-123",
      name: "My Family",
      invite_code: "abc123",
    });

    const user = userEvent.setup();

    render(<OnboardingWizard />);

    // Complete welcome and create household steps
    await user.click(screen.getByRole("button", { name: /get started/i }));
    await user.type(screen.getByLabelText("Household Name"), "My Family");
    await user.click(screen.getByRole("button", { name: /create household/i }));

    await waitFor(() => {
      expect(screen.getByText("Invite Your Partner")).toBeInTheDocument();
    });

    // Skip invite step
    await user.click(screen.getByRole("button", { name: /skip for now/i }));

    expect(screen.getByText("Add Your First Store")).toBeInTheDocument();
  });

  it("skips store profile step and goes to completion", async () => {
    mockCreateHousehold.mockResolvedValue({
      id: "household-123",
      name: "My Family",
      invite_code: "abc123",
    });

    const user = userEvent.setup();

    render(<OnboardingWizard />);

    // Complete welcome and create household steps
    await user.click(screen.getByRole("button", { name: /get started/i }));
    await user.type(screen.getByLabelText("Household Name"), "My Family");
    await user.click(screen.getByRole("button", { name: /create household/i }));

    await waitFor(() => {
      expect(screen.getByText("Invite Your Partner")).toBeInTheDocument();
    });

    // Skip invite step
    await user.click(screen.getByRole("button", { name: /skip for now/i }));

    // Skip store profile step
    await user.click(screen.getByRole("button", { name: /skip for now/i }));

    expect(screen.getByText("You're All Set!")).toBeInTheDocument();
    expect(screen.getByText("My Family is ready to use")).toBeInTheDocument();
  });

  it("completes onboarding and redirects to list", async () => {
    mockCreateHousehold.mockResolvedValue({
      id: "household-123",
      name: "My Family",
      invite_code: "abc123",
    });
    mockRefreshHouseholds.mockResolvedValue(undefined);

    const user = userEvent.setup();

    render(<OnboardingWizard />);

    // Complete all steps
    await user.click(screen.getByRole("button", { name: /get started/i }));
    await user.type(screen.getByLabelText("Household Name"), "My Family");
    await user.click(screen.getByRole("button", { name: /create household/i }));

    await waitFor(() => {
      expect(screen.getByText("Invite Your Partner")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /skip for now/i }));
    await user.click(screen.getByRole("button", { name: /skip for now/i }));

    // Complete onboarding
    await user.click(screen.getByRole("button", { name: /start shopping/i }));

    await waitFor(() => {
      expect(mockRefreshHouseholds).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/list");
    });
  });
});

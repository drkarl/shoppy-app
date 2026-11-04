import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreProfileStep } from "./StoreProfileStep";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    categories: [
      { id: "cat-1", name: "Produce", icon: "🥬", defaultOrder: 1 },
      { id: "cat-2", name: "Dairy", icon: "🥛", defaultOrder: 2 },
    ],
    isLoading: false,
  }),
}));

describe("StoreProfileStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders store profile creation form", () => {
    render(
      <StoreProfileStep
        householdId="household-123"
        onNext={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText("Add Your First Store")).toBeInTheDocument();
    expect(screen.getByLabelText("Store Name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create store profile/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /skip for now/i })
    ).toBeInTheDocument();
  });

  it("disables Create button when input is empty", () => {
    render(
      <StoreProfileStep
        householdId="household-123"
        onNext={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    const createButton = screen.getByRole("button", {
      name: /create store profile/i,
    });
    expect(createButton).toBeDisabled();
  });

  it("enables Create button when input has value", async () => {
    const user = userEvent.setup();

    render(
      <StoreProfileStep
        householdId="household-123"
        onNext={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText("Store Name"), "Lidl");

    const createButton = screen.getByRole("button", {
      name: /create store profile/i,
    });
    expect(createButton).toBeEnabled();
  });

  it("creates store profile and calls onNext on success", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          store_profile: { id: "store-1", store_name: "Lidl" },
        }),
    });

    const onNext = vi.fn();
    const user = userEvent.setup();

    render(
      <StoreProfileStep
        householdId="household-123"
        onNext={onNext}
        onSkip={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText("Store Name"), "Lidl");
    await user.click(
      screen.getByRole("button", { name: /create store profile/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/store-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          household_id: "household-123",
          store_name: "Lidl",
          category_order: ["cat-1", "cat-2"],
          is_default: true,
        }),
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Store "Lidl" created');
      expect(onNext).toHaveBeenCalled();
    });
  });

  it("shows error when creation fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          error: "A store profile with this name already exists",
        }),
    });

    const user = userEvent.setup();

    render(
      <StoreProfileStep
        householdId="household-123"
        onNext={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText("Store Name"), "Lidl");
    await user.click(
      screen.getByRole("button", { name: /create store profile/i })
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "A store profile with this name already exists"
      );
    });
  });

  it("calls onSkip when Skip is clicked", async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();

    render(
      <StoreProfileStep
        householdId="household-123"
        onNext={vi.fn()}
        onSkip={onSkip}
      />
    );

    await user.click(screen.getByRole("button", { name: /skip for now/i }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("shows loading state while creating", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    );

    const user = userEvent.setup();

    render(
      <StoreProfileStep
        householdId="household-123"
        onNext={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText("Store Name"), "Lidl");
    await user.click(
      screen.getByRole("button", { name: /create store profile/i })
    );

    expect(screen.getByText("Creating...")).toBeInTheDocument();
    expect(screen.getByLabelText("Store Name")).toBeDisabled();
  });
});

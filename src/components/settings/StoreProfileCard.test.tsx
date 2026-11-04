import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { StoreProfileCard } from "./StoreProfileCard";

import type { StoreProfile } from "@/types/store-profile";

// Mock next/link - pass through all props including aria-label
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const createMockStore = (
  overrides: Partial<StoreProfile> = {}
): StoreProfile => ({
  id: "store-1",
  household_id: "household-1",
  store_name: "Test Store",
  category_order: ["cat-1", "cat-2", "cat-3"],
  is_default: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

describe("StoreProfileCard", () => {
  const mockOnDelete = vi.fn();
  const mockOnToggleDefault = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnDelete.mockResolvedValue(undefined);
    mockOnToggleDefault.mockResolvedValue(undefined);
  });

  it("renders store name", () => {
    const store = createMockStore({ store_name: "Lidl" });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    expect(screen.getByText("Lidl")).toBeInTheDocument();
  });

  it("renders category count", () => {
    const store = createMockStore({
      category_order: ["cat-1", "cat-2", "cat-3", "cat-4", "cat-5"],
    });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    expect(screen.getByText("5 categories configured")).toBeInTheDocument();
  });

  it("shows default badge when store is default", () => {
    const store = createMockStore({ is_default: true });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("does not show default badge when store is not default", () => {
    const store = createMockStore({ is_default: false });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    expect(screen.queryByText("Default")).not.toBeInTheDocument();
  });

  it("renders Set as Default button for non-default store", () => {
    const store = createMockStore({ is_default: false, store_name: "Lidl" });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    expect(
      screen.getByRole("button", { name: /set lidl as default store/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Set as Default")).toBeInTheDocument();
  });

  it("renders Remove Default button for default store", () => {
    const store = createMockStore({ is_default: true, store_name: "Lidl" });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    expect(
      screen.getByRole("button", { name: /remove lidl as default store/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Remove Default")).toBeInTheDocument();
  });

  it("calls onToggleDefault when default button is clicked", async () => {
    const store = createMockStore({ is_default: false });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    const toggleButton = screen.getByRole("button", {
      name: /set test store as default store/i,
    });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(mockOnToggleDefault).toHaveBeenCalledWith("store-1", true);
    });
  });

  it("calls onToggleDefault with false when removing default", async () => {
    const store = createMockStore({ is_default: true });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    const toggleButton = screen.getByRole("button", {
      name: /remove test store as default store/i,
    });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(mockOnToggleDefault).toHaveBeenCalledWith("store-1", false);
    });
  });

  it("renders edit link with correct href", () => {
    const store = createMockStore({ store_name: "Lidl" });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    const editLink = screen.getByRole("link", { name: /edit lidl/i });
    expect(editLink).toHaveAttribute("href", "/settings/stores/store-1");
  });

  it("renders delete button", () => {
    const store = createMockStore({ store_name: "Lidl" });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    expect(
      screen.getByRole("button", { name: /delete lidl/i })
    ).toBeInTheDocument();
  });

  it("opens delete confirmation dialog when delete button is clicked", async () => {
    const store = createMockStore({ store_name: "Lidl" });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    const deleteButton = screen.getByRole("button", { name: /delete lidl/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText("Delete Store Profile")).toBeInTheDocument();
      expect(
        screen.getByText("Delete Lidl profile? This cannot be undone.")
      ).toBeInTheDocument();
    });
  });

  it("calls onDelete when confirming deletion", async () => {
    const store = createMockStore({ store_name: "Lidl" });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    // Open dialog
    const deleteButton = screen.getByRole("button", { name: /delete lidl/i });
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = await screen.findByRole("button", { name: "Delete" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalledWith("store-1");
    });
  });

  it("closes dialog when cancel is clicked", async () => {
    const store = createMockStore({ store_name: "Lidl" });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    // Open dialog
    const deleteButton = screen.getByRole("button", { name: /delete lidl/i });
    fireEvent.click(deleteButton);

    // Cancel
    const cancelButton = await screen.findByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(
        screen.queryByText("Delete Store Profile")
      ).not.toBeInTheDocument();
    });

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it("disables default toggle button when isTogglingDefault is true", () => {
    const store = createMockStore();

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
        isTogglingDefault={true}
      />
    );

    const toggleButton = screen.getByRole("button", {
      name: /set test store as default store/i,
    });
    expect(toggleButton).toBeDisabled();
  });

  it("shows Deleting... text when isDeleting is true", async () => {
    const store = createMockStore({ store_name: "Lidl" });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
        isDeleting={true}
      />
    );

    // Open dialog
    const deleteButton = screen.getByRole("button", { name: /delete lidl/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText("Deleting...")).toBeInTheDocument();
    });
  });

  it("has correct test id attribute", () => {
    const store = createMockStore({ id: "store-abc-123" });

    render(
      <StoreProfileCard
        store={store}
        onDelete={mockOnDelete}
        onToggleDefault={mockOnToggleDefault}
      />
    );

    expect(screen.getByTestId("store-card-store-abc-123")).toBeInTheDocument();
  });
});

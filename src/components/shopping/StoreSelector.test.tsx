import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { StoreSelector } from "./StoreSelector";

import type { StoreProfile } from "@/types/store-profile";

const mockStores: StoreProfile[] = [
  {
    id: "store-1",
    household_id: "household-123",
    store_name: "Walmart",
    category_order: [],
    is_default: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "store-2",
    household_id: "household-123",
    store_name: "Target",
    category_order: [],
    is_default: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "store-3",
    household_id: "household-123",
    store_name: "Costco",
    category_order: [],
    is_default: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

describe("StoreSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when stores list is empty", () => {
    const { container } = render(
      <StoreSelector stores={[]} selectedStore={null} onSelect={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("displays the selected store name", () => {
    render(
      <StoreSelector
        stores={mockStores}
        selectedStore={mockStores[0]}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText("Walmart")).toBeInTheDocument();
  });

  it("displays 'Select store' when no store is selected", () => {
    render(
      <StoreSelector
        stores={mockStores}
        selectedStore={null}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText("Select store")).toBeInTheDocument();
  });

  it("opens dropdown when button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <StoreSelector
        stores={mockStores}
        selectedStore={mockStores[0]}
        onSelect={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
  });

  it("shows all store names in dropdown", async () => {
    const user = userEvent.setup();

    render(
      <StoreSelector
        stores={mockStores}
        selectedStore={mockStores[0]}
        onSelect={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /Walmart/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: /Target/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: /Costco/i })
      ).toBeInTheDocument();
    });
  });

  it("shows '★ Default' badge on default store", async () => {
    const user = userEvent.setup();

    render(
      <StoreSelector
        stores={mockStores}
        selectedStore={mockStores[1]}
        onSelect={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      // The default badge should appear for Walmart (the default store)
      const defaultBadges = screen.getAllByText("★ Default");
      expect(defaultBadges).toHaveLength(1);
    });
  });

  it("calls onSelect when a store is clicked", async () => {
    const user = userEvent.setup();
    const mockOnSelect = vi.fn();

    render(
      <StoreSelector
        stores={mockStores}
        selectedStore={mockStores[0]}
        onSelect={mockOnSelect}
      />
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /Target/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option", { name: /Target/i }));

    expect(mockOnSelect).toHaveBeenCalledWith(mockStores[1]);
  });

  it("closes dropdown after selection", async () => {
    const user = userEvent.setup();

    render(
      <StoreSelector
        stores={mockStores}
        selectedStore={mockStores[0]}
        onSelect={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option", { name: /Target/i }));

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("closes dropdown when clicking outside", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <div data-testid="outside">Outside</div>
        <StoreSelector
          stores={mockStores}
          selectedStore={mockStores[0]}
          onSelect={vi.fn()}
        />
      </div>
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("outside"));

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("closes dropdown when Escape key is pressed", async () => {
    const user = userEvent.setup();

    render(
      <StoreSelector
        stores={mockStores}
        selectedStore={mockStores[0]}
        onSelect={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("toggles dropdown with Enter key", async () => {
    const user = userEvent.setup();

    render(
      <StoreSelector
        stores={mockStores}
        selectedStore={mockStores[0]}
        onSelect={vi.fn()}
      />
    );

    const button = screen.getByRole("button");
    button.focus();

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
  });

  it("marks the selected store with aria-selected", async () => {
    const user = userEvent.setup();

    render(
      <StoreSelector
        stores={mockStores}
        selectedStore={mockStores[0]}
        onSelect={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      const walmartOption = screen.getByRole("option", { name: /Walmart/i });
      expect(walmartOption).toHaveAttribute("aria-selected", "true");

      const targetOption = screen.getByRole("option", { name: /Target/i });
      expect(targetOption).toHaveAttribute("aria-selected", "false");
    });
  });
});

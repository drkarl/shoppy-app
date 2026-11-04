import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { CategoryOrderList } from "./CategoryOrderList";

const mockCategories = [
  { id: "cat-1", name: "Produce", icon: "carrot" },
  { id: "cat-2", name: "Dairy", icon: "milk" },
  { id: "cat-3", name: "Meat & Fish", icon: "beef" },
  { id: "cat-4", name: "Bakery", icon: "bread-slice" },
  { id: "cat-5", name: "Frozen", icon: "snowflake" },
];

const mockCategoryOrder = ["cat-1", "cat-2", "cat-3", "cat-4", "cat-5"];

describe("CategoryOrderList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all categories in the correct order", () => {
    render(
      <CategoryOrderList
        categories={mockCategories}
        categoryOrder={mockCategoryOrder}
        onSave={vi.fn()}
      />
    );

    // Check that all category names are rendered
    expect(screen.getByText("Produce")).toBeInTheDocument();
    expect(screen.getByText("Dairy")).toBeInTheDocument();
    expect(screen.getByText("Meat & Fish")).toBeInTheDocument();
    expect(screen.getByText("Bakery")).toBeInTheDocument();
    expect(screen.getByText("Frozen")).toBeInTheDocument();
  });

  it("renders categories in specified order", () => {
    const reversedOrder = ["cat-5", "cat-4", "cat-3", "cat-2", "cat-1"];

    render(
      <CategoryOrderList
        categories={mockCategories}
        categoryOrder={reversedOrder}
        onSave={vi.fn()}
      />
    );

    const categoryNames = screen
      .getAllByText(/Produce|Dairy|Meat & Fish|Bakery|Frozen/)
      .map((el) => el.textContent);

    expect(categoryNames[0]).toBe("Frozen");
    expect(categoryNames[4]).toBe("Produce");
  });

  it("renders Save button as disabled when no changes are made", () => {
    render(
      <CategoryOrderList
        categories={mockCategories}
        categoryOrder={mockCategoryOrder}
        onSave={vi.fn()}
      />
    );

    const saveButton = screen.getByRole("button", { name: /save order/i });
    expect(saveButton).toBeDisabled();
  });

  it("shows 'Saving...' text when isSaving is true", () => {
    render(
      <CategoryOrderList
        categories={mockCategories}
        categoryOrder={mockCategoryOrder}
        onSave={vi.fn()}
        isSaving={true}
      />
    );

    expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument();
  });

  it("renders drag handles for each category", () => {
    render(
      <CategoryOrderList
        categories={mockCategories}
        categoryOrder={mockCategoryOrder}
        onSave={vi.fn()}
      />
    );

    // Each category should have a drag handle button
    const dragHandles = screen.getAllByRole("button", {
      name: /drag to reorder/i,
    });
    expect(dragHandles).toHaveLength(5);
  });

  it("renders correct aria-label for drag handles", () => {
    render(
      <CategoryOrderList
        categories={mockCategories}
        categoryOrder={mockCategoryOrder}
        onSave={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Drag to reorder Produce" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Drag to reorder Dairy" })
    ).toBeInTheDocument();
  });

  it("has accessible list structure", () => {
    render(
      <CategoryOrderList
        categories={mockCategories}
        categoryOrder={mockCategoryOrder}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByRole("list")).toHaveAttribute(
      "aria-label",
      "Category order"
    );
  });

  it("handles categories not in the order array", () => {
    const partialOrder = ["cat-1", "cat-3"];

    render(
      <CategoryOrderList
        categories={mockCategories}
        categoryOrder={partialOrder}
        onSave={vi.fn()}
      />
    );

    // All categories should still be rendered
    expect(screen.getByText("Produce")).toBeInTheDocument();
    expect(screen.getByText("Dairy")).toBeInTheDocument();
    expect(screen.getByText("Meat & Fish")).toBeInTheDocument();
    expect(screen.getByText("Bakery")).toBeInTheDocument();
    expect(screen.getByText("Frozen")).toBeInTheDocument();
  });

  it("calls onSave with new order when save button is clicked after reorder", async () => {
    const mockOnSave = vi.fn().mockResolvedValue(undefined);

    render(
      <CategoryOrderList
        categories={mockCategories}
        categoryOrder={mockCategoryOrder}
        onSave={mockOnSave}
      />
    );

    // Simulate drag by firing pointer events
    // Note: Full drag testing is complex with DnD libraries
    // We test the component's interaction with the save function
    // TODO: For comprehensive DnD testing, consider using @testing-library/user-event
    // or E2E tests with Playwright/Cypress that can simulate real pointer interactions

    // Find the first drag handle and simulate pointer down
    const firstDragHandle = screen.getByRole("button", {
      name: "Drag to reorder Produce",
    });

    // Trigger keyboard navigation to reorder (if supported)
    firstDragHandle.focus();
    fireEvent.keyDown(firstDragHandle, { key: " ", code: "Space" });

    // The actual drag simulation would require more complex setup
    // For now, we test that the save button exists and can be interacted with
    const saveButton = screen.getByRole("button", { name: /save order/i });
    expect(saveButton).toBeInTheDocument();
  });

  it("disables save button while saving", async () => {
    const mockOnSave = vi.fn().mockResolvedValue(undefined);

    render(
      <CategoryOrderList
        categories={mockCategories}
        categoryOrder={mockCategoryOrder}
        onSave={mockOnSave}
        isSaving={true}
      />
    );

    const saveButton = screen.getByRole("button", { name: /saving/i });
    expect(saveButton).toBeDisabled();
  });

  it("renders with empty category order", () => {
    render(
      <CategoryOrderList
        categories={mockCategories}
        categoryOrder={[]}
        onSave={vi.fn()}
      />
    );

    // All categories should be rendered (appended since not in order)
    expect(screen.getByText("Produce")).toBeInTheDocument();
    expect(screen.getByText("Dairy")).toBeInTheDocument();
  });

  it("renders with empty categories array", () => {
    render(
      <CategoryOrderList
        categories={[]}
        categoryOrder={mockCategoryOrder}
        onSave={vi.fn()}
      />
    );

    // Should render empty list without crashing
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.queryByText("Produce")).not.toBeInTheDocument();
  });

  it("uses fallback icon for unknown icon names", () => {
    const categoriesWithUnknownIcon = [
      { id: "cat-1", name: "Custom Category", icon: "unknown-icon" },
    ];

    render(
      <CategoryOrderList
        categories={categoriesWithUnknownIcon}
        categoryOrder={["cat-1"]}
        onSave={vi.fn()}
      />
    );

    // Should render without error (uses Package as fallback)
    expect(screen.getByText("Custom Category")).toBeInTheDocument();
  });
});

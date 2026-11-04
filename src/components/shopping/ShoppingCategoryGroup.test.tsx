import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ShoppingCategoryGroup } from "./ShoppingCategoryGroup";

import type { Category, ListItem } from "@/types/list";

const mockCategory: Category = {
  id: "category-1",
  name: "Produce",
  icon: "carrot",
};

const createMockItem = (overrides: Partial<ListItem> = {}): ListItem => ({
  id: "item-1",
  list_id: "list-1",
  raw_text: "Apples",
  display_name: "Apples",
  quantity: 1,
  unit: null,
  note: null,
  category_id: "category-1",
  status: "pending",
  added_by: "user-1",
  checked_by: null,
  checked_at: null,
  version: 1,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  categories: mockCategory,
  ...overrides,
});

describe("ShoppingCategoryGroup", () => {
  it("renders category name", () => {
    const items = [createMockItem()];
    render(
      <ShoppingCategoryGroup
        category={mockCategory}
        items={items}
        onToggleItem={vi.fn()}
      />
    );

    expect(screen.getByText("Produce")).toBeInTheDocument();
  });

  it("renders checked/total count", () => {
    const items = [
      createMockItem({ id: "1", display_name: "Apples", status: "pending" }),
      createMockItem({ id: "2", display_name: "Bananas", status: "checked" }),
      createMockItem({ id: "3", display_name: "Oranges", status: "pending" }),
    ];
    render(
      <ShoppingCategoryGroup
        category={mockCategory}
        items={items}
        onToggleItem={vi.fn()}
      />
    );

    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("renders all items when expanded", () => {
    const items = [
      createMockItem({ id: "1", display_name: "Apples" }),
      createMockItem({ id: "2", display_name: "Bananas" }),
    ];
    render(
      <ShoppingCategoryGroup
        category={mockCategory}
        items={items}
        onToggleItem={vi.fn()}
        defaultExpanded={true}
      />
    );

    expect(screen.getByText("Apples")).toBeInTheDocument();
    expect(screen.getByText("Bananas")).toBeInTheDocument();
  });

  it("hides items when collapsed", async () => {
    const user = userEvent.setup();
    const items = [createMockItem({ display_name: "Apples" })];
    render(
      <ShoppingCategoryGroup
        category={mockCategory}
        items={items}
        onToggleItem={vi.fn()}
        defaultExpanded={true}
      />
    );

    // Click to collapse
    await user.click(screen.getByRole("button", { name: /produce/i }));

    expect(screen.queryByText("Apples")).not.toBeInTheDocument();
  });

  it("shows items when expanded from collapsed state", async () => {
    const user = userEvent.setup();
    const items = [createMockItem({ display_name: "Apples" })];
    render(
      <ShoppingCategoryGroup
        category={mockCategory}
        items={items}
        onToggleItem={vi.fn()}
        defaultExpanded={false}
      />
    );

    // Items should be hidden initially
    expect(screen.queryByText("Apples")).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByRole("button", { name: /produce/i }));

    expect(screen.getByText("Apples")).toBeInTheDocument();
  });

  it("calls onToggleItem with item id when item is clicked", async () => {
    const user = userEvent.setup();
    const onToggleItem = vi.fn();
    const items = [createMockItem({ id: "item-123" })];
    render(
      <ShoppingCategoryGroup
        category={mockCategory}
        items={items}
        onToggleItem={onToggleItem}
      />
    );

    // Click the item button (the whole item is clickable in shopping mode)
    await user.click(screen.getByRole("button", { name: /apples/i }));
    expect(onToggleItem).toHaveBeenCalledWith("item-123");
  });

  it("renders 'Other' for null category", () => {
    const items = [createMockItem({ category_id: null, categories: null })];
    render(
      <ShoppingCategoryGroup
        category={null}
        items={items}
        onToggleItem={vi.fn()}
      />
    );

    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("has correct aria-expanded attribute", async () => {
    const user = userEvent.setup();
    const items = [createMockItem()];
    render(
      <ShoppingCategoryGroup
        category={mockCategory}
        items={items}
        onToggleItem={vi.fn()}
        defaultExpanded={true}
      />
    );

    const button = screen.getByRole("button", { name: /produce/i });
    expect(button).toHaveAttribute("aria-expanded", "true");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("renders item quantity when greater than 1", () => {
    const items = [createMockItem({ quantity: 3 })];
    render(
      <ShoppingCategoryGroup
        category={mockCategory}
        items={items}
        onToggleItem={vi.fn()}
      />
    );

    expect(screen.getByText("x3")).toBeInTheDocument();
  });

  it("renders item unit", () => {
    const items = [createMockItem({ quantity: 2, unit: "kg" })];
    render(
      <ShoppingCategoryGroup
        category={mockCategory}
        items={items}
        onToggleItem={vi.fn()}
      />
    );

    expect(screen.getByText("x2 kg")).toBeInTheDocument();
  });

  it("renders checkbox with correct aria-checked for pending item", () => {
    const items = [createMockItem({ status: "pending" })];
    render(
      <ShoppingCategoryGroup
        category={mockCategory}
        items={items}
        onToggleItem={vi.fn()}
      />
    );

    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("renders checkbox with correct aria-checked for checked item", () => {
    const items = [createMockItem({ status: "checked" })];
    render(
      <ShoppingCategoryGroup
        category={mockCategory}
        items={items}
        onToggleItem={vi.fn()}
      />
    );

    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("applies strikethrough style to checked items", () => {
    const items = [createMockItem({ status: "checked" })];
    render(
      <ShoppingCategoryGroup
        category={mockCategory}
        items={items}
        onToggleItem={vi.fn()}
      />
    );

    expect(screen.getByText("Apples")).toHaveClass("line-through");
  });
});

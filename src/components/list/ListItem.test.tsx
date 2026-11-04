import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ListItem } from "./ListItem";

import type { ListItem as ListItemType } from "@/types/list";

const createMockItem = (
  overrides: Partial<ListItemType> = {}
): ListItemType => ({
  id: "item-1",
  list_id: "list-1",
  raw_text: "Milk",
  display_name: "Milk",
  quantity: 1,
  unit: null,
  note: null,
  category_id: null,
  status: "pending",
  added_by: "user-1",
  checked_by: null,
  checked_at: null,
  version: 1,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  categories: null,
  ...overrides,
});

describe("ListItem", () => {
  it("renders item display name", () => {
    const item = createMockItem({ display_name: "Bread" });
    render(<ListItem item={item} onToggle={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("Bread")).toBeInTheDocument();
  });

  it("renders quantity when greater than 1", () => {
    const item = createMockItem({ display_name: "Eggs", quantity: 12 });
    render(<ListItem item={item} onToggle={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("x12")).toBeInTheDocument();
  });

  it("does not render quantity when equal to 1", () => {
    const item = createMockItem({ quantity: 1 });
    render(<ListItem item={item} onToggle={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.queryByText(/x1$/)).not.toBeInTheDocument();
  });

  it("renders unit with quantity", () => {
    const item = createMockItem({ quantity: 2, unit: "L" });
    render(<ListItem item={item} onToggle={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("x2 L")).toBeInTheDocument();
  });

  it("renders checkbox unchecked for pending items", () => {
    const item = createMockItem({ status: "pending" });
    render(<ListItem item={item} onToggle={vi.fn()} onDelete={vi.fn()} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "false");
  });

  it("renders checkbox checked for checked items", () => {
    const item = createMockItem({ status: "checked" });
    render(<ListItem item={item} onToggle={vi.fn()} onDelete={vi.fn()} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("calls onToggle when checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const item = createMockItem();
    render(<ListItem item={item} onToggle={onToggle} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("applies strikethrough style to checked items", () => {
    const item = createMockItem({
      status: "checked",
      display_name: "Done Item",
    });
    render(<ListItem item={item} onToggle={vi.fn()} onDelete={vi.fn()} />);

    const itemName = screen.getByText("Done Item");
    expect(itemName).toHaveClass("line-through");
  });

  it("does not apply strikethrough to pending items", () => {
    const item = createMockItem({
      status: "pending",
      display_name: "Pending Item",
    });
    render(<ListItem item={item} onToggle={vi.fn()} onDelete={vi.fn()} />);

    const itemName = screen.getByText("Pending Item");
    expect(itemName).not.toHaveClass("line-through");
  });

  it("opens actions menu and shows delete option", async () => {
    const user = userEvent.setup();
    const item = createMockItem();
    render(<ListItem item={item} onToggle={vi.fn()} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /item actions/i }));
    expect(
      screen.getByRole("menuitem", { name: /delete/i })
    ).toBeInTheDocument();
  });

  it("calls onDelete when delete action is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const item = createMockItem();
    render(<ListItem item={item} onToggle={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: /item actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

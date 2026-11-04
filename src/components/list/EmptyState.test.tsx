import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Store } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders default title", () => {
    render(<EmptyState />);
    expect(screen.getByText("Your list is empty")).toBeInTheDocument();
  });

  it("renders default description", () => {
    render(<EmptyState />);
    expect(
      screen.getByText("Add your first item using the input above")
    ).toBeInTheDocument();
  });

  it("renders custom title", () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("renders custom description", () => {
    render(<EmptyState description="Try adding something" />);
    expect(screen.getByText("Try adding something")).toBeInTheDocument();
  });

  it("renders shopping cart icon by default", () => {
    render(<EmptyState />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders custom icon", () => {
    render(<EmptyState icon={Store} />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders action button when actionLabel and onAction provided", () => {
    const handleAction = vi.fn();
    render(<EmptyState actionLabel="Add Item" onAction={handleAction} />);
    expect(
      screen.getByRole("button", { name: "Add Item" })
    ).toBeInTheDocument();
  });

  it("does not render action button when only actionLabel provided", () => {
    render(<EmptyState actionLabel="Add Item" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not render action button when only onAction provided", () => {
    render(<EmptyState onAction={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onAction when button clicked", async () => {
    const user = userEvent.setup();
    const handleAction = vi.fn();
    render(<EmptyState actionLabel="Add Item" onAction={handleAction} />);

    await user.click(screen.getByRole("button", { name: "Add Item" }));

    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it("has accessible icon container", () => {
    render(<EmptyState />);
    const iconContainer = document
      .querySelector("svg")
      ?.closest('[aria-hidden="true"]');
    expect(iconContainer).toBeInTheDocument();
  });
});

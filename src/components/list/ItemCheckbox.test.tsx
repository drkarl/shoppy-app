import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ItemCheckbox } from "./ItemCheckbox";

describe("ItemCheckbox", () => {
  it("renders as unchecked when checked is false", () => {
    render(<ItemCheckbox checked={false} onToggle={vi.fn()} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "false");
  });

  it("renders as checked when checked is true", () => {
    render(<ItemCheckbox checked={true} onToggle={vi.fn()} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("calls onToggle when clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ItemCheckbox checked={false} onToggle={onToggle} />);

    await user.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    render(<ItemCheckbox checked={false} onToggle={vi.fn()} disabled />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
  });

  it("does not call onToggle when disabled and clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ItemCheckbox checked={false} onToggle={onToggle} disabled />);

    await user.click(screen.getByRole("checkbox"));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("shows check icon when checked", () => {
    render(<ItemCheckbox checked={true} onToggle={vi.fn()} />);

    // The Check icon from lucide renders an SVG
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.querySelector("svg")).toBeInTheDocument();
  });

  it("does not show check icon when unchecked", () => {
    render(<ItemCheckbox checked={false} onToggle={vi.fn()} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.querySelector("svg")).not.toBeInTheDocument();
  });
});

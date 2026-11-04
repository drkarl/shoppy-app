import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyStoreState } from "./EmptyStoreState";

describe("EmptyStoreState", () => {
  it("renders title", () => {
    render(<EmptyStoreState onAddStore={() => {}} />);
    expect(screen.getByText("No Store Profiles")).toBeInTheDocument();
  });

  it("renders description with encouraging message", () => {
    render(<EmptyStoreState onAddStore={() => {}} />);
    expect(
      screen.getByText(/Set up your first store to optimize shopping/)
    ).toBeInTheDocument();
  });

  it("renders store icon", () => {
    render(<EmptyStoreState onAddStore={() => {}} />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders add store button", () => {
    render(<EmptyStoreState onAddStore={() => {}} />);
    expect(
      screen.getByRole("button", { name: /Add Your First Store/i })
    ).toBeInTheDocument();
  });

  it("calls onAddStore when button clicked", async () => {
    const user = userEvent.setup();
    const handleAddStore = vi.fn();
    render(<EmptyStoreState onAddStore={handleAddStore} />);

    await user.click(
      screen.getByRole("button", { name: /Add Your First Store/i })
    );

    expect(handleAddStore).toHaveBeenCalledTimes(1);
  });

  it("has accessible icon container", () => {
    render(<EmptyStoreState onAddStore={() => {}} />);
    const iconContainer = document
      .querySelector("svg")
      ?.closest('[aria-hidden="true"]');
    expect(iconContainer).toBeInTheDocument();
  });
});

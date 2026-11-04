import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders the correct item count", () => {
    render(<ProgressBar checked={3} total={10} />);

    expect(screen.getByText("3 of 10 items")).toBeInTheDocument();
  });

  it("renders 0 of 0 items when no items", () => {
    render(<ProgressBar checked={0} total={0} />);

    expect(screen.getByText("0 of 0 items")).toBeInTheDocument();
  });

  it("shows Complete! when all items are checked", () => {
    render(<ProgressBar checked={5} total={5} />);

    expect(screen.getByText("Complete!")).toBeInTheDocument();
  });

  it("does not show Complete! when items remain", () => {
    render(<ProgressBar checked={4} total={5} />);

    expect(screen.queryByText("Complete!")).not.toBeInTheDocument();
  });

  it("does not show Complete! when total is 0", () => {
    render(<ProgressBar checked={0} total={0} />);

    expect(screen.queryByText("Complete!")).not.toBeInTheDocument();
  });

  it("has correct aria attributes on progress bar", () => {
    render(<ProgressBar checked={3} total={10} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "3");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-valuemax", "10");
  });

  it("has correct aria-label", () => {
    render(<ProgressBar checked={3} total={10} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-label", "3 of 10 items checked");
  });

  it("calculates correct percentage for width", () => {
    render(<ProgressBar checked={5} total={10} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveStyle({ width: "50%" });
  });

  it("handles edge case of 0 total gracefully", () => {
    render(<ProgressBar checked={0} total={0} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveStyle({ width: "0%" });
  });

  it("applies custom className", () => {
    const { container } = render(
      <ProgressBar checked={3} total={10} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});

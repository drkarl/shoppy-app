import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders a div element", () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("applies default classes", () => {
    render(<Skeleton data-testid="skeleton" />);
    const element = screen.getByTestId("skeleton");
    expect(element).toHaveClass("animate-pulse", "rounded-md", "bg-muted");
  });

  it("merges custom className", () => {
    render(<Skeleton data-testid="skeleton" className="h-4 w-20" />);
    const element = screen.getByTestId("skeleton");
    expect(element).toHaveClass("animate-pulse", "h-4", "w-20");
  });

  it("passes through additional props", () => {
    render(
      <Skeleton
        data-testid="skeleton"
        aria-label="Loading content"
        role="img"
      />
    );
    const element = screen.getByTestId("skeleton");
    expect(element).toHaveAttribute("aria-label", "Loading content");
    expect(element).toHaveAttribute("role", "img");
  });
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ProgressBarSkeleton,
  ShoppingGroupSkeleton,
  ShoppingItemSkeleton,
  ShoppingModeSkeleton,
} from "./ShoppingModeSkeleton";

describe("ShoppingItemSkeleton", () => {
  it("renders large tap-target checkbox skeleton", () => {
    const { container } = render(<ShoppingItemSkeleton />);
    // Look for 11x11 (h-11 w-11) skeleton for checkbox
    const checkbox = container.querySelector(".h-11.w-11");
    expect(checkbox).toBeInTheDocument();
  });

  it("renders item name skeleton", () => {
    const { container } = render(<ShoppingItemSkeleton />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });

  it("renders quantity skeleton when showQuantity is true", () => {
    const { container } = render(<ShoppingItemSkeleton showQuantity />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });
});

describe("ShoppingGroupSkeleton", () => {
  it("renders category header with icon, name, count, and chevron", () => {
    const { container } = render(<ShoppingGroupSkeleton itemCount={1} />);
    // Header area should have icon (h-10 w-10), name, count, chevron
    const headerIcon = container.querySelector(".h-10.w-10");
    expect(headerIcon).toBeInTheDocument();
  });

  it("renders correct number of items", () => {
    const { container } = render(<ShoppingGroupSkeleton itemCount={4} />);
    // Each item has rounded-xl bg-card container
    const items = container.querySelectorAll(".rounded-xl.bg-card");
    expect(items.length).toBe(4);
  });

  it("defaults to 3 items", () => {
    const { container } = render(<ShoppingGroupSkeleton />);
    const items = container.querySelectorAll(".rounded-xl.bg-card");
    expect(items.length).toBe(3);
  });
});

describe("ProgressBarSkeleton", () => {
  it("renders text and bar skeletons", () => {
    const { container } = render(<ProgressBarSkeleton />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    // Text skeleton + bar skeleton
    expect(skeletons.length).toBe(2);
  });

  it("renders full-width progress bar", () => {
    const { container } = render(<ProgressBarSkeleton />);
    const bar = container.querySelector(".w-full.rounded-full");
    expect(bar).toBeInTheDocument();
  });
});

describe("ShoppingModeSkeleton", () => {
  it("renders multiple groups by default", () => {
    const { container } = render(<ShoppingModeSkeleton />);
    // Groups have mb-4 class
    const groups = container.querySelectorAll(".mb-4");
    expect(groups.length).toBe(3);
  });

  it("does not render progress bar by default", () => {
    const { container } = render(<ShoppingModeSkeleton />);
    // Progress bar has specific w-24 skeleton for text
    const progressText = container.querySelector(".h-4.w-24");
    expect(progressText).not.toBeInTheDocument();
  });

  it("renders progress bar when showProgressBar is true", () => {
    const { container } = render(<ShoppingModeSkeleton showProgressBar />);
    // Look for progress bar container with specific styling
    const progressWrapper = container.querySelector(".w-full");
    expect(progressWrapper).toBeInTheDocument();
  });

  it("uses custom group count", () => {
    const { container } = render(<ShoppingModeSkeleton groupCount={5} />);
    const groups = container.querySelectorAll(".mb-4");
    expect(groups.length).toBe(5);
  });

  it("uses itemsPerGroup array", () => {
    const { container } = render(
      <ShoppingModeSkeleton groupCount={2} itemsPerGroup={[1, 2]} />
    );
    const groups = container.querySelectorAll(".mb-4");
    expect(groups.length).toBe(2);
  });
});

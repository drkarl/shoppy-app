import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ListSkeleton,
  ListSkeletonGroup,
  ListSkeletonItem,
} from "./ListSkeleton";

describe("ListSkeletonItem", () => {
  it("renders skeleton elements for an item", () => {
    const { container } = render(<ListSkeletonItem />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    // Checkbox, item name, actions = 3 skeletons
    expect(skeletons.length).toBe(3);
  });

  it("renders additional skeleton when showQuantity is true", () => {
    const { container } = render(<ListSkeletonItem showQuantity />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    // Checkbox, item name, quantity, actions = 4 skeletons
    expect(skeletons.length).toBe(4);
  });
});

describe("ListSkeletonGroup", () => {
  it("renders category header skeleton", () => {
    const { container } = render(<ListSkeletonGroup itemCount={1} />);
    // Header: icon, name, count, chevron = 4 skeletons
    // Plus 1 item with 3 skeletons = 7 total
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it("renders correct number of item skeletons", () => {
    const { container } = render(<ListSkeletonGroup itemCount={5} />);
    // Each item has at least 3 skeletons (checkbox, name, actions)
    // Plus header (4 skeletons)
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(4 + 5 * 3);
  });

  it("defaults to 3 items", () => {
    const { container } = render(<ListSkeletonGroup />);
    // Header (4) + 3 items with varying skeletons
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(4 + 3 * 3);
  });
});

describe("ListSkeleton", () => {
  it("renders multiple groups", () => {
    const { container } = render(<ListSkeleton groupCount={3} />);
    // mb-4 class is on each group
    const groups = container.querySelectorAll(".mb-4");
    expect(groups.length).toBe(3);
  });

  it("uses provided itemsPerGroup array", () => {
    const { container } = render(
      <ListSkeleton groupCount={2} itemsPerGroup={[2, 4]} />
    );
    const groups = container.querySelectorAll(".mb-4");
    expect(groups.length).toBe(2);
  });

  it("uses uniform itemsPerGroup number", () => {
    const { container } = render(
      <ListSkeleton groupCount={3} itemsPerGroup={2} />
    );
    const groups = container.querySelectorAll(".mb-4");
    expect(groups.length).toBe(3);
  });

  it("defaults to 3 groups with varying items", () => {
    const { container } = render(<ListSkeleton />);
    const groups = container.querySelectorAll(".mb-4");
    expect(groups.length).toBe(3);
  });

  it("matches list page layout structure", () => {
    const { container } = render(<ListSkeleton />);
    // Should have mb-6 wrapper
    expect(container.querySelector(".mb-6")).toBeInTheDocument();
  });
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  SettingsMenuItemSkeleton,
  SettingsMenuSkeleton,
  StoreProfileCardSkeleton,
  StoreProfilesSkeleton,
} from "./SettingsSkeleton";

describe("SettingsMenuItemSkeleton", () => {
  it("renders icon, title, description, and chevron skeletons", () => {
    const { container } = render(<SettingsMenuItemSkeleton />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    // Icon (rounded-full), title, description, chevron = 4
    expect(skeletons.length).toBe(4);
  });

  it("renders icon with circular shape", () => {
    const { container } = render(<SettingsMenuItemSkeleton />);
    const icon = container.querySelector(".rounded-full");
    expect(icon).toBeInTheDocument();
  });
});

describe("StoreProfileCardSkeleton", () => {
  it("renders within a Card", () => {
    const { container } = render(<StoreProfileCardSkeleton />);
    // Card has rounded-xl border shadow classes
    const card = container.querySelector(".rounded-xl.border");
    expect(card).toBeInTheDocument();
  });

  it("renders store name and description skeletons", () => {
    const { container } = render(<StoreProfileCardSkeleton />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    // Name, description, 3 buttons = 5 skeletons
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it("renders action button skeletons", () => {
    const { container } = render(<StoreProfileCardSkeleton />);
    // Buttons have h-8 and rounded-md
    const buttons = container.querySelectorAll(".h-8.rounded-md");
    expect(buttons.length).toBe(3);
  });
});

describe("StoreProfilesSkeleton", () => {
  it("renders default of 2 store cards", () => {
    const { container } = render(<StoreProfilesSkeleton />);
    // Each card has rounded-xl border
    const cards = container.querySelectorAll(".rounded-xl.border");
    expect(cards.length).toBe(2);
  });

  it("renders custom count of store cards", () => {
    const { container } = render(<StoreProfilesSkeleton count={4} />);
    const cards = container.querySelectorAll(".rounded-xl.border");
    expect(cards.length).toBe(4);
  });

  it("has spacing between cards", () => {
    const { container } = render(<StoreProfilesSkeleton />);
    const wrapper = container.querySelector(".space-y-4");
    expect(wrapper).toBeInTheDocument();
  });
});

describe("SettingsMenuSkeleton", () => {
  it("renders two Card sections", () => {
    const { container } = render(<SettingsMenuSkeleton />);
    const cards = container.querySelectorAll(".rounded-xl.border");
    expect(cards.length).toBe(2);
  });

  it("has spacing between sections", () => {
    const { container } = render(<SettingsMenuSkeleton />);
    const wrapper = container.querySelector(".space-y-6");
    expect(wrapper).toBeInTheDocument();
  });

  it("renders card titles and descriptions", () => {
    const { container } = render(<SettingsMenuSkeleton />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    // Each card has: title, description, menu item (4 skeletons) = 6 per card
    // 2 cards = 12+ skeletons
    expect(skeletons.length).toBeGreaterThanOrEqual(10);
  });
});

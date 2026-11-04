import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the useIsMobile hook - must be before importing the component
vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(),
}));

import { useIsMobile } from "@/hooks/useIsMobile";

import {
  DuplicateWarning,
  type DuplicateWarningProps,
  type ExistingItemData,
  type NewItemData,
} from "./DuplicateWarning";
const mockUseIsMobile = vi.mocked(useIsMobile);

const createMockNewItem = (
  overrides: Partial<NewItemData> = {}
): NewItemData => ({
  displayName: "Milk",
  quantity: 2,
  unit: null,
  ...overrides,
});

const createMockExistingItem = (
  overrides: Partial<ExistingItemData> = {}
): ExistingItemData => ({
  id: "item-1",
  displayName: "Milk",
  quantity: 1,
  unit: null,
  ...overrides,
});

const defaultProps: DuplicateWarningProps = {
  isOpen: true,
  onClose: vi.fn(),
  newItem: createMockNewItem(),
  existingItem: createMockExistingItem(),
  confidence: 0.95,
  onMerge: vi.fn(),
  onAddAnyway: vi.fn(),
};

const renderComponent = (props: Partial<DuplicateWarningProps> = {}) => {
  return render(<DuplicateWarning {...defaultProps} {...props} />);
};

describe("DuplicateWarning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to desktop view
    mockUseIsMobile.mockReturnValue(false);
  });

  describe("rendering", () => {
    it("renders the warning title", () => {
      renderComponent();
      expect(screen.getByText("Possible Duplicate Item")).toBeInTheDocument();
    });

    it("renders the warning description", () => {
      renderComponent();
      expect(
        screen.getByText("This item might already be on your list.")
      ).toBeInTheDocument();
    });

    it("displays the new item name and quantity", () => {
      renderComponent({
        newItem: createMockNewItem({ displayName: "Eggs", quantity: 12 }),
      });

      expect(screen.getByText("Eggs")).toBeInTheDocument();
      expect(screen.getByText("Qty: 12")).toBeInTheDocument();
    });

    it("displays the existing item name and quantity", () => {
      renderComponent({
        newItem: createMockNewItem({ displayName: "Milk", quantity: 1 }),
        existingItem: createMockExistingItem({
          displayName: "Bread",
          quantity: 3,
        }),
      });

      expect(screen.getByText("Bread")).toBeInTheDocument();
      expect(screen.getByText("Qty: 3")).toBeInTheDocument();
    });

    it("displays quantity with unit when unit is provided", () => {
      renderComponent({
        newItem: createMockNewItem({ quantity: 2, unit: "L" }),
        existingItem: createMockExistingItem({ quantity: 1, unit: "L" }),
      });

      expect(screen.getByText("Qty: 2 L")).toBeInTheDocument();
      expect(screen.getByText("Qty: 1 L")).toBeInTheDocument();
    });

    it("shows 'Adding' label for new item", () => {
      renderComponent();
      expect(screen.getByText("Adding")).toBeInTheDocument();
    });

    it("shows 'Already in list' label for existing item", () => {
      renderComponent();
      expect(screen.getByText("Already in list")).toBeInTheDocument();
    });

    it("does not render when isOpen is false", () => {
      renderComponent({ isOpen: false });
      expect(
        screen.queryByText("Possible Duplicate Item")
      ).not.toBeInTheDocument();
    });

    it("does not render during SSR (when isMobile is undefined)", () => {
      mockUseIsMobile.mockReturnValue(undefined);
      renderComponent();
      expect(
        screen.queryByText("Possible Duplicate Item")
      ).not.toBeInTheDocument();
    });
  });

  describe("confidence badges", () => {
    it("displays 'High Confidence' badge when confidence >= 0.9", () => {
      renderComponent({ confidence: 0.95 });

      const badge = screen.getByTestId("confidence-badge");
      expect(badge).toHaveTextContent("High Confidence");
    });

    it("displays 'High Confidence' badge when confidence is exactly 0.9", () => {
      renderComponent({ confidence: 0.9 });

      const badge = screen.getByTestId("confidence-badge");
      expect(badge).toHaveTextContent("High Confidence");
    });

    it("displays 'High Confidence' badge when confidence is 1.0 (exact match)", () => {
      renderComponent({ confidence: 1.0 });

      const badge = screen.getByTestId("confidence-badge");
      expect(badge).toHaveTextContent("High Confidence");
    });

    it("displays 'Medium Confidence' badge when confidence is 0.8", () => {
      renderComponent({ confidence: 0.8 });

      const badge = screen.getByTestId("confidence-badge");
      expect(badge).toHaveTextContent("Medium Confidence");
    });

    it("displays 'Medium Confidence' badge when confidence is 0.7", () => {
      renderComponent({ confidence: 0.7 });

      const badge = screen.getByTestId("confidence-badge");
      expect(badge).toHaveTextContent("Medium Confidence");
    });

    it("displays 'Medium Confidence' badge when confidence is 0.89", () => {
      renderComponent({ confidence: 0.89 });

      const badge = screen.getByTestId("confidence-badge");
      expect(badge).toHaveTextContent("Medium Confidence");
    });
  });

  describe("merged quantity preview", () => {
    it("shows correct merged quantity", () => {
      renderComponent({
        newItem: createMockNewItem({ quantity: 2 }),
        existingItem: createMockExistingItem({ quantity: 3 }),
      });

      expect(screen.getByText(/Merged result:/)).toBeInTheDocument();
      expect(screen.getByText(/× 5/)).toBeInTheDocument();
    });

    it("shows merged quantity with unit from existing item", () => {
      renderComponent({
        newItem: createMockNewItem({ quantity: 2, unit: null }),
        existingItem: createMockExistingItem({
          displayName: "Milk",
          quantity: 1,
          unit: "L",
        }),
      });

      expect(screen.getByText(/Milk × 3 L/)).toBeInTheDocument();
    });

    it("shows merged quantity with unit from new item when existing has none", () => {
      renderComponent({
        newItem: createMockNewItem({ quantity: 500, unit: "ml" }),
        existingItem: createMockExistingItem({
          displayName: "Water",
          quantity: 250,
          unit: null,
        }),
      });

      expect(screen.getByText(/Water × 750 ml/)).toBeInTheDocument();
    });

    it("shows merged quantity with existing unit when units differ", () => {
      renderComponent({
        newItem: createMockNewItem({ quantity: 2, unit: "kg" }),
        existingItem: createMockExistingItem({
          displayName: "Flour",
          quantity: 1,
          unit: "lb",
        }),
      });

      // Existing item unit takes precedence
      expect(screen.getByText(/Flour × 3 lb/)).toBeInTheDocument();
    });
  });

  describe("actions", () => {
    it("renders 'Merge Quantities' button", () => {
      renderComponent();
      expect(
        screen.getByRole("button", { name: /merge quantities/i })
      ).toBeInTheDocument();
    });

    it("renders 'Add Anyway' button", () => {
      renderComponent();
      expect(
        screen.getByRole("button", { name: /add anyway/i })
      ).toBeInTheDocument();
    });

    it("calls onMerge and onClose when 'Merge Quantities' is clicked", async () => {
      const user = userEvent.setup();
      const onMerge = vi.fn();
      const onClose = vi.fn();
      renderComponent({ onMerge, onClose });

      await user.click(
        screen.getByRole("button", { name: /merge quantities/i })
      );

      expect(onMerge).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onAddAnyway and onClose when 'Add Anyway' is clicked", async () => {
      const user = userEvent.setup();
      const onAddAnyway = vi.fn();
      const onClose = vi.fn();
      renderComponent({ onAddAnyway, onClose });

      await user.click(screen.getByRole("button", { name: /add anyway/i }));

      expect(onAddAnyway).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("close behavior", () => {
    it("calls onClose when Escape key is pressed", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderComponent({ onClose });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it("calls onClose when clicking outside (overlay) in desktop mode", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      mockUseIsMobile.mockReturnValue(false);
      renderComponent({ onClose });

      // Click the overlay (the dark background)
      const overlay = document.querySelector('[data-state="open"]');
      if (overlay) {
        await user.click(overlay);
      }

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe("responsive behavior", () => {
    it("renders as Dialog on desktop", () => {
      mockUseIsMobile.mockReturnValue(false);
      renderComponent();

      // Dialog content should have specific positioning classes
      const dialogContent = screen.getByRole("dialog");
      expect(dialogContent).toBeInTheDocument();
    });

    it("renders as Sheet (bottom drawer) on mobile", () => {
      mockUseIsMobile.mockReturnValue(true);
      renderComponent();

      // Sheet content should still have dialog role from Radix
      const sheetContent = screen.getByRole("dialog");
      expect(sheetContent).toBeInTheDocument();
      // Sheet has rounded top corners
      expect(sheetContent).toHaveClass("rounded-t-xl");
    });

    it("shows both action buttons on mobile", () => {
      mockUseIsMobile.mockReturnValue(true);
      renderComponent();

      expect(
        screen.getByRole("button", { name: /merge quantities/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add anyway/i })
      ).toBeInTheDocument();
    });

    it("shows both action buttons on desktop", () => {
      mockUseIsMobile.mockReturnValue(false);
      renderComponent();

      expect(
        screen.getByRole("button", { name: /merge quantities/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add anyway/i })
      ).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has accessible dialog role", () => {
      renderComponent();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has accessible title", () => {
      renderComponent();
      expect(
        screen.getByRole("heading", { name: "Possible Duplicate Item" })
      ).toBeInTheDocument();
    });

    it("has accessible description", () => {
      renderComponent();
      const description = screen.getByText(
        "This item might already be on your list."
      );
      expect(description).toHaveAttribute(
        "id",
        "duplicate-warning-description"
      );
    });

    it("has close button with screen reader text", () => {
      renderComponent();
      expect(
        screen.getByRole("button", { name: /close/i })
      ).toBeInTheDocument();
    });

    it("action buttons are focusable", () => {
      renderComponent();

      const mergeButton = screen.getByRole("button", {
        name: /merge quantities/i,
      });
      const addAnywayButton = screen.getByRole("button", {
        name: /add anyway/i,
      });

      expect(mergeButton).not.toHaveAttribute("disabled");
      expect(addAnywayButton).not.toHaveAttribute("disabled");
    });

    it("supports keyboard navigation between buttons", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Tab to first interactive element
      await user.tab();
      // Continue tabbing - should be able to reach action buttons
      await user.tab();
      await user.tab();

      // At least one of the action buttons should be focused
      const mergeButton = screen.getByRole("button", {
        name: /merge quantities/i,
      });
      const addAnywayButton = screen.getByRole("button", {
        name: /add anyway/i,
      });

      const focusedElement = document.activeElement;
      const isActionButtonFocused =
        focusedElement === mergeButton || focusedElement === addAnywayButton;

      // This test verifies keyboard navigation is possible
      expect(focusedElement).not.toBe(document.body);
      expect(
        isActionButtonFocused || focusedElement?.tagName === "BUTTON"
      ).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles zero quantity in new item", () => {
      renderComponent({
        newItem: createMockNewItem({ quantity: 0 }),
        existingItem: createMockExistingItem({ quantity: 5 }),
      });

      expect(screen.getByText("Qty: 0")).toBeInTheDocument();
      expect(screen.getByText(/× 5/)).toBeInTheDocument(); // Merged = 5 + 0
    });

    it("handles large quantities", () => {
      renderComponent({
        newItem: createMockNewItem({ quantity: 1000 }),
        existingItem: createMockExistingItem({ quantity: 500 }),
      });

      expect(screen.getByText("Qty: 1000")).toBeInTheDocument();
      expect(screen.getByText(/× 1500/)).toBeInTheDocument();
    });

    it("handles special characters in item names", () => {
      renderComponent({
        newItem: createMockNewItem({ displayName: "Ben & Jerry's Ice Cream" }),
        existingItem: createMockExistingItem({
          displayName: "Ben & Jerry's Ice Cream",
        }),
      });

      const itemNames = screen.getAllByText("Ben & Jerry's Ice Cream");
      expect(itemNames.length).toBeGreaterThanOrEqual(2);
    });

    it("handles unicode characters in item names", () => {
      renderComponent({
        newItem: createMockNewItem({ displayName: "Leche 🥛" }),
        existingItem: createMockExistingItem({ displayName: "Leche 🥛" }),
      });

      const itemNames = screen.getAllByText("Leche 🥛");
      expect(itemNames.length).toBeGreaterThanOrEqual(2);
    });
  });
});

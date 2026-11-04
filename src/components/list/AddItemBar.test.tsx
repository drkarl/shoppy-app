import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CATEGORY_IDS } from "@/lib/matching/dictionary";

import { AddItemBar } from "./AddItemBar";

import type { ListItem } from "@/types/list";

// Mock useIsMobile for DuplicateWarning to render properly
// Tests assume desktop viewport; for mobile Sheet behavior, mock useIsMobile(() => true)
vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

const createMockListItem = (overrides: Partial<ListItem> = {}): ListItem => ({
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

describe("AddItemBar", () => {
  describe("basic functionality", () => {
    it("renders input and submit button", () => {
      const onAddItem = vi.fn().mockResolvedValue(true);
      render(<AddItemBar onAddItem={onAddItem} />);

      expect(
        screen.getByRole("textbox", { name: /add item/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add item/i })
      ).toBeInTheDocument();
    });

    it("submits item on Enter key press", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      render(<AddItemBar onAddItem={onAddItem} />);

      const input = screen.getByRole("textbox", { name: /add item/i });
      await user.type(input, "milk{Enter}");

      expect(onAddItem).toHaveBeenCalledWith("milk", 1, undefined);
    });

    it("parses quantity from input like 'milk 2'", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      render(<AddItemBar onAddItem={onAddItem} />);

      const input = screen.getByRole("textbox", { name: /add item/i });
      await user.type(input, "milk 2{Enter}");

      expect(onAddItem).toHaveBeenCalledWith("milk", 2, undefined);
    });

    it("parses quantity from input like '3 eggs'", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      render(<AddItemBar onAddItem={onAddItem} />);

      const input = screen.getByRole("textbox", { name: /add item/i });
      await user.type(input, "3 eggs{Enter}");

      expect(onAddItem).toHaveBeenCalledWith("eggs", 3, undefined);
    });

    it("clears input after successful submission", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      render(<AddItemBar onAddItem={onAddItem} />);

      const input = screen.getByRole("textbox", { name: /add item/i });
      await user.type(input, "milk{Enter}");

      expect(input).toHaveValue("");
    });

    it("does not clear input on failed submission", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(false);
      render(<AddItemBar onAddItem={onAddItem} />);

      const input = screen.getByRole("textbox", { name: /add item/i });
      await user.type(input, "milk{Enter}");

      expect(input).toHaveValue("milk");
    });

    it("does not submit empty input", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      render(<AddItemBar onAddItem={onAddItem} />);

      const input = screen.getByRole("textbox", { name: /add item/i });
      await user.type(input, "{Enter}");

      expect(onAddItem).not.toHaveBeenCalled();
    });

    it("does not submit whitespace-only input", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      render(<AddItemBar onAddItem={onAddItem} />);

      const input = screen.getByRole("textbox", { name: /add item/i });
      await user.type(input, "   {Enter}");

      expect(onAddItem).not.toHaveBeenCalled();
    });

    it("disables input when disabled prop is true", () => {
      const onAddItem = vi.fn().mockResolvedValue(true);
      render(<AddItemBar onAddItem={onAddItem} disabled />);

      expect(screen.getByRole("textbox", { name: /add item/i })).toBeDisabled();
    });

    it("submits on button click", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      render(<AddItemBar onAddItem={onAddItem} />);

      const input = screen.getByRole("textbox", { name: /add item/i });
      const button = screen.getByRole("button", { name: /add item/i });

      await user.type(input, "bread");
      await user.click(button);

      expect(onAddItem).toHaveBeenCalledWith("bread", 1, undefined);
    });

    it("shows spinner in button during loading state", async () => {
      const user = userEvent.setup();
      // Create a promise that we can control
      let resolveAdd: (value: boolean) => void;
      const onAddItem = vi.fn().mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveAdd = resolve;
          })
      );
      render(<AddItemBar onAddItem={onAddItem} />);

      const input = screen.getByRole("textbox", { name: /add item/i });
      await user.type(input, "milk");
      await user.click(screen.getByRole("button", { name: /add item/i }));

      // Button should now show loading state
      expect(
        screen.getByRole("button", { name: /adding item/i })
      ).toBeInTheDocument();

      // Resolve the promise
      resolveAdd!(true);

      // After resolution, button should return to normal
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /add item/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe("duplicate detection", () => {
    const activeItems = [
      createMockListItem({ id: "1", display_name: "Milk", quantity: 1 }),
      createMockListItem({ id: "2", display_name: "Bread", quantity: 2 }),
    ];

    it("shows warning badge when duplicate is detected", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      render(<AddItemBar onAddItem={onAddItem} activeItems={activeItems} />);

      const input = screen.getByRole("textbox", { name: /add item/i });

      // Type "milk" - exact match
      await user.type(input, "milk");

      // Wait for debounce (300ms)
      await waitFor(
        () => {
          expect(screen.getByTitle("Possible duplicate")).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it("shows category suggestion chip when dictionary match found", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      render(<AddItemBar onAddItem={onAddItem} activeItems={[]} />);

      const input = screen.getByRole("textbox", { name: /add item/i });

      await user.type(input, "milk");

      await waitFor(
        () => {
          expect(
            screen.getByText(/Suggested category: Dairy/i)
          ).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it("opens DuplicateWarning sheet when submitting with detected duplicate", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      const onMergeItem = vi.fn().mockResolvedValue(true);

      render(
        <AddItemBar
          onAddItem={onAddItem}
          onMergeItem={onMergeItem}
          activeItems={activeItems}
        />
      );

      const input = screen.getByRole("textbox", { name: /add item/i });

      await user.type(input, "milk");

      // Wait for duplicate detection
      await waitFor(
        () => {
          expect(screen.getByTitle("Possible duplicate")).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Submit the form
      const button = screen.getByRole("button", { name: /add item/i });
      await user.click(button);

      // DuplicateWarning should be shown
      await waitFor(() => {
        expect(screen.getByText("Possible Duplicate Item")).toBeInTheDocument();
      });

      // onAddItem should NOT have been called yet
      expect(onAddItem).not.toHaveBeenCalled();
    });

    it("calls onMergeItem when Merge Quantities is clicked", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      const onMergeItem = vi.fn().mockResolvedValue(true);

      render(
        <AddItemBar
          onAddItem={onAddItem}
          onMergeItem={onMergeItem}
          activeItems={activeItems}
        />
      );

      const input = screen.getByRole("textbox", { name: /add item/i });

      // Type and wait for debounce
      await user.type(input, "milk 2");

      // Wait for duplicate detection
      await waitFor(
        () => {
          expect(screen.getByTitle("Possible duplicate")).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Submit to open warning
      const button = screen.getByRole("button", { name: /add item/i });
      await user.click(button);

      // Wait for DuplicateWarning to appear
      await waitFor(() => {
        expect(screen.getByText("Possible Duplicate Item")).toBeInTheDocument();
      });

      // Click Merge Quantities
      await user.click(
        screen.getByRole("button", { name: /merge quantities/i })
      );

      expect(onMergeItem).toHaveBeenCalledWith("1", 2);
      expect(onAddItem).not.toHaveBeenCalled();
    });

    it("calls onAddItem when Add Anyway is clicked", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      const onMergeItem = vi.fn().mockResolvedValue(true);

      render(
        <AddItemBar
          onAddItem={onAddItem}
          onMergeItem={onMergeItem}
          activeItems={activeItems}
        />
      );

      const input = screen.getByRole("textbox", { name: /add item/i });

      // Type and wait for debounce
      await user.type(input, "milk");

      // Wait for duplicate detection
      await waitFor(
        () => {
          expect(screen.getByTitle("Possible duplicate")).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Submit to open warning
      const button = screen.getByRole("button", { name: /add item/i });
      await user.click(button);

      // Wait for DuplicateWarning to appear
      await waitFor(() => {
        expect(screen.getByText("Possible Duplicate Item")).toBeInTheDocument();
      });

      // Click Add Anyway
      await user.click(screen.getByRole("button", { name: /add anyway/i }));

      expect(onAddItem).toHaveBeenCalledWith("milk", 1, CATEGORY_IDS.DAIRY);
      expect(onMergeItem).not.toHaveBeenCalled();
    });

    it("adds item directly without warning when no onMergeItem handler provided", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);

      render(<AddItemBar onAddItem={onAddItem} activeItems={activeItems} />);

      const input = screen.getByRole("textbox", { name: /add item/i });

      // Type and wait for debounce
      await user.type(input, "milk");

      // Wait for duplicate detection
      await waitFor(
        () => {
          expect(screen.getByTitle("Possible duplicate")).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Submit - should add directly without warning
      const button = screen.getByRole("button", { name: /add item/i });
      await user.click(button);

      // DuplicateWarning should NOT be shown
      expect(
        screen.queryByText("Possible Duplicate Item")
      ).not.toBeInTheDocument();

      // onAddItem should have been called with category
      expect(onAddItem).toHaveBeenCalledWith("milk", 1, CATEGORY_IDS.DAIRY);
    });

    it("clears input and result after successful merge", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      const onMergeItem = vi.fn().mockResolvedValue(true);

      render(
        <AddItemBar
          onAddItem={onAddItem}
          onMergeItem={onMergeItem}
          activeItems={activeItems}
        />
      );

      const input = screen.getByRole("textbox", { name: /add item/i });

      await user.type(input, "milk");

      await waitFor(
        () => {
          expect(screen.getByTitle("Possible duplicate")).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      const button = screen.getByRole("button", { name: /add item/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Possible Duplicate Item")).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /merge quantities/i })
      );

      // Input should be cleared
      await waitFor(() => {
        expect(input).toHaveValue("");
      });
    });

    it("closes warning dialog when Escape is pressed", async () => {
      const user = userEvent.setup();
      const onAddItem = vi.fn().mockResolvedValue(true);
      const onMergeItem = vi.fn().mockResolvedValue(true);

      render(
        <AddItemBar
          onAddItem={onAddItem}
          onMergeItem={onMergeItem}
          activeItems={activeItems}
        />
      );

      const input = screen.getByRole("textbox", { name: /add item/i });

      await user.type(input, "milk");

      await waitFor(
        () => {
          expect(screen.getByTitle("Possible duplicate")).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      const button = screen.getByRole("button", { name: /add item/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Possible Duplicate Item")).toBeInTheDocument();
      });

      // Close with Escape key
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(
          screen.queryByText("Possible Duplicate Item")
        ).not.toBeInTheDocument();
      });

      // Neither handler should have been called
      expect(onAddItem).not.toHaveBeenCalled();
      expect(onMergeItem).not.toHaveBeenCalled();
    });
  });
});

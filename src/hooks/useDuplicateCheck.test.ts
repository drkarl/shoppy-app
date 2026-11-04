import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CATEGORY_IDS } from "@/lib/matching/dictionary";
import {
  checkForDuplicate,
  type ActiveItem,
} from "@/lib/matching/DuplicateDetector";

import { getCategoryName, useDuplicateCheck } from "./useDuplicateCheck";

// Mock the checkForDuplicate function
vi.mock("@/lib/matching/DuplicateDetector", async () => {
  const actual = await vi.importActual("@/lib/matching/DuplicateDetector");
  return {
    ...actual,
    checkForDuplicate: vi.fn(),
  };
});

const mockCheckForDuplicate = vi.mocked(checkForDuplicate);

describe("getCategoryName", () => {
  it("returns category name for valid category ID", () => {
    expect(getCategoryName(CATEGORY_IDS.DAIRY)).toBe("Dairy");
    expect(getCategoryName(CATEGORY_IDS.PRODUCE)).toBe("Produce");
    expect(getCategoryName(CATEGORY_IDS.MEAT_FISH)).toBe("Meat & Fish");
  });

  it("returns null for null input", () => {
    expect(getCategoryName(null)).toBeNull();
  });

  it("returns null for invalid category ID", () => {
    // @ts-expect-error testing invalid input
    expect(getCategoryName("invalid-id")).toBeNull();
  });
});

describe("useDuplicateCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCheckForDuplicate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const activeItems: ActiveItem[] = [
    { id: "1", display_name: "Milk" },
    { id: "2", display_name: "Bread" },
  ];

  it("returns null result initially", () => {
    const { result } = renderHook(() =>
      useDuplicateCheck("", activeItems, 300)
    );

    expect(result.current.result).toBeNull();
    expect(result.current.isChecking).toBe(false);
    expect(result.current.suggestedCategoryName).toBeNull();
  });

  it("debounces duplicate check by 300ms", () => {
    mockCheckForDuplicate.mockReturnValue({
      parsed: { quantity: 1, unit: null, text: "mil", original: "mil" },
      duplicate: {
        found: true,
        matchedItem: { id: "1", display_name: "Milk" },
        confidence: 1.0,
        matchType: "exact",
      },
      suggestedCategoryId: CATEGORY_IDS.DAIRY,
    });

    const { result, rerender } = renderHook(
      ({ input }) => useDuplicateCheck(input, activeItems, 300),
      { initialProps: { input: "" } }
    );

    // Type "mil"
    rerender({ input: "mil" });
    expect(result.current.isChecking).toBe(true);
    expect(mockCheckForDuplicate).not.toHaveBeenCalled();

    // Wait 200ms - should not have called yet
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(mockCheckForDuplicate).not.toHaveBeenCalled();

    // Wait another 100ms (total 300ms) - should have called
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(mockCheckForDuplicate).toHaveBeenCalledWith("mil", activeItems);
    expect(result.current.isChecking).toBe(false);
    expect(result.current.result?.duplicate.found).toBe(true);
  });

  it("only executes final debounced check when typing fast", () => {
    mockCheckForDuplicate.mockReturnValue({
      parsed: { quantity: 1, unit: null, text: "milk", original: "milk" },
      duplicate: { found: false },
      suggestedCategoryId: CATEGORY_IDS.DAIRY,
    });

    const { rerender } = renderHook(
      ({ input }) => useDuplicateCheck(input, activeItems, 300),
      { initialProps: { input: "" } }
    );

    // Type rapidly: "m", "mi", "mil", "milk"
    rerender({ input: "m" });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ input: "mi" });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ input: "mil" });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ input: "milk" });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Only the final "milk" should have triggered a check
    expect(mockCheckForDuplicate).toHaveBeenCalledTimes(1);
    expect(mockCheckForDuplicate).toHaveBeenCalledWith("milk", activeItems);
  });

  it("returns duplicate match when found", () => {
    const duplicateResult = {
      parsed: { quantity: 1, unit: null, text: "milk", original: "milk" },
      duplicate: {
        found: true as const,
        matchedItem: { id: "1", display_name: "Milk" },
        confidence: 1.0,
        matchType: "exact" as const,
      },
      suggestedCategoryId: CATEGORY_IDS.DAIRY,
    };

    mockCheckForDuplicate.mockReturnValue(duplicateResult);

    const { result, rerender } = renderHook(
      ({ input }) => useDuplicateCheck(input, activeItems, 300),
      { initialProps: { input: "" } }
    );

    rerender({ input: "milk" });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.result).toEqual(duplicateResult);
    expect(result.current.isChecking).toBe(false);
  });

  it("returns suggested category name from dictionary lookup", () => {
    mockCheckForDuplicate.mockReturnValue({
      parsed: { quantity: 1, unit: null, text: "milk", original: "milk" },
      duplicate: { found: false },
      suggestedCategoryId: CATEGORY_IDS.DAIRY,
    });

    const { result, rerender } = renderHook(
      ({ input }) => useDuplicateCheck(input, activeItems, 300),
      { initialProps: { input: "" } }
    );

    rerender({ input: "milk" });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.suggestedCategoryName).toBe("Dairy");
  });

  it("clears result when input becomes empty", () => {
    mockCheckForDuplicate.mockReturnValue({
      parsed: { quantity: 1, unit: null, text: "milk", original: "milk" },
      duplicate: { found: false },
      suggestedCategoryId: CATEGORY_IDS.DAIRY,
    });

    const { result, rerender } = renderHook(
      ({ input }) => useDuplicateCheck(input, activeItems, 300),
      { initialProps: { input: "milk" } }
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.result).not.toBeNull();

    // Clear input
    rerender({ input: "" });

    expect(result.current.result).toBeNull();
    expect(result.current.isChecking).toBe(false);
  });

  it("clearResult function clears the result", () => {
    mockCheckForDuplicate.mockReturnValue({
      parsed: { quantity: 1, unit: null, text: "milk", original: "milk" },
      duplicate: { found: false },
      suggestedCategoryId: CATEGORY_IDS.DAIRY,
    });

    const { result } = renderHook(
      ({ input }) => useDuplicateCheck(input, activeItems, 300),
      { initialProps: { input: "milk" } }
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.result).not.toBeNull();

    // Call clearResult
    act(() => {
      result.current.clearResult();
    });

    expect(result.current.result).toBeNull();
  });

  it("handles whitespace-only input", () => {
    const { result, rerender } = renderHook(
      ({ input }) => useDuplicateCheck(input, activeItems, 300),
      { initialProps: { input: "" } }
    );

    rerender({ input: "   " });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.result).toBeNull();
    expect(mockCheckForDuplicate).not.toHaveBeenCalled();
  });

  it("cancels pending check on unmount", () => {
    mockCheckForDuplicate.mockReturnValue({
      parsed: { quantity: 1, unit: null, text: "milk", original: "milk" },
      duplicate: { found: false },
      suggestedCategoryId: null,
    });

    const { unmount } = renderHook(
      ({ input }) => useDuplicateCheck(input, activeItems, 300),
      { initialProps: { input: "milk" } }
    );

    // Don't wait for debounce
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Unmount before debounce completes
    unmount();

    // Advance past debounce time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // checkForDuplicate should not have been called
    expect(mockCheckForDuplicate).not.toHaveBeenCalled();
  });

  it("uses custom debounce time", () => {
    mockCheckForDuplicate.mockReturnValue({
      parsed: { quantity: 1, unit: null, text: "test", original: "test" },
      duplicate: { found: false },
      suggestedCategoryId: null,
    });

    const { rerender } = renderHook(
      ({ input }) => useDuplicateCheck(input, activeItems, 500),
      { initialProps: { input: "" } }
    );

    rerender({ input: "test" });

    // Wait 400ms - should not have called yet
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(mockCheckForDuplicate).not.toHaveBeenCalled();

    // Wait another 100ms (total 500ms) - should have called
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(mockCheckForDuplicate).toHaveBeenCalled();
  });
});

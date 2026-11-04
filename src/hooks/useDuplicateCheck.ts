"use client";

import { useCallback, useEffect, useState } from "react";

import { CATEGORY_IDS, type CategoryId } from "@/lib/matching/dictionary";
import {
  checkForDuplicate,
  type ActiveItem,
  type DuplicateCheckResult,
} from "@/lib/matching/DuplicateDetector";

/**
 * Human-readable category names mapped from category IDs.
 */
const CATEGORY_NAMES: Record<CategoryId, string> = {
  [CATEGORY_IDS.PRODUCE]: "Produce",
  [CATEGORY_IDS.MEAT_FISH]: "Meat & Fish",
  [CATEGORY_IDS.DAIRY]: "Dairy",
  [CATEGORY_IDS.BAKERY]: "Bakery",
  [CATEGORY_IDS.PANTRY]: "Pantry",
  [CATEGORY_IDS.FROZEN]: "Frozen",
  [CATEGORY_IDS.SNACKS]: "Snacks",
  [CATEGORY_IDS.DRINKS]: "Drinks",
  [CATEGORY_IDS.BABY]: "Baby",
  [CATEGORY_IDS.HOUSEHOLD]: "Household",
  [CATEGORY_IDS.TOILETRIES]: "Toiletries",
};

/**
 * Gets the human-readable category name for a category ID.
 */
export function getCategoryName(categoryId: CategoryId | null): string | null {
  if (!categoryId) return null;
  return CATEGORY_NAMES[categoryId] ?? null;
}

export interface UseDuplicateCheckResult {
  /** The result of the duplicate check, null if no check has been performed */
  result: DuplicateCheckResult | null;
  /** Whether a duplicate check is currently in progress */
  isChecking: boolean;
  /** Human-readable suggested category name */
  suggestedCategoryName: string | null;
  /** Clear the current result */
  clearResult: () => void;
}

/**
 * Hook that performs debounced duplicate detection as the user types.
 *
 * @param input - The current input text from the user
 * @param activeItems - Array of active items in the shopping list to check against.
 *   **Note:** Callers should memoize this array (e.g., with useMemo) if it's derived
 *   from props or state, to avoid unnecessary re-checks when the reference changes.
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns Object with duplicate check result, loading state, and suggested category
 *
 * @example
 * ```tsx
 * // Memoize activeItems to avoid unnecessary re-checks
 * const duplicateCheckItems = useMemo(
 *   () => items.map(i => ({ id: i.id, display_name: i.display_name })),
 *   [items]
 * );
 *
 * const { result, isChecking, suggestedCategoryName } = useDuplicateCheck(
 *   input,
 *   duplicateCheckItems
 * );
 *
 * // Show warning if duplicate found
 * if (result?.duplicate.found) {
 *   console.log("Duplicate detected:", result.duplicate.matchedItem);
 * }
 *
 * // Show category suggestion
 * if (suggestedCategoryName) {
 *   console.log("Suggested category:", suggestedCategoryName);
 * }
 * ```
 */
export function useDuplicateCheck(
  input: string,
  activeItems: ActiveItem[],
  debounceMs: number = 300
): UseDuplicateCheckResult {
  // Store the result along with what input it corresponds to
  const [checkState, setCheckState] = useState<{
    result: DuplicateCheckResult | null;
    checkedInput: string;
  }>({ result: null, checkedInput: "" });

  const trimmedInput = input.trim();
  const hasInput = trimmedInput.length > 0;

  const clearResult = useCallback(() => {
    setCheckState({ result: null, checkedInput: "" });
  }, []);

  // Run the debounced check
  useEffect(() => {
    // Skip if input is empty
    if (!hasInput) {
      return;
    }

    // Skip if we already checked this input
    if (trimmedInput === checkState.checkedInput) {
      return;
    }

    const timer = setTimeout(() => {
      const checkResult = checkForDuplicate(trimmedInput, activeItems);
      setCheckState({ result: checkResult, checkedInput: trimmedInput });
    }, debounceMs);

    // Cleanup on unmount or when dependencies change
    return () => {
      clearTimeout(timer);
    };
  }, [
    trimmedInput,
    hasInput,
    activeItems,
    debounceMs,
    checkState.checkedInput,
  ]);

  // Derive isChecking: we have input, but it hasn't been checked yet
  const isChecking = hasInput && trimmedInput !== checkState.checkedInput;

  // When input is empty, return null result
  const derivedResult = hasInput ? checkState.result : null;

  // Only show result if it matches current input
  const matchedResult =
    derivedResult && checkState.checkedInput === trimmedInput
      ? derivedResult
      : null;

  // Derive the suggested category name from the result
  const suggestedCategoryName = matchedResult?.suggestedCategoryId
    ? getCategoryName(matchedResult.suggestedCategoryId)
    : null;

  return {
    result: matchedResult,
    isChecking,
    suggestedCategoryName,
    clearResult,
  };
}

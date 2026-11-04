"use client";

import { AlertTriangle, Loader2, Plus, Tag } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import { cn } from "@/lib/utils";

import {
  DuplicateWarning,
  type ExistingItemData,
  type NewItemData,
} from "./DuplicateWarning";

import type {
  ActiveItem,
  DuplicateMatch,
} from "@/lib/matching/DuplicateDetector";
import type { ListItem } from "@/types/list";

interface AddItemBarProps {
  onAddItem: (
    displayName: string,
    quantity: number,
    categoryId?: string
  ) => Promise<boolean>;
  onMergeItem?: (targetItemId: string, quantity: number) => Promise<boolean>;
  activeItems?: ListItem[];
  disabled?: boolean;
  className?: string;
}

function parseInput(input: string): { displayName: string; quantity: number } {
  const trimmed = input.trim();

  // Match patterns like "milk 2", "eggs 12", "bread", "2 milk", etc.
  // Pattern: text followed by number at end, or number at start followed by text
  const endNumberMatch = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*$/);
  const startNumberMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);

  if (endNumberMatch) {
    return {
      displayName: endNumberMatch[1].trim(),
      quantity: parseFloat(endNumberMatch[2]),
    };
  }

  if (startNumberMatch) {
    return {
      displayName: startNumberMatch[2].trim(),
      quantity: parseFloat(startNumberMatch[1]),
    };
  }

  return {
    displayName: trimmed,
    quantity: 1,
  };
}

export function AddItemBar({
  onAddItem,
  onMergeItem,
  activeItems = [],
  disabled = false,
  className,
}: AddItemBarProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<{
    newItem: NewItemData;
    existingItem: ExistingItemData;
    confidence: number;
    suggestedCategoryId: string | null;
  } | null>(null);

  // Convert ListItem[] to ActiveItem[] for the duplicate check hook
  const duplicateCheckItems: ActiveItem[] = activeItems.map((item) => ({
    id: item.id,
    display_name: item.display_name,
  }));

  const { result, isChecking, suggestedCategoryName, clearResult } =
    useDuplicateCheck(input, duplicateCheckItems);

  const hasDuplicate = result?.duplicate.found ?? false;
  const duplicateMatch = result?.duplicate.found
    ? (result.duplicate as DuplicateMatch)
    : null;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmed = input.trim();
      if (!trimmed || disabled || isLoading) return;

      const { displayName, quantity } = parseInput(trimmed);

      // If duplicate detected and merge handler is available, show warning
      if (hasDuplicate && duplicateMatch && onMergeItem) {
        // Find the existing item to get its full details
        const existingListItem = activeItems.find(
          (item) => item.id === duplicateMatch.matchedItem.id
        );

        if (existingListItem) {
          setPendingSubmit({
            newItem: {
              displayName,
              quantity,
              unit: result?.parsed.unit ?? null,
            },
            existingItem: {
              id: existingListItem.id,
              displayName: existingListItem.display_name,
              quantity: existingListItem.quantity,
              unit: existingListItem.unit,
            },
            confidence: duplicateMatch.confidence,
            suggestedCategoryId: result?.suggestedCategoryId ?? null,
          });
          setShowDuplicateWarning(true);
          return;
        }
      }

      // No duplicate or no merge handler - add directly
      setIsLoading(true);
      try {
        const success = await onAddItem(
          displayName,
          quantity,
          result?.suggestedCategoryId ?? undefined
        );
        if (success) {
          setInput("");
          clearResult();
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      input,
      disabled,
      isLoading,
      hasDuplicate,
      duplicateMatch,
      onMergeItem,
      activeItems,
      result,
      onAddItem,
      clearResult,
    ]
  );

  const handleMerge = useCallback(async () => {
    if (!pendingSubmit || !onMergeItem) return;

    setIsLoading(true);
    try {
      const success = await onMergeItem(
        pendingSubmit.existingItem.id,
        pendingSubmit.newItem.quantity
      );
      if (success) {
        setInput("");
        clearResult();
      }
    } finally {
      setIsLoading(false);
      setPendingSubmit(null);
    }
  }, [pendingSubmit, onMergeItem, clearResult]);

  const handleAddAnyway = useCallback(async () => {
    if (!pendingSubmit) return;

    setIsLoading(true);
    try {
      const success = await onAddItem(
        pendingSubmit.newItem.displayName,
        pendingSubmit.newItem.quantity,
        pendingSubmit.suggestedCategoryId ?? undefined
      );
      if (success) {
        setInput("");
        clearResult();
      }
    } finally {
      setIsLoading(false);
      setPendingSubmit(null);
    }
  }, [pendingSubmit, onAddItem, clearResult]);

  const handleCloseWarning = useCallback(() => {
    setShowDuplicateWarning(false);
    setPendingSubmit(null);
  }, []);

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className={cn("flex flex-col gap-2", className)}
      >
        {/* Category suggestion chip */}
        {suggestedCategoryName && !isChecking && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Tag className="h-3 w-3" />
            <span>Suggested category: {suggestedCategoryName}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder='Add item (e.g., "milk 2")'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={disabled || isLoading}
              className={cn(
                "w-full pr-8",
                hasDuplicate && !isChecking && "border-yellow-500"
              )}
              aria-label="Add item"
            />
            {/* Duplicate warning badge */}
            {hasDuplicate && !isChecking && (
              <div
                className="absolute inset-y-0 right-2 flex items-center"
                title="Possible duplicate"
              >
                <AlertTriangle
                  className="h-4 w-4 text-yellow-500"
                  aria-label="Possible duplicate"
                />
              </div>
            )}
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={disabled || isLoading || !input.trim()}
            aria-label={isLoading ? "Adding item..." : "Add item"}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>

      {/* Duplicate warning modal */}
      {pendingSubmit && (
        <DuplicateWarning
          isOpen={showDuplicateWarning}
          onClose={handleCloseWarning}
          newItem={pendingSubmit.newItem}
          existingItem={pendingSubmit.existingItem}
          confidence={pendingSubmit.confidence}
          onMerge={handleMerge}
          onAddAnyway={handleAddAnyway}
        />
      )}
    </>
  );
}
